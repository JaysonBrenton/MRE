---
created: 2026-06-07
creator: Jayson Brenton
lastModified: 2026-06-07
description: Runbook for configuring MRE observability platform in Docker
purpose:
  Step-by-step instructions to enable Datadog (default) or Grafana Cloud +
  Sentry (alternative) for MRE Docker Compose deployments. Covers agent setup,
  environment variables, log pipelines, APM, and verification.
relatedFiles:
  - docs/adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md
  - docs/architecture/observability-platform.md
  - docs/implimentation_plans/observability-platform-remediation-2026-06.md
  - docker-compose.yml
  - .env.docker.example
---

# Observability Platform Setup Runbook

**Audience:** DevOps, Platform, Observability lead  
**Applies to:** Docker Compose (`docker-compose.yml`) — adapt for production
orchestration  
**Prerequisite:** Phase 1+ code from
[observability-platform-remediation-2026-06.md](../implimentation_plans/observability-platform-remediation-2026-06.md)

---

## 1. Overview

MRE observability is **disabled by default** in local development. Enable
explicitly for **staging** and **production** when SaaS credentials are
available.

| Path                           | When to use                          |
| ------------------------------ | ------------------------------------ |
| **A — Datadog (recommended)**  | Single vendor; final release default |
| **B — Grafana Cloud + Sentry** | Cost control; OTel-native stack      |

---

## 2. Pre-flight checklist

- [ ] Docker Desktop running; context `desktop-linux`
- [ ] ADR-20260607 platform choice recorded as Accepted
- [ ] SaaS account created; API keys stored in secrets manager (not committed)
- [ ] Staging `deployment.environment` label agreed (`staging`, `production`)
- [ ] Team access to SaaS org configured

---

## 3. Environment variables

Add to `.env.docker` (never commit secrets). Example skeleton:

```bash
# --- Observability (optional) ---
OBSERVABILITY_ENABLED=false

# Release tag attached to all telemetry
MRE_RELEASE_VERSION=local-dev

# Log levels (existing)
LOG_LEVEL=INFO

# Next.js ApplicationLog DB persistence when SaaS on
APPLICATION_LOG_PERSIST_ENABLED=true
APPLICATION_LOG_PERSIST_LEVELS=warn,error

# Ingestion sampling (production)
INGESTION_LOG_SAMPLE_RATE=1.0
# Use 0.1 in production after Phase 2

# --- Datadog path ---
# DD_API_KEY=
# DD_SITE=datadoghq.com
# DD_ENV=development
# DD_SERVICE=mre-app
# NEXT_PUBLIC_DD_APPLICATION_ID=
# NEXT_PUBLIC_DD_CLIENT_TOKEN=

# --- Sentry path (Grafana alternative) ---
# SENTRY_DSN=
# NEXT_PUBLIC_SENTRY_DSN=

# --- OpenTelemetry (Grafana / OTLP) ---
# OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-us-central-0.grafana.net/otlp
# OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic ...
```

Update `docs/operations/build-runtime-reference.md` when variables ship in code.

---

## 4. Path A — Datadog setup

### 4.1 Create Datadog account

1. Sign up at [https://www.datadoghq.com/](https://www.datadoghq.com/)
2. Note your **site** (`datadoghq.com`, `datadoghq.eu`, etc.)
3. Create an **API key** (Organization Settings → API Keys)

### 4.2 Add Datadog Agent to Compose

Add service to `docker-compose.yml` (after Phase 2 implementation):

```yaml
datadog-agent:
  image: gcr.io/datadoghq/agent:7
  container_name: mre-datadog-agent
  environment:
    DD_API_KEY: ${DD_API_KEY}
    DD_SITE: ${DD_SITE:-datadoghq.com}
    DD_APM_ENABLED: "true"
    DD_LOGS_ENABLED: "true"
    DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL: "true"
    DD_PROCESS_AGENT_ENABLED: "true"
    DD_DOGSTATSD_NON_LOCAL_TRAFFIC: "true"
    DD_AC_EXCLUDE: "name:datadog-agent name:mre-postgres name:mre-clickhouse"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - /proc/:/host/proc/:ro
    - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
  networks:
    - mre-network
  restart: unless-stopped
  profiles:
    - observability
```

Start with profile:

```bash
docker compose --profile observability up -d
```

### 4.3 Container log labels

On `mre-app`:

```yaml
labels:
  com.datadoghq.ad.logs: '[{"source":"nodejs","service":"mre-app"}]'
  com.datadoghq.ad.check_names: '["http_check"]'
  com.datadoghq.ad.init_configs: "[{}]"
  com.datadoghq.ad.instances: '[{"name":"mre-app","url":"http://%%host%%:3001/api/v1/health"}]'
```

On `liverc-ingestion-service`:

```yaml
labels:
  com.datadoghq.ad.logs: '[{"source":"python","service":"liverc-ingestion"}]'
```

On `telemetry-worker`:

```yaml
labels:
  com.datadoghq.ad.logs: '[{"source":"python","service":"telemetry-worker"}]'
```

### 4.4 Application APM (Node.js)

After Phase 1/3 code ships:

1. Install `dd-trace` in `mre-app` container
2. Init in `src/instrumentation.ts`:

```typescript
if (process.env.OBSERVABILITY_ENABLED === "true") {
  require("dd-trace").init({
    service: process.env.DD_SERVICE || "mre-app",
    env: process.env.DD_ENV,
    version: process.env.MRE_RELEASE_VERSION,
    logInjection: true,
  })
}
```

3. Set on `mre-app` service:

```yaml
environment:
  DD_AGENT_HOST: mre-datadog-agent
  DD_TRACE_AGENT_PORT: 8126
  DD_LOGS_INJECTION: "true"
  DD_ENV: ${DD_ENV:-development}
  DD_SERVICE: mre-app
  DD_VERSION: ${MRE_RELEASE_VERSION:-local}
```

### 4.5 Application APM (Python)

On ingestion + telemetry-worker:

```yaml
environment:
  DD_AGENT_HOST: mre-datadog-agent
  DD_TRACE_AGENT_PORT: 8126
  DD_LOGS_INJECTION: "true"
  DD_ENV: ${DD_ENV:-development}
  DD_SERVICE: liverc-ingestion
  DD_VERSION: ${MRE_RELEASE_VERSION:-local}
```

Run uvicorn with `ddtrace-run` (entrypoint change in Phase 3):

```bash
ddtrace-run uvicorn ingestion.api.app:app --host 0.0.0.0 --port 8000
```

### 4.6 Log pipelines (Datadog UI)

1. Navigate to **Logs → Configuration → Pipelines**
2. Create pipeline **MRE JSON**
3. Filter: `service:(mre-app OR liverc-ingestion OR telemetry-worker)`
4. Processors:
   - **JSON parser** — extract root
   - **Remapper** — `timestamp` → `@timestamp`
   - **Category processor** — faceted fields:
     - `@request_id` ← `request_id`
     - `@ingestion.event_id` ← `ingestion.event_id`
     - `@ingestion.stage` ← `ingestion.stage`
     - `@error.code` ← `error.code`
5. **Trace remapper** — enable trace correlation for `dd.trace_id`

### 4.7 Exclude noise

Add log exclusion filter:

```
service:mre-app @http.path:/api/v1/health
service:liverc-ingestion @http.path:/health
```

### 4.8 RUM (browser)

1. Datadog → RUM → New Application → JavaScript
2. Copy Application ID and Client Token to `.env.docker`:

```bash
NEXT_PUBLIC_DD_APPLICATION_ID=...
NEXT_PUBLIC_DD_CLIENT_TOKEN=...
```

3. Enable only when `OBSERVABILITY_ENABLED=true` and not in local dev unless
   testing

### 4.9 Prometheus metrics scrape

After `/metrics` exposed (Phase 3):

1. Datadog Agent → **Checks.d** config or Autodiscovery:

```yaml
ad.datadoghq.com/liverc-ingestion-service.checks: |
  {
    "openmetrics": {
      "init_config": {},
      "instances": [{
        "openmetrics_endpoint": "http://%%host%%:8000/metrics",
        "namespace": "mre.ingestion",
        "metrics": [".*"]
      }]
    }
  }
```

---

## 5. Path B — Grafana Cloud + Sentry

### 5.1 Grafana Cloud

1. Create stack at
   [https://grafana.com/products/cloud/](https://grafana.com/products/cloud/)
2. Note OTLP endpoint and credentials for Loki/Tempo/Mimir

### 5.2 Alloy collector (Compose)

Replace Datadog agent with Grafana Alloy:

```yaml
alloy:
  image: grafana/alloy:latest
  container_name: mre-alloy
  volumes:
    - ./observability/alloy.config:/etc/alloy/config.alloy:ro
    - /var/run/docker.sock:/var/run/docker.sock:ro
  networks:
    - mre-network
  profiles:
    - observability
```

`observability/alloy.config` (create in Phase 2):

- Docker log discovery → Loki push
- OTLP receiver → Tempo + Mimir
- Scrape `liverc-ingestion-service:8000/metrics`

### 5.3 OpenTelemetry export

Set on all app containers:

```bash
OBSERVABILITY_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-...grafana.net/otlp
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_SERVICE_NAME=mre-app
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=staging,service.version=abc123
```

### 5.4 Sentry

1. Create Sentry project (Next.js)
2. `npx @sentry/wizard@latest -i nextjs` inside `mre-app` container workflow
3. Set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
4. Set `OBSERVABILITY_ENABLED=true`

---

## 6. Enabling observability in staging

```bash
# 1. Configure .env.docker
OBSERVABILITY_ENABLED=true
DD_API_KEY=<secret>
DD_ENV=staging
MRE_RELEASE_VERSION=$(git rev-parse --short HEAD)

# 2. Start stack with agent profile
docker compose --profile observability up -d --build

# 3. Verify agent
docker logs mre-datadog-agent 2>&1 | tail -20
# Expect: "API Key valid", "Sending logs"

# 4. Generate traffic
docker exec mre-app wget -qO- http://localhost:3001/api/v1/health
docker exec mre-liverc-ingestion-service curl -sf http://localhost:8000/health

# 5. Trigger test ingest (staging event id)
# Via admin UI or API

# 6. Search SaaS logs (within 2 minutes)
# service:mre-app OR service:liverc-ingestion
```

---

## 7. Verification matrix

| Check             | Command / action                      | Expected                      |
| ----------------- | ------------------------------------- | ----------------------------- |
| Agent running     | `docker ps \| grep datadog-agent`     | Container up                  |
| App logs ingested | SaaS Log Explorer                     | JSON lines from `mre-app`     |
| Ingestion logs    | Trigger ingest                        | Lines with `ingestion_start`  |
| Correlation       | Note `X-Request-ID` from API response | Same id in ingestion logs     |
| APM trace         | Ingest from UI                        | Trace spans both services     |
| Metrics           | `curl /metrics`                       | Prometheus format             |
| Errors            | Trigger 500 on test route             | Error in Sentry/Datadog       |
| Dev unchanged     | `OBSERVABILITY_ENABLED=false`         | No agent required; app starts |

---

## 8. Local development (default)

Developers SHOULD NOT need SaaS keys:

```bash
OBSERVABILITY_ENABLED=false
docker compose up -d
docker compose logs -f app liverc-ingestion-service
```

Optional: use `--profile observability` with a personal Datadog trial for
debugging.

---

## 9. Production differences

| Item                                | Staging          | Production                    |
| ----------------------------------- | ---------------- | ----------------------------- |
| `DD_ENV` / `deployment.environment` | `staging`        | `production`                  |
| `INGESTION_LOG_SAMPLE_RATE`         | `0.5`            | `0.1`                         |
| `APPLICATION_LOG_PERSIST_LEVELS`    | `warn,error`     | `warn,error`                  |
| RUM session replay                  | Optional         | Policy decision               |
| `/metrics` exposure                 | Internal network | Internal only; no public port |

---

## 10. Troubleshooting

### No logs in Datadog

1. `docker logs mre-datadog-agent` — API key errors?
2. Confirm container labels applied:
   `docker inspect mre-app --format '{{json .Config.Labels}}'`
3. Confirm app emits JSON to stdout: `docker logs mre-app 2>&1 | tail -5`
4. Check exclusion filters in Datadog pipelines

### Traces not linked to logs

1. Confirm `DD_LOGS_INJECTION=true` and `logInjection: true`
2. Verify same `env` and `service` on app and agent
3. Check `trace_id` field in log schema matches vendor attribute

### High log volume / cost

1. Lower `INGESTION_LOG_SAMPLE_RATE`
2. Add exclusion filters for health checks
3. Review
   [observability-sampling-retention-and-privacy.md](../architecture/observability-sampling-retention-and-privacy.md)

### Agent cannot reach Docker socket (macOS)

- Ensure Docker Desktop socket mounted; restart Docker Desktop if "too many open
  files"

---

## 11. ApplicationLog retention cron (Phase 4)

Run daily inside `mre-app` or as Postgres job:

```sql
DELETE FROM application_logs WHERE created_at < NOW() - INTERVAL '30 days';
```

Or Prisma script in `scripts/purge-application-logs.ts` (to be implemented).

---

## 12. Related documentation

- [Observability Alerting Runbook](./observability-alerting-runbook.md)
- [Observability Platform Architecture](../architecture/observability-platform.md)
- [Implementation Plan](../implimentation_plans/observability-platform-remediation-2026-06.md)

---

**End of observability-platform-setup-runbook.md**
