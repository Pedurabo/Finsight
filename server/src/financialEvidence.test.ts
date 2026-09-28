describe("currency detection precedence", () => {
  it("prefers explicit CAD metadata over dollar symbols", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(CAD in millions)
2025 2024

North America
Operating Income $ 1,250 $ 900
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "1250",
      currency: "CAD",
      unit: "million",
      period: "2025",
    });

    expect(matches[1]).toMatchObject({
      value: "900",
      currency: "CAD",
      unit: "million",
      period: "2024",
    });
  });

  it("normalizes lowercase explicit currency codes to uppercase", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(eur in millions)
2025 2024

North America
Operating Income 1,250 900
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      currency: "EUR",
    });

    expect(matches[1]).toMatchObject({
      currency: "EUR",
    });
  });
});
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  collectTableArithmeticOperands,
  extractFinancialTableValues,
  extractMetricValues,
  extractNumberNearMetric,
  resolveNearestPeriod,
} from "./financialEvidence";

describe("financial evidence extraction", () => {
  it("extracts consolidated revenue with period and provenance", () => {
    const text = `
Summary Results of Operations
(In millions)
2025 2024

Total Revenue $ 281,724 $ 245,122 15%
`;

    const matches =
      extractFinancialTableValues(
        "revenue",
        text,
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "281724",
      currency: "USD",
      unit: "million",
      period: "2025",
    });

    expect(matches[1]).toMatchObject({
      value: "245122",
      currency: "USD",
      unit: "million",
      period: "2024",
    });
  });

  it("binds a document-discovered scope to its own row", () => {
    const text = `
(In millions)
2025 2024

North America
Revenue $ 80,000 $ 75,000 7%

Europe
Revenue $ 65,000 $ 60,000 8%
`;

    const matches =
      extractFinancialTableValues(
        "revenue",
        text,
        "north america",
        [
          "north america",
          "europe",
        ],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "80000",
      period: "2025",
      currency: "USD",
      unit: "million",
    });

    expect(matches[1]).toMatchObject({
      value: "75000",
      period: "2024",
    });
  });

  it("does not leak values from another scope", () => {
    const text = `
(In millions)
2025 2024

North America
Revenue $ 80,000 $ 75,000 7%

Europe
Revenue $ 65,000 $ 60,000 8%
`;

    const matches =
      extractFinancialTableValues(
        "revenue",
        text,
        "asia pacific",
        [
          "north america",
          "europe",
          "asia pacific",
        ],
      );

    expect(matches).toEqual([]);
  });

  it("collects one arithmetic operand for a requested period", () => {
    const pages = [
      {
        pageNumber: 7,
        source:
          "embedded_text" as const,
        text: `
(In millions)
2025 2024

North America
Revenue $ 80,000 $ 75,000 7%
`,
      },
    ];

    const operands =
      collectTableArithmeticOperands(
        pages,
        "revenue",
        "north america",
        ["2025"],
        "NORTH AMERICA REVENUE",
        ["north america"],
      );

    expect(operands).toHaveLength(1);

    expect(operands[0]).toMatchObject({
      label:
        "NORTH AMERICA REVENUE",
      value: 80000,
      pageNumber: 7,
      source: "embedded_text",
      period: "2025",
      currency: "USD",
      unit: "million",
    });
  });

  it("deduplicates repeated operands and prefers richer provenance", () => {
    const pages = [
      {
        pageNumber: 3,
        source:
          "embedded_text" as const,
        text: `
2025 2024

North America
Revenue 80,000 75,000 7%
`,
      },
      {
        pageNumber: 8,
        source:
          "ocr" as const,
        text: `
(In millions)
2025 2024

North America
Revenue $ 80,000 $ 75,000 7%
`,
      },
    ];

    const operands =
      collectTableArithmeticOperands(
        pages,
        "revenue",
        "north america",
        ["2025"],
        "NORTH AMERICA REVENUE",
        ["north america"],
      );

    expect(operands).toHaveLength(1);

    expect(operands[0]).toMatchObject({
      value: 80000,
      period: "2025",
      currency: "USD",
      unit: "million",
      pageNumber: 8,
      source: "ocr",
    });
  });

  it("extracts a narrative metric value with currency, unit, and period", () => {
    const match =
      extractNumberNearMetric(
        "revenue",
        "In 2025, revenue was $80 million.",
      );

    expect(match).toMatchObject({
      value: "80",
      currency: "USD",
      unit: "million",
      period: "2025",
    });
  });

  it("returns null when narrative context contains multiple possible periods", () => {
    const match =
      extractNumberNearMetric(
        "revenue",
        "Revenue was $80 million in 2025 compared with 2024.",
      );

    expect(match).toMatchObject({
      value: "80",
      currency: "USD",
      unit: "million",
      period: null,
    });
  });

  it("resolves the nearest unambiguous period", () => {
    const text =
      "2024 historical discussion. Revenue 80. More detail for 2025.";

    const matchIndex =
      text.indexOf("Revenue");

    const period =
      resolveNearestPeriod(
        text,
        matchIndex,
        "Revenue 80".length,
      );

    expect(period).toBe("2025");
  });

  it("recognizes supported international ISO currency codes from table context", () => {
    const cases = [
      ["EUR", "million"],
      ["GBP", "million"],
      ["JPY", "billion"],
      ["KES", "million"],
      ["UGX", "billion"],
    ] as const;

    for (const [currencyCode, unit] of cases) {
      const text = `
SEGMENT RESULTS OF OPERATIONS
(${currencyCode} in ${unit}s)
2025 2024

North America
Operating Income 1,250 900
`;

      const matches =
        extractFinancialTableValues(
          "operating income",
          text,
          "north america",
          ["north america"],
        );

      expect(matches).toHaveLength(2);

      expect(matches[0]).toMatchObject({
        value: "1250",
        currency: currencyCode,
        unit,
        period: "2025",
      });

      expect(matches[1]).toMatchObject({
        value: "900",
        currency: currencyCode,
        unit,
        period: "2024",
      });
    }
  });

  it("does not treat an unsupported three-letter code as currency", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(ABC in millions)
2025 2024

North America
Operating Income 1,250 900
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "1250",
      currency: null,
      unit: "million",
      period: "2025",
    });

    expect(matches[1]).toMatchObject({
      value: "900",
      currency: null,
      unit: "million",
      period: "2024",
    });
  });
  it("preserves currency provenance from table context when row symbols are absent", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(USD in millions)
2025 2024

North America
Operating Income 1,250 900
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "1250",
      currency: "USD",
      unit: "million",
      period: "2025",
    });

    expect(matches[1]).toMatchObject({
      value: "900",
      currency: "USD",
      unit: "million",
      period: "2024",
    });
  });
  it("preserves currency provenance when the symbol appears only on the first table value", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Operating Income $ 1,250 900
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "1250",
      currency: "USD",
      unit: "million",
      period: "2025",
    });

    expect(matches[1]).toMatchObject({
      value: "900",
      currency: "USD",
      unit: "million",
      period: "2024",
    });
  });
  it("ignores trailing percentage columns in financial table rows", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024 PercentageChange

North America
Operating Income $ 1,250 $ 900 38.9%
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "1250",
      currency: "USD",
      unit: "million",
      period: "2025",
    });

    expect(matches[1]).toMatchObject({
      value: "900",
      currency: "USD",
      unit: "million",
      period: "2024",
    });
  });
  it("does not fabricate numeric evidence from dash-style financial cells", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Operating Income $ — $ 900
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toEqual([]);
  });
  it("extracts decimal negative financial table values", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Operating Income $ (1,250.5) $ -900.25
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "-1250.5",
      currency: "USD",
      unit: "million",
      period: "2025",
    });

    expect(matches[1]).toMatchObject({
      value: "-900.25",
      currency: "USD",
      unit: "million",
      period: "2024",
    });
  });
  it("extracts explicit minus-sign financial table values", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Operating Income $ -1,250 $ 900
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "-1250",
      currency: "USD",
      unit: "million",
      period: "2025",
    });

    expect(matches[1]).toMatchObject({
      value: "900",
      currency: "USD",
      unit: "million",
      period: "2024",
    });
  });
  it("extracts parenthesized negative financial table values", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Operating Income $ (1,250) $ 900
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "-1250",
      currency: "USD",
      unit: "million",
      period: "2025",
    });

    expect(matches[1]).toMatchObject({
      value: "900",
      currency: "USD",
      unit: "million",
      period: "2024",
    });
  });
  it("collects narrative metric operands with page provenance", () => {
    const operands =
      extractMetricValues(
        "revenue",
        [
          {
            pageNumber: 2,
            source:
              "embedded_text" as const,
            text:
              "2024 Revenue 75",
          },
          {
            pageNumber: 5,
            source:
              "ocr" as const,
            text:
              "2025 Revenue 80",
          },
        ],
      );

    expect(operands).toHaveLength(2);

    expect(operands[0]).toMatchObject({
      label: "REVENUE",
      value: 75,
      pageNumber: 2,
      source: "embedded_text",
      period: "2024",
    });

    expect(operands[1]).toMatchObject({
      label: "REVENUE",
      value: 80,
      pageNumber: 5,
      source: "ocr",
      period: "2025",
    });
  });

  it("returns null when a narrative metric mention has no numeric value", () => {
    const match =
      extractNumberNearMetric(
        "revenue",
        "Revenue increased significantly during 2025.",
      );

    expect(match).toBeNull();
  });

  it("returns null when two periods are exactly equidistant", () => {
    const text =
      "2024 abc Revenue 80 xyz 2025";

    const matchIndex =
      text.indexOf("Revenue");

    const period =
      resolveNearestPeriod(
        text,
        matchIndex,
        "Revenue 80".length,
      );

    expect(period).toBeNull();
  });
});














describe("financial scale ambiguity", () => {
  it("does not choose a unit when explicit table scale metadata conflicts", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(USD in millions)
Amounts also presented in billions
2025 2024

North America
Operating Income 1,250 900
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "1250",
      currency: "USD",
      unit: null,
      period: "2025",
    });

    expect(matches[1]).toMatchObject({
      value: "900",
      currency: "USD",
      unit: null,
      period: "2024",
    });
  });
});

describe("financial currency ambiguity", () => {
  it("does not choose a currency when explicit table currency metadata conflicts", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(USD in millions)
Amounts also presented in EUR
2025 2024

North America
Operating Income 1,250 900
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "1250",
      currency: null,
      unit: "million",
      period: "2025",
    });

    expect(matches[1]).toMatchObject({
      value: "900",
      currency: null,
      unit: "million",
      period: "2024",
    });
  });
});

describe("currency-symbol precedence stability", () => {
  it("keeps a single explicit EUR code authoritative over dollar symbols", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(EUR in millions)
2025 2024

North America
Operating Income $ 1,250 $ 900
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "1250",
      currency: "EUR",
      unit: "million",
      period: "2025",
    });

    expect(matches[1]).toMatchObject({
      value: "900",
      currency: "EUR",
      unit: "million",
      period: "2024",
    });
  });
});

describe("repeated financial metadata consistency", () => {
  it("keeps repeated identical currency and scale metadata authoritative", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(USD in millions)
Amounts in USD millions
2025 2024

North America
Operating Income 1,250 900
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "1250",
      currency: "USD",
      unit: "million",
      period: "2025",
    });

    expect(matches[1]).toMatchObject({
      value: "900",
      currency: "USD",
      unit: "million",
      period: "2024",
    });
  });
});

describe("supported currency filtering", () => {
  it("ignores unsupported codes when one supported currency is explicit", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(USD in millions)
Internal classification ABC
2025 2024

North America
Operating Income 1,250 900
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "1250",
      currency: "USD",
      unit: "million",
      period: "2025",
    });

    expect(matches[1]).toMatchObject({
      value: "900",
      currency: "USD",
      unit: "million",
      period: "2024",
    });
  });
});

describe("scale metadata filtering", () => {
  it("ignores unrelated scale-like wording when one explicit table scale is present", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(USD in millions)
Billion-dollar market commentary
2025 2024

North America
Operating Income 1,250 900
`;

    const matches =
      extractFinancialTableValues(
        "operating income",
        text,
        "north america",
        ["north america"],
      );

    expect(matches).toHaveLength(2);

    expect(matches[0]).toMatchObject({
      value: "1250",
      currency: "USD",
      unit: "million",
      period: "2025",
    });

    expect(matches[1]).toMatchObject({
      value: "900",
      currency: "USD",
      unit: "million",
      period: "2024",
    });
  });
});

describe("arithmetic operand metadata deduplication", () => {
  it("preserves same-value operands when financial metadata differs", () => {
    const pages = [
      {
        pageNumber: 1,
        source: "embedded_text" as const,
        text: `
SEGMENT RESULTS OF OPERATIONS
(USD in millions)
2025 2024

North America
Operating Income 1,250 900
`,
      },
      {
        pageNumber: 2,
        source: "embedded_text" as const,
        text: `
SEGMENT RESULTS OF OPERATIONS
(USD in millions)
Amounts also presented in billions
2025 2024

North America
Operating Income 1,250 900
`,
      },
    ];

    const operands =
      collectTableArithmeticOperands(
        pages,
        "operating income",
        "north america",
        ["2025"],
        "NORTH AMERICA OPERATING INCOME",
        ["north america"],
      );

    expect(operands).toHaveLength(2);

    expect(
      operands.map((operand) => ({
        currency: operand.currency,
        currencyStatus:
          operand.currencyStatus,
        unit: operand.unit,
        unitStatus:
          operand.unitStatus,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          currency: "USD",
          currencyStatus: "known",
          unit: "million",
          unitStatus: "known",
        },
        {
          currency: "USD",
          currencyStatus: "known",
          unit: null,
          unitStatus: "ambiguous",
        },
      ]),
    );
  });
});

describe("narrative metadata status propagation", () => {
  it("preserves known narrative currency and unit status in arithmetic operands", () => {
    const pages = [
      {
        pageNumber: 3,
        source: "embedded_text" as const,
        text: `
For 2025, revenue 125 million USD.
`,
      },
    ];

    const operands =
      extractMetricValues(
        "revenue",
        pages,
      );

    expect(operands).toHaveLength(1);

    expect(operands[0]).toMatchObject({
      value: 125,
      currency: "USD",
      currencyStatus: "known",
      unit: "million",
      unitStatus: "known",
      period: "2025",
    });
  });

  it("marks missing narrative currency and unit metadata as unknown", () => {
    const pages = [
      {
        pageNumber: 4,
        source: "embedded_text" as const,
        text: `
For 2025, revenue 125.
`,
      },
    ];

    const operands =
      extractMetricValues(
        "revenue",
        pages,
      );

    expect(operands).toHaveLength(1);

    expect(operands[0]).toMatchObject({
      value: 125,
      currency: null,
      currencyStatus: "unknown",
      unit: null,
      unitStatus: "unknown",
      period: "2025",
    });
  });
});




describe("narrative scale ambiguity", () => {
  it("marks conflicting narrative scale metadata as ambiguous", () => {
    const pages = [
      {
        pageNumber: 5,
        source: "embedded_text" as const,
        text: `
For 2025, revenue 125 million.
Amounts are also described in billions.
`,
      },
    ];

    const operands =
      extractMetricValues(
        "revenue",
        pages,
      );

    expect(operands).toHaveLength(1);

    expect(operands[0]).toMatchObject({
      value: 125,
      unit: null,
      unitStatus: "ambiguous",
      period: "2025",
    });
  });
});

describe("narrative currency ambiguity", () => {
  it("marks conflicting narrative currency metadata as ambiguous", () => {
    const pages = [
      {
        pageNumber: 6,
        source: "embedded_text" as const,
        text: `
For 2025, revenue 125 million USD.
Amounts are also described in EUR.
`,
      },
    ];

    const operands =
      extractMetricValues(
        "revenue",
        pages,
      );

    expect(operands).toHaveLength(1);

    expect(operands[0]).toMatchObject({
      value: 125,
      currency: null,
      currencyStatus: "ambiguous",
      unit: "million",
      unitStatus: "known",
      period: "2025",
    });
  });
});

describe("arithmetic operand revision deduplication", () => {
  it("preserves same-value original and restated operands for reconciliation", () => {
    const pages = [
      {
        pageNumber: 1,
        source: "embedded_text" as const,
        text: `
SEGMENT RESULTS OF OPERATIONS
(USD in millions)
2025 2024

North America
Revenue 80,000 75,000
`,
      },
      {
        pageNumber: 2,
        source: "embedded_text" as const,
        text: `
RESTATED SEGMENT RESULTS OF OPERATIONS
(USD in millions)
2025 2024

North America
Revenue 80,000 75,000
`,
      },
    ];

    const operands =
      collectTableArithmeticOperands(
        pages,
        "revenue",
        "north america",
        ["2025"],
        "NORTH AMERICA REVENUE",
        ["north america"],
      );

    expect(operands).toHaveLength(2);

    expect(
      operands.map(
        (operand) => operand.revision,
      ),
    ).toEqual(
      expect.arrayContaining([
        "original",
        "restated",
      ]),
    );
  });
});

describe("arithmetic operand source deduplication", () => {
  it("prefers embedded text when duplicate operands have equal financial metadata", () => {
    const pages = [
      {
        pageNumber: 1,
        source: "ocr" as const,
        text: `
SEGMENT RESULTS OF OPERATIONS
(USD in millions)
2025 2024

North America
Revenue 80,000 75,000
`,
      },
      {
        pageNumber: 2,
        source: "embedded_text" as const,
        text: `
SEGMENT RESULTS OF OPERATIONS
(USD in millions)
2025 2024

North America
Revenue 80,000 75,000
`,
      },
    ];

    const operands =
      collectTableArithmeticOperands(
        pages,
        "revenue",
        "north america",
        ["2025"],
        "NORTH AMERICA REVENUE",
        ["north america"],
      );

    expect(operands).toHaveLength(1);

    expect(operands[0]).toMatchObject({
      value: 80000,
      period: "2025",
      currency: "USD",
      unit: "million",
      source: "embedded_text",
    });
  });
});
