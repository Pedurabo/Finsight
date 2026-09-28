export type FinancialEvidenceRevision =
  | "original"
  | "restated"
  | "unknown";

export function classifyFinancialEvidenceRevision(
  context: string,
): FinancialEvidenceRevision {
  const normalized =
    context.toLowerCase();

  const headingMatch =
    /\b(?:segment\s+)?results\s+of\s+operations\b/i.exec(
      context,
    );

  if (!headingMatch) {
    return "unknown";
  }

  const headingIndex =
    headingMatch.index;

  const beforeHeading =
    normalized.slice(
      Math.max(0, headingIndex - 24),
      headingIndex,
    );

  const headingAndAfter =
    normalized.slice(
      headingIndex,
      headingIndex + 100,
    );

  if (
    /\b(?:restated|revised)\s*$/.test(
      beforeHeading.trim(),
    ) ||
    /\bas\s+adjusted\b/.test(
      headingAndAfter,
    )
  ) {
    return "restated";
  }

  if (
    /\b(?:restated|revised)\b/.test(
      beforeHeading,
    )
  ) {
    return "unknown";
  }

  return "original";
}
export type RevisionTaggedEvidence = {
  value: string;
  revision: FinancialEvidenceRevision;
};

export type EvidenceSelectionPolicy =
  | "single_candidate"
  | "consistent_evidence"
  | "restatement_precedence"
  | "embedded_text_precedence";

export type RevisionConflictResolution<T> =
  | {
      status: "selected";
      candidate: T;
      selectionPolicy: EvidenceSelectionPolicy;
    }
  | {
      status: "ambiguous";
    };

export type RevisionAwareEvidenceCandidate = {
  value: string | number;
  context: string;
  source?: "embedded_text" | "ocr";
};

export function resolveRevisionAwareEvidenceCandidates<
  T extends RevisionAwareEvidenceCandidate,
>(
  candidates: T[],
): RevisionConflictResolution<T> {
  const taggedCandidates =
    candidates.map((candidate) => ({
      candidate,
      value: String(candidate.value),
      revision:
        classifyFinancialEvidenceRevision(
          candidate.context,
        ),
    }));

  const resolution =
    resolveFinancialEvidenceRevisionConflict(
      taggedCandidates,
    );

  if (resolution.status === "ambiguous") {
    const revisions =
      new Set(
        taggedCandidates.map(
          (candidate) => candidate.revision,
        ),
      );

    const hasKnownSources =
      candidates.every(
        (candidate) =>
          candidate.source === "embedded_text" ||
          candidate.source === "ocr",
      );

    if (
      revisions.size === 1 &&
      !revisions.has("unknown") &&
      hasKnownSources
    ) {
      const embeddedCandidates =
        taggedCandidates.filter(
          (candidate) =>
            candidate.candidate.source ===
            "embedded_text",
        );

      if (embeddedCandidates.length > 0) {
        const embeddedResolution =
          resolveFinancialEvidenceRevisionConflict(
            embeddedCandidates,
          );

        if (
          embeddedResolution.status ===
          "selected"
        ) {
          return {
            status: "selected",
            candidate:
              embeddedResolution.candidate
                .candidate,
            selectionPolicy:
              "embedded_text_precedence",
          };
        }
      }
    }

    return {
      status: "ambiguous",
    };
  }

  return {
    status: "selected",
    candidate:
      resolution.candidate.candidate,
    selectionPolicy:
      resolution.selectionPolicy,
  };
}

export function resolveFinancialEvidenceRevisionConflict<
  T extends RevisionTaggedEvidence,
>(
  candidates: T[],
): RevisionConflictResolution<T> {
  if (candidates.length === 0) {
    return {
      status: "ambiguous",
    };
  }

  if (candidates.length === 1) {
    return {
      status: "selected",
      candidate: candidates[0],
      selectionPolicy: "single_candidate",
    };
  }

  const distinctValues =
    new Set(
      candidates.map(
        (candidate) => candidate.value,
      ),
    );

  if (distinctValues.size === 1) {
    const preferred =
      candidates.find(
        (candidate) =>
          candidate.revision === "restated",
      ) ?? candidates[0];

    return {
      status: "selected",
      candidate: preferred,
      selectionPolicy: "consistent_evidence",
    };
  }

  if (
    candidates.some(
      (candidate) =>
        candidate.revision === "unknown",
    )
  ) {
    return {
      status: "ambiguous",
    };
  }

  const restatedCandidates =
    candidates.filter(
      (candidate) =>
        candidate.revision === "restated",
    );

  if (restatedCandidates.length === 1) {
    return {
      status: "selected",
      candidate: restatedCandidates[0],
      selectionPolicy: "restatement_precedence",
    };
  }

  return {
    status: "ambiguous",
  };
}


