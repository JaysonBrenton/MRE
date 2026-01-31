# Security, Privacy, Retention, and Deletion

Author: Jayson Brenton  
Date: 2026-01-30  
Purpose: Define the security and privacy posture for MRE telemetry and user
data, including access control, encryption, logging boundaries, data retention,
and user-driven deletion.  
License: Proprietary, internal to MRE

## 1. Scope

This document defines:

- Data classification and threat model for MRE
- Authentication, authorisation, and tenancy boundaries
- Secure storage and transmission for artifacts and derived datasets
- Privacy rules for location and telemetry data
- Retention and deletion policies for all major data categories
- Audit logging, incident response hooks, and operational controls

Out of scope:

- Detailed legal terms and consent text, except where it affects design
- Specific cloud vendor product configuration, beyond required controls
- Device firmware security and supply chain, beyond file integrity checks

## 2. Design goals

- Protect user telemetry, especially location traces and driving behaviour
- Minimise data collection and exposure, only store what is necessary
- Make retention predictable and configurable
- Make deletion real, timely, and verifiable
- Provide operational auditability without leaking sensitive telemetry into logs

## 3. Data classification

### 3.1 Data categories

MRE data is grouped into categories with default sensitivity levels.

Category A: Account and identity

- User id, email, auth provider ids, roles

Category B: Telemetry raw artifacts

- Uploaded files, device exports, sensor streams, potentially precise GPS traces

Category C: Telemetry derived datasets

- Normalised time series, downsampled series, fused pose, lap tables, segment
  tables, metrics

Category D: Metadata and provenance

- Run ids, versions, job status, quality scoring reasons, configuration
  snapshots

Category E: Analytics and operational telemetry

- API request logs, error logs, performance metrics, aggregated usage

Category F: User-generated content

- Notes, labels, manual overrides, track annotations, start-finish edits

### 3.2 Sensitivity levels

- **Restricted**: Categories B and C by default, precise location traces, raw
  sensor time series
- **Confidential**: Categories A, D, F
- **Internal**: Category E, provided it is aggregated and anonymised where
  possible

Strict rule: Restricted data must never be written to application logs.

## 4. Threat model and assumptions

### 4.1 Key risks

- Unauthorised access to telemetry, including location data
- Cross-tenant data leakage via bugs or misconfigured queries
- Token compromise leading to account takeover
- Object storage misconfiguration exposing artifacts
- Insecure logging, accidental PII or telemetry in logs
- Incomplete deletion, data remaining in derived datasets or backups
- Abuse via large uploads, malicious file content, and parser exploits

### 4.2 Assumptions

- MRE uses HTTPS end to end for all client and API traffic
- Stored artifacts and datasets are in a private bucket or equivalent private
  store
- Postgres stores metadata and access control decisions
- Pipeline workers run in a trusted environment with least privilege credentials

## 5. Authentication and session security

### 5.1 Authentication

- Use a trusted auth mechanism with signed, short-lived tokens
- Prefer rotating refresh tokens and short access token expiry
- Enforce MFA for admin roles where supported

### 5.2 Session management

- Tokens bound to an anonymised session id for telemetry correlation
- Invalidate sessions on password change or security events
- Rate limit login attempts and password reset flows

### 5.3 CSRF and browser safety

- Use same-site cookies if cookie-based auth is used
- For token in header auth, enforce strict CORS, origin checks, and no wildcard
  origins

## 6. Authorisation and tenancy isolation

### 6.1 Tenancy model

MRE is single-tenant per user by default, with future support for teams.

Core rule:

- Every row that is user-owned includes `owner_user_id`
- Every query must filter by `owner_user_id` at the data access layer

### 6.2 Access control roles

At minimum:

- `user`: access to their own data
- `admin`: operational visibility, but restricted from raw telemetry unless
  explicitly granted
- `support`: can view metadata, job states, and error codes, but not raw traces
  by default

Support access to Restricted data must be explicitly elevated, logged, and
time-bound.

### 6.3 Object storage access

- Artifacts and derived datasets stored under a path that includes
  `owner_user_id`
- Object access requires a server-signed URL or proxy download endpoint
- Never expose public bucket URLs

## 7. Encryption and key management

### 7.1 In transit

- TLS 1.2+ required
- HSTS enabled
- Avoid mixed content

### 7.2 At rest

- Encrypt Postgres storage (disk or managed service encryption)
- Encrypt object storage (bucket-level encryption or server-side encryption)
- Encrypt backups

### 7.3 Key management principles

- Centralised key management, not hard-coded keys
- Rotate keys on a schedule and after incidents
- Separate keys per environment: dev, staging, prod

## 8. Secure ingestion and file handling

### 8.1 Upload limits and validation

- Enforce max file size, max number of artifacts per session
- Validate MIME types and extensions, but do not trust them, detect by content
  where feasible
- Compute sha256 at upload and verify before processing

### 8.2 Malware and parser hardening

- Treat artifacts as untrusted input
- Parsers run in a restricted environment:
  - limited filesystem access
  - no outbound network unless required for core features
  - strict resource limits, CPU and memory caps

### 8.3 Zip and archive handling

If archive uploads are supported:

- Limit maximum decompressed size
- Prevent path traversal in archive entries
- Limit nested archives
- Prefer streaming extraction with guard rails

## 9. Privacy rules

### 9.1 Data minimisation

- Store only what is required to provide features
- Prefer derived and downsampled data for UI, keep raw only as long as necessary

### 9.2 Location privacy

Location traces are sensitive.

Defaults:

- Do not show exact coordinates in UI by default when not needed
- If sharing is implemented, support redaction zones and start/end blurring
- Do not include precise locations in exports unless the user chooses to

### 9.3 Logging and telemetry privacy

- Do not log coordinates, raw sensor values, or filenames that may include
  personal info
- Log only:
  - ids, durations, sizes
  - structured error codes
  - anonymised session ids
- When debugging requires samples, use explicit opt-in debug mode that is
  time-bound and only stores redacted data

### 9.4 Third-party processors

If using third-party services:

- Document which data categories leave MRE
- Use least privilege and data minimisation
- Prefer aggregated metrics for analytics tools

## 10. Retention policy

Retention must be explicit, tiered, and configurable.

### 10.1 Retention categories and defaults

Category A: Account and identity

- Retain while account is active
- If account deleted, retain minimal compliance record if required, otherwise
  delete

Category B: Raw artifacts  
Raw bytes are not retained; they are discarded immediately after successful
canonicalisation. Only metadata (hash, size, type, parse version) is kept.
Reprocessing uses canonical streams. See
`docs/adr/ADR-20260131-telemetry-storage-and-raw-retention.md`.

Category C: Derived datasets  
Default retention: 12 months  
Rationale: Enables comparisons and history, can be extended by user plan tier.

Category D: Metadata and provenance  
Default retention: 24 months  
Rationale: Auditability, supports debugging without raw data.

Category E: Operational logs  
Raw logs: 7 days  
Aggregated metrics: 90 days  
Rationale: Operational needs, align with existing telemetry guardrails.

Category F: User-generated content  
Retain while session exists, delete with session deletion.

These defaults can be changed per environment and subscription tier.

### 10.2 Retention enforcement mechanism

Use a scheduled retention reaper:

- Runs daily
- Finds expired records
- Deletes in dependency-safe order:
  1. revoke signed URLs and access tokens
  2. delete derived datasets objects (e.g. ClickHouse, object store)
  3. delete metadata rows or mark as tombstoned

Retention enforcement must be idempotent and produce audit events.

### 10.3 Data lifecycle truth table

| Dataset class                                  | Where stored           | When created                             | When / how deleted                                                       | What remains after deletion                                    |
| ---------------------------------------------- | ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Raw upload bytes                               | Not stored             | —                                        | Discarded immediately after successful canonicalisation                  | Nothing (metadata only: hash, size, type, parse version)       |
| Canonical streams / derived time series        | ClickHouse             | After worker canonicalisation/derivation | User deletes session → delete by session_id; retention TTL if configured | Nothing for that session                                       |
| Processed artifact files (e.g. Parquet export) | Object store (if used) | Worker output / export                   | With session deletion or retention reaper                                | Nothing                                                        |
| Metadata (sessions, jobs, provenance)          | Postgres               | On upload / job create                   | User deletes session → cascade; retention reaper for expired metadata    | Per compliance: minimal audit record if required, else nothing |
| Operational logs                               | Log store              | At runtime                               | Raw logs: 7 days; aggregated: 90 days (per Category E above)             | Nothing after expiry                                           |

## 11. Deletion design

### 11.1 User deletion actions

Provide deletion at multiple levels:

- Delete artifact
- Delete session
- Delete account

Each action defines what is removed and what remains.

### 11.2 Hard delete vs tombstone

- Use **hard delete** for Restricted data and object storage by default
- Use **tombstone** for minimal metadata if required for audit, billing, or
  abuse prevention

Tombstone record must not include sensitive content and must never include
coordinates or raw values.

### 11.3 Delete artifact

Behaviour:

- If artifact not yet processed: delete artifact object and metadata
- If processed: delete artifact object, keep provenance that a file existed, and
  keep derived outputs unless user deletes session

UI must explain:

- Deleting the raw file may prevent future reprocessing
- Derived datasets remain until session deletion or retention expiry

### 11.4 Delete session

Behaviour:

- Delete all derived datasets for the session
- Delete all artifacts linked to the session
- Delete user-generated content and overrides
- Delete job and run metadata except minimal tombstone
- Remove from indexes and search

Expected completion target:

- Within minutes for metadata, within hours for storage deletion in worst case

### 11.5 Delete account

Behaviour:

- Cascade delete all sessions, artifacts, derived datasets, and user-generated
  content
- Remove identity data, revoke auth tokens, remove API keys
- Keep minimal abuse-prevention record if required, otherwise delete

Confirmations:

- Require explicit confirmation, with warnings about irreversibility
- Send a confirmation email or in-app confirmation record where appropriate

### 11.6 Deletion verification and user trust

MRE should offer a deletion status page:

- shows deletion requested at timestamp
- shows progress, for example "objects queued for deletion"
- shows completion time

On completion, emit an audit event.

## 12. Backups and deletion implications

Backups complicate deletion.

Policy:

- Backups are encrypted
- Backup retention is limited, for example 30 days
- Deleted data may persist in backups until expiry
- This must be disclosed in deletion UI and policy

Operational rule:

- Do not restore backups into production without reapplying deletion tombstones
- Maintain a deletion ledger to re-enforce deletions after restore

## 13. Audit logging and incident response

### 13.1 Audit events

Record audit events for:

- Login, token refresh, failed auth attempts
- Session creation, artifact upload, export generation
- Support access elevation to Restricted data
- Deletion requests and completion
- Retention reaper deletions

Audit event payload must avoid Restricted data, use ids only.

### 13.2 Incident hooks

- Alert on unusual access patterns, for example many signed URL generations
- Alert on elevated support access events
- Alert on repeated parser failures or suspicious uploads

## 14. Rate limiting and abuse controls

- Per-user upload rate limits
- Global compute limits on heavy jobs
- Request rate limiting on APIs
- Size-based admission control for artifacts

Reject early and clearly, with truthful error messages.

## 15. Data sharing and exports

### 15.1 Default export posture

Exports must be explicit user action.

- Exports include provenance and quality scores
- Exports should default to excluding precise coordinates, unless user selects
  "include coordinates"

### 15.2 Share links

If share links are implemented:

- Use signed, expiring links
- Allow revocation
- Support redaction options, for example hide start/end area

## 16. Security testing and assurance

Minimum practices:

- Dependency scanning and patch cadence
- Static analysis on CI for web and pipeline
- Unit tests for authorisation filters and deletion cascades
- Pen test checklist before public launch

## 17. Implementation checklist

- [ ] Data classification tags for each table and object prefix
- [ ] Owner filter enforced in data access layer, with tests for cross-tenant
      leakage
- [ ] Signed URL generation service with strict scope and short expiry
- [ ] Artifact integrity hashing and verification on read
- [ ] Restricted data logging guardrails, unit tests for log redaction
- [ ] Retention reaper job with idempotent deletion and audit events
- [ ] Deletion ledger to reapply deletions after restore
- [ ] UI deletion flows for artifact, session, account with truthful disclosures
- [ ] Backup retention documented and aligned to deletion policy

## 18. Future evolutions

- Team accounts with role-based sharing
- Fine-grained privacy zones and automatic redaction near home location
- Customer-managed encryption keys for enterprise tier
- Differential privacy for aggregated analytics
- Automated privacy audits and data lineage visualisation
