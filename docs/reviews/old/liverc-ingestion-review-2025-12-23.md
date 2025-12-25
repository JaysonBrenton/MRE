---
created: 2025-12-23
creator: LiveRC Ingestion Review
lastModified: 2025-12-23
reviewVersion: 1.0
description: Comprehensive review of the LiveRC ingestion architecture, code, operations, and testing processes
purpose: Summarize current state, risks, and recommendations before the next round of ingestion hardening work
relatedFiles:
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/operations/liverc-operations-guide.md
  - ingestion/connectors/liverc/connector.py
  - ingestion/ingestion/pipeline.py
  - docs/architecture/liverc-ingestion/15-ingestion-observability.md
  - docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md
---

# LiveRC Ingestion Review

**Review Date:** 2025-12-23  
**Reviewer:** Codex (AI assistant)  
**Scope:** Architecture docs, connector + pipeline code, CLI/ops tooling, and ingestion test strategy

---

## Scope of Evidence

- Architecture specs (`docs/architecture/liverc-ingestion/03-ingestion-pipeline.md`, `docs/architecture/liverc-ingestion/02-connector-architecture.md`, `docs/architecture/liverc-ingestion/15-ingestion-observability.md`, `docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md`)
- Operations runbooks (`docs/operations/liverc-operations-guide.md`)
- Connector and pipeline implementations (`ingestion/connectors/liverc/connector.py`, `ingestion/ingestion/pipeline.py`, `ingestion/common/logging.py`)
- CLI tooling and cron integration (`ingestion/cli/commands.py`, `ingestion/scripts/run-track-sync.sh`, `ingestion/crontab`)
- Test directories and fixtures (`ingestion/tests/unit`, `ingestion/tests/integration`, `ingestion/tests/fixtures/liverc`)

---

## Highlights

- The ingestion pipeline spec is thorough and clearly separates catalogue sync, event sync, and deep ingestion responsibilities, including idempotency expectations (`docs/architecture/liverc-ingestion/03-ingestion-pipeline.md:42`). The implementation mirrors this design with explicit locking, validation, and batch race processing (`ingestion/ingestion/pipeline.py:43` through `ingestion/ingestion/pipeline.py:355`).
- Operational workflows are well documented for administrators, with Docker-first instructions, CLI command references, and troubleshooting tips (`docs/operations/liverc-operations-guide.md:72`). Track catalogue sync is even automated via a cron-integrated wrapper script that produces Markdown reports for auditing (`ingestion/scripts/run-track-sync.sh:12`, `ingestion/crontab:1`).
- Structured logging is consistently enforced across modules via the shared structlog setup (`ingestion/common/logging.py:1`), so ingest runs already emit machine-parseable context even before dedicated metrics land.

---

## Detailed Findings

### 1. Observability stops at logs; metrics/tracing from the spec are not implemented (High)

- **Evidence:** The observability standard mandates emitting metrics such as `ingestion_duration_seconds`, race fetch latency, DB row counters, and connector error totals, plus optional tracing spans (`docs/architecture/liverc-ingestion/15-ingestion-observability.md:43`-`docs/architecture/liverc-ingestion/15-ingestion-observability.md:155`). The pipeline and CLI flows currently only call `logger.info`/`logger.warning` without recording any counters, histograms, or spans (`ingestion/ingestion/pipeline.py:268`-`ingestion/ingestion/pipeline.py:355`). Repo-wide searches for the prescribed metric names return only documentation references.
- **Impact:** Operations cannot detect ingestion slowdowns, partial failures, or upstream HTML drift without manually parsing logs. Alerting on ingestion stagnation, race fetch retries, or lap extraction regressions is impossible, undermining the Alpha readiness goal for predictable ingest ops.
- **Recommendation:** Introduce a metrics module (Prometheus client or OpenTelemetry) that instruments the lifecycle events called out in the spec: wrap `ingest_event`, `_process_races_batch`, and DB writes with timers and counters, and emit connector error totals. Capture optional spans (at least structured timing objects) so trace context can be added later.

### 2. Event detail fetches never fall back to Playwright despite the browser strategy (High)

- **Evidence:** The connector rules call for trying HTTPX first and escalating to Playwright when event metadata or race lists depend on JavaScript (`docs/architecture/liverc-ingestion/02-connector-architecture.md:288`-`docs/architecture/liverc-ingestion/02-connector-architecture.md:520`). However, `LiveRCConnector.fetch_event_page` only uses HTTPX and never checks DOM completeness nor attempts a browser fallback (`ingestion/connectors/liverc/connector.py:230`-`ingestion/connectors/liverc/connector.py:285`). The inline TODO comment even states that parsers “will raise errors indicating they need implementation,” which is now stale and hints at unfinished fallback logic.
- **Impact:** Any track that loads event stats dynamically (e.g., panels that expand via JS) will permanently fail ingestion because the connector simply raises `EventPageFormatError`. Given the “event discovery + on-demand ingestion” flow, this would block users from importing those events entirely.
- **Recommendation:** Mirror the approach used in `list_events_for_track` and `fetch_race_page`: cache page-type decisions, retry with Playwright when headers or tables are missing, and remove the obsolete comment. Consider logging metrics on how often each code path is taken once metrics are in place.

### 3. Race ingestion can spawn 15 concurrent Playwright browsers, violating the “single page per race” goal (Medium)

- **Evidence:** The browser strategy explicitly asks us to minimise Playwright usage and ideally touch only one dynamic page per race (`docs/architecture/liverc-ingestion/02-connector-architecture.md:441`-`docs/architecture/liverc-ingestion/02-connector-architecture.md:499`). Yet the pipeline sets `RACE_FETCH_CONCURRENCY = 15` and fetches races in parallel batches (`ingestion/ingestion/pipeline.py:43`-`ingestion/ingestion/pipeline.py:150`). Whenever a batch requires Playwright, each call constructs a fresh browser context inside `LiveRCConnector.fetch_race_page` (`ingestion/connectors/liverc/connector.py:336`-`ingestion/connectors/liverc/connector.py:345`).
- **Impact:** Large events can easily spawn 10–15 headless Chromium processes simultaneously, which is heavy for the ingestion host and also raises bot-detection risks at LiveRC. Spikes in CPU/memory also threaten the ingestion service container, undermining reliability.
- **Recommendation:** Introduce a small Playwright context pool (1–2 browsers reused sequentially) or lower `RACE_FETCH_CONCURRENCY` when Playwright is required. Alternatively, detect Playwright-only URLs upfront and throttle those fetches so that at most one browser session runs at a time, aligning with the intent of the browser strategy.

### 4. Only track sync is automated; event catalogue syncs and full ingests rely on manual operator runs (Medium)

- **Evidence:** The ops guide lists manual CLI flows for event discovery, refresh, and ingestion (`docs/operations/liverc-operations-guide.md:92`-`docs/operations/liverc-operations-guide.md:200`) and explicitly notes automation only for `refresh-tracks` via cron (`docs/operations/liverc-operations-guide.md:171`). The cron file confirms that only `/usr/local/bin/run-track-sync.sh` runs on a schedule (`ingestion/crontab:1`).
- **Impact:** Tracks can stay in sync automatically, but event catalogues and ingestion depth upgrades will drift unless an operator regularly iterates through every followed track. This approach will not scale once dozens of tracks are being monitored and makes SLA compliance (e.g., “events ready within N hours”) unenforceable.
- **Recommendation:** Define at least a daily job that runs `refresh-events --depth none` for followed tracks, and a policy/automation for re-ingesting “followed + new” events. Even a simple cron wrapper that loops through a tracked list would keep metadata fresh without manual toil.

### 5. Testing coverage stops at parser unit tests despite the mandated integration and regression suites (High)

- **Evidence:** The testing strategy demands eight test categories, including fixture-driven integration tests, regression drift checks, concurrency/locking tests, and performance baselines (`docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md:48`-`docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md:190`). The repository currently contains unit tests for parsers and the state machine, but `ingestion/tests/integration/` holds only an empty placeholder (`ingestion/tests/integration/__init__.py:1`), and there are no regression/performance suites or chaos tests anywhere else.
- **Impact:** End-to-end ingestion remains untested. Parser changes, DB schema tweaks, or concurrency bugs can ship without detection, and LiveRC HTML drift will only be caught in production. This gap also contradicts the Alpha-readiness objective laid out in the testing spec.
- **Recommendation:** Prioritise fixture-based integration tests that replay at least one full event end to end (connector + normalizer + repository). Follow up with regression tests comparing parsed structures to golden JSON, and add concurrency tests around `IngestionPipeline.ingest_event` with advisory locks mocked/stubbed. The existing fixtures under `ingestion/tests/fixtures/liverc` can seed the first pass.

---

## Next Steps

1. Implement the observability hooks (metrics + optional tracing) and surface them via the ingestion CLI/API so ops can alert on drift.
2. Fix browser detection in `fetch_event_page` and throttle Playwright usage to avoid resource spikes.
3. Design and wire an automated event refresh workflow, even if it initially targets a short list of followed tracks.
4. Stand up the missing integration/regression suites so future connector or parser work lands with meaningful coverage.

These changes will align the implementation with the documented expectations and materially improve the reliability of LiveRC ingestion heading into the next release.
