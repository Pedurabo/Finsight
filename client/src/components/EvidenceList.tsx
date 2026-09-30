import type { EvidenceResult } from "../types";

type EvidenceListProps = {
  evidence: EvidenceResult[];
};

export function EvidenceList({
  evidence,
}: EvidenceListProps) {
  return (
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
                  Score {result.score.toFixed(2)}
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
          <p>No evidence retrieved yet.</p>
          <span>
            Relevant source passages and page
            references will appear here.
          </span>
        </div>
      )}
    </div>
  );
}
