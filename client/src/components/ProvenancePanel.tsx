import type {
  CalculationResult,
  VerificationResult,
} from "../types";

type ProvenancePanelProps = {
  calculation: CalculationResult | null;
  verification: VerificationResult | null;
};

export function ProvenancePanel({
  calculation,
  verification,
}: ProvenancePanelProps) {
  return (
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
                  <strong>Reported value:</strong>{" "}
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
                  <strong>Rounding check:</strong>{" "}
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
  );
}
