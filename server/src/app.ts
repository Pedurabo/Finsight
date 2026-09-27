import {
  buildEvidenceSnippet,
  scoreEvidencePage,
  tokenizeSearchText,
} from "./retrieval";
import {
  extractDocxText,
  extractEmbeddedText,
  runOcr,
} from "./documentExtraction";
import {
  collectTableArithmeticOperands,
  extractFinancialTableValues,
  extractMetricValues,
  extractNumberNearMetric,
  type ArithmeticOperand,
  type ExtractedPage,
  type ExtractionSource,
} from "./financialEvidence";
import {
  resolveRevisionAwareEvidenceCandidates,
  resolveFinancialEvidenceRevisionConflict,
  classifyFinancialEvidenceRevision,
  computeArithmetic,
  detectArithmeticOperation,
  detectDirectMetricScopes,
  detectFinancialScope,
  detectMetric,
  detectRequestedRevenueQualifier,
  extractQuestionYears,
  selectArithmeticOperands,
  type ArithmeticOperation,
  buildAvailableScopesFromTexts,
  hasExplicitRatioDirection,
  parseCrossScopeArithmeticRequest,
  orderCrossScopeOperands,
  scopeDirectlyModifiesMetric,
  shouldReverseSubtractionOperands,
} from "./pureLogic";
import express from "express";
import cors from "cors";
import multer from "multer";
import * as mammoth from "mammoth";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const app = express();

const uploadsDirectory = path.resolve("uploads");
const extractedDirectory = path.resolve("extracted");

fs.mkdirSync(uploadsDirectory, { recursive: true });
fs.mkdirSync(extractedDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsDirectory);
  },

  filename: (_req, file, callback) => {
    const safeName = file.originalname.replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );

    callback(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 30 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    const lowerName =
      file.originalname.toLowerCase();

    const isPdf =
      file.mimetype === "application/pdf" ||
      lowerName.endsWith(".pdf");

    const isDocx =
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerName.endsWith(".docx");

    if (!isPdf && !isDocx) {
      callback(
        new Error(
          "FinSight accepts PDF and DOCX documents.",
        ),
      );
      return;
    }

    callback(null, true);
  },
});

type VerificationStatus =
  | "supported"
  | "insufficient_evidence";

type DirectNumericClaim = {
  metric: string;
  value: string;
  currency: string | null;
  unit: string | null;
  period: string | null;
  pageNumber: number;
  source: ExtractionSource;
  snippet: string;
};

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "finsight-server",
  });
});

app.post(
  "/api/documents",
  upload.single("document"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({
          error: "No PDF or DOCX document was uploaded.",
        });

        return;
      }

      const lowerName =
        req.file.originalname.toLowerCase();

      const isDocx =
        lowerName.endsWith(".docx");

      const isPdf =
        lowerName.endsWith(".pdf");

      let pages =
        isDocx
          ? await extractDocxText(req.file.path)
          : await extractEmbeddedText(req.file.path);
      const embeddedTextPages = pages.filter(
        (page) => page.text.trim().length > 20,
      ).length;

      const initialTextCoverage =
        pages.length === 0
          ? 0
          : embeddedTextPages / pages.length;

      let ocrUsed = false;

      if (isPdf && initialTextCoverage < 1) {
        const ocrResult =
          await runOcr(req.file.path);

        const ocrPagesByNumber = new Map(
          ocrResult.pages.map((page) => [
            page.pageNumber,
            page,
          ]),
        );

        pages = pages.map((page) => {
          if (page.text.trim().length > 20) {
            return page;
          }

          const ocrPage =
            ocrPagesByNumber.get(page.pageNumber);

          if (
            ocrPage &&
            ocrPage.text.trim().length > 0
          ) {
            ocrUsed = true;

            return {
              pageNumber: page.pageNumber,
              text: ocrPage.text,
              source: "ocr",
            };
          }

          return page;
        });
      }

      const nonEmptyPages = pages.filter(
        (page) => page.text.trim().length > 20,
      ).length;

      const textCoverage =
        pages.length === 0
          ? 0
          : nonEmptyPages / pages.length;

      let extractionStatus:
        | "complete"
        | "partial"
        | "ocr_required";

      if (textCoverage === 0) {
        extractionStatus = "ocr_required";
      } else if (textCoverage < 0.8) {
        extractionStatus = "partial";
      } else {
        extractionStatus = "complete";
      }

      const extraction = {
        documentId: req.file.filename,
        originalName: req.file.originalname,
        pageCount: pages.length,
        nonEmptyPages,
        textCoverage,
        extractionStatus,
        ocrUsed,
        pages,
      };

      const extractionPath = path.join(
        extractedDirectory,
        `${req.file.filename}.json`,
      );

      fs.writeFileSync(
        extractionPath,
        JSON.stringify(extraction, null, 2),
        "utf8",
      );

      res.status(201).json({
        id: req.file.filename,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        size: req.file.size,
        mimeType: req.file.mimetype,
        pageCount: pages.length,
        nonEmptyPages,
        textCoverage,
        extractionStatus,
        ocrUsed,
      });
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  "/api/documents/:id/pages",
  (req, res) => {
    const documentId = path.basename(req.params.id);

    const extractionPath = path.join(
      extractedDirectory,
      `${documentId}.json`,
    );

    if (!fs.existsSync(extractionPath)) {
      res.status(404).json({
        error: "Extraction not found.",
      });

      return;
    }

    const extraction = JSON.parse(
      fs.readFileSync(extractionPath, "utf8"),
    );

    res.json(extraction);
  },
);

app.post(
  "/api/documents/:id/search",
  (req, res) => {
    const question =
      typeof req.body?.question === "string"
        ? req.body.question.trim()
        : "";

    if (!question) {
      res.status(400).json({
        error: "A question is required.",
      });

      return;
    }

    const documentId = req.params.id;
    const safeDocumentId =
      path.basename(documentId);

    if (safeDocumentId !== documentId) {
      res.status(400).json({
        error: "Invalid document identifier.",
      });

      return;
    }

    const extractionPath = path.join(
      extractedDirectory,
      `${safeDocumentId}.json`,
    );

    if (!fs.existsSync(extractionPath)) {
      res.status(404).json({
        error: "Document extraction not found.",
      });

      return;
    }

    const extraction = JSON.parse(
      fs.readFileSync(extractionPath, "utf8"),
    ) as {
      pageCount: number;
      pages: ExtractedPage[];
    };

    const queryTokens =
      tokenizeSearchText(question);

    const results = extraction.pages
      .map((page) => {
        const score = scoreEvidencePage(
          page.text,
          question,
          queryTokens,
        );

        return {
          pageNumber: page.pageNumber,
          source: page.source,
          score,
          snippet: buildEvidenceSnippet(
            page.text,
            queryTokens,
          ),
        };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    res.json({
      documentId: safeDocumentId,
      question,
      queryTokens,
      resultCount: results.length,
      results,
    });
  },
);


app.post(
  "/api/documents/:id/verify",
  (req, res) => {
    const question =
      typeof req.body?.question === "string"
        ? req.body.question.trim()
        : "";

    if (!question) {
      res.status(400).json({
        error: "A question is required.",
      });
      return;
    }

    const documentId = req.params.id;
    const safeDocumentId = path.basename(documentId);

    if (safeDocumentId !== documentId) {
      res.status(400).json({
        error: "Invalid document identifier.",
      });
      return;
    }

    const extractionPath = path.join(
      extractedDirectory,
      `${safeDocumentId}.json`,
    );

    if (!fs.existsSync(extractionPath)) {
      res.status(404).json({
        error: "Document extraction not found.",
      });
      return;
    }

    const extraction = JSON.parse(
      fs.readFileSync(extractionPath, "utf8"),
    ) as {
      pages: ExtractedPage[];
    };

    const metric = detectMetric(question);

    if (!metric) {
      res.json({
        status: "insufficient_evidence",
        reason:
          "No supported numeric metric could be identified in the question.",
        claim: null,
      });
      return;
    }

    const availableScopes =
      buildAvailableScopesFromTexts(
        extraction.pages.map(
          (page) => page.text,
        ),
      );

    const directMetricScopes =
      detectDirectMetricScopes(
        question,
        metric,
        availableScopes,
      );

    if (directMetricScopes.length > 1) {
      res.json({
        status: "insufficient_evidence",
        reason:
          `FinSight detected multiple requested scopes for ${metric.toUpperCase()} (${directMetricScopes.join(", ")}). A single-value verification cannot resolve multiple scopes.`,
        claim: null,
      });
      return;
    }

    const financialScope =
      directMetricScopes.length === 1
        ? directMetricScopes[0]
        : detectFinancialScope(question);

    const requestedRevenueQualifier =
      metric === "revenue"
        ? detectRequestedRevenueQualifier(
            question,
          )
        : null;

    if (
      requestedRevenueQualifier &&
      !scopeDirectlyModifiesMetric(
        question,
        financialScope,
        metric,
      )
    ) {
      res.json({
        status: "insufficient_evidence",
        reason:
          `FinSight detected the requested revenue scope "${requestedRevenueQualifier}", but that scope is not currently supported.`,
        claim: null,
      });
      return;
    }
    const queryTokens = tokenizeSearchText(question);

    const rankedPages = extraction.pages
      .map((page) => ({
        ...page,
        score: scoreEvidencePage(
          page.text,
          question,
          queryTokens,
        ),
      }))
      .filter((page) => page.score > 0)
      .sort((a, b) => b.score - a.score);

    const requestedYearsAcrossPages =
      extractQuestionYears(question);

    if (requestedYearsAcrossPages.length === 1) {
      const requestedYear =
        requestedYearsAcrossPages[0];

      const tableEvidenceAcrossPages =
        rankedPages.flatMap((page) =>
          extractFinancialTableValues(
            metric,
            page.text,
            financialScope,
            availableScopes,
          )
            .filter(
              (candidate) =>
                candidate.period === requestedYear,
            )
            .map((match) => ({
              page,
              match,
            })),
        );

      const revisionResolution =
        resolveRevisionAwareEvidenceCandidates(
          tableEvidenceAcrossPages.map(
            ({ page, match }) => ({
              page,
              match,
              value: match.value,
              context: match.context,
            }),
          ),
        );
      if (
        tableEvidenceAcrossPages.length > 0 &&
        revisionResolution.status === "ambiguous"
      ) {
        res.json({
          status: "insufficient_evidence",
          reason:
            `FinSight found conflicting ${metric.toUpperCase()} values associated with ${requestedYear} across multiple pages and could not resolve them under the revision-evidence policy.`,
          claim: null,
        });

        return;
      }

      if (revisionResolution.status === "selected") {
        const {
          page,
          match: tableMatch,
          revision,
        } = revisionResolution.candidate;

        res.json({
          status: "supported",
          reason:
            revision === "restated"
              ? "FinSight selected explicit restated financial-table evidence under the revision-evidence policy."
              : "FinSight bound the requested metric and period using consistent financial-table evidence across the document.",
          claim: {
            metric: metric.toUpperCase(),
            value: tableMatch.value,
            currency: tableMatch.currency,
            unit: tableMatch.unit,
            period: tableMatch.period,
            pageNumber: page.pageNumber,
            source: page.source,
            snippet: tableMatch.context,
          },
        });

        return;
      }
    }
    for (const page of rankedPages) {
      const requestedYears =
        extractQuestionYears(question);

      if (requestedYears.length === 1) {
        const requestedYear =
          requestedYears[0];

        const tableMatches =
          extractFinancialTableValues(
            metric,
            page.text,
            financialScope,
            availableScopes,
          ).filter(
            (candidate) =>
              candidate.period ===
              requestedYear,
          );

        if (tableMatches.length === 1) {
          const tableMatch =
            tableMatches[0];

          res.json({
            status: "supported",
            reason:
              "FinSight bound the requested metric and period using a nearby financial-table header.",
            claim: {
              metric:
                metric.toUpperCase(),
              value:
                tableMatch.value,
              currency:
                tableMatch.currency,
              unit:
                tableMatch.unit,
              period:
                tableMatch.period,
              pageNumber:
                page.pageNumber,
              source:
                page.source,
              snippet:
                tableMatch.context,
            },
          });

          return;
        }

        if (tableMatches.length > 1) {
          res.json({
            status:
              "insufficient_evidence",
            reason:
              `FinSight found multiple distinct ${metric.toUpperCase()} values associated with ${requestedYear} and cannot choose one safely.`,
            claim: null,
          });

          return;
        }

        // A year was explicitly requested.
        // Do not fall back to an unbound number.
        continue;
      }
      const numericMatch =
        extractNumberNearMetric(
          metric,
          page.text,
        );

      if (!numericMatch) {
        continue;
      }

      res.json({
        status: "supported",
        reason:
          "A numeric value was bound to the requested metric with available financial provenance.",
        claim: {
          metric: metric.toUpperCase(),
          value: numericMatch.value,
          currency: numericMatch.currency,
          unit: numericMatch.unit,
          period: numericMatch.period,
          pageNumber: page.pageNumber,
          source: page.source,
          snippet: numericMatch.context,
        },
      });

      return;
    }

    res.json({
      status: "insufficient_evidence",
      reason:
        `FinSight found relevant evidence but could not verify a numeric value for ${metric.toUpperCase()}.`,
      claim: null,
    });
  },
);


app.post(
  "/api/documents/:id/calculate",
  (req, res) => {
    const question =
      typeof req.body?.question === "string"
        ? req.body.question.trim()
        : "";

    if (!question) {
      res.status(400).json({
        error: "A question is required.",
      });
      return;
    }

    const safeDocumentId =
      path.basename(req.params.id);

    const extractionPath = path.join(
      extractedDirectory,
      `${safeDocumentId}.json`,
    );

    if (!fs.existsSync(extractionPath)) {
      res.status(404).json({
        error: "Document extraction not found.",
      });
      return;
    }

    const extraction = JSON.parse(
      fs.readFileSync(extractionPath, "utf8"),
    ) as {
      pages: ExtractedPage[];
    };

    const operation =
      detectArithmeticOperation(question);

    if (!operation) {
      res.json({
        status: "insufficient_evidence",
        reason:
          "No supported arithmetic operation was identified.",
        calculation: null,
      });
      return;
    }

    const metric = detectMetric(question);

    if (!metric) {
      res.json({
        status: "insufficient_evidence",
        reason:
          "No supported numeric metric could be identified.",
        calculation: null,
      });
      return;
    }

    const availableScopes =
      buildAvailableScopesFromTexts(
        extraction.pages.map(
          (page) => page.text,
        ),
      );

    const directMetricScopes =
      detectDirectMetricScopes(
        question,
        metric,
        availableScopes,
      );

    if (directMetricScopes.length > 1) {
      const crossScopeRequest =
        parseCrossScopeArithmeticRequest(
          question,
          availableScopes,
        );

      if (!crossScopeRequest) {
        res.json({
          status: "insufficient_evidence",
          reason:
            `FinSight detected multiple requested scopes for ${metric.toUpperCase()} (${directMetricScopes.join(", ")}), but the cross-scope request is ambiguous or unsupported.`,
          candidates: [],
          calculation: null,
        });
        return;
      }

      const orderedScopes =
        orderCrossScopeOperands(
          question,
          crossScopeRequest,
        );

      const resolvedOperands:
        ArithmeticOperand[] = [];

      for (const scope of orderedScopes) {
        const dedupedScopedOperands =
          collectTableArithmeticOperands(
            extraction.pages,
            metric,
            scope,
            [crossScopeRequest.year],
            `${scope.toUpperCase()} ${metric.toUpperCase()}`,
            availableScopes,
          );

        const scopedResolution =
          resolveRevisionAwareEvidenceCandidates(
            dedupedScopedOperands,
          );
        if (
          scopedResolution.status === "ambiguous"
        ) {
          res.json({
            status: "insufficient_evidence",
            reason:
              `FinSight could not uniquely resolve ${metric.toUpperCase()} for ${scope} in ${crossScopeRequest.year} under the revision-evidence policy.`,
            candidates:
              dedupedScopedOperands,
            calculation: null,
          });
          return;
        }

        resolvedOperands.push(
          scopedResolution.candidate,
        );
      }

      const [
        first,
        second,
      ] = resolvedOperands;

      if (
        first.currency &&
        second.currency &&
        first.currency !== second.currency
      ) {
        res.json({
          status:
            "insufficient_evidence",
          reason:
            "The requested cross-scope values use different currencies.",
          candidates:
            resolvedOperands,
          calculation:
            null,
        });
        return;
      }

      if (
        first.unit &&
        second.unit &&
        first.unit !== second.unit
      ) {
        res.json({
          status:
            "insufficient_evidence",
          reason:
            "The requested cross-scope values use different units.",
          candidates:
            resolvedOperands,
          calculation:
            null,
        });
        return;
      }

      const result =
        computeArithmetic(
          crossScopeRequest.operation,
          first.value,
          second.value,
        );

      if (result === null) {
        res.json({
          status:
            "insufficient_evidence",
          reason:
            "The requested cross-scope calculation could not be performed safely.",
          candidates:
            resolvedOperands,
          calculation:
            null,
        });
        return;
      }

      res.json({
        status: "supported",
        reason:
          "FinSight computed the result deterministically from two scope-bound financial-table operands.",
        calculation: {
          metric:
            metric.toUpperCase(),
          operation:
            crossScopeRequest.operation,
          operands:
            resolvedOperands,
          result:
            Number(
              result.toFixed(4),
            ),
          currency:
            crossScopeRequest.operation ===
              "difference" ||
            crossScopeRequest.operation ===
              "subtraction"
              ? first.currency ??
                second.currency ??
                null
              : null,
          unit:
            crossScopeRequest.operation ===
            "ratio"
              ? null
              : first.unit ??
                second.unit ??
                null,
          reportedValue:
            null,
          roundingConsistent:
            null,
        },
      });
      return;
    }
    const financialScope =
      directMetricScopes.length === 1
        ? directMetricScopes[0]
        : detectFinancialScope(question);

    const requestedRevenueQualifier =
      metric === "revenue"
        ? detectRequestedRevenueQualifier(
            question,
          )
        : null;

    if (
      requestedRevenueQualifier &&
      !scopeDirectlyModifiesMetric(
        question,
        financialScope,
        metric,
      )
    ) {
      res.json({
        status: "insufficient_evidence",
        reason:
          `FinSight detected the requested revenue scope "${requestedRevenueQualifier}", but that scope is not currently supported.`,
        candidates: [],
        calculation: null,
      });
      return;
    }

    const requestedYears =
      extractQuestionYears(question);

    if (requestedYears.length >= 2) {
      const firstYear =
        requestedYears[0];

      const secondYear =
        requestedYears[1];

      if (
        !hasExplicitRatioDirection(
          question,
          operation,
        )
      ) {
        res.json({
          status:
            "insufficient_evidence",
          reason:
            "The ratio operation requires an explicit operand order, but the question does not provide one.",
          candidates: [],
          calculation:
            null,
        });

        return;
      }

      const dedupedOperands =
        collectTableArithmeticOperands(
          extraction.pages,
          metric,
          financialScope,
          [firstYear, secondYear],
          metric.toUpperCase(),
          availableScopes,
        );

      const firstCandidates =
        dedupedOperands.filter(
          (operand) =>
            operand.period === firstYear,
        );

      const secondCandidates =
        dedupedOperands.filter(
          (operand) =>
            operand.period === secondYear,
        );

      const resolvePeriodCandidates = (
        candidates: typeof dedupedOperands,
      ) =>
        resolveRevisionAwareEvidenceCandidates(
          candidates,
        );
      const firstResolution =
        resolvePeriodCandidates(firstCandidates);

      const secondResolution =
        resolvePeriodCandidates(secondCandidates);

      if (
        firstResolution.status === "ambiguous" ||
        secondResolution.status === "ambiguous"
      ) {
        res.json({
          status:
            "insufficient_evidence",
          reason:
            `FinSight could not uniquely resolve ${metric.toUpperCase()} values for both requested periods (${firstYear} and ${secondYear}) under the revision-evidence policy.`,
          candidates:
            dedupedOperands,
          calculation:
            null,
        });

        return;
      }

      let first =
        firstResolution.candidate;

      let second =
        secondResolution.candidate;
      if (
        shouldReverseSubtractionOperands(
          question,
          operation,
        )
      ) {
        [first, second] =
          [second, first];
      }

      if (
        first.currency &&
        second.currency &&
        first.currency !== second.currency
      ) {
        res.json({
          status:
            "insufficient_evidence",
          reason:
            "The requested values use different currencies.",
          candidates:
            [first, second],
          calculation:
            null,
        });

        return;
      }

      if (
        first.unit &&
        second.unit &&
        first.unit !== second.unit
      ) {
        res.json({
          status:
            "insufficient_evidence",
          reason:
            "The requested values use different units.",
          candidates:
            [first, second],
          calculation:
            null,
        });

        return;
      }

      const result =
        computeArithmetic(
          operation,
          first.value,
          second.value,
        );

      if (result === null) {
        res.json({
          status:
            "insufficient_evidence",
          reason:
            "The requested calculation could not be performed safely with the resolved operands.",
          candidates:
            [first, second],
          calculation:
            null,
        });

        return;
      }

      let reportedValue: number | null =
        null;

      let roundingConsistent: boolean | null =
        null;

      if (operation === "percentage_change") {
        // A reported table percentage normally describes the newer
        // column relative to the older column. Compare it with our
        // computed percentage only when the requested direction
        // matches that table direction.
        const reportedDirectionPattern =
          new RegExp(
            `\\b${secondYear}\\s+${firstYear}\\b`,
          );

        const canCompareReportedPercentage =
          reportedDirectionPattern.test(
            first.context,
          );

        if (!canCompareReportedPercentage) {
          reportedValue = null;
          roundingConsistent = null;
        } else {
        const escapedMetric =
          metric.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          );

        const escapedScope =
          financialScope?.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          ) ?? null;

        const reportedMetricPattern =
          escapedScope
            ? `${escapedScope}.{0,500}?\\b${escapedMetric}\\b`
            : `\\b${escapedMetric}\\b`;
        const reportedPattern =
          new RegExp(
            `${reportedMetricPattern}\\s*` +
              `\\$?\\s*[0-9][0-9,]*(?:\\.[0-9]+)?\\s+` +
              `\\$?\\s*[0-9][0-9,]*(?:\\.[0-9]+)?\\s+` +
              `([0-9]+(?:\\.[0-9]+)?)\\s*%`,
            "i",
          );
        const reportedMatch =
          first.context.match(
            reportedPattern,
          );

        if (reportedMatch?.[1]) {
          reportedValue =
            Number(reportedMatch[1]);

          if (
            Number.isFinite(
              reportedValue,
            )
          ) {
            roundingConsistent =
              Math.round(result) ===
              Math.round(
                reportedValue,
              );
          }
        }
        }
      }

      res.json({
        status: "supported",
        reason:
          "FinSight computed the result deterministically from period-bound financial-table operands.",
        calculation: {
          metric:
            metric.toUpperCase(),
          operation,
          operands:
            [first, second],
          result:
            Number(
              result.toFixed(4),
            ),
          currency:
            operation === "difference" ||
            operation === "subtraction"
              ? first.currency ??
                second.currency ??
                null
              : null,
          unit:
            operation === "percentage_change"
              ? "percent"
              : operation === "ratio"
                ? null
                : first.unit ??
                  second.unit ??
                  null,
          reportedValue,
          roundingConsistent,
        },
      });

      return;
    }
    const operands = extractMetricValues(
      metric,
      extraction.pages,
    );

    const selection = selectArithmeticOperands(
      question,
      operands,
      operation,
    );
    if (selection.status === "ambiguous") {
      res.json({
        status: "insufficient_evidence",
        reason: selection.reason,
        candidates: operands,
        calculation: null,
      });
      return;
    }

    const [first, second] =
      selection.operands;

    const result = computeArithmetic(
      operation,
      first.value,
      second.value,
    );

    if (result === null) {
      res.json({
        status: "insufficient_evidence",
        reason:
          "The requested calculation could not be completed safely.",
        calculation: null,
      });
      return;
    }

    res.json({
      status: "supported",
      reason:
        "FinSight computed the result deterministically from two source-backed numeric operands.",
      calculation: {
        metric: metric.toUpperCase(),
        operation,
        operands: [first, second],
        result: Number(result.toFixed(4)),
      },
    });
  },
);

app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error);

    res.status(400).json({
      error: error.message,
    

});
  },
);








































