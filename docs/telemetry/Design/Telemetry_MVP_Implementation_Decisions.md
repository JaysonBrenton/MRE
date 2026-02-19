# Telemetry MVP Implementation Decisions

**Created:** 2026-02-18  
**Purpose:** Resolve implementation gaps so the MVP build can proceed without ambiguity. These decisions are the authoritative source for schema, lifecycle, storage, and naming for the telemetry MVP.  
**Audience:** Implementers  
**Related:** [Concrete Data Model](Telemetry%20-%20Concrete%20Data%20Model%20And%20Contracts.md), [API Contract](API_Contract_Telemetry.md), [Processing Pipeline](Telemetry%20Processing%20Pipeline%20Job%20Orchestration%20and%20State%20Machine.md), [Implementation Plan](../../implimentation_plans/telemetry-implementation-plan.md)

---

## 1. Job table: minimal single-table queue with retry/error fields

**Decision:** Use a **single** `telemetry_jobs` table for MVP. Do not add a separate `telemetry_job_attempt` table. Include retry and error columns on the job row to avoid joins and keep claiming fast.

**Schema (authoritative for MVP):**

| Column         | Type        | Purpose |
|----------------|-------------|--------|
| id             | UUID PK     | Job identity |
| runId          | UUID FK     | telemetry_processing_runs.id |
| jobType        | text        | artifact_validate, artifact_classify, parse_raw, etc. |
| status         | text        | QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELLED |
| payload        | jsonb       | Job-specific args (e.g. artifactIds) |
| attemptCount    | int         | Default 0, incremented on each run |
| maxAttempts     | int         | Default 3 |
| lockedAt       | timestamptz | Set when claimed; null when not claimed |
| lockedBy       | text        | Worker identifier |
| lastErrorCode  | text        | Stable code (e.g. CSV_NO_TIME_COLUMN) |
| lastErrorMessage | text     | Operator detail |
| nextRetryAt    | timestamptz | For backoff; null when not retrying |
| createdAt      | timestamptz | |
| updatedAt      | timestamptz | |

**Claim:** `SELECT ... FROM telemetry_jobs WHERE status = 'QUEUED' AND (nextRetryAt IS NULL OR nextRetryAt <= now()) ORDER BY createdAt FOR UPDATE SKIP LOCKED LIMIT 1`. Then set status = RUNNING, lockedAt = now(), lockedBy = worker_id.

**Rationale:** Single table minimizes schema and query complexity; retry/error on the same row avoids joins and keeps the hot path (claim, update status) fast. Add `telemetry_job_attempt` in v1 if diagnostics require per-attempt history.

---

## 2. Upload and artifact lifecycle

**Decision:** **One artifact per file.** Create the artifact at **upload time** (POST /uploads) with `sessionId` **nullable**. On **finalise** (POST /uploads/{id}/finalise), create the session, set `artifact.sessionId = session.id`, create the processing run, and enqueue job(s). No separate "uploads" table.

**Flow:**

1. **POST /api/v1/telemetry/uploads** — Create a row in `telemetry_artifacts` with: sessionId = null, status = UPLOADED, ownerUserId, originalFileName, contentType, byteSize, sha256, uploadedAt, **storagePath** (see §3). Return upload id = artifact.id and signed PUT URL (or accept body and write to storage, then set storagePath).
2. Client uploads file to signed URL (or request body); app writes bytes to object storage or local path and sets artifact.storagePath.
3. **POST /api/v1/telemetry/uploads/{uploadId}/finalise** — Create `telemetry_sessions` (with placeholder start/end time per §4). Set `artifact.sessionId = session.id` for the artifact(s) being finalised. Create `telemetry_processing_runs`. Enqueue job(s) (e.g. one intake job or artifact_validate → artifact_classify → parse_raw). Return session_id and poll URL.

**Idempotency:** Within a session, (sha256, byteSize) unique on artifacts. If finalise is called with an artifact that already has a sessionId, treat as error or idempotent no-op (document chosen behaviour in API).

**Rationale:** Single table (artifacts) avoids dual writes and sync; nullable sessionId is the minimal schema change and keeps the API resource "upload" as the artifact before session exists.

---

## 3. Raw file storage location (worker read path)

**Decision:** Store the **raw uploaded file** location on the artifact so the worker can read it once before canonicalisation. Use a single column that supports both object-storage keys and local paths.

**Schema addition (telemetry_artifacts):**

- **storagePath** (text, required when status = UPLOADED) — Interpretation depends on env:
  - **Object storage:** Storage path or key (e.g. `uploads/{tenant_id}/{artifact_id}.bin` or bucket-relative key). Worker uses TELEMETRY_OBJECT_STORAGE_* to read.
  - **Local path (dev):** Absolute or config-relative path (e.g. `/data/telemetry/uploads/{artifact_id}.csv`). Worker reads from filesystem.

After canonicalisation, raw bytes are discarded per ADR; storagePath can be cleared (set null) or retained for audit. Discarding implies deleting the object or file and setting discardedAt.

**Rationale:** One column keeps the contract simple; backend config (object vs local) determines how the worker resolves storagePath. No separate "upload" table and no duplicate storage of the same path.

---

## 4. Session start/end time at creation

**Decision:** **startTimeUtc** and **endTimeUtc** remain required in the schema. At session creation (finalise), set both to **session.createdAt** (or the same value from the API server clock). When the first processing run **succeeds**, update session.startTimeUtc and session.endTimeUtc from the **canonical data time range** (min/max timestamp from parsed streams).

**Rationale:** Keeps schema constraints valid; placeholder avoids nullable columns; one update after parse gives accurate bounds for listing and filtering.

---

## 5. MVP fixture files

**Decision:** Commit three deterministic fixture files under `ingestion/tests/fixtures/telemetry/` for parser and integration tests:

| File                     | Purpose |
|--------------------------|--------|
| sample_gnss_10hz.csv     | Valid 10 Hz GNSS CSV: timestamp, lat, lon, optional alt, speed. Parser must produce gnss_pvt. |
| sample_track.gpx         | Valid GPX track with trkpt, ele, time. Parser must produce gnss_pvt. |
| csv_no_time.csv          | CSV with lat, lon, speed but **no** time column. Parser must emit error code CSV_NO_TIME_COLUMN. |

Use these in unit tests and in the integration "happy path" and "malformed" scenarios. The existing synth generator and pack-a fixtures remain for richer scenarios; the three above are the MVP contract.

---

## 6. Python dependency for Parquet

**Decision:** Add **pyarrow** to `ingestion/requirements.txt` for writing canonical Parquet. Prefer pyarrow over pandas for this use case (lighter, no pandas dependency, direct columnar write).

**Rationale:** Implementation plan and design require writing Parquet; pyarrow is the standard performant choice and keeps the ingestion service lean.

---

## 7. Error storage and API when session is FAILED

**Decision:** When the processing run fails, the worker sets **telemetry_processing_runs.errorCode** and **telemetry_processing_runs.errorDetail** and the session status to **FAILED**. The API **GET /api/v1/telemetry/sessions/{sessionId}** when status is `failed` MUST include a **failure** object in the session response so the UI can show a clear message and remediation.

**API addition:** In the session detail response, when `session.status === "failed"`, include:

```json
"failure": {
  "code": "string",
  "message": "string"
}
```

Where `code` is the run’s errorCode (stable enum or string) and `message` is a user-facing message derived from errorCode/errorDetail (or errorDetail if safe to show). See [Telemetry Import UX Design](Telemetry_Import_UX_Design.md) §6.4 for error code → UX message mapping.

**Rationale:** Single source of truth (run.errorCode/errorDetail); API exposes it in one place for the client.

---

## 8. Naming convention (Postgres and Prisma)

**Decision:** **camelCase** for column names in the Prisma schema and in the Concrete Data Model document. Prisma will generate the schema; if the database uses snake_case, use Prisma’s `@map("snake_case_column")` (or global mapping) so that the application uses camelCase and the DB can follow existing conventions. Python workers that read/write Postgres must use the same column names as the database (so if Prisma emits snake_case migrations, Python uses snake_case in raw SQL or SQLAlchemy).

**Recommendation:** Use Prisma default (camelCase in schema); ensure migrations emit consistent names. Document in the Concrete Data Model that "column names in this document are Prisma/camelCase; migrations define the actual database column names."

**Rationale:** One convention in the doc and app reduces confusion; Prisma’s mapping keeps DB and app aligned.

---

## 9. Teams and sharing in MVP

**Decision:** **Defer** creation of tables: `teams`, `team_members`, `telemetry_share_grants`, `telemetry_public_shares` to **v1**. For MVP, all sessions are effectively **private** (owned by the user). No team or public-share APIs or UI in MVP.

**Schema scope for MVP:** Implement telemetry_sessions, telemetry_artifacts, telemetry_devices, telemetry_processing_runs, telemetry_jobs, telemetry_datasets, telemetry_laps. Omit telemetry_segments and telemetry_edits if not required for MVP list/detail. Omit teams and sharing tables entirely until v1.

**Rationale:** Simplest path to a working upload → process → list flow; sharing adds scope and can be added when needed.

---

## Summary table

| # | Topic              | Decision |
|---|--------------------|----------|
| 1 | Job table          | Single telemetry_jobs table with retry/error columns; no job_attempt in MVP. |
| 2 | Upload/artifact    | One artifact per file; sessionId nullable until finalise; artifact created on POST uploads. |
| 3 | Raw file storage   | storagePath on telemetry_artifacts; object key or local path per env. |
| 4 | Session time        | Placeholder start/end = session.createdAt; update from canonical range when run succeeds. |
| 5 | Fixtures           | sample_gnss_10hz.csv, sample_track.gpx, csv_no_time.csv committed under fixtures/telemetry. |
| 6 | Parquet dependency | Add pyarrow to ingestion/requirements.txt. |
| 7 | FAILED response    | GET session includes failure: { code, message } when status is failed. |
| 8 | Naming             | camelCase in Prisma and doc; DB column names consistent with migrations. |
| 9 | Sharing             | Defer teams and sharing tables to v1; MVP private only. |
