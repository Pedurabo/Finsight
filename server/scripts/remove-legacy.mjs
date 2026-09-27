import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const loaded = require("typescript");
const ts = loaded.default ?? loaded;

if (!ts.ScriptTarget || !ts.createSourceFile) {
  console.error(
    "Could not load the TypeScript compiler API.",
  );
  console.error(
    "Available keys:",
    Object.keys(loaded).slice(0, 30),
  );
  process.exit(1);
}

const file = "./src/index.ts";
const source = fs.readFileSync(file, "utf8");

const legacyNames = new Set([
  "legacyDetectMetric",
  "legacyDetectRequestedRevenueQualifier",
  "legacyScopeDirectlyModifiesMetric",
  "legacyDetectDirectMetricScopes",
  "legacyDetectFinancialScope",
  "legacyDetectArithmeticOperation",
  "legacyExtractQuestionYears",
  "legacyComputeArithmetic",
]);

const sourceFile = ts.createSourceFile(
  file,
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

const ranges = [];

for (const statement of sourceFile.statements) {
  if (
    ts.isFunctionDeclaration(statement) &&
    statement.name &&
    legacyNames.has(statement.name.text)
  ) {
    ranges.push({
      name: statement.name.text,
      start: statement.getFullStart(),
      end: statement.end,
    });
  }
}

if (ranges.length !== legacyNames.size) {
  console.error(
    `Expected ${legacyNames.size} legacy functions, found ${ranges.length}.`,
  );

  console.error(
    "Found:",
    ranges.map((r) => r.name).join(", "),
  );

  process.exit(1);
}

let updated = source;

for (
  const range of ranges.sort(
    (a, b) => b.start - a.start,
  )
) {
  updated =
    updated.slice(0, range.start) +
    updated.slice(range.end);
}

fs.writeFileSync(file, updated);

console.log(
  `Removed ${ranges.length} legacy functions:`,
);

for (
  const range of ranges.sort(
    (a, b) => a.start - b.start,
  )
) {
  console.log(`- ${range.name}`);
}
