import {
  describe,
  expect,
  it,
} from "vitest";

import {
  classifyFinancialEvidenceRevision,
  resolveFinancialEvidenceRevisionConflict,
  resolveRevisionAwareEvidenceCandidates,
} from "./evidencePolicy";
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

    it("prefers embedded text over conflicting OCR for the same revision status", () => {
      const embedded = {
        value: 82000,
        context:
          "SEGMENT RESULTS OF OPERATIONS",
        source: "embedded_text" as const,
      };

      const ocr = {
        value: 81000,
        context:
          "SEGMENT RESULTS OF OPERATIONS",
        source: "ocr" as const,
      };

      const result =
        resolveRevisionAwareEvidenceCandidates([
          ocr,
          embedded,
        ]);

      expect(result.status).toBe("selected");

      if (result.status === "selected") {
        expect(result.candidate)
          .toEqual(embedded);
        expect(result.selectionPolicy)
          .toBe("embedded_text_precedence");
      }
    });
    it("prefers restated OCR over original embedded text", () => {
      const originalEmbedded = {
        value: 80000,
        context:
          "SEGMENT RESULTS OF OPERATIONS",
        source: "embedded_text" as const,
      };

      const restatedOcr = {
        value: 82000,
        context:
          "RESTATED SEGMENT RESULTS OF OPERATIONS",
        source: "ocr" as const,
      };

      const result =
        resolveRevisionAwareEvidenceCandidates([
          originalEmbedded,
          restatedOcr,
        ]);

      expect(result.status).toBe("selected");

      if (result.status === "selected") {
        expect(result.candidate)
          .toEqual(restatedOcr);
        expect(result.selectionPolicy)
          .toBe("restatement_precedence");
      }
    });
    it("preserves ambiguity for conflicting embedded-text candidates", () => {
      const first = {
        value: 82000,
        context:
          "SEGMENT RESULTS OF OPERATIONS",
        source: "embedded_text" as const,
      };

      const second = {
        value: 83000,
        context:
          "SEGMENT RESULTS OF OPERATIONS",
        source: "embedded_text" as const,
      };

      const result =
        resolveRevisionAwareEvidenceCandidates([
          first,
          second,
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



