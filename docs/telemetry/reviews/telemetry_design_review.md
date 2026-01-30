# Telemetry Design Review (telemetry.zip)

Review date: 2026-01-30

Scope: I extracted and read every non-empty file in the ZIP (excluding macOS
metadata like `.DS_Store` and `__MACOSX`). This review focuses on design risks,
documentation gaps, and any errors or inconsistencies.

## Files reviewed

- `docs/telemetry/Design/API_Contract_Telemetry.md`
- `docs/telemetry/Design/Architecture_Blueprint_Telemetry_Ingest_Storage_Compute_Query.md`
- `docs/telemetry/Design/Gnss_plus_Imu_Fusion_Blueprint.md`
- `docs/telemetry/Design/Lap Segment and Corner Detection Specification.md`
- `docs/telemetry/Design/Operational Runbook.md`
- `docs/telemetry/Design/Performance Plan and Benchmarking.md`
- `docs/telemetry/Design/Security Privacy Retention and Deletion.md`
- `docs/telemetry/Design/Supported Formats and Parser Specification.md`
- `docs/telemetry/Design/Telemetry - Concrete Data Model And Contracts.md`
- `docs/telemetry/Design/Telemetry Processing Pipeline Job Orchestration and State Machine.md`
- `docs/telemetry/Design/Telemetry_Ux_Blueprint.md`
- `docs/telemetry/Design/Test Strategy and Synthetic Datasets.md`
- `docs/telemetry/Design/Trust Quality Scoring and Honesty Rules.md`
- `docs/telemetry/End_User_Experience/Exploring_the_End_User_Experience_for_Telemetry_in_MRE.md`
- `docs/telemetry/User_Story/User_Story_Universal_Telemetry_Import_and_Analysis_(GNSS_+_IMU).md`
- `docs/telemetry/reviews/Gaps And Recommended Additions.md`
- `telemetry/Blueprints/Architecture_Blueprint_Telemetry_Ingest_Storage_Compute_Query.md`
- `telemetry/Blueprints/Gnss_plus_Imu_Fusion_Blueprint.md`
- `telemetry/Blueprints/Telemetry_Ux_Blueprint.md`
- `telemetry/End_User_Experience/Exploring_the_End_User_Experience_for_Telemetry_in_MRE.md`
- `telemetry/User_Story/User_Story_Universal_Telemetry_Import_and_Analysis_(GNSS_+_IMU).md`

## Executive summary

The telemetry documentation set is unusually thorough for this stage: it covers
user outcomes, UX IA, ingest and processing architecture, security and
retention, a concrete data model, a pipeline state machine, quality and honesty
rules, performance planning, and test strategy. The biggest risks are not
"missing ideas", they are **decision ambiguity and operational complexity**
(especially around storage choices and deletion semantics), plus **document
duplication** that will diverge over time.

Top priorities:

1. **Remove duplicate doc roots** (`telemetry/` vs `docs/telemetry/`) to avoid
   drift.

2. **Make an explicit storage ADR** (Parquet-only vs ClickHouse, or phased), and
   update the data model and pipeline docs to match.

3. **Tighten deletion and retention implementation details for ClickHouse and
   object storage** to meet privacy promises.

4. **Align the session lifecycle** (timestamps required vs when they become
   known) with the upload and validation flow.

5. **Normalise API paths and versioning** (some sections use `/api/v1/...`,
   others omit it).

## High-impact design issues and risks

### 1) Duplicate documentation trees will drift

You have identical copies of core documents in two places:

- `telemetry/Blueprints/*` duplicates `docs/telemetry/Design/*`

- `telemetry/User_Story/*` duplicates `docs/telemetry/User_Story/*`

- `telemetry/End_User_Experience/*` duplicates
  `docs/telemetry/End_User_Experience/*`

**Risk:** small future edits will land in only one copy and you will end up with
contradictory “truth”.

**Recommendation:** pick `docs/telemetry/` as the single source of truth, delete
the duplicated `telemetry/` tree, and add an index README under
`docs/telemetry/README.md` that links the intended reading order.

### 2) Storage strategy is inconsistent across documents

The **Architecture Blueprint** strongly suggests starting with _Postgres +
Parquet in object storage_ (Option A) and later adding ClickHouse if required.
The **Concrete Data Model** states it is designed to “introduce a dedicated
high-performance time-series store” and then uses **ClickHouse** as the query
store.

**Risk:** the implementation can accidentally become "double-store" (Parquet
artifacts plus ClickHouse) without a clear reason, doubling costs and
operational burden.

**Recommendation (phased, pragmatic):**

- **Phase 0 / MVP:** Postgres for metadata and summaries, object storage for
  raw + processed Parquet, workers use DuckDB to query Parquet for UI requests
  (or precompute summaries). Keep clickhouse out.

- **Phase 1:** Add ClickHouse only when benchmarks show it is needed, and make
  ingestion into ClickHouse a clearly defined, optional pipeline stage.

- Record the choice in an ADR: "Telemetry time-series store" with explicit
  decision criteria and a migration plan.

### 3) Deletion correctness with ClickHouse needs explicit mechanics

Multiple docs promise strong deletion semantics (privacy, retention reaper,
tombstones plus purge jobs). If ClickHouse is adopted, **row-level deletion is
non-trivial** and can be slow (async mutations), which can conflict with “delete
now” user expectations.

**Risk:** privacy promises that cannot be met in practice, or deletes that
silently lag for hours.

**Recommendations:**

- Partition ClickHouse tables so that "delete session" becomes **drop
  partition(s)** rather than mutating billions of rows.

- Document the expected deletion SLA and surface it in UI (for example "pending
  purge").

- Add a ClickHouse-specific retention section: TTL strategy, partitioning key,
  and how to verify purge completion.

- Make the purge job produce an auditable "deletion completed" event.

### 4) Session timestamps are required too early in the data model

In `Telemetry - Concrete Data Model And Contracts.md`,
`telemetry_sessions.startTimeUtc` and `endTimeUtc` are required. In practice
these are often only known after the upload is validated and parsed.

**Risk:** you either (a) create placeholder sessions with fake times, or (b)
block session creation until parsing completes, which complicates UX.

**Recommendation:** allow start and end to be nullable until validation sets
them, or create the session only at finalise time (after minimal header parse).
Ensure the state machine reflects this.

### 5) Raw artifacts “discarded after canonicalisation” conflicts with reproducibility goals

The data model assumptions say raw uploads are discarded after canonicalisation,
while the security/retention doc defines raw artifact retention defaults (30
days post-processing) and other docs emphasise reproducibility and disputes.

**Risk:** inability to reprocess with improved algorithms, inability to prove
what was uploaded during a dispute, and weaker trust posture.

**Recommendation:** treat raw artifacts as immutable, retained for a defined
window (as you already specify), and make “discard” mean “eligible for retention
reaper” rather than immediate deletion.

### 6) API contract path and versioning are inconsistent

In `API_Contract_Telemetry.md`, upload endpoints are written as
`/api/v1/telemetry/...` but other endpoints are shown as
`/telemetry/sessions/...`.

**Risk:** confusion during implementation and hard-to-change client code.

**Recommendation:** standardise a single base path (suggest
`/api/v1/telemetry/...`) and ensure all examples use it. Add a short section
stating:

- versioning rule (v1 stability, deprecation policy)
- auth model (cookie vs bearer)
- payload envelope standard (errors, pagination)

### 7) Processed outputs: where do “canonical streams” live, and who queries them?

The architecture blueprint describes a “processed artifact store” of Parquet
outputs. The data model uses ClickHouse to query by `session_id` and `ts`
ranges. The orchestration doc describes a multi-stage pipeline.

**Risk:** unclear ownership: is the API a thin proxy to ClickHouse, or does it
read Parquet? Are Parquet outputs authoritative, or just exports?

**Recommendation:** declare one authoritative store per dataset type:

- Raw uploads: object storage
- Canonical streams (gnss, imu, fused): either Parquet (MVP) or ClickHouse
  (later)
- Derived summaries for UI: Postgres
- Exports: Parquet generated on-demand or stored as artifacts

### 8) Multi-device and edit/reprocessing model is good, but needs “cost guardrails”

The run and edit model (immutable runs, edits that influence reprocessing) is
sound. What is missing is an explicit guardrail against runaway compute, for
example users repeatedly reprocessing large sessions.

**Recommendations:**

- Add quotas: max reprocesses per hour/day, max concurrent jobs per user, max
  artifact size.

- Add an operator override and a user-visible reason if throttled.

- Include cost and abuse considerations in the security or runbook docs.

## Medium-impact issues and clarifications

### 9) Local development and deployment details are still fuzzy

The docs mention object storage options and describe components, but there is no
single "how to run this locally" doc that says which services are required
(Postgres, object store, worker, optional ClickHouse) and how they connect.

**Recommendation:** add `docs/telemetry/DEV_SETUP.md` with:

- docker compose (or systemd) service list
- env vars
- seed scripts for synthetic datasets
- smoke test flow: upload, process, query, delete

### 10) ClickHouse modelling and indexing guidance should be explicit

If ClickHouse is adopted, add concrete guidance on table engines, partitioning,
ordering keys, and downsampling strategy (for example separate tables for raw
and downsampled). Right now the docs are correct at a concept level, but do not
constrain the implementation enough to prevent a slow schema.

### 11) Signed URL flows need explicit security boundaries

The API contract references signed URLs for upload and download. Ensure the
security doc explicitly states:

- URL TTL defaults
- scope (single object, single method)
- content-type enforcement
- virus/malware scanning expectations for uploads
- CORS rules for direct browser uploads

### 12) Units and user-facing conversions

The GNSS+IMU blueprint and data model largely standardise units (metres,
seconds, m/s, rad/s). The UX docs talk in user terms (km/h, etc). Add one
explicit, shared section that states:

- canonical internal units
- permitted UI conversions
- rounding rules (and what is never rounded)

## Documentation gaps and missing docs

These are not blockers, but they reduce implementability and team onboarding
speed.

1. **Index / reading order**: add a top-level `docs/telemetry/README.md`.

2. **ADR set**: at minimum, ADRs for:
   - Time-series store choice (Parquet, ClickHouse, Timescale)

   - Job queue choice (DB queue first, Redis/SQS later)

   - Artifact storage choice (S3/MinIO/filesystem)

3. **Developer setup**: `DEV_SETUP.md` as noted above.

4. **Telemetry glossary**: a single canonical glossary for channel names,
   frames, and dataset types.

5. **Parser compatibility matrix**: device or vendor, file type, support tier,
   known issues.

6. **Migration plan**: if you start Parquet-only, how to backfill ClickHouse
   later.

7. **Monitoring dashboards spec**: what graphs and alerts exist, keyed to the
   performance plan.

## Errors and inconsistencies spotted

- **API path mismatch:** `/api/v1/telemetry/...` (uploads) vs
  `/telemetry/sessions/...` (queries) in `API_Contract_Telemetry.md`.

- **Duplication risk:** identical documents duplicated across two doc roots, as
  noted above.

- **Retention wording:** “Raw uploads are discarded after canonicalisation”
  (data model assumptions) conflicts with the explicit 30-day retention window
  in the security doc.

- **ClickHouse delete ambiguity:** “delete ClickHouse rows” is stated, but the
  mechanism (partition drop vs mutations) is not specified.

- **Licence placeholder:** `License: TBD` appears in `API_Contract_Telemetry.md`
  front matter.

## Recommended next steps (ordered)

1. Consolidate docs into `docs/telemetry/` only, delete the duplicated
   `telemetry/` tree.

2. Write ADR: Telemetry time-series store (decide Parquet-first vs
   ClickHouse-now). Update the data model and architecture docs to match.

3. Add a ClickHouse deletion and retention appendix (even if ClickHouse is Phase
   1, decide how it will work).

4. Update the data model so session timestamps can be unknown until validation,
   or declare sessions are created only after validation.

5. Normalise all API paths to `/api/v1/telemetry/...` and add a short versioning
   and deprecation policy.

6. Add `docs/telemetry/DEV_SETUP.md` plus a smoke test checklist.

## Notes on what is already strong

- The UX blueprint and end-user experience doc are concrete and map well to
  likely query patterns.

- The pipeline state machine is thoughtful about idempotency, retries, and
  observability.

- The security, retention, and honesty rules are unusually explicit, which will
  save you later.

- The test strategy doc is detailed and aligns with a reproducible telemetry
  pipeline.
