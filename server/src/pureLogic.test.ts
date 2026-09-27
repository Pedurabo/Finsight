import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolveRevisionAwareEvidenceCandidates,
  resolveFinancialEvidenceRevisionConflict,
  classifyFinancialEvidenceRevision,
  computeArithmetic,
  hasExplicitRatioDirection,
  parseCrossScopeArithmeticRequest,
  orderCrossScopeOperands,
  detectArithmeticOperation,
  detectDirectMetricScopes,
  detectFinancialScope,
  detectMetric,
  detectRequestedRevenueQualifier,
  extractQuestionYears,
  selectArithmeticOperands,
  extractDocumentScopeCandidates,
  buildAvailableScopesFromTexts,
  scopeDirectlyModifiesMetric,
  shouldReverseSubtractionOperands,
} from "./pureLogic";

describe("detectMetric", () => {
  it("prefers operating income over generic income", () => {
    expect(
      detectMetric(
        "What was operating income in 2025?",
      ),
    ).toBe("operating income");
  });

  it("prefers net income over generic income", () => {
    expect(
      detectMetric(
        "What was net income in 2025?",
      ),
    ).toBe("net income");
  });

  it("detects revenue", () => {
    expect(
      detectMetric(
        "What was revenue in 2025?",
      ),
    ).toBe("revenue");
  });
});

describe("scope semantics", () => {
  it("binds Intelligent Cloud directly to revenue", () => {
    expect(
      detectFinancialScope(
        "What was Intelligent Cloud revenue in 2025?",
      ),
    ).toBe("intelligent cloud");
  });

  it("ignores a later distractor scope", () => {
    expect(
      detectFinancialScope(
        "What was Intelligent Cloud revenue in 2025, compared with More Personal Computing?",
      ),
    ).toBe("intelligent cloud");
  });

  it("finds two directly requested revenue scopes", () => {
    expect(
      detectDirectMetricScopes(
        "What was Intelligent Cloud revenue and More Personal Computing revenue in 2025?",
        "revenue",
      ),
    ).toEqual([
      "intelligent cloud",
      "more personal computing",
    ]);
  });

  it("does not treat a bare distractor as a direct metric scope", () => {
    expect(
      detectDirectMetricScopes(
        "What was Intelligent Cloud revenue in 2025, compared with More Personal Computing?",
        "revenue",
      ),
    ).toEqual([
      "intelligent cloud",
    ]);
  });

  it("detects unsupported Azure revenue qualifier", () => {
    expect(
      detectRequestedRevenueQualifier(
        "What was Azure revenue in 2025?",
      ),
    ).toBe("Azure");
  });

  it("checks direct scope-metric ownership", () => {
    expect(
      scopeDirectlyModifiesMetric(
        "What was Intelligent Cloud revenue in 2025?",
        "intelligent cloud",
        "revenue",
      ),
    ).toBe(true);
  });
});

describe("operation detection", () => {
  it("detects percentage change", () => {
    expect(
      detectArithmeticOperation(
        "What is the percentage change in revenue from 2024 to 2025?",
      ),
    ).toBe("percentage_change");
  });

  it("detects subtraction", () => {
    expect(
      detectArithmeticOperation(
        "Subtract revenue in 2024 from revenue in 2025.",
      ),
    ).toBe("subtraction");
  });

  it("detects difference", () => {
    expect(
      detectArithmeticOperation(
        "What is the difference between 2024 and 2025 revenue?",
      ),
    ).toBe("difference");
  });

  it("detects ratio", () => {
    expect(
      detectArithmeticOperation(
        "What is the ratio of revenue in 2025 to revenue in 2024?",
      ),
    ).toBe("ratio");
  });
});

describe("year extraction", () => {
  it("preserves textual year order", () => {
    expect(
      extractQuestionYears(
        "Compare revenue in 2025 to revenue in 2024.",
      ),
    ).toEqual([
      "2025",
      "2024",
    ]);
  });
});

describe("deterministic arithmetic", () => {
  it("computes absolute difference", () => {
    expect(
      computeArithmetic(
        "difference",
        87464,
        106265,
      ),
    ).toBe(18801);
  });

  it("computes ordered subtraction", () => {
    expect(
      computeArithmetic(
        "subtraction",
        106265,
        87464,
      ),
    ).toBe(18801);
  });

  it("computes ratio", () => {
    expect(
      computeArithmetic(
        "ratio",
        106265,
        87464,
      ),
    ).toBeCloseTo(
      1.21495,
      4,
    );
  });

  it("rejects a zero ratio denominator", () => {
    expect(
      computeArithmetic(
        "ratio",
        100,
        0,
      ),
    ).toBeNull();
  });

  it("computes percentage change", () => {
    expect(
      computeArithmetic(
        "percentage_change",
        87464,
        106265,
      ),
    ).toBeCloseTo(
      21.4957,
      4,
    );
  });

  it("rejects percentage change from zero", () => {
    expect(
      computeArithmetic(
        "percentage_change",
        0,
        100,
      ),
    ).toBeNull();
  });
});

describe("metric specificity edge cases", () => {
  it("does not collapse operating income into income", () => {
    expect(
      detectMetric(
        "Compare operating income from 2024 to 2025.",
      ),
    ).toBe("operating income");
  });

  it("does not collapse gross margin into margin", () => {
    expect(
      detectMetric(
        "What was gross margin in 2025?",
      ),
    ).toBe("gross margin");
  });
});

describe("scope ambiguity edge cases", () => {
  it("keeps one direct scope when another scope is only a distractor", () => {
    expect(
      detectDirectMetricScopes(
        "What is the percentage change in Intelligent Cloud revenue from 2024 to 2025, compared with More Personal Computing?",
        "revenue",
      ),
    ).toEqual([
      "intelligent cloud",
    ]);
  });

  it("detects two direct revenue scopes", () => {
    expect(
      detectDirectMetricScopes(
        "Compare Intelligent Cloud revenue with More Personal Computing revenue in 2025.",
        "revenue",
      ),
    ).toEqual([
      "intelligent cloud",
      "more personal computing",
    ]);
  });

  it("detects two direct operating income scopes", () => {
    expect(
      detectDirectMetricScopes(
        "Compare Intelligent Cloud operating income with More Personal Computing operating income.",
        "operating income",
      ),
    ).toEqual([
      "intelligent cloud",
      "more personal computing",
    ]);
  });

  it("binds More Personal Computing when Intelligent Cloud appears later as a distractor", () => {
    expect(
      detectFinancialScope(
        "What was More Personal Computing operating income in 2025, not Intelligent Cloud?",
      ),
    ).toBe("more personal computing");
  });
});

describe("unsupported revenue qualifier edge cases", () => {
  it("detects Azure", () => {
    expect(
      detectRequestedRevenueQualifier(
        "What was Azure revenue in 2025?",
      ),
    ).toBe("Azure");
  });

  it("detects Microsoft Cloud", () => {
    expect(
      detectRequestedRevenueQualifier(
        "What was Microsoft Cloud revenue in 2025?",
      ),
    ).toBe("Microsoft Cloud");
  });

  it("does not let a supported distractor own Azure revenue", () => {
    const question =
      "What was Azure revenue in 2025, compared with Intelligent Cloud?";

    const scope =
      detectFinancialScope(question);

    expect(
      scopeDirectlyModifiesMetric(
        question,
        scope,
        "revenue",
      ),
    ).toBe(false);
  });
});

describe("ratio phrasing edge cases", () => {
  it("detects an explicit ratio", () => {
    expect(
      detectArithmeticOperation(
        "What is the ratio of revenue in 2025 to revenue in 2024?",
      ),
    ).toBe("ratio");
  });

  it("still classifies vague ratio wording as ratio", () => {
    expect(
      detectArithmeticOperation(
        "What is the ratio of revenue between 2024 and 2025?",
      ),
    ).toBe("ratio");
  });

  it("preserves numerator and denominator year order", () => {
    expect(
      extractQuestionYears(
        "What is the ratio of revenue in 2025 to revenue in 2024?",
      ),
    ).toEqual([
      "2025",
      "2024",
    ]);
  });
});

describe("subtraction wording edge cases", () => {
  it("detects subtract-from wording", () => {
    expect(
      detectArithmeticOperation(
        "Subtract revenue in 2024 from revenue in 2025.",
      ),
    ).toBe("subtraction");
  });

  it("preserves textual years before route-level subtraction reversal", () => {
    expect(
      extractQuestionYears(
        "Subtract revenue in 2024 from revenue in 2025.",
      ),
    ).toEqual([
      "2024",
      "2025",
    ]);
  });
});

describe("arithmetic safety edge cases", () => {
  it("returns null when ratio denominator is zero", () => {
    expect(
      computeArithmetic(
        "ratio",
        106265,
        0,
      ),
    ).toBeNull();
  });

  it("returns null when percentage-change base is zero", () => {
    expect(
      computeArithmetic(
        "percentage_change",
        0,
        106265,
      ),
    ).toBeNull();
  });

  it("preserves subtraction sign", () => {
    expect(
      computeArithmetic(
        "subtraction",
        87464,
        106265,
      ),
    ).toBe(-18801);
  });

  it("keeps difference order-independent", () => {
    expect(
      computeArithmetic(
        "difference",
        106265,
        87464,
      ),
    ).toBe(18801);

    expect(
      computeArithmetic(
        "difference",
        87464,
        106265,
      ),
    ).toBe(18801);
  });
});

describe("subtraction operand direction", () => {
  it("reverses explicit subtract-from wording", () => {
    expect(
      shouldReverseSubtractionOperands(
        "Subtract revenue in 2024 from revenue in 2025.",
        "subtraction",
      ),
    ).toBe(true);
  });

  it("does not reverse subtraction without from", () => {
    expect(
      shouldReverseSubtractionOperands(
        "Revenue in 2025 minus revenue in 2024.",
        "subtraction",
      ),
    ).toBe(false);
  });

  it("never reverses difference operations", () => {
    expect(
      shouldReverseSubtractionOperands(
        "What is the difference from 2024 to 2025?",
        "difference",
      ),
    ).toBe(false);
  });

  it("never reverses ratio operations", () => {
    expect(
      shouldReverseSubtractionOperands(
        "What is the ratio from 2024 to 2025?",
        "ratio",
      ),
    ).toBe(false);
  });
});



describe("ratio direction eligibility", () => {
  it("accepts ratio using to", () => {
    expect(
      hasExplicitRatioDirection(
        "What is the ratio of revenue in 2025 to revenue in 2024?",
        "ratio",
      ),
    ).toBe(true);
  });

  it("accepts ratio using over", () => {
    expect(
      hasExplicitRatioDirection(
        "What is revenue in 2025 over revenue in 2024?",
        "ratio",
      ),
    ).toBe(true);
  });

  it("accepts divided-by wording", () => {
    expect(
      hasExplicitRatioDirection(
        "Revenue in 2025 divided by revenue in 2024.",
        "ratio",
      ),
    ).toBe(true);
  });

  it("rejects ambiguous between wording", () => {
    expect(
      hasExplicitRatioDirection(
        "What is the ratio of revenue between 2024 and 2025?",
        "ratio",
      ),
    ).toBe(false);
  });

  it("does not restrict non-ratio operations", () => {
    expect(
      hasExplicitRatioDirection(
        "What is the difference between revenue in 2024 and 2025?",
        "difference",
      ),
    ).toBe(true);
  });
});


describe("cross-scope arithmetic parsing", () => {
  it("parses a same-year difference across two scopes", () => {
    expect(
      parseCrossScopeArithmeticRequest(
        "What is the difference between Intelligent Cloud revenue and More Personal Computing revenue in 2025?",
      ),
    ).toEqual({
      scopes: [
        "intelligent cloud",
        "more personal computing",
      ],
      metric: "revenue",
      year: "2025",
      operation: "difference",
    });
  });

  it("parses an explicit same-year ratio across two scopes", () => {
    expect(
      parseCrossScopeArithmeticRequest(
        "What is the ratio of Productivity and Business Processes revenue to Intelligent Cloud revenue in 2025?",
      ),
    ).toEqual({
      scopes: [
        "productivity and business processes",
        "intelligent cloud",
      ],
      metric: "revenue",
      year: "2025",
      operation: "ratio",
    });
  });

  it("rejects vague cross-scope ratio wording", () => {
    expect(
      parseCrossScopeArithmeticRequest(
        "What is the ratio between Intelligent Cloud revenue and More Personal Computing revenue in 2025?",
      ),
    ).toBeNull();
  });

  it("rejects cross-scope percentage change", () => {
    expect(
      parseCrossScopeArithmeticRequest(
        "What is the percentage change between Intelligent Cloud revenue and More Personal Computing revenue in 2025?",
      ),
    ).toBeNull();
  });

  it("rejects requests with two years", () => {
    expect(
      parseCrossScopeArithmeticRequest(
        "What is the difference between Intelligent Cloud revenue in 2024 and More Personal Computing revenue in 2025?",
      ),
    ).toBeNull();
  });

  it("rejects a single-scope request", () => {
    expect(
      parseCrossScopeArithmeticRequest(
        "What is the difference in Intelligent Cloud revenue between 2024 and 2025?",
      ),
    ).toBeNull();
  });
});


describe("cross-scope operand ordering", () => {
  it("preserves scope order for difference", () => {
    const question =
      "What is the difference between Intelligent Cloud revenue and More Personal Computing revenue in 2025?";

    const request =
      parseCrossScopeArithmeticRequest(
        question,
      );

    expect(request).not.toBeNull();

    expect(
      orderCrossScopeOperands(
        question,
        request!,
      ),
    ).toEqual([
      "intelligent cloud",
      "more personal computing",
    ]);
  });

  it("preserves numerator and denominator order for ratio", () => {
    const question =
      "What is the ratio of Productivity and Business Processes revenue to Intelligent Cloud revenue in 2025?";

    const request =
      parseCrossScopeArithmeticRequest(
        question,
      );

    expect(request).not.toBeNull();

    expect(
      orderCrossScopeOperands(
        question,
        request!,
      ),
    ).toEqual([
      "productivity and business processes",
      "intelligent cloud",
    ]);
  });

  it("reverses subtract-from scope order", () => {
    const question =
      "Subtract Intelligent Cloud revenue from More Personal Computing revenue in 2025.";

    const request =
      parseCrossScopeArithmeticRequest(
        question,
      );

    expect(request).not.toBeNull();

    expect(
      orderCrossScopeOperands(
        question,
        request!,
      ),
    ).toEqual([
      "more personal computing",
      "intelligent cloud",
    ]);
  });

describe("direct scope textual ordering", () => {
  it("returns scopes in question order rather than configured order", () => {
    expect(
      detectDirectMetricScopes(
        "Subtract Intelligent Cloud operating income from Productivity and Business Processes operating income in 2025.",
        "operating income",
      ),
    ).toEqual([
      "intelligent cloud",
      "productivity and business processes",
    ]);
  });
});
});



describe("document-driven scope candidates", () => {
  it("extracts segment names preceding supported metric rows", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
(In millions, except percentages)
2025 2024 PercentageChange

Productivity and Business Processes
Revenue $ 120,810 $ 106,820 13%

Intelligent Cloud
Revenue $ 106,265 $ 87,464 21%

More Personal Computing
Operating Income $ 14,166 $ 11,959 18%
`;

    expect(
      extractDocumentScopeCandidates(
        text,
      ),
    ).toEqual([
      "productivity and business processes",
      "intelligent cloud",
      "more personal computing",
    ]);
  });

  it("works with previously unknown scope names", () => {
    const text = `
North America
Revenue $ 12,400 $ 11,900 4%

Europe
Operating Income $ 3,100 $ 2,900 7%
`;

    expect(
      extractDocumentScopeCandidates(
        text,
      ),
    ).toEqual([
      "north america",
      "europe",
    ]);
  });

  it("rejects generic financial headings as scopes", () => {
    const text = `
SEGMENT RESULTS OF OPERATIONS
Revenue $ 100 $ 90 11%

(In millions, except percentages)
Operating Income $ 50 $ 40 25%
`;

    expect(
      extractDocumentScopeCandidates(
        text,
      ),
    ).toEqual([]);
  });

  it("does not treat numeric table rows as scope labels", () => {
    const text = `
Cost of revenue 40,171 29,611 36%
Revenue $ 106,265 $ 87,464 21%
`;

    expect(
      extractDocumentScopeCandidates(
        text,
      ),
    ).toEqual([]);
  });

describe("document-supplied scope vocabulary", () => {
  it("detects previously unknown scopes when supplied", () => {
    expect(
      detectDirectMetricScopes(
        "What is the difference between North America revenue and Europe revenue in 2025?",
        "revenue",
        [
          "north america",
          "europe",
        ],
      ),
    ).toEqual([
      "north america",
      "europe",
    ]);
  });

  it("preserves textual order for supplied scopes", () => {
    expect(
      detectDirectMetricScopes(
        "Subtract Europe revenue from North America revenue in 2025.",
        "revenue",
        [
          "north america",
          "europe",
        ],
      ),
    ).toEqual([
      "europe",
      "north america",
    ]);
  });

  it("falls back to built-in scopes when none are supplied", () => {
    expect(
      detectDirectMetricScopes(
        "Compare Intelligent Cloud revenue with More Personal Computing revenue.",
        "revenue",
      ),
    ).toEqual([
      "intelligent cloud",
      "more personal computing",
    ]);
  });
});

describe("document-driven cross-scope parsing", () => {
  it("parses arithmetic across supplied document scopes", () => {
    expect(
      parseCrossScopeArithmeticRequest(
        "What is the difference between North America revenue and Europe revenue in 2025?",
        [
          "north america",
          "europe",
        ],
      ),
    ).toEqual({
      scopes: [
        "north america",
        "europe",
      ],
      metric: "revenue",
      year: "2025",
      operation: "difference",
    });
  });

  it("preserves supplied scope text order for subtract-from semantics", () => {
    const question =
      "Subtract Europe revenue from North America revenue in 2025.";

    const request =
      parseCrossScopeArithmeticRequest(
        question,
        [
          "north america",
          "europe",
        ],
      );

    expect(request).not.toBeNull();

    expect(
      request
        ? orderCrossScopeOperands(
            question,
            request,
          )
        : null,
    ).toEqual([
      "north america",
      "europe",
    ]);
  });
});

describe("available scope vocabulary", () => {
  it("combines fallback and document-discovered scopes", () => {
    const scopes =
      buildAvailableScopesFromTexts([
        `
North America
Revenue $ 80,000 $ 75,000 7%

Europe
Revenue $ 65,000 $ 60,000 8%
`,
      ]);

    expect(scopes).toEqual([
      "productivity and business processes",
      "intelligent cloud",
      "more personal computing",
      "north america",
      "europe",
    ]);
  });

  it("deduplicates scopes discovered across pages", () => {
    const scopes =
      buildAvailableScopesFromTexts([
        `
North America
Revenue $ 80,000 $ 75,000 7%
`,
        `
North America
Operating Income $ 20,000 $ 18,000 11%
`,
      ]);

    expect(
      scopes.filter(
        (scope) =>
          scope === "north america",
      ),
    ).toHaveLength(1);
  });
});

describe("arithmetic operand selection", () => {
  it("selects requested periods in question order", () => {
    const result =
      selectArithmeticOperands(
        "What is the difference between 2024 and 2025?",
        [
          {
            id: "2025",
            period: "2025",
          },
          {
            id: "2024",
            period: "2024",
          },
        ],
        "difference",
      );

    expect(result.status).toBe("selected");

    if (result.status === "selected") {
      expect(result.operands[0].id)
        .toBe("2024");

      expect(result.operands[1].id)
        .toBe("2025");
    }
  });

  it("abstains when one requested period has multiple candidates", () => {
    const result =
      selectArithmeticOperands(
        "Compare 2024 and 2025.",
        [
          {
            id: "a",
            period: "2024",
          },
          {
            id: "b",
            period: "2024",
          },
          {
            id: "c",
            period: "2025",
          },
        ],
        "difference",
      );

    expect(result.status)
      .toBe("ambiguous");
  });

  it("selects exactly two unordered candidates for difference", () => {
    const result =
      selectArithmeticOperands(
        "What is the difference?",
        [
          {
            id: "first",
            period: null,
          },
          {
            id: "second",
            period: null,
          },
        ],
        "difference",
      );

    expect(result.status).toBe("selected");

    if (result.status === "selected") {
      expect(
        result.operands.map(
          (operand) => operand.id,
        ),
      ).toEqual([
        "first",
        "second",
      ]);
    }
  });

  it("abstains on unordered subtraction", () => {
    const result =
      selectArithmeticOperands(
        "Subtract the values.",
        [
          {
            id: "first",
            period: null,
          },
          {
            id: "second",
            period: null,
          },
        ],
        "subtraction",
      );

    expect(result.status)
      .toBe("ambiguous");
  });

  it("abstains when requested periods are missing", () => {
    const result =
      selectArithmeticOperands(
        "Compare 2024 and 2025.",
        [
          {
            id: "only",
            period: "2024",
          },
        ],
        "difference",
      );

    expect(result.status)
      .toBe("ambiguous");
  });
});

  describe("financial evidence revision classification", () => {
    it("classifies explicit restated evidence", () => {
      expect(
        classifyFinancialEvidenceRevision(
          "RESTATED SEGMENT RESULTS OF OPERATIONS",
        ),
      ).toBe("restated");
    });

    it("classifies explicit revised evidence", () => {
      expect(
        classifyFinancialEvidenceRevision(
          "Revised segment results of operations",
        ),
      ).toBe("restated");
    });

    it("classifies as-adjusted evidence as restated", () => {
      expect(
        classifyFinancialEvidenceRevision(
          "Segment results of operations, as adjusted",
        ),
      ).toBe("restated");
    });

    it("classifies ordinary financial-table evidence as original", () => {
      expect(
        classifyFinancialEvidenceRevision(
          "SEGMENT RESULTS OF OPERATIONS (In millions) 2025 2024",
        ),
      ).toBe("original");
    });

    it("does not infer revision status from weak prose", () => {
      expect(
        classifyFinancialEvidenceRevision(
          "Management discussed revenue trends during the year.",
        ),
      ).toBe("unknown");
    });

    it("does not treat unrelated revision language as restatement evidence", () => {
      expect(
        classifyFinancialEvidenceRevision(
          "The outlook was revised. SEGMENT RESULTS OF OPERATIONS",
        ),
      ).toBe("unknown");
    });
  });

  describe("financial evidence revision resolution", () => {
    const original = {
      value: "80000",
      revision: "original" as const,
    };

    const restated = {
      value: "82000",
      revision: "restated" as const,
    };

    it("prefers a single restated value over an original value", () => {
      const result =
        resolveFinancialEvidenceRevisionConflict([
          original,
          restated,
        ]);

      expect(result.status).toBe("selected");

      if (result.status === "selected") {
        expect(result.candidate)
          .toEqual(restated);
      }
    });

    it("selects consistent repeated restated evidence", () => {
      const repeated = {
        value: "82000",
        revision: "restated" as const,
      };

      const result =
        resolveFinancialEvidenceRevisionConflict([
          restated,
          repeated,
        ]);

      expect(result.status).toBe("selected");

      if (result.status === "selected") {
        expect(result.candidate.value)
          .toBe("82000");
      }
    });

    it("abstains on conflicting restated values", () => {
      const result =
        resolveFinancialEvidenceRevisionConflict([
          restated,
          {
            value: "83000",
            revision: "restated" as const,
          },
        ]);

      expect(result.status).toBe("ambiguous");
    });

    it("abstains on conflicting original values", () => {
      const result =
        resolveFinancialEvidenceRevisionConflict([
          original,
          {
            value: "81000",
            revision: "original" as const,
          },
        ]);

      expect(result.status).toBe("ambiguous");
    });

    it("abstains when unknown evidence conflicts with known evidence", () => {
      const result =
        resolveFinancialEvidenceRevisionConflict([
          restated,
          {
            value: "83000",
            revision: "unknown" as const,
          },
        ]);

      expect(result.status).toBe("ambiguous");
    });

    it("selects a single unconflicted candidate", () => {
      const result =
        resolveFinancialEvidenceRevisionConflict([
          original,
        ]);

      expect(result.status).toBe("selected");
    });
  });

  describe("revision-aware evidence candidate resolution", () => {
    it("returns the original candidate selected by restatement precedence", () => {
      const original = {
        value: 80000,
        context:
          "SEGMENT RESULTS OF OPERATIONS",
        pageNumber: 1,
      };

      const restated = {
        value: 82000,
        context:
          "RESTATED SEGMENT RESULTS OF OPERATIONS",
        pageNumber: 2,
      };

      const result =
        resolveRevisionAwareEvidenceCandidates([
          original,
          restated,
        ]);

      expect(result.status).toBe("selected");

      if (result.status === "selected") {
        expect(result.candidate)
          .toEqual(restated);
      }
    });

    it("preserves ambiguity for conflicting restated candidates", () => {
      const result =
        resolveRevisionAwareEvidenceCandidates([
          {
            value: 82000,
            context:
              "RESTATED SEGMENT RESULTS OF OPERATIONS",
          },
          {
            value: 83000,
            context:
              "RESTATED SEGMENT RESULTS OF OPERATIONS",
          },
        ]);

      expect(result.status).toBe("ambiguous");
    });

    it("handles consistent repeated evidence", () => {
      const first = {
        value: "65000",
        context:
          "SEGMENT RESULTS OF OPERATIONS",
        pageNumber: 1,
      };

      const second = {
        value: "65000",
        context:
          "SEGMENT RESULTS OF OPERATIONS",
        pageNumber: 2,
      };

      const result =
        resolveRevisionAwareEvidenceCandidates([
          first,
          second,
        ]);

      expect(result.status).toBe("selected");
    });
  });
});











