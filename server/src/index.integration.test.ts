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

const grossMarginDocumentId =
  "vitest-gross-margin-fixture";

const grossMarginExtractionPath = path.resolve(
  "extracted",
  `${grossMarginDocumentId}.json`,
);

const grossMarginFixtureText = `
SEGMENT RESULTS OF OPERATIONS
(In millions, except percentages)
2025 2024 PercentageChange

North America
Gross Margin $ 60,000 $ 55,000 9%

Europe
Gross Margin $ 45,000 $ 40,000 13%
`;
const netIncomeDocumentId =
  "vitest-net-income-fixture";

const netIncomeExtractionPath = path.resolve(
  "extracted",
  `${netIncomeDocumentId}.json`,
);

const netIncomeFixtureText = `
SEGMENT RESULTS OF OPERATIONS
(In millions, except percentages)
2025 2024 PercentageChange

North America
Net Income $ 50,000 $ 46,000 9%

Europe
Net Income $ 35,000 $ 32,000 9%
`;
const balanceSheetDocumentId =
  "vitest-balance-sheet-fixture";

const balanceSheetExtractionPath = path.resolve(
  "extracted",
  `${balanceSheetDocumentId}.json`,
);

const balanceSheetFixtureText = `
BALANCE SHEETS
(In millions)
2025 2024

North America
Assets $ 120,000 $ 110,000
Liabilities $ 70,000 $ 65,000
Equity $ 50,000 $ 45,000

Europe
Assets $ 90,000 $ 82,000
Liabilities $ 55,000 $ 50,000
Equity $ 35,000 $ 32,000
`;
beforeAll(() => {
  fs.writeFileSync(
    balanceSheetExtractionPath,
    JSON.stringify(
      {
        documentId: balanceSheetDocumentId,
        originalName:
          "vitest-balance-sheet-fixture.pdf",
        pageCount: 1,
        nonEmptyPages: 1,
        pages: [
          {
            pageNumber: 1,
            text: balanceSheetFixtureText,
            source: "embedded_text",
          },
        ],
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    netIncomeExtractionPath,
    JSON.stringify(
      {
        documentId: netIncomeDocumentId,
        originalName:
          "vitest-net-income-fixture.pdf",
        pageCount: 1,
        nonEmptyPages: 1,
        pages: [
          {
            pageNumber: 1,
            text: netIncomeFixtureText,
            source: "embedded_text",
          },
        ],
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    grossMarginExtractionPath,
    JSON.stringify(
      {
        documentId: grossMarginDocumentId,
        originalName:
          "vitest-gross-margin-fixture.pdf",
        pageCount: 1,
        nonEmptyPages: 1,
        pages: [
          {
            pageNumber: 1,
            text: grossMarginFixtureText,
            source: "embedded_text",
          },
        ],
      },
      null,
      2,
    ),
  );

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

const mixedCurrencyDocumentId =
  "vitest-mixed-currency-fixture";

const mixedCurrencyExtractionPath = path.resolve(
  "extracted",
  `${mixedCurrencyDocumentId}.json`,
);

const mixedCurrencyPageOne = `
SEGMENT RESULTS OF OPERATIONS
(USD in millions)
2025 2024

North America
Revenue 100 90
`;

const mixedCurrencyPageTwo = `
SEGMENT RESULTS OF OPERATIONS
(EUR in millions)
2025 2024

Europe
Revenue 80 70
`;
beforeAll(() => {
  fs.writeFileSync(
    mixedCurrencyExtractionPath,
    JSON.stringify(
      {
        documentId:
          mixedCurrencyDocumentId,
        originalName:
          "vitest-mixed-currency-fixture.pdf",
        pageCount: 2,
        nonEmptyPages: 2,
        textCoverage: 1,
        extractionStatus: "complete",
        ocrUsed: false,
        pages: [
          {
            pageNumber: 1,
            text: mixedCurrencyPageOne,
            source: "embedded_text",
          },
          {
            pageNumber: 2,
            text: mixedCurrencyPageTwo,
            source: "embedded_text",
          },
        ],
      },
      null,
      2,
    ),
  );
});

afterAll(() => {
  if (
    fs.existsSync(
      mixedCurrencyExtractionPath,
    )
  ) {
    fs.unlinkSync(
      mixedCurrencyExtractionPath,
    );
  }
});
const euroCurrencyDocumentId =
  "vitest-euro-currency-fixture";

const euroCurrencyExtractionPath = path.resolve(
  "extracted",
  `${euroCurrencyDocumentId}.json`,
);

const euroCurrencyFixtureText = `
SEGMENT RESULTS OF OPERATIONS
(EUR in millions)
2025 2024

North America
Revenue 100 90

Europe
Revenue 80 70
`;

beforeAll(() => {
  fs.writeFileSync(
    euroCurrencyExtractionPath,
    JSON.stringify(
      {
        documentId:
          euroCurrencyDocumentId,
        originalName:
          "vitest-euro-currency-fixture.pdf",
        pageCount: 1,
        nonEmptyPages: 1,
        textCoverage: 1,
        extractionStatus: "complete",
        ocrUsed: false,
        pages: [
          {
            pageNumber: 1,
            text: euroCurrencyFixtureText,
            source: "embedded_text",
          },
        ],
      },
      null,
      2,
    ),
  );
});

afterAll(() => {
  if (
    fs.existsSync(
      euroCurrencyExtractionPath,
    )
  ) {
    fs.unlinkSync(
      euroCurrencyExtractionPath,
    );
  }
});
const mixedScaleDocumentId =
  "vitest-mixed-scale-fixture";

const mixedScaleExtractionPath = path.resolve(
  "extracted",
  `${mixedScaleDocumentId}.json`,
);

const mixedScalePageOne = `
SEGMENT RESULTS OF OPERATIONS
(USD in millions)
2025 2024

North America
Revenue 500 450
`;

const mixedScalePageTwo = `
SEGMENT RESULTS OF OPERATIONS
(USD in billions)
2025 2024

Europe
Revenue 1 0.9
`;

beforeAll(() => {
  fs.writeFileSync(
    mixedScaleExtractionPath,
    JSON.stringify(
      {
        documentId:
          mixedScaleDocumentId,
        originalName:
          "vitest-mixed-scale-fixture.pdf",
        pageCount: 2,
        nonEmptyPages: 2,
        textCoverage: 1,
        extractionStatus: "complete",
        ocrUsed: false,
        pages: [
          {
            pageNumber: 1,
            text: mixedScalePageOne,
            source: "embedded_text",
          },
          {
            pageNumber: 2,
            text: mixedScalePageTwo,
            source: "embedded_text",
          },
        ],
      },
      null,
      2,
    ),
  );
});

afterAll(() => {
  if (
    fs.existsSync(
      mixedScaleExtractionPath,
    )
  ) {
    fs.unlinkSync(
      mixedScaleExtractionPath,
    );
  }
});
const thousandScaleDocumentId =
  "vitest-thousand-scale-fixture";

const thousandScaleExtractionPath = path.resolve(
  "extracted",
  `${thousandScaleDocumentId}.json`,
);

const thousandScalePageOne = `
SEGMENT RESULTS OF OPERATIONS
(USD in millions)
2025 2024

North America
Revenue 2 1.8
`;

const thousandScalePageTwo = `
SEGMENT RESULTS OF OPERATIONS
(USD in thousands)
2025 2024

Europe
Revenue 500 450
`;

beforeAll(() => {
  fs.writeFileSync(
    thousandScaleExtractionPath,
    JSON.stringify(
      {
        documentId:
          thousandScaleDocumentId,
        originalName:
          "vitest-thousand-scale-fixture.pdf",
        pageCount: 2,
        nonEmptyPages: 2,
        textCoverage: 1,
        extractionStatus: "complete",
        ocrUsed: false,
        pages: [
          {
            pageNumber: 1,
            text: thousandScalePageOne,
            source: "embedded_text",
          },
          {
            pageNumber: 2,
            text: thousandScalePageTwo,
            source: "embedded_text",
          },
        ],
      },
      null,
      2,
    ),
  );
});

afterAll(() => {
  if (
    fs.existsSync(
      thousandScaleExtractionPath,
    )
  ) {
    fs.unlinkSync(
      thousandScaleExtractionPath,
    );
  }
});
const mixedScalePercentageDocumentId =
  "vitest-mixed-scale-percentage-fixture";

const mixedScalePercentageExtractionPath = path.resolve(
  "extracted",
  `${mixedScalePercentageDocumentId}.json`,
);

const mixedScalePercentagePageOne = `
SUMMARY RESULTS OF OPERATIONS
(USD in millions)
2024 2023

Revenue 500 450
`;

const mixedScalePercentagePageTwo = `
SUMMARY RESULTS OF OPERATIONS
(USD in billions)
2025 2026

Revenue 1 1.2
`;

beforeAll(() => {
  fs.writeFileSync(
    mixedScalePercentageExtractionPath,
    JSON.stringify(
      {
        documentId:
          mixedScalePercentageDocumentId,
        originalName:
          "vitest-mixed-scale-percentage-fixture.pdf",
        pageCount: 2,
        nonEmptyPages: 2,
        textCoverage: 1,
        extractionStatus: "complete",
        ocrUsed: false,
        pages: [
          {
            pageNumber: 1,
            text:
              mixedScalePercentagePageOne,
            source: "embedded_text",
          },
          {
            pageNumber: 2,
            text:
              mixedScalePercentagePageTwo,
            source: "embedded_text",
          },
        ],
      },
      null,
      2,
    ),
  );
});

afterAll(() => {
  if (
    fs.existsSync(
      mixedScalePercentageExtractionPath,
    )
  ) {
    fs.unlinkSync(
      mixedScalePercentageExtractionPath,
    );
  }
});
describe("FinSight HTTP integration", () => {
  it("normalizes mixed scales before percentage-change arithmetic", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${mixedScalePercentageDocumentId}/calculate`,
        )
        .send({
          question:
            "What was the percentage change in revenue from 2024 to 2025?",
        });
    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(100);

    expect(
      response.body.calculation.currency,
    ).toBeNull();

    expect(
      response.body.calculation.unit,
    ).toBe("percent");
  });

  it("normalizes thousand-scale evidence into millions", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${thousandScaleDocumentId}/calculate`,
        )
        .send({
          question:
            "What is the difference between North America revenue and Europe revenue in 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(1.5);

    expect(
      response.body.calculation.currency,
    ).toBe("USD");

    expect(
      response.body.calculation.unit,
    ).toBe("million");
  });

  it("normalizes billion-scale evidence into millions for cross-scope difference", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${mixedScaleDocumentId}/calculate`,
        )
        .send({
          question:
            "What is the difference between North America revenue and Europe revenue in 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(500);

    expect(
      response.body.calculation.currency,
    ).toBe("USD");

    expect(
      response.body.calculation.unit,
    ).toBe("million");
  });

  it("normalizes mixed financial scales before calculating a ratio", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${mixedScaleDocumentId}/calculate`,
        )
        .send({
          question:
            "What is the ratio of Europe revenue to North America revenue in 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(2);

    expect(
      response.body.calculation.currency,
    ).toBeNull();

    expect(
      response.body.calculation.unit,
    ).toBeNull();
  });

  it("calculates a same-currency EUR cross-scope difference", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${euroCurrencyDocumentId}/calculate`,
        )
        .send({
          question:
            "What is the difference between North America revenue and Europe revenue in 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(20);

    expect(
      response.body.calculation.currency,
    ).toBe("EUR");

    expect(
      response.body.calculation.unit,
    ).toBe("million");
  });

  it("calculates a same-currency EUR ratio with dimensionless metadata", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${euroCurrencyDocumentId}/calculate`,
        )
        .send({
          question:
            "What is the ratio of North America revenue to Europe revenue in 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(1.25);

    expect(
      response.body.calculation.currency,
    ).toBeNull();

    expect(
      response.body.calculation.unit,
    ).toBeNull();
  });

  it("abstains on a cross-scope difference with different currencies", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${mixedCurrencyDocumentId}/calculate`,
        )
        .send({
          question:
            "What is the difference between North America revenue and Europe revenue in 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");
    expect(response.body.calculation)
      .toBeNull();

    expect(response.body.candidates)
      .toHaveLength(2);

    expect(
      response.body.candidates[0].currency,
    ).toBe("USD");

    expect(
      response.body.candidates[1].currency,
    ).toBe("EUR");
  });

  it("abstains on a cross-scope ratio with different currencies", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${mixedCurrencyDocumentId}/calculate`,
        )
        .send({
          question:
            "What is the ratio of North America revenue to Europe revenue in 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");
    expect(response.body.calculation)
      .toBeNull();
  });

  it("verifies scoped Assets when table evidence exists", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${balanceSheetDocumentId}/verify`,
        )
        .send({
          question:
            "What was North America assets in 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.claim,
    ).toMatchObject({
      metric: "ASSETS",
      value: "120000",
      period: "2025",
      pageNumber: 1,
      source: "embedded_text",
      selectionPolicy: "single_candidate",
    });
  });
  it("verifies scoped Liabilities when table evidence exists", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${balanceSheetDocumentId}/verify`,
        )
        .send({
          question:
            "What were North America liabilities in 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.claim,
    ).toMatchObject({
      metric: "LIABILITIES",
      value: "70000",
      period: "2025",
      pageNumber: 1,
      source: "embedded_text",
      selectionPolicy: "single_candidate",
    });
  });

  it("verifies scoped Equity when table evidence exists", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${balanceSheetDocumentId}/verify`,
        )
        .send({
          question:
            "What was North America equity in 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.claim,
    ).toMatchObject({
      metric: "EQUITY",
      value: "50000",
      period: "2025",
      pageNumber: 1,
      source: "embedded_text",
      selectionPolicy: "single_candidate",
    });
  });
  it("calculates scoped Assets percentage change when table evidence exists", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${balanceSheetDocumentId}/calculate`,
        )
        .send({
          question:
            "What was the percentage change in North America assets from 2024 to 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBeCloseTo(
      9.0909,
      4,
    );
  });

  it("calculates cross-scope Assets difference when table evidence exists", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${balanceSheetDocumentId}/calculate`,
        )
        .send({
          question:
            "What is the difference between North America assets and Europe assets in 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(30000);
  });

  it("calculates cross-scope Liabilities ratio when table evidence exists", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${balanceSheetDocumentId}/calculate`,
        )
        .send({
          question:
            "What is the ratio of North America liabilities to Europe liabilities in 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBeCloseTo(
      1.2727,
      4,
    );

    expect(
      response.body.calculation.currency,
    ).toBeNull();

    expect(
      response.body.calculation.unit,
    ).toBeNull();
  });

  it("preserves subtraction ordering for cross-scope Equity", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${balanceSheetDocumentId}/calculate`,
        )
        .send({
          question:
            "Subtract North America equity from Europe equity in 2025.",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(-15000);
  });
  it("verifies scoped Net Income when table evidence exists", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${netIncomeDocumentId}/verify`,
        )
        .send({
          question:
            "What was North America net income in 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.claim,
    ).toMatchObject({
      metric: "NET INCOME",
      value: "50000",
      period: "2025",
      pageNumber: 1,
      source: "embedded_text",
      selectionPolicy: "single_candidate",
    });
  });
  it("calculates scoped Net Income percentage change when table evidence exists", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${netIncomeDocumentId}/calculate`,
        )
        .send({
          question:
            "What was the percentage change in North America net income from 2024 to 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBeCloseTo(
      8.6957,
      4,
    );

    expect(
      response.body.calculation.operands[0],
    ).toMatchObject({
      value: 46000,
      period: "2024",
    });

    expect(
      response.body.calculation.operands[1],
    ).toMatchObject({
      value: 50000,
      period: "2025",
    });
  });

  it("calculates cross-scope Net Income difference when table evidence exists", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${netIncomeDocumentId}/calculate`,
        )
        .send({
          question:
            "What is the difference between North America net income and Europe net income in 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

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

  it("calculates cross-scope Net Income ratio when table evidence exists", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${netIncomeDocumentId}/calculate`,
        )
        .send({
          question:
            "What is the ratio of North America net income to Europe net income in 2025?",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBeCloseTo(
      1.4286,
      4,
    );

    expect(
      response.body.calculation.currency,
    ).toBeNull();

    expect(
      response.body.calculation.unit,
    ).toBeNull();
  });

  it("preserves subtraction ordering for cross-scope Net Income", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${netIncomeDocumentId}/calculate`,
        )
        .send({
          question:
            "Subtract North America net income from Europe net income in 2025.",
        });

    console.log(
      JSON.stringify(response.body, null, 2),
    );

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(-15000);
  });
  it("verifies scoped Gross Margin when table evidence exists", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${grossMarginDocumentId}/verify`,
        )
        .send({
          question:
            "What was North America gross margin in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.claim,
    ).toMatchObject({
      metric: "GROSS MARGIN",
      value: "60000",
      period: "2025",
      pageNumber: 1,
      source: "embedded_text",
      selectionPolicy: "single_candidate",
    });
  });
  it("calculates scoped Gross Margin percentage change when table evidence exists", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${grossMarginDocumentId}/calculate`,
        )
        .send({
          question:
            "What was the percentage change in North America gross margin from 2024 to 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBeCloseTo(
      9.0909,
      4,
    );

    expect(
      response.body.calculation.operands[0],
    ).toMatchObject({
      value: 55000,
      period: "2024",
    });

    expect(
      response.body.calculation.operands[1],
    ).toMatchObject({
      value: 60000,
      period: "2025",
    });
  });
  it("calculates cross-scope Gross Margin difference when table evidence exists", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${grossMarginDocumentId}/calculate`,
        )
        .send({
          question:
            "What is the difference between North America gross margin and Europe gross margin in 2025?",
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

  it("calculates cross-scope Gross Margin ratio when table evidence exists", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${grossMarginDocumentId}/calculate`,
        )
        .send({
          question:
            "What is the ratio of North America gross margin to Europe gross margin in 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBeCloseTo(
      1.3333,
      4,
    );

    expect(
      response.body.calculation.currency,
    ).toBeNull();

    expect(
      response.body.calculation.unit,
    ).toBeNull();
  });

  it("preserves subtraction ordering for cross-scope Gross Margin", async () => {
    const response =
      await request(app)
        .post(
          `/api/documents/${grossMarginDocumentId}/calculate`,
        )
        .send({
          question:
            "Subtract North America gross margin from Europe gross margin in 2025.",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("supported");

    expect(
      response.body.calculation.result,
    ).toBe(-15000);
  });
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

  it("prefers embedded text over conflicting OCR across pages", async () => {
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
      .toBe("supported");

    expect(response.body.claim)
      .toMatchObject({
        value: "80000",
        period: "2025",
        currency: "USD",
        unit: "million",
        pageNumber: 1,
        source: "embedded_text",
        revision: "original",
      });
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
        revision: "restated",
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
      revision: "restated",
      selectionPolicy: "restatement_precedence",
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
      revision: "restated",
      selectionPolicy: "restatement_precedence",
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








































































it("abstains when arithmetic operands carry ambiguous financial metadata", async () => {
  const documentId =
    "vitest-ambiguous-metadata-arithmetic-fixture";

  const extractionPath = path.resolve(
    "extracted",
    `${documentId}.json`,
  );

  fs.writeFileSync(
    extractionPath,
    JSON.stringify({
      pages: [
        {
          pageNumber: 1,
          source: "embedded_text",
          text: `
SUMMARY RESULTS OF OPERATIONS
(USD in millions)
Amounts also presented in billions
2024 2023

Total Revenue 500 450
`,
        },
        {
          pageNumber: 2,
          source: "embedded_text",
          text: `
SUMMARY RESULTS OF OPERATIONS
(USD in millions)
Amounts also presented in billions
2025 2026

Total Revenue 600 650
`,
        },
      ],
    }),
  );

  try {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What was the percentage change in revenue from 2024 to 2025?",
        });
    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");

    expect(
      response.body.calculation,
    ).toBeNull();
  } finally {
    fs.rmSync(
      extractionPath,
      {
        force: true,
      },
    );
  }
});





it("abstains when narrative arithmetic evidence has ambiguous scale metadata", async () => {
  const documentId =
    "vitest-narrative-ambiguous-scale-fixture";

  const extractionPath = path.resolve(
    "extracted",
    `${documentId}.json`,
  );

  fs.writeFileSync(
    extractionPath,
    JSON.stringify({
      pages: [
        {
          pageNumber: 1,
          source: "embedded_text",
          text: `
For 2024, revenue 100 million USD.
Amounts are also described in billions.
`,
        },
        {
          pageNumber: 2,
          source: "embedded_text",
          text: `
For 2025, revenue 120 million USD.
`,
        },
      ],
    }),
  );

  try {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What was the percentage change in revenue from 2024 to 2025?",
        });

    expect(response.status).toBe(200);
    expect(response.body.status)
      .toBe("insufficient_evidence");

    expect(
      response.body.calculation,
    ).toBeNull();
  } finally {
    fs.rmSync(
      extractionPath,
      {
        force: true,
      },
    );
  }
});


it("exposes evidence candidates when verify abstains on conflicting values", async () => {
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

  expect(response.body.candidates)
    .toHaveLength(2);

  expect(
    response.body.candidates,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        value: "80000",
        period: "2025",
        source: "embedded_text",
        snippet: expect.stringContaining(
          "North America",
        ),
      }),
      expect.objectContaining({
        value: "82000",
        period: "2025",
        source: "embedded_text",
        snippet: expect.stringContaining(
          "North America",
        ),
      }),
    ]),
  );
});


it("returns a structured reason code when no supported calculation intent is detected", async () => {
  const response =
    await request(app)
      .post(
        `/api/documents/${documentId}/calculate`,
      )
      .send({
        question:
          "Tell me about North America revenue.",
      });

  expect(response.status).toBe(200);

  expect(response.body).toMatchObject({
    status: "insufficient_evidence",
    reasonCode: "unsupported_intent",
    calculation: null,
  });
});

it("returns a structured reason code when no supported metric is detected", async () => {
  const response =
    await request(app)
      .post(
        `/api/documents/${documentId}/calculate`,
      )
      .send({
        question:
          "What is the difference in headcount from 2024 to 2025?",
      });

  expect(response.status).toBe(200);

  expect(response.body).toMatchObject({
    status: "insufficient_evidence",
    reasonCode: "unsupported_metric",
    calculation: null,
  });
});

it("returns a structured reason code for an unsupported scope", async () => {
  const response =
    await request(app)
      .post(
        `/api/documents/${documentId}/calculate`,
      )
      .send({
        question:
          "What was the percentage change in Azure revenue from 2024 to 2025?",
      });

  expect(response.status).toBe(200);

  expect(response.body).toMatchObject({
    status: "insufficient_evidence",
    reasonCode: "unsupported_scope",
    calculation: null,
  });
});

it("returns a structured reason code for an ambiguous calculation request", async () => {
  const response =
    await request(app)
      .post(
        `/api/documents/${documentId}/calculate`,
      )
      .send({
        question:
          "What is the ratio of North America revenue and Europe revenue in 2025?",
      });

  expect(response.status).toBe(200);

  expect(response.body).toMatchObject({
    status: "insufficient_evidence",
    reasonCode: "ambiguous_request",
    calculation: null,
  });
});

it("returns a structured reason code for conflicting evidence", async () => {
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

  expect(response.body).toMatchObject({
    status: "insufficient_evidence",
    reasonCode: "conflicting_evidence",
    claim: null,
  });

  expect(response.body.candidates)
    .toHaveLength(2);
});

it("returns a structured reason code for incompatible financial metadata", async () => {
  const response =
    await request(app)
      .post(
        `/api/documents/${mixedCurrencyDocumentId}/calculate`,
      )
      .send({
        question:
          "What is the difference between North America revenue and Europe revenue in 2025?",
      });

  expect(response.status).toBe(200);

  expect(response.body).toMatchObject({
    status: "insufficient_evidence",
    reasonCode: "incompatible_metadata",
    calculation: null,
  });

  expect(response.body.candidates)
    .toHaveLength(2);
});

it("returns a structured reason code when required evidence is missing", async () => {
  const response =
    await request(app)
      .post(
        `/api/documents/${documentId}/calculate`,
      )
      .send({
        question:
          "What was the percentage change in Intelligent Cloud gross margin from 2024 to 2025?",
      });

  expect(response.status).toBe(200);

  expect(response.body).toMatchObject({
    status: "insufficient_evidence",
    reasonCode: "missing_evidence",
    calculation: null,
  });
});

it("returns a structured reason code when arithmetic cannot be completed safely", async () => {
  const documentId =
    "vitest-zero-denominator-fixture";

  const extractionPath = path.resolve(
    "extracted",
    `${documentId}.json`,
  );

  fs.writeFileSync(
    extractionPath,
    JSON.stringify({
      pages: [
        {
          pageNumber: 1,
          source: "embedded_text",
          text: `
SUMMARY RESULTS OF OPERATIONS
(USD in millions)
2025 2024

Total Revenue 120 0
`,
        },
      ],
    }),
  );

  try {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the ratio of revenue in 2025 to revenue in 2024?",
        });

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      status: "insufficient_evidence",
      reasonCode: "unsafe_calculation",
      calculation: null,
    });

    expect(response.body.candidates)
      .toHaveLength(2);
  } finally {
    fs.rmSync(
      extractionPath,
      {
        force: true,
      },
    );
  }
});



it("rejects an invalid calculate document identifier", async () => {
  const response =
    await request(app)
      .post(
        "/api/documents/..%2Finvalid/calculate",
      )
      .send({
        question:
          "What was the percentage change in revenue from 2024 to 2025?",
      });

  expect(response.status).toBe(400);

  expect(response.body).toMatchObject({
    error: "Invalid document identifier.",
  });
});


it("rejects malformed calculate question bodies", async () => {
  const cases = [
    {},
    {
      question: "   ",
    },
    {
      question: 123,
    },
    {
      question: null,
    },
  ];

  for (const body of cases) {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send(body);

    expect(response.status).toBe(400);

    expect(response.body).toMatchObject({
      error: "A question is required.",
    });
  }
});

it("rejects malformed verify question bodies", async () => {
  const cases = [
    {},
    {
      question: "   ",
    },
    {
      question: 123,
    },
    {
      question: null,
    },
  ];

  for (const body of cases) {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/verify`,
        )
        .send(body);

    expect(response.status).toBe(400);

    expect(response.body).toMatchObject({
      error: "A question is required.",
    });
  }
});

it("retains uploaded and extracted files after successful document processing", async () => {
  const fixturePath =
    path.resolve(
      "src",
      "test-fixtures",
      "minimal-financial.docx",
    );

  const response =
    await request(app)
      .post("/api/documents")
      .attach(
        "document",
        fixturePath,
      );

  expect(response.status).toBe(201);

  const documentId =
    response.body.id;

  expect(typeof documentId).toBe("string");

  const uploadedPath =
    path.resolve(
      "uploads",
      documentId,
    );

  const extractionPath =
    path.resolve(
      "extracted",
      `${documentId}.json`,
    );

  try {
    expect(
      fs.existsSync(uploadedPath),
    ).toBe(true);

    expect(
      fs.existsSync(extractionPath),
    ).toBe(true);

    expect(response.body).toMatchObject({
      originalName:
        "minimal-financial.docx",
      pageCount: 1,
      extractionStatus:
        "complete",
      ocrUsed: false,
    });
  } finally {
    fs.rmSync(
      uploadedPath,
      {
        force: true,
      },
    );

    fs.rmSync(
      extractionPath,
      {
        force: true,
      },
    );
  }
});
it("removes an uploaded file when document extraction fails", async () => {
  const uploadsDirectory =
    path.resolve("uploads");

  fs.mkdirSync(
    uploadsDirectory,
    {
      recursive: true,
    },
  );

  const beforeFiles =
    new Set(
      fs.readdirSync(
        uploadsDirectory,
      ),
    );

  const response =
    await request(app)
      .post("/api/documents")
      .attach(
        "document",
        Buffer.from(
          "this is not a valid pdf",
          "utf8",
        ),
        {
          filename:
            "vitest-invalid-upload.pdf",
          contentType:
            "application/pdf",
        },
      );

  expect(response.status).toBe(400);

  const afterFiles =
    fs.readdirSync(
      uploadsDirectory,
    );

  const newlyCreatedFiles =
    afterFiles.filter(
      (fileName) =>
        !beforeFiles.has(fileName),
    );

  expect(newlyCreatedFiles).toEqual([]);
});
it("rejects oversized JSON request bodies", async () => {
  const response =
    await request(app)
      .post(
        `/api/documents/${documentId}/verify`,
      )
      .send({
        question: "What was revenue in 2025?",
        padding: "x".repeat(20 * 1024),
      });

  expect(response.status).toBe(413);

  expect(response.body).toEqual({
    error: "Request body exceeds maximum size.",
  });
});
it("rejects excessively long questions", async () => {
  const question =
    "x".repeat(2001);

  for (const route of [
    "verify",
    "calculate",
  ]) {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/${route}`,
        )
        .send({
          question,
        });

    expect(response.status).toBe(400);

    expect(response.body).toMatchObject({
      error: "Question exceeds maximum length.",
    });
  }
});

it("rejects an extraction that exceeds the maximum page count", async () => {
  const oversizedDocumentId =
    "vitest-oversized-page-count-fixture";

  const oversizedExtractionPath =
    path.resolve(
      "extracted",
      `${oversizedDocumentId}.json`,
    );

  const pages =
    Array.from(
      { length: 501 },
      (_, index) => ({
        pageNumber: index + 1,
        source: "embedded_text",
        text: "Revenue 100",
      }),
    );

  fs.writeFileSync(
    oversizedExtractionPath,
    JSON.stringify({
      pages,
    }),
    "utf8",
  );

  try {
    const pagesResponse =
      await request(app)
        .get(
          `/api/documents/${oversizedDocumentId}/pages`,
        );

    expect(pagesResponse.status).toBe(422);

    expect(pagesResponse.body).toEqual({
      error:
        "Document extraction exceeds maximum page count.",
    });

    for (const route of [
      "search",
      "verify",
      "calculate",
    ]) {
      const response =
        await request(app)
          .post(
            `/api/documents/${oversizedDocumentId}/${route}`,
          )
          .send({
            question:
              route === "calculate"
                ? "What is the difference between revenue in 2025 and 2024?"
                : "What was revenue in 2025?",
          });

      expect(response.status).toBe(422);

      expect(response.body).toEqual({
        error:
          "Document extraction exceeds maximum page count.",
      });
    }
  } finally {
    fs.rmSync(
      oversizedExtractionPath,
      {
        force: true,
      },
    );
  }
});
it("rejects an extraction that exceeds the maximum file size", async () => {
  const oversizedDocumentId =
    "vitest-oversized-extraction-file-fixture";

  const oversizedExtractionPath =
    path.resolve(
      "extracted",
      `${oversizedDocumentId}.json`,
    );

  fs.writeFileSync(
    oversizedExtractionPath,
    JSON.stringify({
      pages: [
        {
          pageNumber: 1,
          source: "embedded_text",
          text: "x".repeat(
            8 * 1024 * 1024,
          ),
        },
      ],
    }),
    "utf8",
  );

  try {
    const response =
      await request(app)
        .get(
          `/api/documents/${oversizedDocumentId}/pages`,
        );

    expect(response.status).toBe(422);

    expect(response.body).toEqual({
      error:
        "Document extraction exceeds maximum file size.",
    });
  } finally {
    fs.rmSync(
      oversizedExtractionPath,
      {
        force: true,
      },
    );
  }
});
it("returns a controlled error for malformed extraction JSON", async () => {
  const documentId =
    "vitest-malformed-extraction-fixture";

  const extractionPath = path.resolve(
    "extracted",
    `${documentId}.json`,
  );

  fs.writeFileSync(
    extractionPath,
    "{ definitely not valid json",
    "utf8",
  );

  try {
    for (const route of [
      "verify",
      "calculate",
    ]) {
      const response =
        await request(app)
          .post(
            `/api/documents/${documentId}/${route}`,
          )
          .send({
            question:
              route === "verify"
                ? "What was revenue in 2025?"
                : "What is the difference between revenue in 2025 and 2024?",
          });

      expect(response.status).toBe(500);

      expect(response.body).toEqual({
        error: "Document extraction is invalid.",
      });
    }
  } finally {
    fs.rmSync(
      extractionPath,
      {
        force: true,
      },
    );
  }
});

it("returns a controlled error for malformed extraction JSON on pages and search", async () => {
  const documentId =
    "vitest-malformed-general-extraction-fixture";

  const extractionPath = path.resolve(
    "extracted",
    `${documentId}.json`,
  );

  fs.writeFileSync(
    extractionPath,
    "{ invalid json",
    "utf8",
  );

  try {
    const pagesResponse =
      await request(app)
        .get(
          `/api/documents/${documentId}/pages`,
        );

    expect(pagesResponse.status).toBe(500);

    expect(pagesResponse.body).toEqual({
      error: "Document extraction is invalid.",
    });

    const searchResponse =
      await request(app)
        .post(
          `/api/documents/${documentId}/search`,
        )
        .send({
          question: "revenue",
        });

    expect(searchResponse.status).toBe(500);

    expect(searchResponse.body).toEqual({
      error: "Document extraction is invalid.",
    });
  } finally {
    fs.rmSync(
      extractionPath,
      {
        force: true,
      },
    );
  }
});

it("returns a controlled error for an invalid extraction shape", async () => {
  const documentId =
    "vitest-invalid-extraction-shape-fixture";

  const extractionPath = path.resolve(
    "extracted",
    `${documentId}.json`,
  );

  fs.writeFileSync(
    extractionPath,
    JSON.stringify({
      pages: "wrong",
    }),
    "utf8",
  );

  try {
    for (const route of [
      "search",
      "verify",
      "calculate",
    ]) {
      const response =
        await request(app)
          .post(
            `/api/documents/${documentId}/${route}`,
          )
          .send({
            question:
              route === "calculate"
                ? "What is the difference between revenue in 2025 and 2024?"
                : "What was revenue in 2025?",
          });

      expect(response.status).toBe(500);

      expect(response.body).toEqual({
        error: "Document extraction is invalid.",
      });
    }
  } finally {
    fs.rmSync(
      extractionPath,
      {
        force: true,
      },
    );
  }
});

it("returns a controlled error for invalid extraction page entries", async () => {
  const documentId =
    "vitest-invalid-extraction-page-fixture";

  const extractionPath = path.resolve(
    "extracted",
    `${documentId}.json`,
  );

  fs.writeFileSync(
    extractionPath,
    JSON.stringify({
      pages: [
        {
          pageNumber: "one",
          source: "embedded_text",
          text: 123,
        },
      ],
    }),
    "utf8",
  );

  try {
    for (const route of [
      "search",
      "verify",
      "calculate",
    ]) {
      const response =
        await request(app)
          .post(
            `/api/documents/${documentId}/${route}`,
          )
          .send({
            question:
              route === "calculate"
                ? "What is the difference between revenue in 2025 and 2024?"
                : "What was revenue in 2025?",
          });

      expect(response.status).toBe(500);

      expect(response.body).toEqual({
        error: "Document extraction is invalid.",
      });
    }
  } finally {
    fs.rmSync(
      extractionPath,
      {
        force: true,
      },
    );
  }
});

it("returns a controlled error for an unsupported extraction source", async () => {
  const documentId =
    "vitest-invalid-extraction-source-fixture";

  const extractionPath = path.resolve(
    "extracted",
    `${documentId}.json`,
  );

  fs.writeFileSync(
    extractionPath,
    JSON.stringify({
      pages: [
        {
          pageNumber: 1,
          source: "unknown_source",
          text: "Revenue 100",
        },
      ],
    }),
    "utf8",
  );

  try {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/verify`,
        )
        .send({
          question:
            "What was revenue in 2025?",
        });

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      error: "Document extraction is invalid.",
    });
  } finally {
    fs.rmSync(
      extractionPath,
      {
        force: true,
      },
    );
  }
});

it("rejects an invalid pages document identifier", async () => {
  const response =
    await request(app)
      .get(
        "/api/documents/..%2Finvalid/pages",
      );

  expect(response.status).toBe(400);

  expect(response.body).toEqual({
    error: "Invalid document identifier.",
  });
});

it("rejects an excessively long search question", async () => {
  const response =
    await request(app)
      .post(
        `/api/documents/${documentId}/search`,
      )
      .send({
        question: "x".repeat(2001),
      });

  expect(response.status).toBe(400);

  expect(response.body).toEqual({
    error: "Question exceeds maximum length.",
  });
});

it("returns a consistent error when document extraction is missing", async () => {
  const documentId =
    "vitest-missing-extraction-fixture";

  const requests = [
    request(app)
      .get(
        `/api/documents/${documentId}/pages`,
      ),

    request(app)
      .post(
        `/api/documents/${documentId}/search`,
      )
      .send({
        question: "revenue",
      }),

    request(app)
      .post(
        `/api/documents/${documentId}/verify`,
      )
      .send({
        question: "What was revenue in 2025?",
      }),

    request(app)
      .post(
        `/api/documents/${documentId}/calculate`,
      )
      .send({
        question:
          "What is the difference between revenue in 2025 and 2024?",
      }),
  ];

  for (const pending of requests) {
    const response = await pending;

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      error: "Document extraction not found.",
    });
  }
});

it("handles an empty extraction without treating it as corrupt", async () => {
  const documentId =
    "vitest-empty-extraction-fixture";

  const extractionPath = path.resolve(
    "extracted",
    `${documentId}.json`,
  );

  fs.writeFileSync(
    extractionPath,
    JSON.stringify({
      pages: [],
    }),
    "utf8",
  );

  try {
    const verifyResponse =
      await request(app)
        .post(
          `/api/documents/${documentId}/verify`,
        )
        .send({
          question:
            "What was revenue in 2025?",
        });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.status)
      .toBe("insufficient_evidence");

    const calculateResponse =
      await request(app)
        .post(
          `/api/documents/${documentId}/calculate`,
        )
        .send({
          question:
            "What is the difference between revenue in 2025 and 2024?",
        });

    expect(calculateResponse.status).toBe(200);
    expect(calculateResponse.body.status)
      .toBe("insufficient_evidence");
  } finally {
    fs.rmSync(
      extractionPath,
      {
        force: true,
      },
    );
  }
});

it("rejects a partially invalid extraction instead of using partial evidence", async () => {
  const documentId =
    "vitest-partially-invalid-extraction-fixture";

  const extractionPath = path.resolve(
    "extracted",
    `${documentId}.json`,
  );

  fs.writeFileSync(
    extractionPath,
    JSON.stringify({
      pages: [
        {
          pageNumber: 1,
          source: "embedded_text",
          text: "Revenue 2025 100",
        },
        {
          pageNumber: 2,
          source: "embedded_text",
          text: 123,
        },
      ],
    }),
    "utf8",
  );

  try {
    const response =
      await request(app)
        .post(
          `/api/documents/${documentId}/verify`,
        )
        .send({
          question:
            "What was revenue in 2025?",
        });

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      error: "Document extraction is invalid.",
    });
  } finally {
    fs.rmSync(
      extractionPath,
      {
        force: true,
      },
    );
  }
});








