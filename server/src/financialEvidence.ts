import { classifyFinancialEvidenceRevision } from "./evidencePolicy";

export type ExtractionSource =
  | "embedded_text"
  | "ocr";

export type ExtractedPage = {
  pageNumber: number;
  text: string;
  source: ExtractionSource;
};

export type DirectNumericMatch = {
  value: string;
  currency: string | null;
  currencyStatus:
    | "known"
    | "unknown"
    | "ambiguous";
  unit: string | null;
  unitStatus:
    | "known"
    | "unknown"
    | "ambiguous";
  period: string | null;
  context: string;
};

const SUPPORTED_CURRENCY_CODES = new Set([
  "AED", "AFN", "ALL", "AMD", "AOA", "ARS", "AUD", "AWG", "AZN",
  "BAM", "BBD", "BDT", "BHD", "BIF", "BMD", "BND", "BOB", "BRL",
  "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP",
  "CNY", "COP", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP",
  "DZD", "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL",
  "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HTG",
  "HUF", "IDR", "ILS", "INR", "IQD", "IRR", "ISK", "JMD", "JOD",
  "JPY", "KES", "KGS", "KHR", "KMF", "KPW", "KRW", "KWD", "KYD",
  "KZT", "LAK", "LBP", "LKR", "LRD", "LSL", "LYD", "MAD", "MDL",
  "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR", "MVR", "MWK",
  "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD",
  "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR",
  "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK",
  "SGD", "SHP", "SLE", "SOS", "SRD", "SSP", "STN", "SVC", "SYP",
  "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD",
  "TZS", "UAH", "UGX", "USD", "UYU", "UZS", "VES", "VND", "VUV",
  "WST", "XAF", "XCD", "XCG", "XOF", "XPF", "YER", "ZAR", "ZMW",
  "ZWG",
]);

export function extractFinancialTableValues(
  metric: string,
  text: string,
  requestedScope: string | null = null,
  availableScopes?: string[],
): DirectNumericMatch[] {
  const escapedMetric = metric.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  // Require the metric to behave like a financial-table row:
  //
  // Revenue $281,724 $245,122 15%
  //
  // This deliberately avoids prose such as:
  // "Microsoft 365 Commercial revenue is mainly affected..."
  const rowPattern = new RegExp(
    `\\b${escapedMetric}\\b\\s*[:=\\-]?\\s*\\$?\\s*` +
      `(\\([0-9][0-9,]*(?:\\.[0-9]+)?\\)|-?[0-9][0-9,]*(?:\\.[0-9]+)?)\\s+` +
      `\\$?\\s*(\\([0-9][0-9,]*(?:\\.[0-9]+)?\\)|-?[0-9][0-9,]*(?:\\.[0-9]+)?)`,
    "gi",
  );

  const results: DirectNumericMatch[] = [];

  for (const rowMatch of text.matchAll(rowPattern)) {
    const rowIndex =
      rowMatch.index ?? 0;

    const prefixStart = Math.max(
      0,
      rowIndex - 160,
    );

    const immediatePrefix = text
      .slice(prefixStart, rowIndex)
      .replace(/\s+/g, " ")
      .toLowerCase();

    const structuralContextStart =
      Math.max(
        0,
        rowIndex - 320,
      );

    const structuralContext = text
      .slice(
        structuralContextStart,
        rowIndex,
      )
      .replace(/\s+/g, " ")
      .toLowerCase();

    const isProForma =
      structuralContext.includes(
        "pro forma",
      );

    if (isProForma) {
      continue;
    }

    // Scope belongs to the financial row independently of metric.
    // Bind the row to the nearest preceding recognized segment
    // heading before applying metric-specific filtering.
    if (requestedScope) {
      const scopeContextStart = Math.max(
        0,
        rowIndex - 1400,
      );

      const scopeContext = text
        .slice(
          scopeContextStart,
          rowIndex,
        )
        .toLowerCase();

      const fallbackScopes = [
        "productivity and business processes",
        "intelligent cloud",
        "more personal computing",
      ];

      const knownScopes = [
        ...new Set([
          ...fallbackScopes,
          ...(availableScopes ?? []),
          requestedScope.toLowerCase(),
        ]),
      ];

      let nearestScope: string | null =
        null;

      let nearestScopeIndex = -1;

      for (const scope of knownScopes) {
        const scopeIndex =
          scopeContext.lastIndexOf(
            scope,
          );

        if (
          scopeIndex >
          nearestScopeIndex
        ) {
          nearestScope =
            scope;

          nearestScopeIndex =
            scopeIndex;
        }
      }

      const nearestScopeDistance =
        nearestScopeIndex >= 0
          ? scopeContext.length -
            nearestScopeIndex
          : null;

      if (
        nearestScope !==
          requestedScope.toLowerCase() ||
        nearestScopeDistance === null ||
        nearestScopeDistance > 500
      ) {
        continue;
      }
    }

    if (metric.toLowerCase() === "revenue") {
      const isCostRevenue =
        /cost of\s*$/.test(
          immediatePrefix,
        );

      const isUnearnedRevenue =
        /unearned\s*$/.test(
          immediatePrefix,
        );

      if (
        isCostRevenue ||
        isUnearnedRevenue
      ) {
        continue;
      }

      // An explicitly scoped row was already bound above.
      // For generic revenue, retain only consolidated/total rows.
      if (!requestedScope) {
        const isTotalRevenue =
          /total\s*$/.test(
            immediatePrefix,
          );

        const isSummaryRevenue =
          structuralContext.includes(
            "summary results of operations",
          );

        if (
          !isTotalRevenue &&
          !isSummaryRevenue
        ) {
          continue;
        }
      }
    }
    const firstValue =
      rowMatch[1];

    const secondValue =
      rowMatch[2];

    const normalizeTableValue = (
      value: string,
    ): string => {
      const trimmed = value.trim();

      const isParenthesized =
        trimmed.startsWith("(") &&
        trimmed.endsWith(")");

      const normalized =
        trimmed.replace(
          /[(),]/g,
          "",
        );

      return isParenthesized
        ? `-${normalized}`
        : normalized;
    };

    let headerStart = Math.max(
      0,
      rowIndex - 260,
    );

    let headerText = text.slice(
      headerStart,
      rowIndex,
    );

    let allYears =
      headerText.match(
        /\b(?:19|20)\d{2}\b/g,
      ) ?? [];

    // Segment rows may be separated from the table header by
    // preceding segment rows. Only for an explicitly scoped
    // metric, widen the backward search until two periods are
    // available, while keeping the row itself scope-bound.
    if (
      requestedScope &&
      new Set(allYears).size < 2
    ) {
      const fallbackWindows = [
        520,
        780,
        1040,
        1300,
      ];

      for (
        const windowSize of fallbackWindows
      ) {
        headerStart = Math.max(
          0,
          rowIndex - windowSize,
        );

        headerText = text.slice(
          headerStart,
          rowIndex,
        );

        allYears =
          headerText.match(
            /\b(?:19|20)\d{2}\b/g,
          ) ?? [];

        if (
          new Set(allYears).size >= 2
        ) {
          break;
        }
      }
    }

    const distinctYears = [
      ...new Set(allYears),
    ];

    if (distinctYears.length < 2) {
      continue;
    }

    // Financial tables commonly expose:
    //
    // 2025 2024
    // or
    // 2025 2024 2023
    //
    // The first numeric row values correspond to the
    // first columns, so retain the most recent header
    // group and bind its first two periods.
    const recentYears =
      distinctYears.slice(-3);

    const years =
      recentYears.slice(0, 2);

    const contextEnd = Math.min(
      text.length,
      rowIndex +
        rowMatch[0].length +
        140,
    );

    const context = text
      .slice(
        headerStart,
        contextEnd,
      )
      .replace(/\s+/g, " ")
      .trim();

    // Metadata such as table scale and currency may appear
    // above the metric row, so use a slightly wider window
    // than the evidence snippet itself.
    const metadataStart =
      Math.max(
        0,
        rowIndex - 380,
      );

    const metadataContext =
      text.slice(
        metadataStart,
        contextEnd,
      );

    // Period binding and table-scale provenance are separate.
    // Search farther backward for the nearest explicit table scale,
    // even if the period header was found earlier.
    const scaleStart = Math.max(
      0,
      rowIndex - 1400,
    );

    const scaleContext = text.slice(
      scaleStart,
      rowIndex,
    );

    const explicitScaleMatches = [
      ...scaleContext.matchAll(
        /\bin\s+(thousand|million|billion)s?\b/gi,
      ),
    ];

    const explicitScales = [
      ...new Set(
        explicitScaleMatches.map(
          (match) =>
            match[1].toLowerCase(),
        ),
      ),
    ];

    const fallbackUnitMatch =
      metadataContext.match(
        /\b(thousand|million|billion)s?\b/i,
      );

    const unit =
      explicitScales.length > 1
        ? null
        : explicitScales.length === 1
          ? explicitScales[0]
          : fallbackUnitMatch?.[1]?.toLowerCase() ??
            null;
    const explicitCurrencyCodes = [
      ...new Set(
        (
          metadataContext.match(
            /\b[A-Z]{3}\b/gi,
          ) ?? []
        )
          .map((code) =>
            code.toUpperCase(),
          )
          .filter((code) =>
            SUPPORTED_CURRENCY_CODES.has(
              code,
            ),
          ),
      ),
    ];

    const currency =
      explicitCurrencyCodes.length > 1
        ? null
        : explicitCurrencyCodes.length === 1
          ? explicitCurrencyCodes[0]
          : (
              rowMatch[0].includes("$") ||
              metadataContext.includes("$")
                ? "USD"
                : null
            );    const currencyStatus:
      | "known"
      | "unknown"
      | "ambiguous" =
      explicitCurrencyCodes.length > 1
        ? "ambiguous"
        : currency !== null
          ? "known"
          : "unknown";

    const unitStatus:
      | "known"
      | "unknown"
      | "ambiguous" =
      explicitScales.length > 1
        ? "ambiguous"
        : unit !== null
          ? "known"
          : "unknown";



    results.push(
      {
        value: normalizeTableValue(
          firstValue,
        ),
        currency,
        currencyStatus,
        unit,
        period: years[0],
        unitStatus,
        context,
      },
      {
        value: normalizeTableValue(
          secondValue,
        ),
        currency,
        currencyStatus,
        unit,
        period: years[1],
        unitStatus,
        context,
      },
    );
  }

  // Repeated tables or summaries can contain the same
  // metric/year/value more than once. Those are corroborating
  // duplicates, not separate competing claims.
  const unique = new Map<
    string,
    DirectNumericMatch
  >();

  for (const result of results) {
    // Repeated occurrences of the same year/value are
    // corroborating evidence, not competing claims.
    const key = [
      result.period,
      result.value,
    ].join("|");

    const existing =
      unique.get(key);

    if (!existing) {
      unique.set(key, result);
      continue;
    }

    // Prefer whichever duplicate preserves richer provenance.
    const escapedMetricForPreference =
      metric.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );

    const reportedRowPattern =
      new RegExp(
        `\\b${escapedMetricForPreference}\\b\\s*` +
          `\\$?\\s*[0-9][0-9,]*(?:\\.[0-9]+)?\\s+` +
          `\\$?\\s*[0-9][0-9,]*(?:\\.[0-9]+)?\\s+` +
          `[0-9]+(?:\\.[0-9]+)?\\s*%`,
        "i",
      );

    const existingScore =
      (existing.currency ? 1 : 0) +
      (existing.unit ? 1 : 0) +
      (reportedRowPattern.test(existing.context)
        ? 2
        : 0);

    const resultScore =
      (result.currency ? 1 : 0) +
      (result.unit ? 1 : 0) +
      (reportedRowPattern.test(result.context)
        ? 2
        : 0);

    if (resultScore > existingScore) {
      unique.set(key, result);
    }
  }

  return [...unique.values()];
}

export type ArithmeticOperand = {
  label: string;
  value: number;
  pageNumber: number;
  source: ExtractionSource;
  period: string | null;
  revision: "original" | "restated" | "unknown";
  currency?: string | null;
  currencyStatus?:
    | "known"
    | "unknown"
    | "ambiguous";
  unit?: string | null;
  unitStatus?:
    | "known"
    | "unknown"
    | "ambiguous";
  context: string;
};
export function collectTableArithmeticOperands(
  pages: ExtractedPage[],
  metric: string,
  requestedScope: string | null,
  requestedPeriods: string[],
  label: string,
  availableScopes?: string[],
): ArithmeticOperand[] {
  const operands: ArithmeticOperand[] = [];

  for (const page of pages) {
    const matches =
      extractFinancialTableValues(
        metric,
        page.text,
        requestedScope,
        availableScopes,
      );

    for (const match of matches) {
      if (
        requestedPeriods.length > 0 &&
        !requestedPeriods.includes(
          match.period ?? "",
        )
      ) {
        continue;
      }

      const numericValue =
        Number(match.value);

      if (!Number.isFinite(numericValue)) {
        continue;
      }

      operands.push({
        label,
        value: numericValue,
        pageNumber: page.pageNumber,
        source: page.source,
        period: match.period,
        currency: match.currency,
        currencyStatus:
          match.currencyStatus,
        unit: match.unit,
        unitStatus:
          match.unitStatus,
        context: match.context,
        revision:
          classifyFinancialEvidenceRevision(
            match.context,
          ),
      });
    }
  }

  const uniqueOperands: ArithmeticOperand[] = [];

  for (const operand of operands) {
    const matchingIndex =
      uniqueOperands.findIndex((existing) => {
        if (
          existing.period !== operand.period ||
          existing.value !== operand.value
        ) {
          return false;
        }

        
        if (
          existing.revision !==
          operand.revision
        ) {
          return false;
        }
const exactMetadataMatch =
          (existing.currency ?? null) ===
            (operand.currency ?? null) &&
          (existing.currencyStatus ?? null) ===
            (operand.currencyStatus ?? null) &&
          (existing.unit ?? null) ===
            (operand.unit ?? null) &&
          (existing.unitStatus ?? null) ===
            (operand.unitStatus ?? null);

        if (exactMetadataMatch) {
          return true;
        }

        const hasAmbiguousMetadata =
          existing.currencyStatus === "ambiguous" ||
          operand.currencyStatus === "ambiguous" ||
          existing.unitStatus === "ambiguous" ||
          operand.unitStatus === "ambiguous";

        if (hasAmbiguousMetadata) {
          return false;
        }

        const currenciesCompatible =
          existing.currency == null ||
          operand.currency == null ||
          existing.currency === operand.currency;

        const unitsCompatible =
          existing.unit == null ||
          operand.unit == null ||
          existing.unit === operand.unit;

        return (
          currenciesCompatible &&
          unitsCompatible
        );
      });

    if (matchingIndex === -1) {
      uniqueOperands.push(operand);
      continue;
    }

    const existing =
      uniqueOperands[matchingIndex];

    const existingScore =
      (existing.currency ? 1 : 0) +
      (existing.unit ? 1 : 0);

    const operandScore =
    (operand.currency ? 1 : 0) +
    (operand.unit ? 1 : 0);

  const shouldPreferOperand =
    operandScore > existingScore ||
    (
      operandScore === existingScore &&
      existing.source === "ocr" &&
      operand.source === "embedded_text"
    );

  if (shouldPreferOperand) {
    uniqueOperands[matchingIndex] =
      operand;
  }
  }

  return uniqueOperands;
}



export function extractNumberNearMetric(
  metric: string,
  text: string,
): DirectNumericMatch | null {
  const escapedMetric = metric.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const numberPattern =
    "([0-9][0-9,]*(?:\\.[0-9]+)?)";

  const patterns = [
    new RegExp(
      `\\b${escapedMetric}\\b\\s*[:=\\-]?\\s*(\\$)?\\s*${numberPattern}\\s*(thousand|million|billion)?`,
      "i",
    ),

    new RegExp(
      `\\b${escapedMetric}\\b\\s+(?:was|were|is|are|totaled|totalled|reached|stood\\s+at)\\s+(\\$)?\\s*${numberPattern}\\s*(thousand|million|billion)?`,
      "i",
    ),

    new RegExp(
      `\\b${escapedMetric}\\b\\s+of\\s+(\\$)?\\s*${numberPattern}\\s*(thousand|million|billion)?`,
      "i",
    ),

    new RegExp(
      `\\b${escapedMetric}\\b\\s+(?:increased|grew|rose|climbed)\\s+to\\s+(\\$)?\\s*${numberPattern}\\s*(thousand|million|billion)?`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);

    if (!match?.[2]) {
      continue;
    }

    const matchIndex =
      match.index ?? 0;

    const contextStart = Math.max(
      0,
      matchIndex - 180,
    );

    const contextEnd = Math.min(
      text.length,
      matchIndex + match[0].length + 180,
    );

    const context = text
      .slice(contextStart, contextEnd)
      .replace(/\s+/g, " ")
      .trim();

    const immediateUnit =
      match[3]?.toLowerCase() ?? null;

    const contextualUnitMatch =
      context.match(
        /\b(?:in\s+)?(thousand|million|billion)s?\b/i,
      );

    const unit =
      immediateUnit ??
      contextualUnitMatch?.[1]?.toLowerCase() ??
      null;

    const currency =
      match[1] === "$" ||
      context.includes("$")
        ? "USD"
        : null;

    const contextYears = [
      ...new Set(
        context.match(/\b(?:19|20)\d{2}\b/g) ?? [],
      ),
    ];

    const period =
      contextYears.length === 1
        ? contextYears[0]
        : null;
    return {
      value: match[2].replace(/,/g, ""),
      currency,
      currencyStatus:
        currency !== null
          ? "known"
          : "unknown",
      unit,
      unitStatus:
        unit !== null
          ? "known"
          : "unknown",
      period,
      context,
    };
  }

  return null;
}

export function resolveNearestPeriod(
  pageText: string,
  matchIndex: number,
  matchLength: number,
): string | null {
  const windowStart = Math.max(
    0,
    matchIndex - 160,
  );

  const windowEnd = Math.min(
    pageText.length,
    matchIndex + matchLength + 160,
  );

  const windowText = pageText.slice(
    windowStart,
    windowEnd,
  );

  const yearPattern = /\b(?:19|20)\d{2}\b/g;

  const matches = [
    ...windowText.matchAll(yearPattern),
  ];

  if (matches.length === 0) {
    return null;
  }

  const metricCenter =
    matchIndex +
    matchLength / 2 -
    windowStart;

  const ranked = matches
    .map((match) => {
      const yearIndex =
        match.index ?? 0;

      const yearCenter =
        yearIndex +
        match[0].length / 2;

      return {
        year: match[0],
        distance: Math.abs(
          yearCenter - metricCenter,
        ),
      };
    })
    .sort(
      (a, b) =>
        a.distance - b.distance,
    );

  if (
    ranked.length > 1 &&
    ranked[0].distance === ranked[1].distance
  ) {
    return null;
  }

  return ranked[0].year;
}
export function extractMetricValues(
  metric: string,
  pages: ExtractedPage[],
): ArithmeticOperand[] {
  const escapedMetric = metric.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const pattern = new RegExp(
    `\\b${escapedMetric}\\b\\s*[:=\\-]?\\s*([0-9]+(?:\\.[0-9]+)?)`,
    "gi",
  );

  const operands: ArithmeticOperand[] = [];

  for (const page of pages) {
    const matches = [
      ...page.text.matchAll(pattern),
    ];

    for (const match of matches) {
      const value = Number(match[1]);

      if (!Number.isFinite(value)) {
        continue;
      }

      const matchIndex =
        match.index ?? 0;

      const contextStart = Math.max(
        0,
        matchIndex - 120,
      );

      const contextEnd = Math.min(
        page.text.length,
        matchIndex +
          match[0].length +
          120,
      );

      const context = page.text
        .slice(
          contextStart,
          contextEnd,
        )
        .replace(/\s+/g, " ")
        .trim();

      const period =
        resolveNearestPeriod(
          page.text,
          matchIndex,
          match[0].length,
        );

            const explicitCurrencyCodes = [
        ...new Set(
          (
            context.match(
              /\b[A-Z]{3}\b/gi,
            ) ?? []
          )
            .map((code) =>
              code.toUpperCase(),
            )
            .filter((code) =>
              SUPPORTED_CURRENCY_CODES.has(
                code,
              ),
            ),
        ),
      ];

      const currency =
        explicitCurrencyCodes.length > 1
          ? null
          : explicitCurrencyCodes.length === 1
            ? explicitCurrencyCodes[0]
            : context.includes("$")
              ? "USD"
              : null;

      const currencyStatus =
        explicitCurrencyCodes.length > 1
          ? "ambiguous"
          : currency !== null
            ? "known"
            : "unknown";

      const narrativeScales = [
        ...new Set(
          (
            context.match(
              /\b(?:thousand|million|billion)s?\b/gi,
            ) ?? []
          ).map((scale) =>
            scale
              .toLowerCase()
              .replace(/s$/, ""),
          ),
        ),
      ];

      const unit =
        narrativeScales.length > 1
          ? null
          : narrativeScales.length === 1
            ? narrativeScales[0]
            : null;

      const unitStatus =
        narrativeScales.length > 1
          ? "ambiguous"
          : unit !== null
            ? "known"
            : "unknown";

      operands.push({
        label: metric.toUpperCase(),
        value,
        pageNumber: page.pageNumber,
        source: page.source,
        period,
        currency,
        currencyStatus,
        unit,
        unitStatus,
        context,
        revision:
          classifyFinancialEvidenceRevision(
            context,
          ),
      });
    }
  }

  return operands;
}



























