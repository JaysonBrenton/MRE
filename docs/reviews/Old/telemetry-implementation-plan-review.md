# Telemetry Implementation Plan Review

**Date:** 2026-02-16  
**Reviewed:** [Telemetry Implementation Design](../telemetry/Design/Telemetry_Implementation_Design.md) §1.5, §9 (Implementation Phase Overview, Roadmap, Milestone Checklist) and related sections  
**Comparison baseline:** [Practice Day Full Ingestion Implementation Plan](../implimentation_plans/practice-day-full-ingestion-implementation-plan.md)

---

## 1. Verdict

- **Correctness:** The implementation design is **correct** and internally consistent. Phases (MVP → v1 → v2), deliverables, dependencies (§1.6), architecture (§2), data models (§3), and the milestone checklists (§9.5) align with the referenced design docs and ADRs.
- **Implementation readiness:** The document is **not yet comprehensive enough** to start implementation in the same way the practice-day plan is. It works as a high-level roadmap and design consolidation but lacks task-level steps, infra decisions, phase dependencies, test strategy, and doc-update obligations. Adding the sections below would make it implementation-ready.

---

## 2. What Is Correct and Sufficient

- **Phase scope:** MVP (metadata, CSV/GPX, Parquet, session list, upload API), v1 (all text parsers, fusion, lap detection, ClickHouse, quality, LiveRC link), v2 (binary parsers, track SFL, user SFL, 9-axis, segments) is clear and consistent with the rest of the doc.
- **Key decisions table (§1.6):** Storage authority, IDs, retention, downsample naming, fusion, lap detection, LiveRC link, export format are stated and traceable to ADRs.
- **Architecture and data flow (§2):** Control vs compute plane, pipeline stages, sequence diagram, storage tiers, delete ordering, and job types are well defined.
- **Data models (§3):** Postgres tables, ClickHouse tables, API endpoints, Parquet layout, and canonical stream contracts are summarised with pointers to the Concrete Data Model and API Contract.
- **Authoritative sources (§1.4):** Good index to Architecture Blueprint, API Contract, Concrete Data Model, Pipeline/State Machine, Fusion Blueprint, Lap Detection, Supported Formats, Trust Quality, and ADRs.
- **Milestone checklists (§9.5):** MVP/v1/v2 checkboxes are reasonable high-level deliverables.

---

## 3. Gaps for Implementation Readiness

### 3.1 Prerequisites and Conventions (Missing)

The practice-day plan has an explicit **Section 0** that the telemetry plan lacks:

- **Execution environment:** Docker-only; which container runs the Python compute plane (existing `mre-liverc-ingestion-service` or a new telemetry worker?), which runs Next.js (`mre-app`).
- **Testing:** Where tests live (e.g. `ingestion/tests/`, `src/__tests__/`), fixture strategy (sample CSV/GPX under `ingestion/tests/fixtures/telemetry/`), and how to run tests (`docker exec ... pytest`, `npm test`).
- **Schema and migrations:** Telemetry tables are **not** in the repo today (no `telemetry_*` in Prisma). The plan should state: schema changes via Prisma migrations; Python/Next.js both use the same Postgres; any new service (e.g. worker) must stay in sync.
- **Documentation policy:** “Every doc touched is listed in the Documentation phase with exact updates; no doc left behind.”

**Recommendation:** Add a **§0 Prerequisites and Conventions** (or equivalent) to the Implementation Design, or to a separate `docs/implimentation_plans/telemetry-implementation-plan.md` that references the design.

### 3.2 Phase Dependencies (Unclear)

§9 has phases and a “Suggested Implementation Order” (§9.4) but:

- There is **no dependency table** (e.g. “Phase v1.3 depends on Phase v1.1 and v1.2”).
- §9.4 says: “1. Processing pipeline and state machine, 2. API contract, 3. Data model and schema…”. The **MVP checklist** instead starts with “Postgres metadata schema” and “Upload API”. So it is unclear whether to implement the pipeline skeleton first or schema/API first.

**Recommendation:** Add a **phase dependency table** (similar to practice-day plan §1) and align §9.4 with it (e.g. “Schema and API first for MVP, then pipeline and workers”).

### 3.3 Task-Level Breakdown (Missing)

Current phases are bullet lists of **deliverables**, not **tasks** with:

- File paths (e.g. where do parsers live: `ingestion/telemetry/parsers/`? New package?).
- Method/interface names (e.g. ParserPlugin contract: `detect()`, `parse()`, `ParseResult`).
- Exact steps (e.g. “Create Prisma migration adding `telemetry_sessions`, `telemetry_artifacts`…”).
- Verification steps (“Run migration; query Postgres; run existing tests”).

**Recommendation:** For MVP at minimum, expand each checklist item into 1–3 concrete tasks with file paths and exit criteria. Example for “CSV parser (Level 1)”:

- Implement `CsvParser` in `ingestion/telemetry/parsers/csv_parser.py` per Supported Formats §8.
- Add fixture `ingestion/tests/fixtures/telemetry/sample_gnss_10hz.csv` and a unit test that parses it and asserts `has_gnss_position`, stream shape.
- Exit criteria: test passes; parser registered in classifier.

### 3.4 Infrastructure and Runtime (Underspecified)

- **Object storage (Parquet):** §3.6 gives path layout but not: S3 vs S3-compatible vs local; env vars (e.g. `TELEMETRY_OBJECT_STORAGE_ENDPOINT`, `BUCKET`); which process writes (Python worker); how Next.js gets signed URLs (minting against same store?). ADR-20260203 is referenced but not wired to docker/compose or env docs.
- **ClickHouse:** v1 needs it. Not specified: run in Docker? Same host as app? Schema applied how (migrations/scripts)? Which service connects (Python materialise job)? Connection env vars?
- **Job queue:** §2.6 says “Postgres-backed, SELECT FOR UPDATE SKIP LOCKED”. Missing: table name(s), schema (job type, payload, status, claimed_at, etc.); who enqueues (Next.js API); who claims (Python worker); whether worker is the same process as ingestion service or a new container.
- **Worker process:** One or two Python containers? If one, how are “ingestion” and “telemetry” jobs scheduled (same queue, different job types)?

**Recommendation:** Add an **Infrastructure / Runtime** subsection (or a short “Telemetry stack” doc) that specifies: object storage provider and env vars; ClickHouse deployment and schema application; job queue table(s) and ownership; worker topology (single vs separate telemetry worker). Reference it from §9.

### 3.5 API Contract Summary for MVP (Convenience)

API Contract is referenced; the Implementation Design does not repeat it. For implementers, a **one-page MVP summary** would help: e.g. `POST /api/v1/telemetry/uploads` request/response, `POST …/finalise` behaviour, `GET /api/v1/telemetry/sessions` response shape, and how the UI gets a signed upload URL. Optional: add a small § “MVP API summary” or “First endpoints to implement” with links to API Contract sections.

### 3.6 Configuration and Environment (Scattered)

Downsample mapping (L0/L1/L2 ↔ ds_50hz/ds_10hz/ds_1hz), quality thresholds (lap_timing ≥ 55, etc.), and fusion behaviour are described in the doc but **where they are configured** is not (env vars, config file, feature flags). Practice-day plan explicitly documents `PRACTICE_DAY_DETAIL_CONCURRENCY` and where it is read.

**Recommendation:** Add a **Config and environment** list for telemetry: e.g. object storage URL and credentials, ClickHouse URL, queue table name, downsample level mapping, quality thresholds (or path to config file), and any feature flags for MVP vs v1.

### 3.7 Testing Strategy (Missing)

No section on:

- Unit tests: parsers, normalisers, capability detection.
- Integration tests: upload → validate → parse → Parquet write (with test object storage or local FS), optional ClickHouse.
- Fixtures: minimal CSV/GPX files in repo; expected ParseResult or canonical stream shape.
- Edge cases: malformed file, empty file, wrong delimiter, missing time column (reason codes).

The practice-day plan has Phase 7 (Testing) with explicit cases and fixture locations.

**Recommendation:** Add a **Testing** subsection under §9 (or a dedicated phase): test locations, fixture directory, minimum cases (happy path CSV/GPX, malformed, empty), and how to run (docker exec pytest, etc.).

### 3.8 Documentation Phase (Missing)

Practice-day plan has **Phase 6** that lists every affected document and the exact updates (architecture, operations, API, schema, runbooks). The telemetry design does not.

**Recommendation:** Add a **Documentation** phase or subsection: list every doc that must be updated when implementing MVP/v1 (e.g. schema.md, API reference, operations guide, observability, runbook, document index) and what to add/change in each.

### 3.9 Runbooks, Observability, Release Verification (Missing)

Practice-day plan has **Phase 8:** runbooks, observability, release verification checklist. The telemetry design references Operational Runbook and observability in general but does not require “when you ship MVP/v1, do X, Y, Z” (alerts, dashboards, runbook steps, smoke tests).

**Recommendation:** Add a short **Operations and release** subsection: runbook updates (upload failure, processing stuck, ClickHouse down); metrics and logs to add for MVP/v1; release verification steps (upload sample file, see session in list, open session detail).

### 3.10 Auto SFL Lap Detection (Algorithm Detail)

§8.1 gives a clear v1 outline (project ENU → candidate SFLs → crossings → validate). For implementation, some details are still open: grid resolution or clustering method, thresholds (min lap time 30 s, max 600 s are stated), and acceptance criteria (e.g. “detected lap count within X% of manual” or “no false crossings on straight”). These may live in the Lap Segment and Corner Detection spec; the implementation plan should at least point to “implementation acceptance criteria” there or add one sentence (e.g. “v1 acceptance: lap count matches manual for fixture X”).

**Recommendation:** In §8 or §9, add one line: “Acceptance criteria and tuning parameters for auto SFL: see [Lap Segment and Corner Detection Specification](…) §X; MVP/v1 acceptance: …”.

---

## 4. Suggested Next Steps

1. **Keep** the current Implementation Design as the single source for architecture, data model, phases, and milestone checklists.
2. **Add** to it (or to a new `docs/implimentation_plans/telemetry-implementation-plan.md`):
   - **§0 Prerequisites and Conventions** (Docker, tests, migrations, doc policy).
   - **Phase dependency table** and alignment of “Suggested Implementation Order” with it.
   - **Infrastructure / Runtime** (object storage, ClickHouse, job queue, worker topology).
   - **Config and environment** list.
   - **Per-phase task breakdown for MVP** (and optionally v1) with file paths and exit criteria.
   - **Testing** subsection (locations, fixtures, minimum cases).
   - **Documentation** phase (list of docs and required updates).
   - **Operations and release** (runbooks, metrics, release verification).
3. **Optionally** add a one-page **MVP API summary** and an **Auto SFL acceptance** pointer in §8/§9.

Once these are in place, the plan will be at a similar level of comprehensiveness to the practice-day implementation plan and ready to start implementation.

---

## 5. References

- [Telemetry Implementation Design](../telemetry/Design/Telemetry_Implementation_Design.md)
- [Practice Day Full Ingestion Implementation Plan](../implimentation_plans/practice-day-full-ingestion-implementation-plan.md)
- [Telemetry Processing Pipeline Job Orchestration and State Machine](../telemetry/Design/Telemetry%20Processing%20Pipeline%20Job%20Orchestration%20and%20State%20Machine.md)
- [API Contract Telemetry](../telemetry/Design/API_Contract_Telemetry.md)
