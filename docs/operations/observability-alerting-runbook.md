---
created: 2026-06-07
creator: Jayson Brenton
lastModified: 2026-06-07
description: Alert definitions and incident response for MRE observability
purpose:
  Defines recommended monitors, thresholds, notification channels, and operator
  response steps for MRE production and staging. Implements alerting
  requirements from observability architecture and ingestion doc 15.
relatedFiles:
  - docs/architecture/observability-platform.md
  - docs/architecture/liverc-ingestion/15-ingestion-observability.md
  - docs/operations/observability-platform-setup-runbook.md
  - docs/operations/ingestion-lock-recovery-runbook.md
  - docs/operations/recent-events-auto-ingest-runbook.md
  - docs/roles/observability-incident-response-lead.md
---

# Observability Alerting Runbook

**Audience:** On-call, Observability lead, Platform  
**Platform:** Datadog monitors (default); adapt queries for Grafana Alerting  
**Status:** Target configuration — create monitors after Phase 3 metrics/traces
ship

---

## 1. Alert severity model

| Severity        | Response time     | Channel                   | Examples                                     |
| --------------- | ----------------- | ------------------------- | -------------------------------------------- |
| **P1 Critical** | 15 minutes        | PagerDuty / phone + Slack | App down, DB unreachable, error rate >5%     |
| **P2 High**     | 1 hour            | Slack #mre-alerts         | Ingestion failure spike, lock leak suspected |
| **P3 Warning**  | Next business day | Slack #mre-ops            | Elevated latency, disk usage                 |
| **P4 Info**     | Log only          | Email                     | Deploy notification, cron completed          |

---

## 2. Notification channels (configure in SaaS)

| Channel              | Use                |
| -------------------- | ------------------ |
| `#mre-alerts`        | P1–P2              |
| `#mre-ops`           | P3                 |
| `oncall@mre.example` | P1 escalation      |
| Email digest         | Weekly SLO summary |

Document actual webhook URLs in team secrets store, not in git.

---

## 3. Critical monitors (P1)

### 3.1 MRE App health check failing

**Type:** Synthetic HTTP or metric  
**Query (Datadog):**

```
avg(last_5m):avg:network.http.response_time{service:mre-app,url:*/api/v1/health} > 0
```

**Alternative:** Synthetic test GET `https://<prod-host>/api/v1/health` every
60s

| Setting  | Value                  |
| -------- | ---------------------- |
| Trigger  | 3 consecutive failures |
| Severity | P1                     |

**Response:**

1. `docker ps` / orchestration dashboard — is `mre-app` running?
2. `docker logs mre-app --tail 200`
3. Check Postgres health: `docker exec mre-postgres pg_isready`
4. If OOM: review container memory limits in `docker-compose.yml`
5. Escalate to Platform if DB connection pool exhausted

---

### 3.2 Ingestion service health failing

**Synthetic:** GET `http://liverc-ingestion-service:8000/health` from agent

| Setting  | Value               |
| -------- | ------------------- |
| Trigger  | 3 failures in 5 min |
| Severity | P1                  |

**Response:**

1. `docker logs mre-liverc-ingestion-service --tail 200`
2. Check queue backlog if `INGESTION_USE_QUEUE=true`
3. Restart: `docker compose restart liverc-ingestion-service`
4. Verify Playwright dependencies if browser errors in logs

---

### 3.3 API error rate critical

**Query:**

```
sum(last_5m):sum:trace.http.request.errors{service:mre-app}.as_count() /
sum:trace.http.request.hits{service:mre-app}.as_count() > 0.05
```

| Setting  | Value             |
| -------- | ----------------- |
| Trigger  | >5% for 5 minutes |
| Severity | P1                |

**Response:**

1. Log Explorer: `service:mre-app status:error` group by `@http.route`
2. Identify deploy correlation — recent release?
3. Check Postgres connectivity errors
4. Rollback if single bad deploy confirmed

---

### 3.4 Database connectivity

**Query:** Log pattern or metric from app:

```
logs("service:mre-app @error.code:DATABASE_*").index("*").rollup("count").last("5m") > 10
```

| Setting  | Value               |
| -------- | ------------------- |
| Trigger  | >10 errors in 5 min |
| Severity | P1                  |

**Response:**

1. Postgres container health
2. Connection string / pool settings (`connection_limit=10` in DATABASE_URL)
3. Review long-running ingestion transactions blocking pool

---

## 4. High priority monitors (P2)

### 4.1 Ingestion failure rate

**Query (metrics after label refactor):**

```
sum(last_15m):sum:mre.ingestion.connector_errors_total{*}.as_count() > 20
```

Or log-based:

```
logs("service:liverc-ingestion @message:ingestion_failed").rollup("count").last("15m") > 5
```

| Setting  | Value                 |
| -------- | --------------------- |
| Trigger  | >5 failures in 15 min |
| Severity | P2                    |

**Response:**

1. Group by `@error.code`, `@ingestion.stage`
2. Check LiveRC upstream / site policy throttling (`site_policy_events_total`)
3. Review connector stage — HTTPX vs Playwright
4. See
   [20-ingestion-replay-and-debugging.md](../architecture/liverc-ingestion/20-ingestion-replay-and-debugging.md)

---

### 4.2 Advisory lock leak suspected

**Log monitor:**

```
logs("service:liverc-ingestion @message:advisory_lock_leaked_suspected").index("*").rollup("count").last("10m") >= 1
```

| Setting  | Value    |
| -------- | -------- |
| Trigger  | ≥1 event |
| Severity | P2       |

**Response:**

Follow
[ingestion-lock-recovery-runbook.md](./ingestion-lock-recovery-runbook.md).

---

### 4.3 Ingestion lock timeout spike

**Metric:**

```
sum(last_15m):sum:mre.ingestion.ingestion_lock_timeouts_total{*}.as_count() > 3
```

| Setting  | Value        |
| -------- | ------------ |
| Trigger  | >3 in 15 min |
| Severity | P2           |

**Response:**

1. Check concurrent ingests for same `event_id`
2. Review queue mode vs worker count (`UVICORN_WORKERS`, `INGESTION_USE_QUEUE`)
3. Lock recovery runbook if stale locks

---

### 4.4 API latency degradation

**Query:**

```
avg(last_10m):p95:trace.http.request.duration{service:mre-app} > 2
```

| Setting  | Value               |
| -------- | ------------------- |
| Trigger  | p95 > 2s for 10 min |
| Severity | P2                  |

**Response:**

1. Identify slow routes in APM
2. Check `prismaQueryCount` in logs for N+1
3. Review
   [application-performance-remediation-2026-03.md](../implimentation_plans/application-performance-remediation-2026-03.md)

---

### 4.5 Recent events auto-ingest job missing

From
[15-ingestion-observability.md](../architecture/liverc-ingestion/15-ingestion-observability.md)
§9.3:

```
logs("service:liverc-ingestion @message:refresh_recent_events_complete").rollup("count").last("26h") < 1
```

| Setting  | Value                     |
| -------- | ------------------------- |
| Trigger  | No complete event in 26 h |
| Severity | P2                        |

**Response:**
[recent-events-auto-ingest-runbook.md](./recent-events-auto-ingest-runbook.md)

---

## 5. Warning monitors (P3)

### 5.1 Slow API requests (existing threshold)

Aligns with `PERF_THRESHOLD_API=300` ms — alert at sustained elevation:

```
avg(last_15m):p95:trace.http.request.duration{service:mre-app} > 1
```

Severity P3.

---

### 5.2 Ingestion duration anomaly

```
avg(last_1h):p95:mre.ingestion.ingestion_duration_seconds{result:success} > 600
```

Ten minutes p95 — tune baseline after 2 weeks of data.

---

### 5.3 Container memory high

```
avg(last_10m):docker.mem.rss{mre-app} / docker.mem.limit{mre-app} > 0.9
```

Repeat for `liverc-ingestion-service`.

---

### 5.4 ApplicationLog table growth

Postgres custom metric or daily script:

```
SELECT COUNT(*) FROM application_logs WHERE created_at > NOW() - INTERVAL '1 day';
```

Alert if >100k rows/day when SaaS enabled (misconfigured persistence).

---

## 6. Info monitors (P4)

| Monitor              | Condition                                   |
| -------------------- | ------------------------------------------- |
| Deploy marker        | Annotation from CI on deploy                |
| Auto-ingest complete | `refresh_recent_events_complete` once daily |
| Track sync complete  | CLI success log                             |

---

## 7. Dashboard-linked alerts

Each [setup runbook](./observability-platform-setup-runbook.md) dashboard SHOULD
have at least one alert:

| Dashboard      | Alert                         |
| -------------- | ----------------------------- |
| MRE API        | Error rate + p95 latency      |
| Ingestion      | Failure count + lock timeouts |
| Infrastructure | Memory >90%                   |

---

## 8. Incident response workflow

```
Alert fires
    ↓
Acknowledge in PagerDuty/Slack (who is on-call?)
    ↓
Triage severity — re-classify if needed
    ↓
Gather context:
  - SaaS Log Explorer: request_id / trace_id / ingestion.event_id
  - APM trace flame graph
  - /admin/audit for recent admin actions
  - docker logs if SaaS unavailable
    ↓
Mitigate (restart, disable cron, site policy pause)
    ↓
Fix forward or rollback
    ↓
Verify alert resolved
    ↓
Post-incident: update runbook, tune threshold, create ticket for root cause
```

---

## 9. Useful Log Explorer queries

| Scenario                   | Query                                                               |
| -------------------------- | ------------------------------------------------------------------- |
| Single user ingest failure | `service:mre-app @http.route:"/api/v1/events/*" @request_id:<uuid>` |
| Cross-service trace        | `trace_id:<hex>`                                                    |
| Ingestion stage errors     | `service:liverc-ingestion @ingestion.stage:parse_laps status:error` |
| Lock issues                | `service:liverc-ingestion @message:advisory_lock_*`                 |
| Security                   | `service:mre-app @security.event:failed_login`                      |
| Site policy blocks         | `service:liverc-ingestion @message:site_policy_*`                   |

---

## 10. Synthetic test checklist (staging validation)

Before promoting monitors to production:

- [ ] Stop `mre-app` → health alert fires
- [ ] Force `ingestion_failed` with bad fixture → P2 fires
- [ ] Generate 500 on test route → error rate alert fires
- [ ] Confirm Slack message received
- [ ] Confirm alert auto-resolves on recovery

Document test date and operator in team wiki.

---

## 11. SLO targets (final release)

| SLI                    | Target                  | Measurement window |
| ---------------------- | ----------------------- | ------------------ |
| API availability       | 99.5%                   | 30 days            |
| API p95 latency        | <1s                     | 7 days             |
| Ingestion success rate | 95% (excl. user-caused) | 7 days             |
| Time to detect (P1)    | <5 min                  | Per incident       |

Review quarterly with Observability lead.

---

## 12. Related documentation

- [Observability Platform Setup Runbook](./observability-platform-setup-runbook.md)
- [Monitoring and Observability Guide](./observability-guide.md)
- [Ingestion Lock Recovery](./ingestion-lock-recovery-runbook.md)
- [Observability & Incident Response Lead](../roles/observability-incident-response-lead.md)

---

**End of observability-alerting-runbook.md**
