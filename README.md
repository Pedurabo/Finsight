# FinSight

FinSight is a financial-document analysis system focused on extracting, reconciling, verifying, and calculating financial information from source documents while preserving evidence provenance and abstaining when evidence is insufficient or conflicting.

## Current Backend Status

The financial reasoning engine is substantially complete. Current development is focused on production hardening, resource limits, security, observability, and broader real-document regression testing.

### Supported Financial Metrics

- Revenue
- Operating Income
- Net Income
- Gross Margin
- Assets
- Liabilities
- Equity

### Supported Calculations

- Difference
- Ordered subtraction
- Ratio
- Percentage change
- Same-scope period comparisons
- Cross-scope comparisons

Calculations preserve operand provenance and normalize compatible financial scales before arithmetic.

## Evidence and Reconciliation

FinSight currently supports:

- original vs. restated evidence
- restatement precedence
- conflicting-restatement abstention
- embedded-text precedence over conflicting OCR when revision status is equivalent
- duplicate evidence reconciliation
- evidence provenance propagation
- conservative handling of ambiguous or conflicting evidence

## Currency and Scale Handling

The backend supports explicit financial metadata including currencies and thousand/million/billion scales.

Compatible scales are normalized before calculations. FinSight does not guess currencies from locale and does not perform foreign-exchange conversion.

## Structured Abstention

FinSight returns structured insufficient-evidence responses instead of manufacturing answers.

Current reason codes include:

- `unsupported_intent`
- `unsupported_metric`
- `unsupported_scope`
- `ambiguous_request`
- `missing_evidence`
- `conflicting_evidence`
- `incompatible_metadata`
- `unsafe_calculation`

## Extraction Safety

The backend validates stored extraction data before it reaches financial reasoning.

Current handling includes:

- malformed extraction JSON
- invalid extraction root structures
- invalid page entries
- unsupported provenance values
- partially corrupt extractions
- missing extraction files
- valid but empty extractions

Supported extraction sources:

- `embedded_text`
- `ocr`

Lifecycle behavior:

- missing extraction -> HTTP 404
- corrupt or invalid extraction -> controlled HTTP 500
- valid extraction with no usable evidence -> HTTP 200 with `insufficient_evidence`

## API Validation

Financial and search endpoints currently enforce:

- required questions
- trimmed non-empty questions
- string question values
- maximum question length
- safe document identifiers
- consistent missing-extraction responses

Relevant endpoints:

- `GET /api/documents/:id/pages`
- `POST /api/documents/:id/search`
- `POST /api/documents/:id/verify`
- `POST /api/documents/:id/calculate`

## Testing

FinSight has unit, integration, evidence-policy, financial-evidence, and real-document regression coverage.

The regression suite currently includes a Microsoft FY2025 Q4 / 10-K document and verifies financial extraction and calculation behavior against real document evidence.

## Backend Development

From the `server` directory:

```bash
npm install
npm run dev
```

Run the automated test suite:

```bash
npm test
```

Run the real-document regression script from PowerShell:

```powershell
.\scripts\regression.ps1 `
  -DocumentId "1790500547621-MSFT_FY25q4_10K.docx"
```

## Repository Structure

```text
FinSight/
├── client/
└── server/
    ├── scripts/
    ├── src/
    ├── extracted/
    ├── uploads/
    ├── package.json
    └── tsconfig.json
```

Core backend logic currently lives primarily in:

- `server/src/app.ts`
- `server/src/pureLogic.ts`
- `server/src/evidencePolicy.ts`
- `server/src/financialEvidence.ts`

## Development Roadmap

Next backend milestones:

1. resource and performance limits
2. security and productization hardening
3. observability and debug-output cleanup
4. explicit build/type-check release gate
5. broader real-document regression corpus
6. final backend verification and freeze

## Project Philosophy

FinSight favors traceable evidence and explicit uncertainty over unsupported certainty.

When financial evidence cannot be reconciled safely, the system is designed to abstain and expose the reason rather than fabricate a deterministic result.
