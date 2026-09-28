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
  normalizeFinancialOperandPair,
  detectArithmeticOperation,
  detectDirectMetricScopes,
  detectFinancialScope,
  detectMetric,
  detectRequestedRevenueQualifier,
  extractQuestionYears,
  selectArithmeticOperands,
  type ArithmeticOperation,
  type EvidenceSelectionPolicy,
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

const MAX_QUESTION_LENGTH = 2000;

function readExtractionJson<T>(
  extractionPath: string,
): T | null {
  try {
    const parsed: unknown =
      JSON.parse(
        fs.readFileSync(
          extractionPath,
          "utf8",
        ),
      );

    if (
      typeof parsed !== "object" ||
      parsed === null
    ) {
      return null;
    }

    const pages =
      (parsed as { pages?: unknown }).pages;

    if (!Array.isArray(pages)) {
      return null;
    }

    const pagesAreValid =
      pages.every((page) => {
        if (
          typeof page !== "object" ||
          page === null
        ) {
          return false;
        }

        const candidate =
          page as {
            pageNumber?: unknown;
            source?: unknown;
            text?: unknown;
          };

        return (
          typeof candidate.pageNumber === "number" &&
          Number.isFinite(candidate.pageNumber) &&
          (
            candidate.source === "embedded_text" ||
            candidate.source === "ocr"
          ) &&
          typeof candidate.text === "string"
        );
      });

    if (!pagesAreValid) {
      return null;
    }

    return parsed as T;
  } catch {
    return null;
  }
}

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

    const extraction =
      readExtractionJson<unknown>(
        extractionPath,
      );

    if (!extraction) {
      res.status(500).json({
        error: "Document extraction is invalid.",
      });
      return;
    }

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
    if (question.length > MAX_QUESTION_LENGTH) {
      res.status(400).json({
        error: "Question exceeds maximum length.",
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

    const extraction =
      readExtractionJson<{
        pageCount: number;
        pages: ExtractedPage[];
      }>(extractionPath);

    if (!extraction) {
      res.status(500).json({
        error: "Document extraction is invalid.",
      });
      return;
    }

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
    if (question.length > MAX_QUESTION_LENGTH) {
      res.status(400).json({
        error: "Question exceeds maximum length.",
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

    const extraction =
      readExtractionJson<{
        pages: ExtractedPage[];
      }>(extractionPath);

    if (!extraction) {
      res.status(500).json({
        error: "Document extraction is invalid.",
      });
      return;
    }

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
              source: page.source,
              revision:
                classifyFinancialEvidenceRevision(
                  match.context,
                ),
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
          reasonCode: "conflicting_evidence",
          candidates:
            tableEvidenceAcrossPages.map(
              ({ page, match }) => ({
                value: match.value,
                currency: match.currency,
                currencyStatus:
                  match.currencyStatus,
                unit: match.unit,
                unitStatus:
                  match.unitStatus,
                period: match.period,
                pageNumber:
                  page.pageNumber,
                source: page.source,
                revision:
                  classifyFinancialEvidenceRevision(
                    match.context,
                  ),
                snippet: match.context,
              }),
            ),
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
            revision,
            selectionPolicy: revisionResolution.selectionPolicy,
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
    if (question.length > MAX_QUESTION_LENGTH) {
      res.status(400).json({
        error: "Question exceeds maximum length.",
      });
      return;
    }

    const documentId =
      req.params.id;

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

    const extraction =
      readExtractionJson<{
        pages: ExtractedPage[];
      }>(extractionPath);

    if (!extraction) {
      res.status(500).json({
        error: "Document extraction is invalid.",
      });
      return;
    }

    const operation =
      detectArithmeticOperation(question);

    if (!operation) {
      res.json({
        status: "insufficient_evidence",
        reason:
          "No supported arithmetic operation was identified.",
        reasonCode: "unsupported_intent",
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
        reasonCode: "unsupported_metric",
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
          reasonCode: "ambiguous_request",
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
        (ArithmeticOperand & {
          selectionPolicy: EvidenceSelectionPolicy;
        })[] = [];

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

        resolvedOperands.push({
          ...scopedResolution.candidate,
          selectionPolicy:
            scopedResolution.selectionPolicy,
        });
      }

      const [
        first,
        second,
      ] = resolvedOperands;
      const normalized =
        normalizeFinancialOperandPair(
          first,
          second,
        );

      if (
        normalized.status ===
        "incompatible"
      ) {
        res.json({
          status:
            "insufficient_evidence",
          reason:
            "The requested cross-scope values do not have compatible currency and unit metadata.",
          reasonCode: "incompatible_metadata",
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
          normalized.firstValue,
          normalized.secondValue,
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
              : normalized.unit,
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
        reasonCode: "unsupported_scope",
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
          reasonCode: "ambiguous_request",
          candidates: [],
          calculation: null,
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

      
      if (
        firstCandidates.length === 0 ||
        secondCandidates.length === 0
      ) {
        res.json({
          status: "insufficient_evidence",
          reason:
            `FinSight could not find sufficient ${metric.toUpperCase()} evidence for both requested periods (${firstYear} and ${secondYear}).`,
          reasonCode: "missing_evidence",
          candidates:
            dedupedOperands,
          calculation: null,
        });

        return;
      }
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
          reasonCode: "conflicting_evidence",
          candidates:
            dedupedOperands,
          calculation:
            null,
        });

        return;
      }

      let first = {
        ...firstResolution.candidate,
        selectionPolicy:
          firstResolution.selectionPolicy,
      };

      let second = {
        ...secondResolution.candidate,
        selectionPolicy:
          secondResolution.selectionPolicy,
      };
      if (
        shouldReverseSubtractionOperands(
          question,
          operation,
        )
      ) {
        [first, second] =
          [second, first];
      }
      const normalized =
        normalizeFinancialOperandPair(
          first,
          second,
        );

      if (
        normalized.status ===
        "incompatible"
      ) {
        res.json({
          status:
            "insufficient_evidence",
          reason:
            "The requested values do not have compatible currency and unit metadata.",
          reasonCode: "incompatible_metadata",
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
          normalized.firstValue,
          normalized.secondValue,
        );

      if (result === null) {
        res.json({
          status:
            "insufficient_evidence",
          reason:
            "The requested calculation could not be performed safely with the resolved operands.",
          reasonCode: "unsafe_calculation",
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
                : normalized.unit,
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
      const normalized =
        normalizeFinancialOperandPair(
          first,
          second,
        );

      if (
        normalized.status ===
        "incompatible"
      ) {
        res.json({
          status:
            "insufficient_evidence",
          reason:
            "The requested values do not have compatible currency and unit metadata.",
          reasonCode: "incompatible_metadata",
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
          normalized.firstValue,
          normalized.secondValue,
        );

    if (result === null) {
      res.json({
        status: "insufficient_evidence",
        reason:
          "The requested calculation could not be completed safely.",
        reasonCode: "unsafe_calculation",
        candidates:
          [first, second],
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






















































































