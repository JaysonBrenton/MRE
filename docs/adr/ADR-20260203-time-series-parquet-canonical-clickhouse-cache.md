---
created: 2026-02-03
creator: Jayson Brenton
lastModified: 2026-02-03
description: Parquet as canonical time series store, ClickHouse as query cache
purpose:
  Resolves ambiguity between Parquet and ClickHouse as primary stores; establishes
  Parquet as system of record and ClickHouse as rebuildable derived cache.
relatedFiles:
  - docs/telemetry/Design/Architecture_Blueprint_Telemetry_Ingest_Storage_Compute_Query.md
  - docs/telemetry/Design/Telemetry - Concrete Data Model And Contracts.md
  - docs/telemetry/Design/API_Contract_Telemetry.md
  - docs/telemetry/Design/Security Privacy Retention and Deletion.md
supersedes:
  - docs/adr/ADR-20260131-telemetry-storage-and-raw-retention.md
---

# ADR-20260203: Time series storage, Parquet as canonical, ClickHouse as query cache

Date: 2026-02-03
Status: Accepted
Owner: Jayson Brenton
Scope: MRE telemetry time series storage for GNSS, IMU, derived streams, laps, segments, corners

## Context

The telemetry design documents currently reference both Parquet (object storage) and ClickHouse as primary stores for time series. This creates ambiguity across:

* System of record and replayability (what is authoritative)
* Deletion and retention promises (what must be deleted, how quickly)
* API query behaviour (which store backs which endpoints)
* Operational risk (consistency, rebuild, and incident response)

MRE needs:

* Device agnostic ingestion and canonicalisation
* Reprocessing capability as algorithms evolve (fusion, lap detection, segment and corner detection)
* High performance interactive queries for the desktop UX
* Clear and enforceable retention and deletion semantics

## Decision

**Parquet in object storage is the canonical, authoritative system of record for telemetry time series.**

**ClickHouse is a derived, query optimised cache for interactive reads and aggregates, and must be rebuildable from canonical Parquet plus metadata.**

If Parquet and ClickHouse disagree for the same session and processing run, Parquet is authoritative. ClickHouse data for that scope must be invalidated and rebuilt.

## Options considered

### Option A: Parquet canonical, ClickHouse cache (chosen)

* Canonical telemetry streams are written to Parquet.
* ClickHouse stores derived tables to serve fast UI queries.
* ClickHouse can be rebuilt deterministically from Parquet and processing metadata.

### Option B: ClickHouse canonical, Parquet export only

* ClickHouse stores the full authoritative time series.
* Parquet is used for export or archive.

### Option C: Dual write, both authoritative

* Parquet and ClickHouse both treated as primary stores with strict consistency requirements.

## Rationale

Option A is chosen because it best satisfies the combined requirements:

* **Replayability and evolution**: canonical Parquet supports deterministic reprocessing when algorithms change.
* **Trust and honesty**: provenance can point to a stable canonical dataset and processing run.
* **Deletion semantics**: canonical deletion can be implemented cleanly in object storage, and ClickHouse can be treated as derived data that can be regenerated.
* **Performance**: ClickHouse still provides low latency interactive queries for charts, laps, and comparisons.
* **Operational risk**: avoids making ClickHouse the compliance anchor for retention and deletion promises.

## Consequences

### Positive

* Clear authoritative source for time series.
* Enables reprocessing without requiring long lived raw upload retention.
* ClickHouse schema can evolve without becoming a permanent historical truth store.
* Easier to provide consistent export behaviour.

### Negative and mitigation

* Requires a reliable rebuild mechanism for ClickHouse.

  * Mitigation: add a first class "materialisation job" step and track materialisation status per dataset.
* Requires freshness and version metadata surfaced through APIs.

  * Mitigation: return `processing_run_id`, `schema_version`, and `materialisation_status` on read endpoints.
* Adds storage duplication.

  * Mitigation: keep ClickHouse storage limited to downsampled series and aggregates needed for the UI, not full raw resolution unless required.

## Data model implications

### Canonical artefacts (object storage)

Canonical Parquet is organised by:

* `tenant_id` (or account scope)
* `driver_id`
* `session_id`
* `processing_run_id`
* `schema_version`

Each processing run produces an immutable canonical dataset. If a session is reprocessed, it creates a new `processing_run_id` with a new canonical dataset.

### Derived datasets (ClickHouse)

ClickHouse tables must include:

* `session_id`
* `processing_run_id`
* `dataset_kind` (for example points_1hz, points_10hz, laps, segments, corners)
* `schema_version`

ClickHouse is not permitted to be the only copy of any telemetry required for correctness or exports.

## API implications

### Read path

* Interactive chart endpoints read from ClickHouse by default.
* Every read response includes:

  * `session_id`
  * `processing_run_id`
  * `schema_version`
  * `materialisation_status` (ready, pending, stale, failed)
  * `data_freshness` (for example last_materialised_at)

If ClickHouse is missing or stale for the requested scope, the API either:

* triggers materialisation and returns `pending`, or
* falls back to a slower Parquet backed query path for limited endpoints if implemented

### Export path

* Export endpoints are canonical and return Parquet backed results.
* Exports must reference `processing_run_id` and `schema_version`.

## Deletion and retention semantics

This ADR does not decide raw upload retention. It does define deletion responsibilities for each tier.

### Truth table

| Dataset class                            | Store                    |    Authoritative | Delete trigger                                                      | Delete mechanism                                                                                      | Verification                                                |
| ---------------------------------------- | ------------------------ | ---------------: | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Canonical time series                    | Object storage (Parquet) |              Yes | User delete session, user delete account, retention expiry          | Delete objects under `session_id` and `processing_run_id` prefixes                                    | List prefix returns empty, plus processing metadata updated |
| ClickHouse derived points and aggregates | ClickHouse               |               No | User delete session, user delete account, retention expiry, rebuild | Delete rows by `session_id` and `processing_run_id`, or TTL expiry, or drop partitions where feasible | Query returns no rows for scope                             |
| Processing metadata                      | Postgres                 |              Yes | User delete account, retention expiry                               | Delete or anonymise as policy dictates                                                                | Select returns no rows, or redacted rows                    |
| Raw upload bytes                         | Object storage           | Policy dependent | Policy dependent                                                    | Policy dependent                                                                                      | Policy dependent                                            |

### Contract

* A user facing "delete session" operation must delete canonical Parquet first, then delete ClickHouse derived datasets.
* Any ClickHouse deletion lag must not block canonical deletion.
* If ClickHouse deletion is eventually consistent, the UI must represent that honestly.

## Operational implications

### Materialisation jobs

* Add a pipeline job type: `materialise_clickhouse`.
* Inputs: canonical Parquet location, `session_id`, `processing_run_id`, `schema_version`.
* Output: derived tables in ClickHouse, and a materialisation record in Postgres.

### Observability

Track and alert on:

* materialisation failures and retries
* clickhouse query latency percentiles per endpoint
* cache hit and miss rate
* rebuild backlog

## Rollout plan

1. Implement canonical Parquet write for the minimal telemetry stream set.
2. Implement ClickHouse materialisation for the minimal UI query surfaces:

   * downsampled points series
   * lap summaries
3. Update API contract to include `processing_run_id`, `schema_version`, `materialisation_status`.
4. Update all telemetry design docs to reference this ADR as the authoritative storage decision.

## References

* `docs/telemetry/Design/Architecture_Blueprint_Telemetry_Ingest_Storage_Compute_Query.md`
* `docs/telemetry/Design/Telemetry - Concrete Data Model And Contracts.md`
* `docs/telemetry/Design/API_Contract_Telemetry.md`
* `docs/telemetry/Design/Security Privacy Retention and Deletion.md`
