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

export * from "./evidencePolicy";
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

export function normalizeFinancialOperandPair(
  first: {
    value: number;
    currency?: string | null;
    unit?: string | null;
    currencyStatus?:
      | "known"
      | "unknown"
      | "ambiguous";
    unitStatus?:
      | "known"
      | "unknown"
      | "ambiguous";
  },
  second: {
    value: number;
    currency?: string | null;
    unit?: string | null;
    currencyStatus?:
      | "known"
      | "unknown"
      | "ambiguous";
    unitStatus?:
      | "known"
      | "unknown"
      | "ambiguous";
  },
):
  | {
      status: "compatible";
      firstValue: number;
      secondValue: number;
      unit: string | null;
    }
  | {
      status: "incompatible";
    } {
  if (
    first.currencyStatus === "ambiguous" ||
    second.currencyStatus === "ambiguous" ||
    first.unitStatus === "ambiguous" ||
    second.unitStatus === "ambiguous"
  ) {
    return {
      status: "incompatible",
    };
  }

  const firstCurrency =
    first.currency ?? null;

  const secondCurrency =
    second.currency ?? null;

  if (firstCurrency !== secondCurrency) {
    return {
      status: "incompatible",
    };
  }

  const firstUnit =
    first.unit ?? null;

  const secondUnit =
    second.unit ?? null;

  if (firstUnit === secondUnit) {
    return {
      status: "compatible",
      firstValue: first.value,
      secondValue: second.value,
      unit: firstUnit,
    };
  }

  if (
    firstUnit === null ||
    secondUnit === null
  ) {
    return {
      status: "incompatible",
    };
  }

  const scaleFactors: Record<string, number> = {
    thousand: 1_000,
    million: 1_000_000,
    billion: 1_000_000_000,
  };

  const firstScale =
    scaleFactors[firstUnit];

  const secondScale =
    scaleFactors[secondUnit];

  if (
    firstScale === undefined ||
    secondScale === undefined
  ) {
    return {
      status: "incompatible",
    };
  }

  return {
    status: "compatible",
    firstValue: first.value,
    secondValue:
      second.value *
      (secondScale / firstScale),
    unit: firstUnit,
  };
}
export function haveCompatibleFinancialMetadata(
  first: {
    currency?: string | null;
    unit?: string | null;
  },
  second: {
    currency?: string | null;
    unit?: string | null;
  },
): boolean {
  if (
    first.currencyStatus === "ambiguous" ||
    second.currencyStatus === "ambiguous" ||
    first.unitStatus === "ambiguous" ||
    second.unitStatus === "ambiguous"
  ) {
    return {
      status: "incompatible",
    };
  }

  const firstCurrency =
    first.currency ?? null;

  const secondCurrency =
    second.currency ?? null;

  const firstUnit =
    first.unit ?? null;

  const secondUnit =
    second.unit ?? null;

  return (
    firstCurrency === secondCurrency &&
    firstUnit === secondUnit
  );
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
    /^(?:revenue|operating income|net income|gross margin|assets|liabilities|equity)\b/i;

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












export function exceedsDocumentPageLimit(
  pageCount: number,
  maxPages = 500,
): boolean {
  return pageCount > maxPages;
}
