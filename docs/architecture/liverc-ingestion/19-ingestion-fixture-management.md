---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Fixture management strategy for LiveRC ingestion testing
purpose:
  Defines how HTML fixtures are stored, versioned, audited, and evolved for
  ingestion testing. Fixtures enable deterministic testing and offline
  validation of ingestion logic, ensuring LiveRC HTML changes don't silently
  break the pipeline.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md
  - docs/architecture/liverc-ingestion/20-ingestion-replay-and-debugging.md
  - docs/roles/quality-automation-engineer.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 19. Ingestion Fixture Management (LiveRC Ingestion Subsystem)

This document defines how My Race Engineer (MRE) stores, versions, audits, and
evolves HTML fixtures used for ingestion testing. Fixtures are the backbone of
deterministic ingestion: they ensure that LiveRC HTML changes do not silently
break the pipeline and allow all ingestion logic to be tested offline.

Fixtures represent _canonical snapshots_ of upstream LiveRC pages in a
controlled environment.

The goals of fixture management are:

- ensure ingestion correctness is reproducible
- detect upstream HTML drift quickly
- guarantee deterministic ingestion results
- provide curated historical snapshots for regression testing
- allow ingestion debugging even when LiveRC is down
- support multiple connectors and future data sources

This document defines rules for fixture structure, metadata, redaction,
versioning, lifecycle, and CI enforcement.

---

## 1. What Fixtures Are and Why They Matter

A fixture is a stored HTML snapshot of:

- an event page
- one or more race result pages
- optional lap breakdown pages

Fixtures ensure:

1. Parsing logic is stable and verified
2. Ingestion results are reproducible
3. Upstream HTML changes are detectable
4. Cursor can test ingestion without a live network
5. Developer debugging becomes fast and consistent

Without fixtures, ingestion would rely on live HTML, which is unpredictable and
unsafe for automated testing.

---

## 2. Fixture Directory Structure

All fixtures MUST adhere to the following folder layout:

fixtures/ liverc/ <event_id>/ event.html race.<race_id>.html
laps.<race_result_id>.html metadata.json notes.md

Rules:

- <event_id> must match the LiveRC event ID
- <race_id> and <race_result_id> must match real IDs extracted from the event
- A fixture folder MUST contain _at minimum_ event.html
- metadata.json MUST contain information required to run the fixture ingestion
- notes.md is optional developer-facing commentary

Fixture directories must not contain binaries or screenshots; those belong in
diagnostic artefacts.

---

## 3. Fixture File Requirements

### 3.1 event.html

Must contain the _entire_ HTML of the event page:

- full head, scripts, styles, and body
- LiveRC-generated JavaScript blocks
- no trimming allowed
- no modifications except approved redaction rules

### 3.2 race.<race_id>.html

Minimum one per race referenced by the event page. Must contain:

- class name
- race label (e.g., A-Main)
- entries table
- lap summary tables
- embedded JS arrays (e.g., racerLaps)

### 3.3 laps.<race_result_id>.html (Optional)

LiveRC embeds lap data inline in the race page. If lap data exists only in
embedded scripts, a separate laps file is optional.

However, if lap data ever requires clicking JS-expandable sections in the
browser, Playwright-generated snapshot HTML MUST be stored here.

### 3.4 metadata.json

Contains structured details:

{ "event_id": "6304829", "source": "liverc", "fixture_version": 1, "tracks": {
"track_slug": "canberraoffroad", "track_name": "Canberra Off Road Model Car
Club" }, "races_expected": [501, 502, 503], "laps_expected": { "9001": 47,
"9002": 46 }, "notes": "This fixture set contains all A-Main pages from 2025
Rudi Wensing Memorial." }

Rules:

- keys must be stable across fixtures
- fixture_version increments when structure changes
- races_expected and laps_expected validate ingestion completeness

### 3.5 notes.md

Optional freeform commentary:

- page anomalies
- known LiveRC quirks
- debugging notes
- why this fixture exists

---

## 4. Fixture Redaction Policy

Fixture redaction is allowed ONLY for:

- email addresses
- IP addresses
- inline tokens or personal identifiers

Redaction must NEVER:

- modify structure
- remove DOM nodes
- change race ordering
- affect numeric or timing data

Redacted values must be replaced with placeholders such as:

REDACTED_EMAIL  
REDACTED_NAME

The redaction must be minimal and reversible in intent (not content).

---

## 5. Fixture Versioning and Change Control

### 5.1 Fixture Version Bumps

Fixture versions must be bumped when:

- LiveRC HTML structure changes
- new expected fields are added to normaliser output
- race or lap extraction logic evolves
- additional race types become ingestible

Fixtures must NEVER be silently overwritten.

### 5.2 Git Version Control

Rules:

- fixtures MUST be committed to Git
- binary files must not be included
- large fixture sets should be compressed or chunked if needed
- fixture diffs must be human-readable (HTML line-by-line diffs encouraged)

### 5.3 Review Requirements

Any PR modifying fixtures MUST include:

- explanation of what changed upstream
- explanation of what ingestion behaviour changed
- evidence that ingestion tests still pass
- fixture version increments when required

---

## 6. Fixture Lifecycle

Fixtures have a lifecycle:

### 6.1 Initial Capture

Captured from:

- httpx fetch (preferred)
- Playwright snapshot (when required)

Captured HTML must reflect exactly what LiveRC served.

### 6.2 Active Fixtures

These fixtures:

- reflect current ingestion logic
- run in CI regression tests
- are required for validating new ingestion releases

### 6.3 Deprecated Fixtures

Deprecated when:

- upstream changes invalidate them
- they no longer reflect typical LiveRC structures

Deprecated fixtures remain in archive/ for historical reproducibility.

### 6.4 Archived Fixtures

Archived fixtures:

- live under fixtures/archive/
- may be used for backwards compatibility or research
- do not run in CI unless explicitly invoked

---

## 7. Fixture Drift Detection

Fixtures detect when upstream HTML changes by causing:

- parsing failures
- missing elements
- baseline ingestion mismatches
- changed lap counts

Drift detection tests must:

- load fixtures
- run ingestion
- compare canonical normalised output to expected snapshots
- fail on any mismatch

Snapshot testing is mandatory.

---

## 8. Fixture Replay Engine

The ingestion subsystem must include a fixture replay mechanism:

replay_fixture(event_id):

- loads fixtures/liverc/<event_id>/
- configures ingestion to fetch from disk instead of network
- runs full pipeline
- emits logs, metrics, and diagnostics
- asserts determinism

Fixture replay is used for:

- debugging
- regression testing
- performance benchmarking
- verifying backwards compatibility

---

## 9. Playwright Fixture Generation

When a page requires JS execution:

- Playwright navigates to the page
- waits for all relevant selectors
- extracts the fully materialised DOM
- saves a static snapshot as race.<race_id>.html or laps.<id>.html

Snapshots must not include:

- ads
- dynamic live banners
- non-deterministic DOM elements

If the DOM contains volatile content, it must be normalised.

---

## 10. Fixture Maintenance Guidelines

1. Keep fixtures small but complete.
2. Do not trim important HTML sections.
3. Keep metadata.json aligned with schema changes.
4. Always document upstream changes in notes.md.
5. Avoid frequent fixture churn; treat them as contracts.
6. Use diffs to detect subtle upstream DOM changes.
7. Periodically add new fixtures for new event types.
8. Curate a representative fixture library across years and clubs.

---

## 11. Long-Term Fixture Strategy

Long-term goals include:

- centralised global fixture registry for all connectors
- automated diffing of new upstream HTML against known fixtures
- fixture compression for weight reduction
- ingestion drift dashboards
- version tagging fixtures with LiveRC UI version identifiers
- connector-agnostic fixture replay tools

These steps ensure the ingestion subsystem remains resilient over years even as
upstream sites evolve.

---

End of 19-ingestion-fixture-management.md.
