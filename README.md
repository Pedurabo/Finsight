# FinSight

FinSight is a financial-document research workbench for extracting, retrieving, reconciling, verifying, and calculating financial information from PDF and DOCX documents while preserving evidence provenance.

FinSight favors conservative financial reasoning: when evidence is missing, ambiguous, incompatible, or conflicting, the system abstains instead of manufacturing an answer.

## Project Status

FinSight currently has a mature financial-reasoning backend and a functional React research-workbench client.

The backend reasoning layer is frozen at its current validated baseline while future work focuses on extraction robustness, real-document regression coverage, and product refinement.

### Current release gates

Backend:

- TypeScript type-check passes with `npm run typecheck`
- Automated test suite passes with 234 tests
- Unit, integration, financial-evidence, and evidence-policy coverage
- Controlled API error handling and resource limits

Client:

- Production build passes with `npm run build`
- ESLint passes with `npm run lint`
- Configurable API base URL
- Answer-first financial analysis experience
- Structured insufficient-evidence guidance
- Evidence and provenance presentation
- Componentized React architecture

## Supported Financial Metrics

- Revenue
- Operating Income
- Net Income
- Gross Margin
- Assets
- Liabilities
- Equity

## Supported Calculations

- Difference
- Ordered subtraction
- Ratio
- Percentage change
- Same-scope period comparisons
- Cross-scope comparisons

Calculations preserve operand provenance and normalize compatible financial scales before arithmetic.

## Evidence Reconciliation

FinSight reconciles multiple candidate values conservatively.

Current behavior includes:

- original vs. restated evidence
- restatement precedence
- conflicting-restatement abstention
- conflicting-original abstention unless supported evidence quality resolves the conflict
- conservative handling of unknown revision relationships
- embedded-text precedence over conflicting OCR when revision status is equivalent
- duplicate evidence reconciliation
- provenance propagation through verification and calculations

Evidence-selection policies include:

- `single_candidate`
- `consistent_evidence`
- `restatement_precedence`
- `embedded_text_precedence`

## Currency and Scale Handling

FinSight preserves explicit currency and scale metadata.

Supported behavior includes:

- ISO-style currency handling
- explicit ISO currency precedence over `$`
- lowercase currency normalization
- ambiguity rejection
- thousand, million, and billion scale normalization
- compatible operand scale conversion before arithmetic
- rejection of incompatible currencies
- no locale-based currency guessing
- no foreign-exchange conversion

## Structured Abstention

FinSight returns structured insufficient-evidence responses when a result cannot be established safely.

Current reason codes include:

- `unsupported_intent`
- `unsupported_metric`
- `unsupported_scope`
- `ambiguous_request`
- `missing_evidence`
- `conflicting_evidence`
- `incompatible_metadata`
- `unsafe_calculation`

The client translates these codes into concise user-facing guidance while retaining the backend's detailed reasoning.

## Document Extraction

FinSight accepts:

- PDF
- DOCX

Extraction provenance is recorded as:

- `embedded_text`
- `ocr`

The backend validates extraction data before financial reasoning is performed.

Handled extraction conditions include:

- malformed extraction JSON
- invalid extraction root structures
- invalid page entries
- unsupported provenance values
- partially corrupt extractions
- missing extraction files
- empty but valid extractions
- excessive page counts
- excessive extraction file sizes

## API Hardening

The backend includes explicit validation and limits for:

- 16 KB JSON request bodies
- 2,000-character questions
- 500-page extraction maximum
- 8 MiB extraction JSON maximum
- 30 MiB upload maximum
- safe document identifiers
- MIME type and extension consistency
- malformed request bodies
- invalid uploads
- failed-upload cleanup
- controlled unknown-error responses

Relevant endpoints include:

- `GET /api/documents/:id/pages`
- `POST /api/documents/:id/search`
- `POST /api/documents/:id/verify`
- `POST /api/documents/:id/calculate`

## Client Experience

The React client is organized as a research workbench with three primary areas:

1. document sources
2. question, answer, and retrieved evidence
3. provenance and calculation details

The answer is presented as the primary analysis result.

Supported results display the resolved metric and value prominently.

When FinSight abstains, the client can display guidance such as:

- Required evidence is missing
- Conflicting values were found
- Financial metadata does not match
- The request is ambiguous
- That metric is not supported
- The calculation cannot be completed safely

The detailed backend reason remains visible for traceability.

## Client Architecture

The client uses React, TypeScript, and Vite.

Presentation is separated into focused components:

```text
client/src/
├── components/
│   ├── AnswerCard.tsx
│   ├── EvidenceList.tsx
│   ├── ProvenancePanel.tsx
│   ├── QuestionPanel.tsx
│   └── SourcePanel.tsx
├── App.tsx
├── App.css
├── types.ts
└── main.tsx
```

`App.tsx` retains application state and API orchestration while presentation is delegated to the component layer.

## Configuration

The client supports a configurable backend URL:

```text
VITE_API_BASE_URL=http://127.0.0.1:3001
```

See `client/.env.example`.

If the environment variable is not defined, the development client defaults to `http://127.0.0.1:3001`.

## Development

### Backend

From the `server` directory:

```bash
npm install
npm run dev
```

Run the backend type-check:

```bash
npm run typecheck
```

Run the automated test suite:

```bash
npm test
```

### Client

From the `client` directory:

```bash
npm install
npm run dev
```

Production validation:

```bash
npm run build
npm run lint
```

## Known Extraction Work

Financial reasoning and client behavior are currently more mature than the extraction layer.

Some large or print-generated PDFs can be rejected by the current PDF parser before OCR can run.

A fallback extraction experiment was evaluated but intentionally not merged because the large-document path remained too expensive and unreliable.

Improved PDF compatibility therefore remains a future extraction-engine enhancement.

## Regression Corpus

The financial reasoning suite has extensive synthetic and integration coverage.

The Microsoft FY2025 10-K regression fixture has now been independently verified against Microsoft's official source document.

The stored upload SHA-256 matches the official Microsoft FY2025 10-K binary, the paired extraction artifact has its own verified SHA-256, and the regression script validates both hashes before running financial assertions.

This protects the real-document regression path from silently running against mismatched or replaced corpus artifacts.

An earlier manual UI session produced unrelated OCR evidence during a Microsoft-document test. That anomalous session has not been reproduced at the stored upload/extraction layer and is tracked separately from the verified regression corpus.

## Development Roadmap

Next meaningful milestones:

1. expand the hash-verified real-document regression corpus
2. improve PDF extraction compatibility
3. expand manual end-to-end client verification
4. continue responsive and accessibility improvements
5. broaden real financial-report coverage
6. prepare deployment and production observability

## Project Philosophy

FinSight favors traceable evidence and explicit uncertainty over unsupported certainty.

When financial evidence cannot be reconciled safely, the system is designed to abstain, expose the reason, and preserve the evidence needed for human review.

