import fs from "fs";
import path from "path";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { app } from "./app";

const documentId =
  "vitest-financial-fixture";

const extractionPath = path.resolve(
  "extracted",
  `${documentId}.json`,
);

const conflictDocumentId =
  "vitest-conflicting-financial-fixture";

const conflictExtractionPath = path.resolve(
  "extracted",
  `${conflictDocumentId}.json`,
);

const conflictFixtureText = `
SEGMENT RESULTS OF OPERATIONS
(In millions, except percentages)
2025 2024 PercentageChange

North America
Revenue $ 80,000 $ 75,000 7%

North America
Revenue $ 82,000 $ 75,000 9%
`;
const crossPageConflictDocumentId =
  "vitest-cross-page-conflict-fixture";

const crossPageConflictExtractionPath = path.resolve(
  "extracted",
  `${crossPageConflictDocumentId}.json`,
);

const crossPageConflictPageOne = `
SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Revenue $ 80,000 $ 75,000
`;

const crossPageConflictPageTwo = `
SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Revenue $ 82,000 $ 75,000
`;
const consistentCrossPageDocumentId =
  "vitest-consistent-cross-page-fixture";

const consistentCrossPageExtractionPath = path.resolve(
  "extracted",
  `${consistentCrossPageDocumentId}.json`,
);

const consistentCrossPagePageOne = `
SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Revenue $ 80,000 $ 75,000
`;

const consistentCrossPagePageTwo = `
SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Revenue $ 80,000 $ 75,000
`;
const restatementDocumentId =
  "vitest-restatement-fixture";

const restatementExtractionPath = path.resolve(
  "extracted",
  `${restatementDocumentId}.json`,
);

const restatementPageOne = `
SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Revenue $ 80,000 $ 75,000
`;

const restatementPageTwo = `
RESTATED SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Revenue $ 82,000 $ 75,000
`;
const restatedCalculationDocumentId =
  "vitest-restated-calculation-fixture";

const restatedCalculationExtractionPath = path.resolve(
  "extracted",
  `${restatedCalculationDocumentId}.json`,
);

const restatedCalculationPageOne = `
SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Revenue $ 80,000 $ 75,000

Europe
Revenue $ 65,000 $ 60,000
`;
const restatedCalculationPageTwo = `
RESTATED SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Revenue $ 82,000 $ 75,000

Europe
Revenue $ 65,000 $ 60,000
`;
const conflictingRestatedCrossScopeDocumentId =
  "vitest-conflicting-restated-cross-scope";

const conflictingRestatedCrossScopeExtractionPath = path.resolve(
  "extracted",
  `${conflictingRestatedCrossScopeDocumentId}.json`,
);

const conflictingRestatedCrossScopePageOne = `
SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Revenue $ 80,000 $ 75,000

Europe
Revenue $ 65,000 $ 60,000
`;

const conflictingRestatedCrossScopePageTwo = `
RESTATED SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Revenue $ 82,000 $ 75,000

Europe
Revenue $ 65,000 $ 60,000
`;

const conflictingRestatedCrossScopePageThree = `
RESTATED SEGMENT RESULTS OF OPERATIONS
(In millions)
2025 2024

North America
Revenue $ 83,000 $ 75,000

Europe
Revenue $ 65,000 $ 60,000
`;
const fixtureText = `
SEGMENT RESULTS OF OPERATIONS
(In millions, except percentages)
2025 2024 PercentageChange

Productivity and Business Processes
Revenue $ 120,810 $ 106,820 13%
Cost of revenue 22,422 19,611 14%
Operating expenses 28,615 27,548 4%
Operating Income $ 69,773 $ 59,661 17%

Intelligent Cloud
Revenue $ 106,265 $ 87,464 21%
Cost of revenue 40,171 29,611 36%
Operating expenses 21,505 20,040 7%
Operating Income $ 44,589 $ 37,813 18%

More Personal Computing
Revenue $ 54,649 $ 50,838 7%
Cost of revenue 25,238 24,892 1%
Operating expenses 15,245 13,987 9%
Operating Income $ 14,166 $ 11,959 18%

North America
Revenue $ 80,000 $ 75,000 7%
Operating Income $ 20,000 $ 18,000 11%

Europe
Revenue $ 65,000 $ 60,000 8%
Operating Income $ 15,500 $ 14,000 11%
`;

beforeAll(() => {
  fs.mkdirSync(
    path.dirname(extractionPath),
    { recursive: true },
  );

  fs.writeFileSync(
    extractionPath,
    JSON.stringify(
      {
        documentId,
        originalName:
          "vitest-financial-fixture.pdf",
        pageCount: 1,
        nonEmptyPages: 1,
        textCoverage: 1,
        extractionStatus: "complete",
        ocrUsed: false,
        pages: [
          {
            pageNumber: 1,
            text: fixtureText,
            source: "embedded_text",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  fs.writeFileSync(
    conflictExtractionPath,
    JSON.stringify(
      {
        documentId: conflictDocumentId,
        originalName:
          "vitest-conflicting-financial-fixture.pdf",
        pageCount: 1,
        nonEmptyPages: 1,
        textCoverage: 1,
        extractionStatus: "complete",
        ocrUsed: false,
        pages: [
          {
            pageNumber: 1,
            text: conflictFixtureText,
            source: "embedded_text",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  fs.writeFileSync(
    crossPageConflictExtractionPath,
    JSON.stringify(
      {
        documentId: crossPageConflictDocumentId,
        originalName:
          "vitest-cross-page-conflict-fixture.pdf",
        pageCount: 2,
        nonEmptyPages: 2,
        textCoverage: 1,
        extractionStatus: "complete",
        ocrUsed: true,
        pages: [
          {
            pageNumber: 1,
            text: crossPageConflictPageOne,
            source: "embedded_text",
          },
          {
            pageNumber: 2,
            text: crossPageConflictPageTwo,
            source: "ocr",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  fs.writeFileSync(
    consistentCrossPageExtractionPath,
    JSON.stringify(
      {
        documentId: consistentCrossPageDocumentId,
        originalName:
          "vitest-consistent-cross-page-fixture.pdf",
        pageCount: 2,
        nonEmptyPages: 2,
        textCoverage: 1,
        extractionStatus: "complete",
        ocrUsed: true,
        pages: [
          {
            pageNumber: 1,
            text: consistentCrossPagePageOne,
            source: "embedded_text",
          },
          {
            pageNumber: 2,
            text: consistentCrossPagePageTwo,
            source: "ocr",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  fs.writeFileSync(
    restatementExtractionPath,
    JSON.stringify(
      {
        documentId: restatementDocumentId,
        originalName:
          "vitest-restatement-fixture.pdf",
        pageCount: 2,
        nonEmptyPages: 2,
        textCoverage: 1,
        extractionStatus: "complete",
        ocrUsed: false,
        pages: [
          {
            pageNumber: 1,
            text: restatementPageOne,
            source: "embedded_text",
          },
          {
            pageNumber: 2,
            text: restatementPageTwo,
            source: "embedded_text",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  fs.writeFileSync(
    restatedCalculationExtractionPath,
    JSON.stringify(
      {
        documentId: restatedCalculationDocumentId,
        originalName:
          "vitest-restated-calculation-fixture.pdf",
        pageCount: 2,
        nonEmptyPages: 2,
        textCoverage: 1,
        extractionStatus: "complete",
        ocrUsed: false,
        pages: [
          {
            pageNumber: 1,
            text: restatedCalculationPageOne,
            source: "embedded_text",
          },
          {
            pageNumber: 2,
            text: restatedCalculationPageTwo,
            source: "embedded_text",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  fs.writeFileSync(
    conflictingRestatedCrossScopeExtractionPath,
    JSON.stringify(
      {
        documentId:
          conflictingRestatedCrossScopeDocumentId,
        originalName:
          "vitest-conflicting-restated-cross-scope.pdf",
        pageCount: 3,
        nonEmptyPages: 3,
        textCoverage: 1,
        extractionStatus: "complete",
        ocrUsed: false,
        pages: [
          {
            pageNumber: 1,
            text: conflictingRestatedCrossScopePageOne,
            source: "embedded_text",
          },
          {
            pageNumber: 2,
            text: conflictingRestatedCrossScopePageTwo,
            source: "embedded_text",
          },
          {
            pageNumber: 3,
            text: conflictingRestatedCrossScopePageThree,
            source: "embedded_text",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );
});

afterAll(() => {
  if (fs.existsSync(extractionPath)) {
    fs.unlinkSync(extractionPath);
  }

  if (fs.existsSync(conflictExtractionPath)) {
    fs.unlinkSync(conflictExtractionPath);
  }

  if (fs.existsSync(crossPageConflictExtractionPath)) {
    fs.unlinkSync(crossPageConflictExtractionPath);
  }

  if (fs.existsSync(consistentCrossPageExtractionPath)) {
    fs.unlinkSync(consistentCrossPageExtractionPath);
  }

  if (fs.existsSync(restatementExtractionPath)) {
    fs.unlinkSync(restatementExtractionPath);
  }

  if (fs.existsSync(restatedCalculationExtractionPath)) {
    fs.unlinkSync(restatedCalculationExtractionPath);
  }

  if (fs.existsSync(conflictingRestatedCrossScopeExtractionPath)) {
    fs.unlinkSync(conflictingRestatedCrossScopeExtractionPath);
  }
});

describe("FinSight HTTP integration", () => {
  it("rejects an empty verify question", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/verify`,
        )
        .send({
          question: "",
        });

    expect(response.status).toBe(400);
  });

  it("returns 404 for a missing document", async () => {
    const response =
      await request(app)
        .post(
          "/api/documents/missing-fixture/verify",
        )
        .send({
          question:
            "What was Intelligent Cloud revenue in 2025?",
        });

    expect(response.status).toBe(404);
  });

  it("verifies scoped revenue through HTTP", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/verify`,
        )
        .send({
          question:
            "What was Intelligent Cloud revenue in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");
    expect(response.body.claim.value)
      .toBe("106265");
    expect(response.body.claim.currency)
      .toBe("USD");
    expect(response.body.claim.unit)
      .toBe("million");
    expect(response.body.claim.period)
      .toBe("2025");
  });

  it("calculates scoped percentage change through HTTP", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the percentage change in Intelligent Cloud revenue from 2024 to 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");
    expect(
      response.body.calculation.result,
    ).toBeCloseTo(
      21.4957,
      4,
    );
    expect(
      response.body.calculation.reportedValue,
    ).toBe(21);
    expect(
      response.body.calculation
        .roundingConsistent,
    ).toBe(true);
  });

  it("calculates a cross-scope difference through HTTP", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the difference between Intelligent Cloud revenue and More Personal Computing revenue in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");
    expect(
      response.body.calculation.result,
    ).toBe(51616);
    expect(
      response.body.calculation.currency,
    ).toBe("USD");
    expect(
      response.body.calculation.unit,
    ).toBe("million");
  });

  it("preserves subtract-from ordering across scopes", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "Subtract Intelligent Cloud revenue from More Personal Computing revenue in 2025.",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");
    expect(
      response.body.calculation.result,
    ).toBe(-51616);
  });

  it("abstains on an ambiguous cross-scope ratio", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the ratio between Intelligent Cloud revenue and More Personal Computing revenue in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");
    expect(
      response.body.calculation,
    ).toBeNull();
  });

  it("keeps multi-scope verify conservative", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/verify`,
        )
        .send({
          question:
            "What was Intelligent Cloud revenue and More Personal Computing revenue in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");
    expect(response.body.claim)
      .toBeNull();
  });

  it("abstains on unsupported Azure revenue", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the percentage change in Azure revenue from 2024 to 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");
    expect(response.body.calculation)
      .toBeNull();
  });

  it("returns dimensionless metadata for an explicit ratio", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the ratio of Intelligent Cloud revenue in 2025 to Intelligent Cloud revenue in 2024?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBeCloseTo(
      1.215,
      3,
    );

    expect(
      response.body.calculation.currency,
    ).toBeNull();

    expect(
      response.body.calculation.unit,
    ).toBeNull();
  });

  it("preserves reverse same-scope subtraction sign", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "Subtract Intelligent Cloud revenue in 2025 from Intelligent Cloud revenue in 2024.",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(-18801);
  });

  it("abstains when a scoped metric row is missing", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the percentage change in Intelligent Cloud gross margin from 2024 to 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");

    expect(
      response.body.calculation,
    ).toBeNull();
  });

  it("checks reported percentage and rounding consistency", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the percentage change in Intelligent Cloud revenue from 2024 to 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBeCloseTo(
      21.4957,
      4,
    );

    expect(
      response.body.calculation.reportedValue,
    ).toBe(21);

    expect(
      response.body.calculation
        .roundingConsistent,
    ).toBe(true);
  });

  it("calculates cross-scope Operating Income difference", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the difference between Intelligent Cloud operating income and More Personal Computing operating income in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(30423);

    expect(
      response.body.calculation.currency,
    ).toBe("USD");

    expect(
      response.body.calculation.unit,
    ).toBe("million");
  });

  it("calculates cross-scope Operating Income ratio", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the ratio of Productivity and Business Processes operating income to Intelligent Cloud operating income in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBeCloseTo(
      1.5648,
      4,
    );

    expect(
      response.body.calculation.currency,
    ).toBeNull();

    expect(
      response.body.calculation.unit,
    ).toBeNull();
  });

  it("preserves subtract-from ordering for cross-scope Operating Income", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "Subtract Intelligent Cloud operating income from Productivity and Business Processes operating income in 2025.",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(25184);

    expect(
      response.body.calculation.currency,
    ).toBe("USD");

    expect(
      response.body.calculation.unit,
    ).toBe("million");
  });

  it("abstains on cross-scope Gross Margin difference when scoped rows are missing", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the difference between Intelligent Cloud gross margin and More Personal Computing gross margin in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");

    expect(
      response.body.calculation,
    ).toBeNull();
  });

  it("abstains on cross-scope Gross Margin ratio when scoped rows are missing", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the ratio of Productivity and Business Processes gross margin to Intelligent Cloud gross margin in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");

    expect(
      response.body.calculation,
    ).toBeNull();
  });

  it("abstains on cross-scope Gross Margin subtraction when scoped rows are missing", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "Subtract Intelligent Cloud gross margin from Productivity and Business Processes gross margin in 2025.",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");

    expect(
      response.body.calculation,
    ).toBeNull();
  });

  it("calculates cross-scope arithmetic using document-discovered scopes", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the difference between North America revenue and Europe revenue in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(15000);

    expect(
      response.body.calculation.currency,
    ).toBe("USD");

    expect(
      response.body.calculation.unit,
    ).toBe("million");
  });

  it("calculates a ratio using document-discovered scopes", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the ratio of North America revenue to Europe revenue in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBeCloseTo(
      1.2308,
      4,
    );

    expect(
      response.body.calculation.currency,
    ).toBeNull();

    expect(
      response.body.calculation.unit,
    ).toBeNull();
  });

  it("preserves subtract-from ordering for document-discovered scopes", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "Subtract Europe revenue from North America revenue in 2025.",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(15000);

    expect(
      response.body.calculation.currency,
    ).toBe("USD");

    expect(
      response.body.calculation.unit,
    ).toBe("million");
  });

  it("abstains on an ambiguous ratio between document-discovered scopes", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the ratio between North America revenue and Europe revenue in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");

    expect(
      response.body.calculation,
    ).toBeNull();
  });

  it("verifies a single document-discovered scope", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/verify`,
        )
        .send({
          question:
            "What was North America revenue in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.claim.value,
    ).toBe("80000");

    expect(
      response.body.claim.currency,
    ).toBe("USD");

    expect(
      response.body.claim.unit,
    ).toBe("million");

    expect(
      response.body.claim.period,
    ).toBe("2025");
  });

  it("keeps multi-scope document-discovered verification conservative", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/verify`,
        )
        .send({
          question:
            "What were North America revenue and Europe revenue in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");

    expect(
      response.body.claim,
    ).toBeNull();
  });

  it("verifies Operating Income for a document-discovered scope", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/verify`,
        )
        .send({
          question:
            "What was North America operating income in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.claim.value,
    ).toBe("20000");

    expect(
      response.body.claim.currency,
    ).toBe("USD");

    expect(
      response.body.claim.unit,
    ).toBe("million");

    expect(
      response.body.claim.period,
    ).toBe("2025");
  });

  it("calculates Operating Income difference across document-discovered scopes", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the difference between North America operating income and Europe operating income in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(4500);

    expect(
      response.body.calculation.currency,
    ).toBe("USD");

    expect(
      response.body.calculation.unit,
    ).toBe("million");
  });

  it("calculates Operating Income percentage change for a document-discovered scope", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What was the percentage change in North America operating income from 2024 to 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(response.body.calculation.operands)
      .toHaveLength(2);

    expect(response.body.calculation.operands[0])
      .toMatchObject({
        value: 18000,
        period: "2024",
        pageNumber: 1,
        source: "embedded_text",
        currency: "USD",
        unit: "million",
      });

    expect(response.body.calculation.operands[1])
      .toMatchObject({
        value: 20000,
        period: "2025",
        pageNumber: 1,
        source: "embedded_text",
        currency: "USD",
        unit: "million",
      });

    expect(
      response.body.calculation.operands[0].context,
    ).toContain("North America");

    expect(
      response.body.calculation.operands[1].context,
    ).toContain("North America");

    expect(response.body.calculation.reportedValue)
      .toBe(11);

    expect(response.body.calculation.roundingConsistent)
      .toBe(true);
    expect(
      response.body.calculation.result,
    ).toBeCloseTo(
      11.1111,
      4,
    );

    expect(
      response.body.calculation.unit,
    ).toBe("percent");
  });

  it("abstains on missing Gross Margin for a document-discovered scope", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What was the percentage change in North America gross margin from 2024 to 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");

    expect(response.body.calculation)
      .toBeNull();
  });

  it("abstains when the same scope metric and period have conflicting values", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${conflictDocumentId}/verify`,
        )
        .send({
          question:
            "What was North America revenue in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");

    expect(response.body.claim)
      .toBeNull();
  });

  it("abstains on conflicting values across pages and extraction sources", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${crossPageConflictDocumentId}/verify`,
        )
        .send({
          question:
            "What was North America revenue in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");

    expect(response.body.claim)
      .toBeNull();
  });

  it("supports consistent repeated evidence across pages", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${consistentCrossPageDocumentId}/verify`,
        )
        .send({
          question:
            "What was North America revenue in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(response.body.claim)
      .toMatchObject({
        value: "80000",
        period: "2025",
        currency: "USD",
        unit: "million",
        pageNumber: 1,
        source: "embedded_text",
      });
  });

  it("prefers explicit restated evidence over original evidence", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${restatementDocumentId}/verify`,
        )
        .send({
          question:
            "What was North America revenue in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(response.body.claim)
      .toMatchObject({
        value: "82000",
        period: "2025",
        currency: "USD",
        unit: "million",
        pageNumber: 2,
        source: "embedded_text",
      });
  });


  it("uses explicit restated evidence in same-scope percentage change", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${restatedCalculationDocumentId}/calculate`,
        )
        .send({
          question:
            "What was the percentage change in North America revenue from 2024 to 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBeCloseTo(
      9.3333,
      4,
    );

    expect(
      response.body.calculation.operands[0],
    ).toMatchObject({
      value: 75000,
      period: "2024",
    });

    expect(
      response.body.calculation.operands[1],
    ).toMatchObject({
      value: 82000,
      period: "2025",
      pageNumber: 2,
    });
  });

  it("uses explicit restated evidence in cross-scope difference", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${restatedCalculationDocumentId}/calculate`,
        )
        .send({
          question:
            "What was the difference between North America revenue and Europe revenue in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(17000);

    expect(
      response.body.calculation.operands[0],
    ).toMatchObject({
      value: 82000,
      period: "2025",
      pageNumber: 2,
    });

    expect(
      response.body.calculation.operands[1],
    ).toMatchObject({
      value: 65000,
      period: "2025",
    });
  });

  it("abstains on conflicting restated cross-scope evidence", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${conflictingRestatedCrossScopeDocumentId}/calculate`,
        )
        .send({
          question:
            "What was the difference between North America revenue and Europe revenue in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");

    expect(response.body.calculation)
      .toBeNull();
  });
});





























