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



