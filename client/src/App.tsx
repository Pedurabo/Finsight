import {
  useRef,
  useState,
} from "react";
import type { ChangeEvent } from "react";
import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://127.0.0.1:3001";
type UploadedDocument = {
  id: string;
  originalName: string;
  storedName: string;
  size: number;
  mimeType: string;
  pageCount: number;
  nonEmptyPages?: number;
  textCoverage?: number;
  extractionStatus:
    | "complete"
    | "partial"
    | "ocr_required";
  ocrUsed?: boolean;
};

type CalculationOperand = {
  label: string;
  value: number;
  pageNumber: number;
  source: "embedded_text" | "ocr";
  period: string | null;
  currency?: string | null;
  unit?: string | null;
  context: string;
};

type ReasonCode =
  | "unsupported_intent"
  | "unsupported_metric"
  | "unsupported_scope"
  | "ambiguous_request"
  | "missing_evidence"
  | "conflicting_evidence"
  | "incompatible_metadata"
  | "unsafe_calculation";
type CalculationResult = {
  status: "supported" | "insufficient_evidence";
  reason: string;
  reasonCode?: ReasonCode;
  calculation: {
    metric: string;
    operation:
      | "difference"
      | "ratio"
      | "percentage_change";
    operands: CalculationOperand[];
    result: number;
  currency?: string | null;
  unit?: string | null;
  reportedValue?: number | null;
  roundingConsistent?: boolean | null;
  } | null;
};

type VerificationResult = {
  status: "supported" | "insufficient_evidence";
  reason: string;
  reasonCode?: ReasonCode;
  claim: {
    metric: string;
    value: string;
    pageNumber: number;
    source: "embedded_text" | "ocr";
    snippet: string;
  } | null;
};

type EvidenceResult = {
  pageNumber: number;
  source: "embedded_text" | "ocr";
  score: number;
  snippet: string;
};

function getReasonGuidance(reasonCode?: ReasonCode) {
  switch (reasonCode) {
    case "missing_evidence":
      return {
        title: "Required evidence is missing",
        action:
          "Try a different metric, period, or scope that is explicitly reported in the document.",
      };

    case "conflicting_evidence":
      return {
        title: "Conflicting values were found",
        action:
          "Review the evidence below. FinSight will not choose between unresolved conflicting values.",
      };

    case "incompatible_metadata":
      return {
        title: "Financial metadata does not match",
        action:
          "The values may use incompatible currencies, units, or scales and cannot be combined safely.",
      };

    case "ambiguous_request":
      return {
        title: "The request is ambiguous",
        action:
          "Specify the metric, period, scope, and calculation direction more explicitly.",
      };

    case "unsupported_metric":
      return {
        title: "That metric is not supported",
        action:
          "Ask about a supported metric such as revenue, operating income, net income, gross margin, assets, liabilities, or equity.",
      };

    case "unsupported_scope":
      return {
        title: "That scope is not supported by the evidence",
        action:
          "Use a business segment, region, or scope that appears explicitly in the document.",
      };

    case "unsupported_intent":
      return {
        title: "FinSight could not identify a supported calculation",
        action:
          "Try asking for a value, difference, ratio, subtraction, or percentage change.",
      };

    case "unsafe_calculation":
      return {
        title: "The calculation cannot be completed safely",
        action:
          "Review the requested operands and periods. FinSight will abstain when arithmetic would be unreliable.",
      };

    default:
      return {
        title: "FinSight could not safely verify an answer",
        action:
          "Review the retrieved evidence or make the question more specific.",
      };
  }
}
function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

function App() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [document, setDocument] =
    useState<UploadedDocument | null>(null);

  const [uploadError, setUploadError] =
    useState("");

  const [isUploading, setIsUploading] =
    useState(false);

  const [question, setQuestion] =
    useState("");

  const [evidence, setEvidence] =
    useState<EvidenceResult[]>([]);

  const [isSearching, setIsSearching] =
    useState(false);

  const [searchError, setSearchError] = useState("");
  const [verification, setVerification] =
    useState<VerificationResult | null>(null);

  const [calculation, setCalculation] =
    useState<CalculationResult | null>(null);

  const handleChooseDocument = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const lowerName =
      file.name.toLowerCase();

    const isPdf =
      file.type === "application/pdf" ||
      lowerName.endsWith(".pdf");

    const isDocx =
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lowerName.endsWith(".docx");

    if (!isPdf && !isDocx) {
      setUploadError(
        "FinSight accepts PDF and DOCX documents.",
      );

      event.target.value = "";
      return;
    }

    setUploadError("");
    setSearchError("");
    setEvidence([]);
    setVerification(null);
    setCalculation(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("document", file);

      const response = await fetch(
        `${API_BASE_URL}/api/documents`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Document upload failed.",
        );
      }

      setDocument(data);
    } catch (error) {
      setDocument(null);

      setUploadError(
        error instanceof Error
          ? error.message
          : "Could not upload the document.",
      );
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleRemoveDocument = () => {
    setDocument(null);
    setQuestion("");
    setEvidence([]);
    setVerification(null);
    setCalculation(null);
    setSearchError("");
    setUploadError("");
  };

  const handleAnalyze = async () => {
    if (!document) {
      setSearchError("No document is loaded.");
      return;
    }

    if (!question.trim()) {
      setSearchError("Enter a question before analyzing.");
      return;
    }

    setIsSearching(true);
    setSearchError("");
    setEvidence([]);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/documents/${encodeURIComponent(
          document.id,
        )}/search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: question.trim(),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Evidence search failed.",
        );
      }

      setEvidence(data.results ?? []);
      const calculationResponse = await fetch(
        `${API_BASE_URL}/api/documents/${encodeURIComponent(
          document.id,
        )}/calculate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: question.trim(),
          }),
        },
      );

      const calculationData =
        await calculationResponse.json();

      if (!calculationResponse.ok) {
        throw new Error(
          calculationData.error ??
            "Calculation verification failed.",
        );
      }

      if (calculationData.status === "supported") {
        setCalculation(calculationData);
        setVerification(null);
      } else {
        setCalculation(null);

        const verificationResponse = await fetch(
          `${API_BASE_URL}/api/documents/${encodeURIComponent(
            document.id,
          )}/verify`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              question: question.trim(),
            }),
          },
        );

        const verificationData =
          await verificationResponse.json();

        if (!verificationResponse.ok) {
          throw new Error(
            verificationData.error ??
              "Verification failed.",
          );
        }

        setVerification(verificationData);
      }
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "Could not retrieve evidence.",
      );
    } finally {
      setIsSearching(false);
    }
  };
  const activeReasonCode =
    calculation?.reasonCode ??
    verification?.reasonCode;

  const reasonGuidance =
    getReasonGuidance(activeReasonCode);


  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>FinSight</h1>
          <p>Research Workbench</p>
        </div>
      </header>

      <main className="workspace">
        <aside className="panel sources-panel">
          <h2>Sources</h2>

          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
            onChange={handleFileChange}
          />

          <button
            className="primary-button"
            type="button"
            onClick={handleChooseDocument}
            disabled={isUploading}
          >
            {isUploading
              ? "Uploading..."
              : document
                ? "Change document"
                : "Upload document"}
          </button>

          {uploadError && (
            <div
              className="error-message"
              role="alert"
            >
              {uploadError}
            </div>
          )}

          {document ? (
            <div className="document-card">
              <div className="document-icon">
                {document.originalName
                  .toLowerCase()
                  .endsWith(".docx")
                  ? "DOCX"
                  : "PDF"}
              </div>

              <div className="document-details">
                <strong>
                  {document.originalName}
                </strong>

                <span>
                  {formatFileSize(document.size)}
                </span>

                <span>
                  Stored by FinSight
                </span>

                {document.extractionStatus ===
                "ocr_required" ? (
                  <span className="extraction-warning">
                    {document.pageCount} pages
                    detected · OCR still required
                  </span>
                ) : document.extractionStatus ===
                  "partial" ? (
                  <span className="extraction-warning">
                    {document.nonEmptyPages ?? 0} of{" "}
                    {document.pageCount} pages
                    recovered
                    {document.ocrUsed
                      ? " · OCR used"
                      : ""}
                  </span>
                ) : (
                  <span className="extraction-success">
                    {document.pageCount} pages
                    extracted
                    {document.ocrUsed
                      ? " · OCR used"
                      : ""}
                  </span>
                )}
              </div>

              <button
                className="remove-button"
                type="button"
                onClick={handleRemoveDocument}
              >
                Remove from workbench
              </button>
            </div>
          ) : (
            <div className="empty-state">
              <p>
                No documents loaded yet.
              </p>
              <span>
                Upload a financial report to
                begin analysis.
              </span>
            </div>
          )}
        </aside>

        <section className="panel question-panel">
          <h2>Question</h2>

          <textarea
            placeholder="Ask a question about the uploaded document..."
            rows={5}
            value={question}
            onChange={(event) =>
              setQuestion(event.target.value)
            }
            disabled={!document}
          />

          <button
            className="primary-button"
            type="button"
            disabled={!document || isSearching}
            onClick={handleAnalyze}
          >
            {isSearching
              ? "Retrieving evidence..."
              : "Analyze"}
          </button>

          {searchError && (
            <div
              className="error-message"
              role="alert"
            >
              {searchError}
            </div>
          )}

          {(calculation || verification) && (
            <section
              className={`answer-card ${
                calculation?.status === "supported" ||
                verification?.status === "supported"
                  ? "answer-supported"
                  : "answer-insufficient"
              }`}
            >
              <div className="answer-header">
                <span className="answer-eyebrow">
                  FinSight answer
                </span>

                <span className="answer-status">
                  {calculation?.status === "supported" ||
                  verification?.status === "supported"
                    ? "Supported"
                    : "Insufficient evidence"}
                </span>
              </div>

              {calculation?.calculation ? (
                <>
                  <p className="answer-metric">
                    {calculation.calculation.metric}
                  </p>

                  <p className="answer-value">
                    {calculation.calculation.result}
                    {calculation.calculation.unit ===
                    "percent"
                      ? "%"
                      : ""}
                    {calculation.calculation.currency
                      ? ` ${calculation.calculation.currency}`
                      : ""}
                    {calculation.calculation.unit &&
                    calculation.calculation.unit !==
                      "percent"
                      ? ` ${calculation.calculation.unit}`
                      : ""}
                  </p>

                  <p className="answer-reason">
                    {calculation.reason}
                  </p>
                </>
              ) : verification?.claim ? (
                <>
                  <p className="answer-metric">
                    {verification.claim.metric}
                  </p>

                  <p className="answer-value">
                    {verification.claim.value}
                  </p>

                  <p className="answer-reason">
                    {verification.reason}
                  </p>

                  <p className="answer-citation">
                    Page {verification.claim.pageNumber} ·{" "}
                    {verification.claim.source === "ocr"
                      ? "OCR"
                      : "Embedded text"}
                  </p>
                </>
              ) : (
                <>
                  <p className="answer-value answer-message">
                    {reasonGuidance.title}
                  </p>

                  <p className="answer-guidance">
                    {reasonGuidance.action}
                  </p>

                  <p className="answer-reason">
                    {verification?.reason ??
                      calculation?.reason}
                  </p>
                </>
              )}
            </section>
          )}
          <div className="evidence-section">
            <h3>Retrieved evidence</h3>

            {evidence.length > 0 ? (
              <div className="evidence-list">
                {evidence.map((result) => (
                  <article
                    className="evidence-card"
                    key={result.pageNumber}
                  >
                    <div className="evidence-header">
                      <strong>
                        Page {result.pageNumber}
                      </strong>

                      <span>
                        Score{" "}
                        {result.score.toFixed(2)}
                      </span>
                    </div>

                    <p>{result.snippet}</p>

                    <span className="evidence-source">
                      Source:{" "}
                      {result.source === "ocr"
                        ? "OCR"
                        : "Embedded text"}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>
                  No evidence retrieved yet.
                </p>
                <span>
                  Relevant source passages and
                  page references will appear
                  here.
                </span>
              </div>
            )}
          </div>
        </section>

        <aside className="panel verification-panel">
          <h2>Provenance</h2>
<div className="provenance-section">
            <h3>Evidence details</h3>

            {calculation?.calculation ? (
              <>
                <p>
                  <strong>Metric:</strong>{" "}
                  {calculation.calculation.metric}
                </p>

                <p>
                  <strong>Operation:</strong>{" "}
                  {calculation.calculation.operation
                    .replace("_", " ")
                    .replace(/\b\w/g, (letter) =>
                      letter.toUpperCase(),
                    )}
                </p>

                {calculation.calculation.operands.map(
                  (operand, index) => (
                    <div
                      className="operand-card"
                      key={`${operand.pageNumber}-${index}`}
                    >
                      <strong>
                        Operand {index + 1}
                      </strong>

                      <span>
                        {operand.label}: {operand.value}
                      </span>

                      {operand.period && (
                        <span>
                          <strong>Period:</strong>{" "}
                          {operand.period}
                        </span>
                      )}

                      {operand.currency && (
                        <span>
                          <strong>Currency:</strong>{" "}
                          {operand.currency}
                        </span>
                      )}

                      {operand.unit && (
                        <span>
                          <strong>Unit:</strong>{" "}
                          {operand.unit}
                        </span>
                      )}

                      <span>
                        <strong>Page:</strong>{" "}
                        {operand.pageNumber}
                      </span>

                      <span>
                        <strong>Source:</strong>{" "}
                        {operand.source === "ocr"
                          ? "OCR"
                          : "Embedded text"}
                      </span>

                      {operand.context && (
                        <p className="operand-context">
                          <strong>Context:</strong>{" "}
                          {operand.context}
                        </p>
                      )}
                    </div>
                  ),
                )}

                <div className="calculation-summary">
                  <p className="calculation-result">
                    <strong>Result:</strong>{" "}
                    {calculation.calculation.result}
                    {calculation.calculation.unit ===
                    "percent"
                      ? "%"
                      : ""}
                  </p>

                  {calculation.calculation.currency && (
                    <p>
                      <strong>Currency:</strong>{" "}
                      {calculation.calculation.currency}
                    </p>
                  )}

                  {calculation.calculation.unit &&
                    calculation.calculation.unit !==
                      "percent" && (
                      <p>
                        <strong>Unit:</strong>{" "}
                        {calculation.calculation.unit}
                      </p>
                    )}

                  {calculation.calculation
                    .reportedValue != null && (
                    <p>
                      <strong>
                        Reported value:
                      </strong>{" "}
                      {
                        calculation.calculation
                          .reportedValue
                      }
                      %
                    </p>
                  )}

                  {calculation.calculation
                    .roundingConsistent != null && (
                    <p>
                      <strong>
                        Rounding check:
                      </strong>{" "}
                      {calculation.calculation
                        .roundingConsistent
                        ? "Consistent"
                        : "Mismatch"}
                    </p>
                  )}
                </div>

                <p>
                  <strong>Reason:</strong>{" "}
                  {calculation.reason}
                </p>
              </>
            ) : verification?.claim ? (
              <>
                <p>
                  <strong>Metric:</strong>{" "}
                  {verification.claim.metric}
                </p>

                <p>
                  <strong>Value:</strong>{" "}
                  {verification.claim.value}
                </p>

                <p>
                  <strong>Page:</strong>{" "}
                  {verification.claim.pageNumber}
                </p>

                <p>
                  <strong>Source:</strong>{" "}
                  {verification.claim.source === "ocr"
                    ? "OCR"
                    : "Embedded text"}
                </p>

                <p>
                  <strong>Reason:</strong>{" "}
                  {verification.reason}
                </p>
              </>
            ) : (
              <p>
                {calculation?.reason ??
                  verification?.reason ??
                  "Source values, periods, units, calculations, and citations will be shown here."}
              </p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;


















