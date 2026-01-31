---
created: 2026-01-31
creator: Architecture
lastModified: 2026-01-31
description: Telemetry storage authority and raw artifact retention policy
purpose:
  Resolves conflicts between telemetry design docs on raw upload retention and
  time-series store authority. Single source of truth for storage and retention.
relatedFiles:
  - docs/telemetry/Design/Security Privacy Retention and Deletion.md
  - docs/telemetry/Design/Architecture_Blueprint_Telemetry_Ingest_Storage_Compute_Query.md
  - docs/telemetry/Design/Telemetry - Concrete Data Model And Contracts.md
  - docs/telemetry/reviews/telemetry_design_review.md
---

# ADR-20260131-telemetry-storage-and-raw-retention

## Status

Accepted

## Context

Telemetry design docs disagreed on (1) whether raw uploads are kept or discarded
after canonicalisation, and (2) whether time series are authoritative in
Parquet, ClickHouse, or both. Resolving this is required before implementation.

## Decision

**Raw artifacts:** Discard raw upload bytes immediately after successful
canonicalisation. Keep only metadata (hash, size, type, parse version) and
derived outputs. Reprocessing is from canonical streams only, not from re-upload
of raw files. No raw artifact object store for replay/audit of original bytes.

**Time series store:** ClickHouse is the system of record for high-rate time
series and derived sample streams. Postgres remains the system of record for
metadata, sessions, users, jobs, and summaries. Processed outputs (canonical
streams, downsampled levels) may be written as Parquet for worker output and
optional export; the authoritative queryable store for the application is
ClickHouse. APIs serve time series by querying ClickHouse (by session_id and ts
range).

**Single source of truth:** Postgres = metadata and governance. ClickHouse =
time series points and derived streams. Parquet = output format for workers and
exports, not the primary query store.

## Consequences

- Privacy and retention are simpler: no raw blob retention policy.
- Reprocessing requires re-upload if canonicalisation fails or algorithm
  changes; otherwise reprocess from canonical streams.
- All retention and deletion docs must state "raw bytes discarded after
  canonicalisation" and reference this ADR.
- Architecture and data model docs must state ClickHouse as authoritative for
  time series queries; Parquet as format for worker output/export only.

## Alternatives Considered

- **Keep raw 30 days:** Rejected to avoid conflicting retention and deletion
  semantics and to reduce storage/sensitivity.
- **Parquet as primary query store:** Rejected for interactive query
  performance; ClickHouse is used for that; Parquet remains for batch/export.
