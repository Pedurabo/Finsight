import type {
  CalculationResult,
  ReasonCode,
  VerificationResult,
} from "../types";

type AnswerCardProps = {
  calculation: CalculationResult | null;
  verification: VerificationResult | null;
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

export function AnswerCard({
  calculation,
  verification,
}: AnswerCardProps) {
  if (!calculation && !verification) {
    return null;
  }

  const supported =
    calculation?.status === "supported" ||
    verification?.status === "supported";

  const reasonGuidance = getReasonGuidance(
    calculation?.reasonCode ??
      verification?.reasonCode,
  );

  return (
    <section
      className={`answer-card ${
        supported
          ? "answer-supported"
          : "answer-insufficient"
      }`}
    >
      <div className="answer-header">
        <span className="answer-eyebrow">
          FinSight answer
        </span>

        <span className="answer-status">
          {supported
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
            {calculation.calculation.unit === "percent"
              ? "%"
              : ""}
            {calculation.calculation.currency
              ? ` ${calculation.calculation.currency}`
              : ""}
            {calculation.calculation.unit &&
            calculation.calculation.unit !== "percent"
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
  );
}
