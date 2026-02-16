# Operational Runbook

Author: Jayson Brenton  
Date: 2026-01-30  
Purpose: Provide an operator-focused runbook for running, monitoring, and
troubleshooting MRE in production, including ingestion pipeline operations,
incident response, backups, retention, and safe maintenance procedures.  
License: Proprietary, internal to MRE

## 1. Scope

This runbook covers:

- Day-to-day operational tasks for the MRE web app, API, and telemetry pipeline
  workers
- Monitoring, alerting, and dashboards
- Incident triage and escalation
- Common failure modes and step-by-step remediation
- Data integrity, retention, and deletion operations
- Release, rollback, and maintenance workflows
- Security and privacy operational controls

Out of scope:

- Business processes and customer support scripts
- Vendor-specific click-path instructions, except where required for critical
  operations

## 2. System overview for operators

### 2.1 Core components

- **Web UI**: Next.js application serving the user interface and calling API
  endpoints
- **API**: Next.js API routes (or a dedicated API service in future) that:
  - handles auth and access control
  - stores metadata in Postgres
  - generates signed URLs for artifact and dataset access
  - exposes progress and derived dataset endpoints

- **Postgres**:
  - stores sessions, artifacts, processing runs, jobs, attempts, derived dataset
    pointers
  - stores quality scoring summaries and reason codes
  - stores audit events and operational telemetry aggregates

- **Object storage**:
  - stores raw artifacts
  - stores derived datasets (chunked time series, lap tables, indexes)
  - stores optional job logs or debug artifacts (redacted)

- **Workers**:
  - poll the job queue (Postgres-backed queue initially)
  - execute jobs: parse, normalise, downsample, fuse, detect laps, publish

- **Retention and deletion reaper**:
  - scheduled process that deletes expired artifacts and datasets
  - enforces user deletion requests

### 2.2 Critical invariants

- No cross-tenant access, every request is scoped by `owner_user_id`
- No Restricted telemetry values in application logs
- Derived datasets are immutable, reprocessing creates new runs
- Jobs are idempotent and safe to retry
- Deletions are real and cascade to storage objects

## 3. Operator roles and access

### 3.1 Roles

- **On-call operator**: handles incidents, dashboards, and basic remediation
- **Platform admin**: can deploy, rollback, and manage infrastructure
- **Support**: can view metadata and job states, cannot view Restricted
  telemetry by default

### 3.2 Elevation for Restricted access

If Restricted data access is required for debugging:

- must be time-bound
- must be explicitly approved
- must be logged as an audit event
- should use redacted views wherever possible

## 4. Monitoring and dashboards

### 4.1 Required dashboards

API:

- request rate, error rate (4xx, 5xx)
- latency percentiles by endpoint (P50, P95, P99)
- top slow endpoints and DB query times

Workers:

- queue depth by job type
- queue wait time percentiles
- job duration percentiles by job type
- retry rate and failure rate by error code
- stale locks count and reaper activity

Storage:

- read/write latency
- error rates
- throughput

Database:

- CPU and memory
- connections and pool saturation
- slow queries and locks
- replication health if applicable

Product-level:

- time to usable (parse + downsample_L1)
- publish success rate
- percentage of runs ending partial or failed

### 4.2 Alerting thresholds

Initial alert thresholds, tune over time:

API:

- 5xx error rate > 1% over 5 minutes
- P95 latency > 800ms for critical read endpoints over 10 minutes
- auth failures spike > 3x baseline

Workers:

- queue depth grows continuously for > 15 minutes
- time to usable P95 > 60 seconds for size class S sessions
- job failure rate > 5% over 15 minutes
- stale locks > 20 jobs for > 10 minutes

Database:

- connection pool > 80% for > 10 minutes
- slow query count > baseline threshold
- disk usage > 80%

Storage:

- write errors > 1% over 10 minutes
- read latency P95 > 500ms over 10 minutes

Security:

- repeated login failures from same IP or account
- unusual signed URL generation volume
- support elevation events outside business hours

## 5. Daily operational checklist

Daily:

- verify all services healthy:
  - /api/health, /api/ready, /api/version
- check queue depth and worker health
- check error rate and top error codes
- verify retention reaper ran successfully
- review audit events for unusual access or elevation

Weekly:

- review performance benchmark trend
- review storage growth and retention effectiveness
- confirm backups completed and restore test status
- review top user-facing errors and prioritise fixes

## 6. Incident management

### 6.1 Incident severity levels

- **SEV1**: service down, widespread failures, data leak risk
- **SEV2**: core features degraded, ingestion failing for many users
- **SEV3**: limited scope failures, single job type broken, workaround exists
- **SEV4**: minor issues, cosmetic, or planned maintenance alerts

### 6.2 Incident response flow

1. Triage:
   - identify affected components and scope
   - classify severity
2. Stabilise:
   - stop the bleeding, disable problematic features, reduce load
3. Diagnose:
   - use dashboards, logs, and job attempt records
4. Remediate:
   - apply fix, restart workers, rollback release, reprocess stuck jobs
5. Validate:
   - confirm error rates and queue recover
6. Retrospective:
   - record timeline, root cause, prevention actions, and ADR if needed

### 6.3 Communication expectations

- Provide truthful status updates, no guessing
- Clearly state what is impacted and what is not
- If data integrity is uncertain, pause processing and investigate before
  resuming

## 7. Common failure modes and remediation

### 7.1 Upload failures

Symptoms:

- 4xx on upload, or artifact stuck in uploaded state

Checks:

- API logs for validation failures
- object storage permissions and latency
- file size limits and MIME mismatches

Actions:

- adjust limits only if intentional, otherwise improve error messages
- verify signed URL generation and upload endpoint health

### 7.2 Parser failures

Symptoms:

- high `parse_raw` failure rate, error codes spike

Checks:

- job attempt errors by parser_id and version
- confirm recent release changes
- validate fixtures and classifier thresholds

Actions:

- rollback parser version if needed
- temporarily disable format family via feature flag
- provide user-facing reason codes and workaround suggestions

#### 7.2.1 Known bad patterns for ingestion

These patterns cause parser or pipeline failures and have stable error codes.
Check job attempt `last_error_code` and `last_error_message` for these:

| Pattern | Error code (example) | First checks |
| -------- | -------------------- | ------------- |
| **Timebase mismatch** | `TIME_ALIGNMENT_DRIFT`, `TIMESTAMP_NON_MONOTONIC` | GNSS vs IMU clock drift; device time vs UTC mapping; duplicate timestamps |
| **IMU axis confusion** | `IMU_AXIS_MISMATCH`, `FRAME_AMBIGUOUS` | Device family axis convention (RH_Z_UP vs RH_Z_DOWN); coordinate frame metadata |
| **GNSS jitter** | `GNSS_JITTER_HIGH`, `GNSS_TELEPORT_EVENTS` | HDOP spikes; dropout spans; multipath near structures |
| **Missing timestamps** | `CSV_NO_TIME_COLUMN`, `GPX_MISSING_TIME` | Header mapping; time column detection; fallback to relative time |

Operator actions: run golden fixtures to confirm parser baseline; check device
family in parse metadata; suggest user re-export with timestamps enabled.

### 7.3 Queue backlog

Symptoms:

- queue depth increasing, long wait times

Checks:

- worker health, CPU saturation
- job duration distribution, identify the slow job type
- DB locks or slow query on claim

Actions:

- scale worker replicas horizontally
- split worker pools by job type, isolate fusion
- temporarily lower ingestion rate or enforce quotas
- ensure stale lock reaper running

### 7.4 Stale locks and stuck jobs

Symptoms:

- jobs remain in running state beyond expected timeout

Checks:

- `locked_at` age, `locked_by` active
- worker crash logs
- reaper execution status

Actions:

- run reaper to release stale locks
- requeue jobs in retry_wait if transient failure
- mark failed with clear reason if non-retriable

### 7.5 Storage errors

Symptoms:

- write failures on derived datasets, missing chunk objects

Checks:

- storage error rates and permissions
- object namespace and path correctness

Actions:

- pause publish job type to avoid marking sessions ready with missing data
- re-run affected jobs after storage stabilises
- verify idempotent writes and atomic promotion behaviour

### 7.6 Database issues

Symptoms:

- elevated API latency, timeouts, errors

Checks:

- connection pool saturation
- slow queries and missing indexes
- locks on job claim queries

Actions:

- add missing indexes
- reduce connection pool pressure
- if severe, scale DB or apply read replicas where appropriate
- pause heavy jobs to reduce DB writes

### 7.7 Data integrity anomalies

Symptoms:

- mismatched dataset hashes, inconsistent lap counts across reprocess with same
  versions

Checks:

- determinism tests failing
- compare run metadata, version pins, config snapshots

Actions:

- stop affected processing job types
- investigate non-deterministic code paths
- patch and reprocess affected sessions

## 8. Safe maintenance procedures

### 8.1 Rolling deploy

Pre-deploy:

- verify CI green, including smoke perf and regression tests
- check queue depth, avoid deploy during backlog unless required

Deploy:

- roll web and API first
- then roll workers
- ensure version endpoints updated

Post-deploy:

- monitor 5xx, latency, job failure rates
- monitor time to usable and publish success rate
- keep rollback plan ready

### 8.2 Rollback

Rollback triggers:

- sustained 5xx or job failures
- data integrity uncertainty
- severe performance regression

Rollback steps:

- rollback web and API to last known good
- rollback workers and parser versions
- re-run smoke processing on a known dataset
- reprocess affected user runs if necessary and safe

## 9. Backups, retention, and deletion operations

### 9.1 Backups

Requirements:

- daily full backup of Postgres
- frequent incremental or WAL archiving if supported
- object storage versioning optional, but encryption mandatory
- backup retention aligned to policy, for example 30 days

Runbook:

- check backup success daily
- perform restore test monthly, document results
- ensure deletion ledger is applied after restore

### 9.2 Retention reaper

Daily reaper tasks:

- delete expired raw artifacts
- delete expired derived datasets
- apply user deletion requests

Operator checks:

- confirm reaper ran and produced audit events
- confirm storage usage trends align to expected retention

### 9.3 Deletion verification

For a user deletion request:

- verify tombstone records exist if required
- verify objects removed from storage
- verify session is not discoverable or accessible
- confirm audit event for deletion completion

If deletion fails:

- retry idempotently
- escalate if blocked by storage permissions or object locks

## 10. Security and privacy operational controls

### 10.1 Audit review

Daily:

- review support elevation events
- review unusual signed URL generation spikes
- review repeated failed login patterns

### 10.2 Secret rotation

- rotate signing keys on schedule
- rotate storage credentials and DB passwords periodically
- immediate rotation after suspected compromise

### 10.3 Incident response for suspected data leak

Immediate steps:

- stop signed URL issuance if necessary
- rotate keys and revoke tokens
- restrict access paths
- preserve evidence logs, ensure privacy controls maintained
- notify stakeholders per policy

## 11. Operational tooling requirements

Operators need:

- a single command or dashboard to view:
  - job queue depth
  - stuck jobs and stale locks
  - recent failures by error code
  - run status distribution
- ability to:
  - pause and resume job types via feature flags
  - requeue jobs safely
  - trigger reprocessing runs
  - run retention and deletion tasks on demand
- runbook links embedded in dashboards

## 12. Runbook playbooks

### 12.1 Playbook: ingestion failing for new uploads

1. Confirm /api/ready and storage connectivity
2. Check artifact_validate failures and error codes
3. Check storage permissions and signed URL issuance
4. Rollback recent deploy if correlated
5. Communicate status and workaround, for example export as CSV

### 12.2 Playbook: lap detection suddenly failing

1. Check detect_laps failure rate and reason codes
2. Check recent algorithm version changes
3. Run golden dataset Pack A on staging
4. If regression, rollback lap detection version
5. Reprocess affected sessions if safe

### 12.3 Playbook: queue backlog due to fusion

1. Identify fusion job duration spike
2. Shift fusion jobs to separate worker pool, increase replicas
3. Apply admission control, limit fusion concurrency
4. If necessary, disable fusion temporarily and publish partial outputs
5. Communicate degraded mode truthfully

### 12.4 Playbook: storage partial outage

1. Pause publish_session job type
2. Allow parse and downsample to continue if storage reads ok
3. Monitor storage recovery
4. Re-run failed write jobs
5. Validate object completeness before resuming publish

## 13. Documentation and change management

- Significant operational changes require an ADR
- Runbook updates must be versioned and reviewed
- Every incident must produce:
  - short post-incident note
  - at least one prevention action item

## 14. Implementation checklist

- [ ] Create dashboards and alerts described above
- [ ] Implement operator endpoints or admin UI for job control and requeue
- [ ] Implement stale lock reaper and ensure it is monitored
- [ ] Implement retention and deletion reaper with audit events
- [ ] Implement backup jobs and monthly restore drill
- [ ] Add security audit event review process
- [ ] Add rollback and canary workflow with version pinning
