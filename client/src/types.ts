export type UploadedDocument = {
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

export type CalculationOperand = {
  label: string;
  value: number;
  pageNumber: number;
  source: "embedded_text" | "ocr";
  period: string | null;
  currency?: string | null;
  unit?: string | null;
  context: string;
};

export type ReasonCode =
  | "unsupported_intent"
  | "unsupported_metric"
  | "unsupported_scope"
  | "ambiguous_request"
  | "missing_evidence"
  | "conflicting_evidence"
  | "incompatible_metadata"
  | "unsafe_calculation";

export type CalculationResult = {
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

export type VerificationResult = {
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

export type EvidenceResult = {
  pageNumber: number;
  source: "embedded_text" | "ocr";
  score: number;
  snippet: string;
};
