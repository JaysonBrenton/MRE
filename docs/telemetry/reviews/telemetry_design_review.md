# Telemetry Design Review (telemetry.zip)

**Resolved (2026-01-31):** Storage and raw retention resolved by
`docs/adr/ADR-20260131-telemetry-storage-and-raw-retention.md`; ID strategy by
`docs/adr/ADR-20260131-telemetry-identifier-strategy.md`; data lifecycle truth
table added to Security doc (§10.3).

**Resolved (2026-02-03):** Parquet vs ClickHouse resolved by
`docs/adr/ADR-20260203-time-series-parquet-canonical-clickhouse-cache.md`:
Parquet is canonical, ClickHouse is derived cache. Architecture Blueprint, Data
Model, API Contract, and Security docs updated to reference the ADR.

Review date: 30 Jan 2026 Scope: I extracted the ZIP and read every file under
`docs/telemetry/` (Design/, End_User_Experience/, User_Story/, reviews/). All
paths in this review are under `docs/telemetry/`.

## File inventory (what I reviewed)

| File                                                                                           | Notes                                        |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `docs/telemetry/Design/API_Contract_Telemetry.md`                                              | API contract and query patterns              |
| `docs/telemetry/Design/Architecture_Blueprint_Telemetry_Ingest_Storage_Compute_Query.md`       | System architecture blueprint                |
| `docs/telemetry/Design/Gnss_plus_Imu_Fusion_Blueprint.md`                                      | Normalisation and fusion blueprint           |
| `docs/telemetry/Design/Lap Segment and Corner Detection Specification.md`                      | Lap, segment, corner spec                    |
| `docs/telemetry/Design/Operational Runbook.md`                                                 | Ops runbook                                  |
| `docs/telemetry/Design/Performance Plan and Benchmarking.md`                                   | Perf plan, budgets, benchmarking             |
| `docs/telemetry/Design/Security Privacy Retention and Deletion.md`                             | Security, privacy, retention, deletion       |
| `docs/telemetry/Design/Supported Formats and Parser Specification.md`                          | Formats, parsers, capability detection       |
| `docs/telemetry/Design/Telemetry - Concrete Data Model And Contracts.md`                       | Postgres plus ClickHouse model and contracts |
| `docs/telemetry/Design/Telemetry Processing Pipeline Job Orchestration and State Machine.md`   | Pipeline, orchestration, states              |
| `docs/telemetry/Design/Telemetry_Ux_Blueprint.md`                                              | Telemetry UX blueprint                       |
| `docs/telemetry/Design/Test Strategy and Synthetic Datasets.md`                                | Test approach and synthetic data             |
| `docs/telemetry/Design/Trust Quality Scoring and Honesty Rules.md`                             | Trust, quality scoring, honesty rules        |
| `docs/telemetry/End_User_Experience/Exploring_the_End_User_Experience_for_Telemetry_in_MRE.md` | JTBD, end user experience                    |
| `docs/telemetry/User_Story/User_Story_Universal_Telemetry_Import_and_Analysis_(GNSS_+_IMU).md` | User story                                   |
| `docs/telemetry/reviews/Old/Gaps And Recommended Additions.md`                                 | Existing review doc (archived)               |
| `docs/telemetry/reviews/telemetry_design_review.md`                                            | This review doc                              |

## Executive summary

This is a strong documentation set, it covers the full surface area you actually
need (formats, canonicalisation, pipeline, quality, UX, performance, security).
The main problems are not missing content, they are contradictions between
documents, plus a few hard choices that are half made in multiple places.

If you fix only five things, fix these:

1. Raw artifact retention is contradictory across docs (immediate discard vs 30
   day retention vs immutable raw store). This is a design and trust problem,
   not a wording problem.
2. Storage approach is not single source of truth (Parquet first blueprint vs a
   detailed ClickHouse schema, plus APIs that imply both).
3. ID strategy conflicts (API examples use prefixed ULID like IDs such as
   `ses_01H...`, the data model uses UUIDs everywhere).
4. Deletion promises are ahead of the implementation reality, especially if
   ClickHouse is the source of truth for time series.
5. The existing review docs contain factual errors about what files exist in the
   ZIP, which will confuse future work.

## High impact design issues (cross cutting)

### 1) Raw uploads retention, discard, and auditability are inconsistent

**Where it conflicts:**

- Data model: raw uploads are discarded after canonicalisation and tracks
  `discardedAt`.
- Security retention doc: raw artifacts retained for 30 days after successful
  processing.
- Architecture blueprint: store exactly what the user uploaded, keep immutable
  for replay and audit.

**Why it matters:**

This impacts privacy guarantees, storage cost, ability to reprocess, and what
you can honestly claim in the UX and in the honesty rules.

**Recommendation:**

Pick one authoritative policy and reflect it everywhere:

- Option A (matches your earlier stated preference): discard raw bytes
  immediately after canonicalisation, keep only metadata plus derived outputs,
  support reprocessing only from canonical streams.
- Option B: keep raw bytes for a configurable window (example 7 or 30 days), but
  then the data model and UX must explicitly show raw retained until a date, and
  deletion semantics must include the raw store.

Whichever you choose, add one retention and deletion truth table that enumerates
each storage tier and exactly when it is deleted.

### 2) Parquet vs ClickHouse is presented as both, but the docs treat each as the plan

You have:

- A blueprint that strongly suggests Parquet processed outputs for time series.
- A very detailed ClickHouse schema with table design and query patterns.
- APIs that could support either, but do not clearly state which is canonical
  and which is a cache.

**Why it matters:**

Query behaviour, latency, deletion, cost, and complexity all depend on this.
Right now it reads like two architectures merged.

**Recommendation:**

Write a single storage decision doc (an ADR is ideal) answering:

- What is the system of record for time series (ClickHouse tables, Parquet in
  object storage, or both)?
- If both, which is authoritative for which queries (interactive charts,
  recompute, exports, offline analysis)?
- What is the ingest contract into the analytics store (exactly which canonical
  streams, at which sample rates, at which downsample levels)?

Then update the data model doc and architecture blueprint to match the ADR.

### 3) Deletion promises are risky if ClickHouse stores per point data

Your security and privacy doc implies strong deletion semantics. That is correct
and needed, but if ClickHouse holds all points:

- Per session deletes can become costly (mutations, tombstones, merges).
- Partitioning monthly by ts is fine for scan performance, but it makes targeted
  deletion harder.

**Recommendation:**

Explicitly document how you will implement:

- Delete a session now (worst case)
- Delete all data for a user now
- Retention TTL expiry

If ClickHouse is used for detailed points, choose and document a strategy:

- TTL based expiry, plus a documented worst case for immediate deletion.
- Or treat ClickHouse as a derived cache that can be rebuilt, and keep the
  authoritative dataset elsewhere.

### 4) ID format inconsistency (UUID model vs prefixed ULID like examples)

- API contract examples show `session_id: "ses_01H..."` and
  `processing_run_id: "prun_01H..."`.
- Concrete data model uses UUIDs heavily.

**Why it matters:**

It bleeds into schema, URL design, DB types, and client assumptions. It also
affects sorting and operational debugging (ULIDs are time sortable, UUIDv4 is
not).

**Recommendation:**

Choose one and enforce it across all docs:

- Either use UUIDs everywhere and remove prefixed IDs from examples.
- Or adopt a prefixed, time sortable ID scheme (ULID or UUIDv7 style), store as
  text where needed, and update the relational model accordingly.

Add a short identifier conventions section that lists each entity type and its
ID format.

### 5) Documentation style contradicts the stated direction about no non goals or limitations

Multiple design docs include an out of scope section. If the product direction
is no non goals or limitations, you need a consistent documentation rule:

- Either remove these sections.
- Or reframe them as covered in another spec, which keeps the docs scoped
  without reading like a limitation.

## Errors and concrete doc problems

### A) Existing review doc lists files that do not exist in this ZIP

`docs/telemetry/reviews/telemetry_design_review.md` claims it reviewed paths
like:

- `telemetry/Blueprints/...`
- `telemetry/End_User_Experience/...`

In this ZIP, there is no `telemetry/` root, only `docs/telemetry/...`.

**Impact:** future readers will waste time looking for duplicates and drift that
are not present, and might incorrectly conclude there are two doc trees.

**Fix:** update the review doc’s files reviewed list to match the actual tree,
or delete the outdated review doc.

### B) `.DS_Store` is included

`docs/telemetry/.DS_Store` is macOS metadata and should not be committed.

**Fix:** delete it and add `.DS_Store` to `.gitignore` if not already.

### C) License placeholder

`API_Contract_Telemetry.md` includes `License: TBD`.

**Fix:** make license consistent with the other docs (most say Proprietary,
internal to MRE).

### D) Tracking parameters in ClickHouse links

The data model doc includes ClickHouse links with `utm_source=chatgpt.com`. This
is noisy and not great for long lived internal docs.

**Fix:** remove tracking parameters, keep clean doc links.

## Gaps and missing documents

These are the missing pieces that would materially reduce implementation risk.

### 1) One authoritative decision register (ADRs)

Right now the decisions are embedded in multiple docs. Add ADRs for:

- Storage choice (ClickHouse vs Parquet, and the source of truth question)
- Raw retention policy (discard vs reprocess window)
- ID strategy (UUID vs ULID like)
- Orchestration choice (DB queue, Redis, SQS, etc), including retry semantics
  and dead letter handling
- Deletion strategy for each storage tier

### 2) Data lifecycle truth table (must have)

A single table that lists, for each dataset class:

- Where it is stored (Postgres, object storage, ClickHouse)
- When it is created
- When and how it is deleted (user delete, retention expiry)
- What remains after deletion (audit metadata, aggregates, nothing)

### 3) End to end sequence diagrams

At least two:

- Upload to parse to canonicalise to publish to query
- Delete session to revoke share links to delete datasets to verify deletion

### 4) Schema and API alignment checklist

A doc that ensures these line up:

- Entity names and fields (session, upload, artifact, processing_run, dataset)
- ID formats
- Timestamp semantics (known at upload time vs derived after parse)
- Error codes and status enums, including retryable vs terminal

### 5) Operational SLOs and failure playbooks tied to pipeline states

The runbook is good, but add:

- For each pipeline state: expected duration, alarm conditions, and the first
  three debugging commands
- Clear distinction between stuck job, slow job, bad data

## Per document notes (targeted feedback)

### `Telemetry - Concrete Data Model And Contracts.md`

**Strong:** detailed entities and ClickHouse schema, sharing model, status
enums.

**Risks and issues:**

- Conflicts with retention policy in the security doc and the architecture
  blueprint.
- Commits strongly to ClickHouse while other docs lean Parquet first.
- Uses UUIDs everywhere, conflicts with API examples using `ses_01H...`.

**Suggested changes:**

- Add an ID strategy section.
- Align raw retention policy with the security doc (or vice versa).
- If ClickHouse is optional, label the schema as Phase 2 and define Phase 1
  clearly.

### `Architecture_Blueprint_Telemetry_Ingest_Storage_Compute_Query.md`

**Strong:** clear control plane vs compute plane separation, good glossary.

**Risks and issues:**

- Explicitly says raw uploads are kept immutable for audit, conflicts with
  discard after canonicalisation.
- Storage strategy reads Parquet first, but the data model is ClickHouse first.

**Suggested changes:**

- Update Tier 1 raw policy to match the agreed retention decision.
- Add a paragraph that states which store is authoritative for time series
  queries.

### `API_Contract_Telemetry.md`

**Strong:** good endpoint set, query patterns cover UX needs.

**Risks and issues:**

- ID example format conflict with the data model.
- License placeholder.
- If time series is stored in Parquet, define whether APIs return signed URLs vs
  server queried windows, and make that explicit per endpoint.

**Suggested changes:**

- Normalise ID format and document it once.
- Add caching semantics (ETag, max age) specifically for derived summaries and
  map tiles.

### `Security Privacy Retention and Deletion.md`

**Strong:** right topics, includes log retention alignment.

**Risks and issues:**

- Raw retention default (30 days) contradicts the data model.
- Deletion needs concrete implementation per storage engine, particularly if
  ClickHouse is involved.

**Suggested changes:**

- Add the lifecycle truth table.
- Add explicit how to delete from ClickHouse and how to verify deletion steps.

### `Telemetry Processing Pipeline Job Orchestration and State Machine.md`

**Strong:** state machine thinking, idempotency is explicitly addressed.

**Gap:** queue technology and execution environment are still abstract, which is
fine, but you need a decision soon because it shapes retries, parallelism, and
cost.

**Suggested changes:**

- Add one minimum viable orchestration section that says what you will implement
  first (example: Postgres backed job table plus worker polling), then what you
  will migrate to later.

### `Supported Formats and Parser Specification.md`

**Strong:** plugin contract, safety constraints, fusion provenance model.

**Minor gap:** explicitly define the minimum canonical stream set required for
lap detection, and the minimum required for quality scoring.

### `Lap Segment and Corner Detection Specification.md`

**Strong:** start finish acquisition sources, honesty labelling for inference.

**Gap:** add explicit handling for wrong track selected and track catalogue
mismatch cases, since that will happen often and impacts trust.

### `Performance Plan and Benchmarking.md`

**Strong:** budgets align with the stated guardrails, clear stage timings.

**Gap:** tie benchmark datasets directly to the synthetic dataset plan (one
canonical set of standard tracks and runs used everywhere).

### `Trust Quality Scoring and Honesty Rules.md`

**Strong:** explicit provenance, avoids misleading claims.

**Gap:** ensure the API contract includes a stable schema for reasons so the UI
can render trust explanations consistently.

### `Operational Runbook.md`

**Strong:** practical, includes health endpoints.

**Gap:** add a known bad patterns section for ingestion failures (timebase
mismatch, IMU axis confusion, GNSS jitter, missing timestamps).

### Existing review docs

Both review docs are directionally useful, but they need maintenance:

- One contains incorrect file paths for this ZIP.
- Both suggest adding docs that now already exist (because the design set has
  grown).

## Recommended next actions (priority order)

1. Write the storage plus retention ADRs (storage source of truth, raw discard
   policy). Then update the three conflicting docs to match.
2. Decide and document ID format (UUID vs prefixed ULID like), then normalise
   API examples and schema.
3. Add the data lifecycle truth table, this will also strengthen your trust and
   privacy story.
