---
created: 2026-06-07
creator: Jayson Brenton
lastModified: 2026-06-07
description: Log sampling, retention tiers, and PII rules for MRE observability
purpose:
  Defines what MUST NOT be logged, which ingestion events are always logged vs
  sampled, retention periods for SaaS vs Postgres, and cost-control policies for
  final release. Complements the log schema and platform architecture docs.
relatedFiles:
  - docs/architecture/observability-platform.md
  - docs/architecture/observability-log-schema.md
  - docs/architecture/logging.md
  - docs/architecture/liverc-ingestion/17-ingestion-security.md
  - docs/telemetry/Design/Security Privacy Retention and Deletion.md
  - src/lib/security-logger.ts
status: Normative — proposed with ADR-20260607
---

# Observability Sampling, Retention, and Privacy

**Status:** Normative (proposed)  
**ADR:** [ADR-20260607](../adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md)

---

## 1. Purpose

Ingestion and API traffic can generate **high log volume**. A third-party SaaS
platform bills by ingested volume and indexed fields. This document defines:

- **Privacy:** fields that MUST NOT appear in logs
- **Sampling:** which events are always kept vs probabilistically dropped
- **Retention:** how long each store keeps data
- **Redaction:** rules for identifiers that may appear in limited form

---

## 2. Data classification

| Class           | Examples                                                                               | Log policy                           |
| --------------- | -------------------------------------------------------------------------------------- | ------------------------------------ |
| **Forbidden**   | Passwords, `AUTH_SECRET`, session JWTs, API keys, full request bodies with credentials | MUST NOT log                         |
| **Restricted**  | Email, full name, transponder, IP (GDPR context)                                       | Mask or omit unless operational need |
| **Operational** | `event_id`, `track_slug`, error codes, durations, HTTP status                          | Log freely                           |
| **Debug-only**  | HTML snippets, selector dumps, full SQL                                                | DEBUG level + dev/fixture only       |
| **Audit**       | Admin actions                                                                          | `AuditLog` table, not general stdout |

---

## 3. Forbidden fields and patterns

The following MUST NOT appear in any log level in production:

| Pattern                                                               | Reason                                    |
| --------------------------------------------------------------------- | ----------------------------------------- |
| `password`, `passwd`, `secret`, `token`, `authorization` header value | Credential leak                           |
| Full `DATABASE_URL`, `AUTH_SECRET`, `DD_API_KEY`, `SENTRY_DSN`        | Secret leak                               |
| Raw LiveRC HTML bodies at INFO or above                               | Size, PII, copyright                      |
| Full session cookies                                                  | Session hijack                            |
| Unredacted email addresses                                            | Privacy — use masking per security-logger |
| Credit card or payment data                                           | N/A today; forbidden for future           |

### 3.1 CI / lint enforcement (target)

- Grep rule in pre-commit: `logger.*password`, `console.log.*token`
- Code review checklist for new log context objects

---

## 4. Redaction rules

### 4.1 Email and username

Use existing pattern from `src/lib/security-logger.ts`:

```
user@example.com → use***@example.com
username         → use***
```

Apply in `logFailedLogin`, registration errors, and any user identifier in
WARN/ERROR.

### 4.2 IP addresses

| Environment      | Policy                                                |
| ---------------- | ----------------------------------------------------- |
| Production SaaS  | Log `client.ip` for security events and rate limiting |
| Production DEBUG | Omit unless debugging incident                        |
| Development      | Allowed                                               |

### 4.3 LiveRC driver names

Driver names from public race results MAY appear in ingestion DEBUG logs in
development. In production INFO+ logs, prefer `driver_id` / `source_driver_id`
only. If name required for operator debugging, log at DEBUG with sampling.

### 4.4 URLs

Log LiveRC URLs without query strings containing session tokens. Truncate to 512
chars.

---

## 5. Ingestion log sampling

### 5.1 Environment defaults

| Environment | `INGESTION_LOG_SAMPLE_RATE` | Notes                              |
| ----------- | --------------------------- | ---------------------------------- |
| development | `1.0`                       | Full verbosity                     |
| staging     | `0.5`                       | Validate sampling logic            |
| production  | `0.1`                       | 10% of sample-eligible INFO events |

Controlled by env var on `liverc-ingestion-service` and `telemetry-worker`.

### 5.2 Never sample (always emit at full rate)

These `message` values MUST bypass sampling regardless of rate:

```
ingestion_start
ingestion_finish
ingestion_failed
ingestion_skip_already_complete
db_upsert_summary
advisory_lock_acquired
advisory_lock_released
advisory_lock_release_failed
advisory_lock_leaked_suspected
connector_errors_total   (metric + log on increment)
site_policy_events_total
refresh_recent_events_start
refresh_recent_events_complete
ingest_practice_day_start
ingest_practice_day_success
telemetry_job_failed
```

Configure via `INGESTION_LOG_ALWAYS_EVENTS` (comma-separated list matching
above).

### 5.3 Sample-eligible (INFO, high volume)

```
event_page_fetched
race_page_fetched
laps_extracted
trace_span_start
trace_span_end
practice_session_detail_fetch_failed  (warn — see below)
```

Implementation: structlog processor or wrapper:

```python
def sample_log_event(event_dict: dict) -> dict | None:
    if event_dict.get("message") in ALWAYS_EVENTS:
        return event_dict
    if event_dict.get("level") in ("warning", "error"):
        return event_dict
    if random.random() <= sample_rate:
        return event_dict
    return None  # drop
```

### 5.4 WARN and ERROR

**Never sample** warnings and errors in production.

---

## 6. Next.js ApplicationLog persistence sampling

When `OBSERVABILITY_ENABLED=true`:

| Level | Persist to Postgres `ApplicationLog`       |
| ----- | ------------------------------------------ |
| debug | No                                         |
| info  | No (default)                               |
| warn  | Yes                                        |
| error | Yes (immediate flush — existing behaviour) |

Override with `APPLICATION_LOG_PERSIST_LEVELS=warn,error`.

When `OBSERVABILITY_ENABLED=false` (local dev):

| Level | Persist                           |
| ----- | --------------------------------- |
| debug | No (console only in dev)          |
| info  | Yes (optional, current behaviour) |
| warn  | Yes                               |
| error | Yes                               |

Rationale: Postgres is not the primary log store in production; warn/error
suffice for admin UI when SaaS is unavailable.

---

## 7. Retention tiers

| Store                                             | Hot (full search)  | Total retention      | Owner                         |
| ------------------------------------------------- | ------------------ | -------------------- | ----------------------------- |
| SaaS logs                                         | 15 days            | 30 days              | Platform / Observability lead |
| SaaS traces                                       | 15 days            | 15 days              | Platform                      |
| SaaS metrics                                      | 15 months (rollup) | 13 months granular   | Platform                      |
| `ApplicationLog`                                  | 7 days             | 30 days (cron purge) | Backend engineer              |
| `AuditLog`                                        | 1 year             | 1+ years (TBD legal) | Compliance                    |
| Ingestion HTML fixtures                           | N/A                | 30 days on disk      | Ingestion                     |
| Cron stdout files (`/var/log/*.log` in container) | 7 days             | 14 days              | DevOps                        |

### 7.1 Purge jobs (target)

- `ApplicationLog`: daily delete where `createdAt < now() - 30 days`
- Document in `docs/operations/observability-platform-setup-runbook.md`

---

## 8. Trace and metric cardinality

### 8.1 Metrics — label rules

**Allowed labels:** `result`, `stage`, `error_code`, `method`, `table_name`,
`track_slug`, `job_type`, `outcome`, `status`

**Disallowed as metric labels in SaaS export:** `event_id`, `race_id`,
`user_id`, `job_id` (unbounded cardinality)

Use logs/traces for per-entity detail. Refactor `ingestion/common/metrics.py`
histogram labels in Phase 3.

### 8.2 Traces

Prefer span attributes for `ingestion.event_id` (allowed on spans, not metric
labels).

---

## 9. GDPR and user data

Operational logs are **not** the source of truth for user personal data.

- User deletion requests: purge or anonymise `ApplicationLog` rows by `userId`;
  SaaS logs may require vendor API purge (document in telemetry privacy doc).
- `AuditLog` may retain admin actions involving a user — legal review required
  before deletion.

See also:
[Security Privacy Retention and Deletion.md](../telemetry/Design/Security%20Privacy%20Retention%20and%20Deletion.md).

---

## 10. Cost control checklist (production)

- [ ] `INGESTION_LOG_SAMPLE_RATE=0.1` or lower after baseline measured
- [ ] ApplicationLog info persistence disabled
- [ ] Datadog/Grafana exclusion filters for healthcheck spam (`GET /health`,
      `GET /api/v1/health`)
- [ ] Metric label cardinality audit complete
- [ ] Log pipelines drop DEBUG from production containers
- [ ] Monthly review of indexed log volume by `service`

---

## 11. Incident mode (temporary full verbosity)

Operators MAY set `INGESTION_LOG_SAMPLE_RATE=1.0` and `LOG_LEVEL=DEBUG` for a
**single worker** during an active incident, with:

1. Ticket / incident id recorded
2. Time-box (max 4 hours)
3. Revert documented in post-incident review

Do not leave full sampling enabled globally in production.

---

## 12. Related documentation

- [Observability Log Schema](./observability-log-schema.md)
- [Logging Architecture](./logging.md)
- [Observability Alerting Runbook](../operations/observability-alerting-runbook.md)

---

**End of observability-sampling-retention-and-privacy.md**
