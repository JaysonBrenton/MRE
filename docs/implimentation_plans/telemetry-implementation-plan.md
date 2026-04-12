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

| Area              | What                                                                                                                                                                                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Postgres**      | Prisma models and migration `20260414120000_telemetry_infra_stage1`: `telemetry_sessions`, `telemetry_artifacts`, `telemetry_devices`, `telemetry_processing_runs`, `telemetry_jobs`, `telemetry_datasets`, `telemetry_laps` (datasets/laps unused until later phases).                                     |
| **Local storage** | `TELEMETRY_UPLOAD_ROOT` (default `/data/telemetry`); artifact `storagePath` is a relative key `uploads/{userId}/{artifactId}`. Shared Docker volume `mre-telemetry-uploads` mounted at `/data/telemetry` on `app`, `liverc-ingestion-service`, and `telemetry-worker`.                                      |
| **API**           | Authenticated routes under `/api/v1/telemetry/`: create upload intent, PUT bytes, finalise (session + run + job), GET session status.                                                                                                                                                                       |
| **Worker**        | `mre-telemetry-worker` runs `python -m ingestion.telemetry.worker`; claims `telemetry_jobs` with `FOR UPDATE SKIP LOCKED`; runs job type `artifact_validate` (file exists, size matches `byte_size`). On success: run `SUCCEEDED`, session `READY`. On failure: run/session/job `FAILED` with error detail. |
| **Docs**          | This file; operational notes in [`docs/telemetry/Design/Operational Runbook.md`](../telemetry/Design/Operational%20Runbook.md) §Telemetry worker; schema prose in [`docs/database/schema.md`](../database/schema.md).                                                                                       |

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

## Phase 2 — MVP schema usage + parsers (next)

1. Implement CSV/GPX parsers per
   [`Supported Formats and Parser Specification`](../telemetry/Design/Supported%20Formats%20and%20Parser%20Specification.md).
2. Write canonical Parquet to object storage (relative paths under
   `TELEMETRY_UPLOAD_ROOT` or future S3 prefix); add job types after
   `artifact_validate`.
3. Populate `telemetry_datasets` / `telemetry_laps` when data exists.
4. Session time range updates from canonical min/max timestamps per MVP
   decisions.

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
