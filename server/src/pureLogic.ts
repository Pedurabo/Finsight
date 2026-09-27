export type ArithmeticOperation =
  | "difference"
  | "subtraction"
  | "ratio"
  | "percentage_change";

export function detectMetric(
  question: string,
): string | null {
  const normalized =
    question.toLowerCase();

  const knownMetrics = [
    "operating income",
    "net income",
    "gross margin",
    "cgpa",
    "gpa",
    "revenue",
    "profit",
    "income",
    "assets",
    "liabilities",
    "equity",
    "margin",
    "percentage",
    "percent",
    "score",
  ];

  return (
    knownMetrics.find((metric) =>
      normalized.includes(metric),
    ) ?? null
  );
}

export function detectRequestedRevenueQualifier(
  question: string,
): string | null {
  const match = question.match(
    /\b([A-Z][A-Za-z&-]*(?:\s+[A-Z][A-Za-z&-]*){0,5})\s+revenue\b/,
  );

  return match?.[1]?.trim() ?? null;
}

export function scopeDirectlyModifiesMetric(
  question: string,
  scope: string | null,
  metric: string,
): boolean {
  if (!scope) {
    return false;
  }

  const escapedScope =
    scope.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

  const escapedMetric =
    metric.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

  const pattern =
    new RegExp(
      `\\b${escapedScope}\\s+${escapedMetric}\\b`,
      "i",
    );

  return pattern.test(question);
}

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

export type RevisionConflictResolution<T> =
  | {
      status: "selected";
      candidate: T;
    }
  | {
      status: "ambiguous";
    };

export type RevisionAwareEvidenceCandidate = {
  value: string | number;
  context: string;
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
    return {
      status: "ambiguous",
    };
  }

  return {
    status: "selected",
    candidate:
      resolution.candidate.candidate,
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
    };
  }

  return {
    status: "ambiguous",
  };
}
export function detectDirectMetricScopes(
  question: string,
  metric: string,
  availableScopes?: string[],
): string[] {
  const fallbackScopes = [
    "productivity and business processes",
    "intelligent cloud",
    "more personal computing",
  ];

  const knownScopes =
    availableScopes?.length
      ? availableScopes
      : fallbackScopes;

  const escapedMetric =
    metric.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

  const matches: {
    scope: string;
    index: number;
  }[] = [];

  for (const scope of knownScopes) {
    const escapedScope =
      scope.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );

    const pattern =
      new RegExp(
        `\\b${escapedScope}\\s+${escapedMetric}\\b`,
        "i",
      );

    const match =
      pattern.exec(question);

    if (!match) {
      continue;
    }

    matches.push({
      scope,
      index: match.index,
    });
  }

  return matches
    .sort(
      (a, b) =>
        a.index - b.index,
    )
    .map(
      (match) =>
        match.scope,
    );
}
export function detectFinancialScope(
  question: string,
): string | null {
  const normalized =
    question.toLowerCase();

  const knownScopes = [
    "productivity and business processes",
    "intelligent cloud",
    "more personal computing",
  ];

  const metric =
    detectMetric(question);

  const presentScopes =
    knownScopes.filter((scope) =>
      normalized.includes(scope),
    );

  if (presentScopes.length === 0) {
    return null;
  }

  if (!metric) {
    return presentScopes.length === 1
      ? presentScopes[0]
      : null;
  }

  const metricIndex =
    normalized.indexOf(metric);

  if (metricIndex >= 0) {
    let nearestScope: string | null =
      null;

    let nearestScopeIndex = -1;

    for (const scope of presentScopes) {
      const scopeIndex =
        normalized.lastIndexOf(
          scope,
          metricIndex,
        );

      if (
        scopeIndex >= 0 &&
        scopeIndex > nearestScopeIndex
      ) {
        nearestScope = scope;
        nearestScopeIndex = scopeIndex;
      }
    }

    if (nearestScope) {
      return nearestScope;
    }
  }

  return presentScopes.length === 1
    ? presentScopes[0]
    : null;
}

export function detectArithmeticOperation(
  question: string,
): ArithmeticOperation | null {
  const normalized =
    question.toLowerCase();

  if (
    normalized.includes("percentage change") ||
    normalized.includes("percent change") ||
    normalized.includes("% change")
  ) {
    return "percentage_change";
  }

  if (
    normalized.includes(" minus ") ||
    normalized.includes("subtract") ||
    normalized.includes("subtracted from")
  ) {
    return "subtraction";
  }

  if (normalized.includes("difference")) {
    return "difference";
  }

  if (
    normalized.includes("ratio") ||
    normalized.includes("divided by")
  ) {
    return "ratio";
  }

  return null;
}

export function extractQuestionYears(
  question: string,
): string[] {
  return [
    ...question.matchAll(
      /\b(?:19|20)\d{2}\b/g,
    ),
  ].map((match) => match[0]);
}

export function computeArithmetic(
  operation: ArithmeticOperation,
  first: number,
  second: number,
): number | null {
  if (operation === "difference") {
    return Math.abs(first - second);
  }

  if (operation === "subtraction") {
    return first - second;
  }

  if (operation === "ratio") {
    if (second === 0) {
      return null;
    }

    return first / second;
  }

  if (operation === "percentage_change") {
    if (first === 0) {
      return null;
    }

    return ((second - first) / first) * 100;
  }

  return null;
}

export function shouldReverseSubtractionOperands(
  question: string,
  operation: ArithmeticOperation,
): boolean {
  return (
    operation === "subtraction" &&
    /\bfrom\b/i.test(question)
  );
}

export function hasExplicitRatioDirection(
  question: string,
  operation: ArithmeticOperation,
): boolean {
  if (operation !== "ratio") {
    return true;
  }

  return /\b(?:to|over|divided by)\b/i.test(
    question,
  );
}

export type CrossScopeArithmeticRequest = {
  scopes: [string, string];
  metric: string;
  year: string;
  operation: ArithmeticOperation;
};

export function parseCrossScopeArithmeticRequest(
  question: string,
  availableScopes?: string[],
): CrossScopeArithmeticRequest | null {
  const metric = detectMetric(question);

  if (!metric) {
    return null;
  }

  const scopes =
    detectDirectMetricScopes(
      question,
      metric,
      availableScopes,
    );

  if (scopes.length !== 2) {
    return null;
  }

  const years =
    extractQuestionYears(question);

  if (years.length !== 1) {
    return null;
  }

  const operation =
    detectArithmeticOperation(question);

  if (!operation) {
    return null;
  }

  if (
    operation === "percentage_change"
  ) {
    return null;
  }

  if (
    operation === "ratio" &&
    !hasExplicitRatioDirection(
      question,
      operation,
    )
  ) {
    return null;
  }

  return {
    scopes: [
      scopes[0],
      scopes[1],
    ],
    metric,
    year: years[0],
    operation,
  };
}

export function orderCrossScopeOperands(
  question: string,
  request: CrossScopeArithmeticRequest,
): [string, string] {
  const [firstScope, secondScope] =
    request.scopes;

  if (
    request.operation === "subtraction" &&
    shouldReverseSubtractionOperands(
      question,
      request.operation,
    )
  ) {
    return [
      secondScope,
      firstScope,
    ];
  }

  return [
    firstScope,
    secondScope,
  ];
}


export function extractDocumentScopeCandidates(
  text: string,
): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates: string[] = [];

  const metricPattern =
    /^(?:revenue|operating income|net income|gross margin)\b/i;

  const rejectedHeadingPattern =
    /^(?:segment results of operations|results of operations|income statements?|balance sheets?|cash flows?|\(?in millions\b.*|202\d\b)/i;

  for (let index = 1; index < lines.length; index++) {
    const line = lines[index];

    if (!metricPattern.test(line)) {
      continue;
    }

    const previous =
      lines[index - 1];

    if (
      !previous ||
      rejectedHeadingPattern.test(previous)
    ) {
      continue;
    }

    if (
      previous.length < 3 ||
      previous.length > 80
    ) {
      continue;
    }

    if (
      /[$%0-9]/.test(previous)
    ) {
      continue;
    }

    const normalized =
      previous
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    if (
      normalized &&
      !candidates.includes(normalized)
    ) {
      candidates.push(normalized);
    }
  }

  return candidates;
}




export function buildAvailableScopesFromTexts(
  texts: string[],
): string[] {
  const fallbackScopes = [
    "productivity and business processes",
    "intelligent cloud",
    "more personal computing",
  ];

  const documentScopes =
    texts.flatMap(
      (text) =>
        extractDocumentScopeCandidates(text),
    );

  return [
    ...new Set([
      ...fallbackScopes,
      ...documentScopes,
    ]),
  ];
}

export function selectArithmeticOperands<
  T extends {
    period: string | null;
  },
>(
  question: string,
  candidates: T[],
  operation: ArithmeticOperation,
):
  | {
      status: "selected";
      operands: [T, T];
    }
  | {
      status: "ambiguous";
      reason: string;
    } {
  const questionYears =
    extractQuestionYears(question);

  if (questionYears.length >= 2) {
    const firstYear =
      questionYears[0];

    const secondYear =
      questionYears[1];

    const firstMatches =
      candidates.filter(
        (operand) =>
          operand.period === firstYear,
      );

    const secondMatches =
      candidates.filter(
        (operand) =>
          operand.period === secondYear,
      );

    if (
      firstMatches.length !== 1 ||
      secondMatches.length !== 1
    ) {
      return {
        status: "ambiguous",
        reason:
          `FinSight could not uniquely bind the requested periods ${firstYear} and ${secondYear} to source values.`,
      };
    }

    return {
      status: "selected",
      operands: [
        firstMatches[0],
        secondMatches[0],
      ],
    };
  }

  if (candidates.length < 2) {
    return {
      status: "ambiguous",
      reason:
        "Fewer than two usable numeric operands were found.",
    };
  }

  if (candidates.length > 2) {
    return {
      status: "ambiguous",
      reason:
        `FinSight found ${candidates.length} plausible values and the question does not identify which two should be compared.`,
    };
  }

  if (operation === "difference") {
    return {
      status: "selected",
      operands: [
        candidates[0],
        candidates[1],
      ],
    };
  }

  return {
    status: "ambiguous",
    reason:
      `The ${operation.replace("_", " ")} operation requires an explicit operand order, but the question does not provide one.`,
  };
}



