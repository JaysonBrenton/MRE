---
created: 2026-04-14
creator: MRE
purpose: Phased delivery plan for telemetry (ingest, storage, workers, API, UI)
relatedDocs:
  - docs/telemetry/README.md
  - docs/telemetry/Design/Telemetry_Implementation_Design.md
  - docs/telemetry/Design/Telemetry_MVP_Implementation_Decisions.md
---

# Telemetry Implementation Plan

This document is the **task-level plan** referenced from
[`docs/telemetry/README.md`](../telemetry/README.md) and
[`Telemetry_Implementation_Design.md`](../telemetry/Design/Telemetry_Implementation_Design.md)
§9. It records **completed** and **upcoming** phases.

## Phase 0 — Prerequisites

- Docker Compose stack (`mre-app`, `mre-postgres`,
  `mre-liverc-ingestion-service`).
- `DATABASE_URL` available to Next.js and Python services.

## Phase 1 — Infrastructure (stage 1) — **COMPLETE**

**Goal:** End-to-end **metadata + bytes + Postgres job queue + worker stub**
with no parsing/fusion yet.

**Delivered:**

| Area              | What                                                                                                                                                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Postgres**      | Prisma models and migration `20260414120000_telemetry_infra_stage1`: `telemetry_sessions`, `telemetry_artifacts`, `telemetry_devices`, `telemetry_processing_runs`, `telemetry_jobs`, `telemetry_datasets`, `telemetry_laps` (datasets/laps unused until later phases). |
| **Local storage** | `TELEMETRY_UPLOAD_ROOT` (default `/data/telemetry`); artifact `storagePath` is a relative key `uploads/{userId}/{artifactId}`. Shared Docker volume `mre-telemetry-uploads` mounted at `/data/telemetry` on `app`, `liverc-ingestion-service`, and `telemetry-worker`.  |
| **API**           | Authenticated routes under `/api/v1/telemetry/`: create upload intent, PUT bytes, finalise (session + run + job), GET session status.                                                                                                                                   |
| **Worker**        | `mre-telemetry-worker` runs `python -m ingestion.telemetry.worker`; claims `telemetry_jobs` with `FOR UPDATE SKIP LOCKED`; initially job type `artifact_validate` only (file exists, size matches `byte_size`). _Superseded by Phase 2 pipeline below._                 |
| **Docs**          | This file; operational notes in [`docs/telemetry/Design/Operational Runbook.md`](../telemetry/Design/Operational%20Runbook.md) §Telemetry worker; schema prose in [`docs/database/schema.md`](../database/schema.md).                                                   |

**Apply migration (Docker):**

```bash
docker exec -it mre-app npx prisma migrate deploy
```

**Manual smoke test:**

1. `POST /api/v1/telemetry/uploads` with
   `{ "originalFileName": "t.csv", "contentType": "text/csv" }` → `uploadId`,
   `uploadUrl`.
2. `PUT` raw bytes to `uploadUrl`.
3. `POST /api/v1/telemetry/uploads/{uploadId}/finalise` (optional JSON
   `{ "name": "..." }` or empty body).
4. `GET /api/v1/telemetry/sessions/{sessionId}` until `session.status` is
   `ready` (worker must be running).

**Behaviour change (Phase 2):** Processing no longer stops at
`artifact_validate`. The worker enqueues `parse_raw` after validation; session
`READY` and `start_time_utc` / `end_time_utc` are set when parsing and Parquet
write succeed.

## Phase 2 — MVP schema usage + parsers — **COMPLETE**

**Goal:** Level 1 CSV + GPX GNSS → canonical Parquet, datasets row, session time
range from parsed data, session `READY` only after `parse_raw` succeeds.

**Delivered:**

| Area         | What                                                                                                                                                                                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Parsers**  | `ingestion/telemetry/parsers/csv_gnss.py`, `gpx_gnss.py`; stable errors (`CSV_NO_TIME_COLUMN`, etc.) per MVP decisions.                                                                                                                                                                                                                                                  |
| **Parquet**  | `ingestion/telemetry/canonical_parquet.py` (pyarrow): `t_ns`, `lat_deg`, `lon_deg`, `alt_m`, `speed_mps`. Relative path `canonical/{sessionId}/{runId}/{datasetId}/gnss_pvt.parquet` under `TELEMETRY_UPLOAD_ROOT`.                                                                                                                                                      |
| **Jobs**     | `artifact_validate` (file exists + size); enqueues `parse_raw`. `parse_raw` classifies CSV vs GPX, parses, writes Parquet, inserts `telemetry_datasets` (`CANON_GNSS`), updates run `output_dataset_ids` / `quality_summary`, sets artifact `format_detected` + `CANONICALISED`, updates session `start_time_utc` / `end_time_utc` from min/max `t_ns`, session `READY`. |
| **Versions** | `TELEMETRY_PIPELINE_VERSION` = `telemetry-mvp-0.2.0`, `TELEMETRY_CANONICALISER_VERSION` = `csv-gpx-parquet-0.2.0` in `src/core/telemetry/telemetry-repo.ts`.                                                                                                                                                                                                             |
| **Tests**    | `ingestion/tests/unit/test_telemetry_parsers.py`, `test_telemetry_parquet.py` (fixtures under `ingestion/tests/fixtures/telemetry/`).                                                                                                                                                                                                                                    |
| **Laps**     | Not populated in Phase 2 (lap detection is later).                                                                                                                                                                                                                                                                                                                       |

**Manual smoke test:** Same as Phase 1 steps 1–3; step 4: `GET session` until
`ready`; confirm `start_time_utc` / `end_time_utc` reflect parsed GNSS range
(not placeholder `createdAt` only).

## Phase 2b — MVP list/detail + map read + UI — **COMPLETE**

**Goal:** Authenticated **session list**, **session detail** (datasets + mapped
failure messages), **bounded Parquet read** for map preview, and **desktop UI**
wired to upload → finalise → poll.

**Delivered:**

| Area      | What                                                                                                                                                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API**   | `GET /api/v1/telemetry/sessions` (cursor pagination, optional `status`); extended `GET .../sessions/{id}` with `datasets[]` and `failure.message` from `telemetry-failure-messages`; `GET .../sessions/{id}/map` (hyparquet + compressors, size/row caps, downsampled `lat_deg`/`lon_deg`). |
| **UI**    | `eventAnalysis/my-telemetry` list + import; `eventAnalysis/my-telemetry/[sessionId]` detail, failure banner, SVG path preview.                                                                                                                                                              |
| **Tests** | Vitest: `telemetry-failure-messages`, `telemetry-repo` cursor/path helpers, existing upload storage tests.                                                                                                                                                                                  |

## Phase 3 — v1 (design reference)

Fusion, lap detection, ClickHouse materialisation, full quality scoring — per
[`Telemetry_Implementation_Design.md`](../telemetry/Design/Telemetry_Implementation_Design.md)
§9.3.

## Configuration reference

| Variable                             | Service                                               | Purpose                                                  |
| ------------------------------------ | ----------------------------------------------------- | -------------------------------------------------------- |
| `TELEMETRY_UPLOAD_ROOT`              | `app`, `liverc-ingestion-service`, `telemetry-worker` | Root directory for relative `storagePath` values.        |
| `TELEMETRY_WORKER_ID`                | `telemetry-worker`                                    | Value stored in `telemetry_jobs.locked_by` when claimed. |
| `TELEMETRY_WORKER_POLL_INTERVAL_SEC` | `telemetry-worker`                                    | Sleep when queue is empty (default `2`).                 |

See also [`.env.docker.example`](../../.env.docker.example).
