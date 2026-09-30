import { AnswerCard } from "./AnswerCard";
import { EvidenceList } from "./EvidenceList";
import type {
  CalculationResult,
  EvidenceResult,
  UploadedDocument,
  VerificationResult,
} from "../types";

type QuestionPanelProps = {
  document: UploadedDocument | null;
  question: string;
  searchError: string;
  isSearching: boolean;
  calculation: CalculationResult | null;
  verification: VerificationResult | null;
  evidence: EvidenceResult[];
  onQuestionChange: (value: string) => void;
  onAnalyze: () => void;
};

export function QuestionPanel({
  document,
  question,
  searchError,
  isSearching,
  calculation,
  verification,
  evidence,
  onQuestionChange,
  onAnalyze,
}: QuestionPanelProps) {
  return (
    <section className="panel question-panel">
      <h2>Question</h2>

      <textarea
        placeholder="Ask a question about the uploaded document..."
        rows={5}
        value={question}
        onChange={(event) =>
          onQuestionChange(event.target.value)
        }
        disabled={!document}
      />

      <button
        className="primary-button"
        type="button"
        disabled={!document || isSearching}
        onClick={onAnalyze}
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

      <AnswerCard
        calculation={calculation}
        verification={verification}
      />

      <EvidenceList evidence={evidence} />
    </section>
  );
}
