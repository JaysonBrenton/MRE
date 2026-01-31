---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Complete testing strategy for LiveRC ingestion subsystem
purpose:
  Defines the complete testing strategy including test categories, fixture
  design, performance baselines, concurrency tests, and regression detection.
  Governs how ingestion correctness is guaranteed across all environments.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/19-ingestion-fixture-management.md
  - docs/architecture/liverc-ingestion/20-ingestion-replay-and-debugging.md
  - docs/roles/quality-automation-engineer.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 18. Ingestion Testing Strategy (LiveRC Ingestion Subsystem)

This document defines the complete testing strategy for the LiveRC ingestion
subsystem in My Race Engineer (MRE). It outlines testing principles, required
test categories, fixture design, performance baselines, concurrency tests,
browser fallback verification, and regression detection for upstream HTML
changes. This document governs how ingestion correctness is guaranteed across
all environments.

The goals are:

- make ingestion deterministic, reproducible, and verifiable
- detect LiveRC HTML changes before they break production
- prevent silent ingestion failures
- exercise all connectors (httpx, Playwright)
- validate the normalisation pipeline and DB model
- ensure concurrency, idempotency, and state-machine guarantees
- establish a long-lived testing discipline for future connectors

This strategy includes the recommended test directory structure.

---

## 1. Testing Principles

1. Ingestion must produce identical results given identical upstream fixtures.
2. All ingestion logic must be testable without a live network.
3. Live network tests are allowed but must run only when explicitly enabled.
4. Fixtures represent the authoritative contract between LiveRC and MRE.
5. A single ingestion must be observable, debuggable, and reproducible via
   fixtures.
6. Failures must be predictable and produce structured error outputs.
7. Browser-based connector tests must verify fallback behaviour, not replace
   fixtures.

---

## 2. Test Categories

Ingestion testing is divided into eight categories.

### 2.1 Unit Tests

Unit tests verify isolated functions:

- HTML parsing helpers
- time parsing functions
- lap normalisation logic
- slug resolution
- mapping LiveRC integers/strings to canonical MRE types
- ingest state-machine transitions
- URL construction functions

Unit tests use synthetic, minimal HTML snippets (not full fixtures).

---

### 2.2 Integration Tests (Fixture-Based)

These tests simulate full ingestion of an event using:

- saved HTML event pages
- saved HTML race result pages
- saved HTML lap sections

Integration tests must validate:

- correct race detection
- correct result extraction
- correct lap extraction
- preservation of ordering (races, results, laps)
- DB write correctness and idempotency
- stable ingestion outcomes across versions

Integration tests MUST run without network access.

Fixtures are stored under:

fixtures/liverc/<event_id>/

---

### 2.3 Regression Tests (HTML Drift Detection)

LiveRC may change HTML unexpectedly. Regression tests detect drift by:

- comparing parsed output of new HTML fixtures against known-good outputs
- failing when new upstream structure breaks field extraction
- capturing HTML diffs on parser failure

These tests MUST:

- run automatically in CI
- produce minimal but actionable error messages
- isolate which part of HTML changed

Optionally, regression tests may compare:

- race ordering
- lap counts
- missing fields
- malformed JS snippets

---

### 2.4 Concurrency and Locking Tests

These tests verify the ingestion lock behaviour:

- simultaneous ingestion requests
- retry behaviour
- lock timeout behaviour
- correct lock release on error
- correct block on second request

These tests MUST simulate:

- ingestion overlap attempts
- ingestion crash scenarios (mocked)
- ingestion completing after timeout

---

### 2.5 Performance and Scaling Tests

Performance tests measure:

- ingestion duration for fixtures of increasing size
- lap extraction speed for large multi-class events
- memory usage under Playwright fallback
- DB write throughput (rows inserted and updated per second)

Performance tests MUST:

- establish baseline metrics
- fail when ingestion regressions exceed thresholds
- compare ingestion time between versions

“Large events” should use fixtures with the highest real-world driver counts.

---

### 2.6 Chaos and Failure Mode Tests

These tests intentionally break ingestion to ensure robustness.

Chaos scenarios must include:

- empty HTML pages
- missing tables or headings
- malformed JavaScript blocks
- lap arrays truncated
- wrong DOM structures (div replaced with span, etc)
- HTTPX returning 404, 500
- Playwright timing out or failing selectors
- partial DB writes simulated via transactional failures

The ingestion pipeline must:

- classify failures into known error types
- produce structured errors
- terminate cleanly
- leave the DB in a consistent state

---

### 2.7 Determinism Tests

Determinism tests ensure:

- identical fixture inputs always produce identical DB outputs
- ingestion is idempotent
- ingestion re-runs do not modify unaffected rows
- lap ordering and timestamps never vary
- race ordering is stable

Determinism is a hard requirement for any system used for analytics.

---

### 2.8 Cross-Version Compatibility Tests

These tests ensure ingestion changes do not break persisted data or logic.

Examples:

- event ingested under version A must ingest identically under version B
- fixture replays must produce identical results across versions
- DB migrations must preserve ingestion correctness

This protects historical ingestion correctness.

---

## 3. Test Environment Requirements

### 3.1 Local Development

Local tests must:

- run with no network access
- allow toggling Playwright mode
- work with ephemeral or in-memory databases
- allow step-through debugging with breakpoints

### 3.2 CI Requirements

CI must:

- run all unit tests
- run fixture-based ingestion tests
- run regression tests
- optionally run performance tests (in a scheduled nightly job)

Playwright tests must run only when explicitly enabled in CI (common in Linux
headless pipelines).

---

## 4. Fixture Design

### 4.1 Fixture Storage

Fixtures live under:

fixtures/liverc/<event_id>/

Minimum fixture set:

- event.html
- race.<race_id>.html
- laps.<race_result_id>.html (if stored separately)
- metadata.json (tracks mapping, test harness configuration)

### 4.2 Fixture Quality Requirements

Fixtures must:

- represent real LiveRC pages
- include full HTML, not selectively trimmed content
- be timestamped and versioned
- include multiple event sizes (small, medium, large)
- include pathological events (zero drivers, missing laps, etc)

### 4.3 Fixture Redaction

If needed, fixture content may redact:

- emails
- personal identifiers

Driver names must remain intact for consistency tests.

---

## 5. End-to-End Ingestion Tests

These tests simulate a full run:

1. load event fixture
2. load all race fixtures
3. load all lap fixtures
4. run full pipeline (fetch mocked, parse, normalise, persist)
5. query backend APIs
6. compare outputs to expected snapshots

E2E tests confirm:

- ingestion correctness
- API integrity
- DB consistency
- full system determinism

These tests are the highest-value ingestion tests.

---

## 6. Browser Fallback Tests (Playwright)

Playwright fallback is only needed for pages where JS populates the DOM.

Tests must verify:

- fallback is used only when httpx fails
- browser rendering produces expected HTML structure
- Playwright selector waits behave correctly
- browser timeouts trigger correct ingestion error types
- fallback performance remains acceptable

Test fixtures may include:

- synthetic JS-rendered pages
- pages with delayed DOM injection
- missing script tags

---

## 7. DB State Validation Tests

These tests verify:

- event, race, result, lap tables are populated correctly
- fields conform to schema and constraints
- no duplicate rows are created
- ingest_depth and last_ingested_at update correctly
- idempotency ensures stable DB state across reruns

Each test must produce a human-readable diff when mismatches occur.

---

## 8. Test Folder Structure (Recommended)

All ingestion tests MUST follow a structured layout:

tests/ ingestion/ unit/ parsing/ normalisation/ utils/ integration/ events/
races/ laps/ regression/ html-drift/ parser-changes/ performance/ benchmarks/
chaos/ malformed-html/ timeouts/ browser-failures/ determinism/ fixture-replays/
concurrency/ locking/ race-conditions/ fixtures/ liverc/ <event_id>/ event.html
race.<race_id>.html laps.<race_result_id>.html metadata.json

This folder structure must be adhered to for Cursor to reason correctly about
test placement.

---

## 9. Minimum Required Test Coverage for V1

To ship ingestion, the following are required:

- unit tests for all parsing utilities
- at least 3 representative fixture-based integration tests
- 1 concurrency lock test
- 1 determinism test
- 1 browser fallback test
- 1 malformed HTML chaos test
- baseline ingestion duration test

Further tests may be added incrementally.

---

## 10. Long-Term Testing Strategy

Future upgrades include:

- multi-connector unified ingestion tests
- differential test harness that auto-detects HTML structural drift
- automatic ingestion replays of historical fixtures
- validation of AI-driven analysis based on ingestion outputs
- nightly ingestion regression CI
- cross-club fixture library

---

End of 18-ingestion-testing-strategy.md.
