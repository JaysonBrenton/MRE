---
created: 2026-06-08
creator: Platform / Ingestion
lastModified: 2026-06-08
description:
  Canonical registry of all ingestion-related settings for the admin console and
  runtime config resolver.
purpose:
  Normative list of keys, types, defaults, validation, scope, and apply mode.
  TypeScript and Python registries MUST stay in sync (enforced by test).
relatedDocs:
  - docs/architecture/admin-ingestion-settings-console.md
  - docs/operations/environment-variables.md
  - docs/adr/ADR-20260608-admin-ingestion-settings-console.md
  - policies/site_policy/policy.json
---

# 33. Ingestion Settings Registry and Runtime Config

**Status:** Implemented  
**Registry size:** 47 keys (TypeScript + Python parity enforced in CI)
**Supersedes:** Informal env-var lists only; does not remove
`docs/operations/environment-variables.md` (that doc remains the ops reference
for Docker Compose wiring).

---

## 1. Registry schema

Each entry in code (`ingestion-settings-registry.ts` / `settings_registry.py`):

```typescript
interface IngestionSettingDefinition {
  key: string
  label: string
  description: string
  category: IngestionSettingCategory
  type: "boolean" | "integer" | "number" | "string" | "enum" | "path" | "json"
  default: string | number | boolean
  scope: "ingestion" | "app" | "both" | "telemetry"
  applyMode: "runtime" | "restart" | "readonly"
  writable: boolean // derived: applyMode === "runtime"
  min?: number
  max?: number
  enumValues?: string[]
  confirmWhen?: "disable_scrape" | "unlimited_ingests" | "disable_queue"
  dockerService?:
    | "liverc-ingestion-service"
    | "telemetry-worker"
    | "app"
    | "all"
}
```

**Categories:**

- `scraping_safety`
- `ingestion_queue`
- `track_sync`
- `recent_events_auto_ingest`
- `practice_days`
- `telemetry`
- `infrastructure`
- `site_policy`
- `code_constants`

---

## 2. Resolution and storage

| Source               | Precedence  | Storage                        |
| -------------------- | ----------- | ------------------------------ |
| Database override    | 1 (highest) | `ingestion_settings` table     |
| Environment variable | 2           | Docker Compose / `.env.docker` |
| Registry default     | 3           | Code                           |

Boolean normalisation: `true`, `1`, `yes` → true; `false`, `0`, `no`, `off` →
false.

---

## 3. Registered settings

### 3.1 Scraping and safety

| key                     | type    | default                                 | scope     | applyMode | min/max | notes                                      |
| ----------------------- | ------- | --------------------------------------- | --------- | --------- | ------- | ------------------------------------------ |
| `MRE_SCRAPE_ENABLED`    | boolean | `true`                                  | both      | runtime   | —       | Global kill switch; confirm when disabling |
| `SITE_POLICY_PATH`      | path    | `/app/policies/site_policy/policy.json` | ingestion | restart   | —       | Writable: false                            |
| `SITE_POLICY_CACHE_MAX` | integer | `256`                                   | ingestion | runtime   | 0–4096  | Conditional request cache size             |

### 3.2 Async ingestion queue

| key                               | type    | default | scope     | applyMode | min/max  | notes                              |
| --------------------------------- | ------- | ------- | --------- | --------- | -------- | ---------------------------------- |
| `INGESTION_USE_QUEUE`             | boolean | `true`  | ingestion | restart   | —        | Forces UVICORN_WORKERS=1 when true |
| `INGESTION_QUEUE_MAX_CONCURRENT`  | integer | `2`     | ingestion | runtime   | 1–16     | Active worker semaphore            |
| `INGESTION_QUEUE_JOB_TTL_SECONDS` | integer | `3600`  | ingestion | runtime   | 60–86400 | Completed job retention            |

### 3.3 Track sync

| key                                | type    | default | scope     | applyMode | min/max | notes                      |
| ---------------------------------- | ------- | ------- | --------- | --------- | ------- | -------------------------- |
| `TRACK_SYNC_METADATA_CONCURRENCY`  | integer | `6`     | ingestion | runtime   | 1–32    | Parallel dashboard fetches |
| `TRACK_SYNC_REPORT_RETENTION_DAYS` | integer | `30`    | ingestion | runtime   | 1–365   | Report cleanup             |

### 3.4 Recent events auto-ingest

| key                                     | type    | default    | scope     | applyMode | min/max | enum                        |
| --------------------------------------- | ------- | ---------- | --------- | --------- | ------- | --------------------------- |
| `MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED` | boolean | `false`    | ingestion | runtime   | —       | Cron 02:00 UTC gate         |
| `MRE_RECENT_EVENTS_DAYS`                | integer | `7`        | ingestion | runtime   | 1–90    | —                           |
| `MRE_RECENT_EVENTS_TRACKS`              | enum    | `followed` | ingestion | runtime   | —       | `followed`, `active`, `all` |
| `MRE_RECENT_EVENTS_MAX_INGESTS`         | integer | `50`       | ingestion | runtime   | 0–500   | `0` = unlimited; confirm    |
| `MRE_RECENT_EVENTS_MIN_AGE_HOURS`       | integer | `12`       | ingestion | runtime   | 0–168   | Skip in-progress meetings   |

See [31-recent-events-auto-ingest.md](31-recent-events-auto-ingest.md).

### 3.5 Practice days

| key                                              | type    | default | scope     | applyMode | min/max | notes                         |
| ------------------------------------------------ | ------- | ------- | --------- | --------- | ------- | ----------------------------- |
| `PRACTICE_DAY_DETAIL_CONCURRENCY`                | integer | `5`     | ingestion | runtime   | 1–20    | Session detail parallel fetch |
| `PRACTICE_DISCOVER_CACHE_TTL_SECONDS`            | integer | `600`   | ingestion | runtime   | 0–86400 | Discovery cache               |
| `PRACTICE_DISCOVER_MONTH_VIEW_TIMEOUT_SECONDS`   | number  | `15`    | ingestion | runtime   | 1–120   | HTTP timeout                  |
| `PRACTICE_DISCOVER_DAY_OVERVIEW_TIMEOUT_SECONDS` | number  | `25`    | ingestion | runtime   | 1–120   | HTTP timeout                  |

### 3.6 Telemetry worker

| key                                  | type    | default              | scope     | applyMode | notes                           |
| ------------------------------------ | ------- | -------------------- | --------- | --------- | ------------------------------- |
| `TELEMETRY_UPLOAD_ROOT`              | path    | `/data/telemetry`    | telemetry | restart   | Shared volume                   |
| `TELEMETRY_WORKER_ID`                | string  | `telemetry-worker-1` | telemetry | restart   | —                               |
| `TELEMETRY_WORKER_POLL_INTERVAL_SEC` | number  | `2`                  | telemetry | runtime   | Restart worker if no hot reload |
| `TELEMETRY_WORKER_CLICKHOUSE_HOST`   | string  | ``                   | telemetry | restart   | Empty = skip ClickHouse         |
| `CLICKHOUSE_HTTP_PORT`               | integer | `8123`               | telemetry | restart   | —                               |
| `CLICKHOUSE_USER`                    | string  | `default`            | telemetry | restart   | —                               |
| `CLICKHOUSE_PASSWORD`                | string  | ``                   | telemetry | readonly  | Masked in UI                    |

### 3.7 Infrastructure (read-only in UI)

| key                      | type    | default                                | scope     | applyMode | notes                               |
| ------------------------ | ------- | -------------------------------------- | --------- | --------- | ----------------------------------- |
| `DATABASE_URL`           | string  | required                               | ingestion | readonly  | Masked                              |
| `DB_POOL_SIZE`           | integer | `10`                                   | ingestion | restart   | —                                   |
| `DB_MAX_OVERFLOW`        | integer | `20`                                   | ingestion | restart   | —                                   |
| `LOG_LEVEL`              | enum    | `INFO`                                 | ingestion | restart   | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `HOST`                   | string  | `0.0.0.0`                              | ingestion | restart   | —                                   |
| `PORT`                   | integer | `8000`                                 | ingestion | restart   | —                                   |
| `PYTHONUNBUFFERED`       | string  | `1`                                    | ingestion | restart   | —                                   |
| `TZ`                     | string  | `Australia/Sydney`                     | ingestion | restart   | —                                   |
| `UVICORN_RELOAD`         | boolean | `false`                                | ingestion | restart   | Dev hot reload                      |
| `UVICORN_WORKERS`        | integer | `1`                                    | ingestion | restart   | Forced 1 when queue on              |
| `INGESTION_BUILD_TARGET` | enum    | `development`                          | ingestion | readonly  | Image build arg                     |
| `CORS_ALLOWED_ORIGINS`   | string  | `http://localhost:3001`                | ingestion | restart   | Comma-separated                     |
| `INGESTION_SERVICE_URL`  | string  | `http://liverc-ingestion-service:8000` | app       | readonly  | Next.js → Python                    |
| `INGESTION_PORT`         | integer | `8000`                                 | app       | readonly  | Host mapping                        |

### 3.8 Site policy

| key                     | type | default | scope | applyMode | notes                                 |
| ----------------------- | ---- | ------- | ----- | --------- | ------------------------------------- |
| `site_policy_overrides` | json | `{}`    | both  | runtime   | Merged onto base JSON file at runtime |

Base file fields (documented; override via JSON panel or partial host merge):

| JSON path                     | type    | default (live.liverc.com) | notes                        |
| ----------------------------- | ------- | ------------------------- | ---------------------------- |
| `killSwitchEnv`               | string  | `MRE_SCRAPE_ENABLED`      | Which env var is kill switch |
| `hosts[].pattern`             | string  | —                         | Host glob                    |
| `hosts[].crawlDelaySeconds`   | number  | `0.1`                     | Min delay between requests   |
| `hosts[].maxConcurrency`      | integer | `8`                       | Per-host cap                 |
| `hosts[].respectRobots`       | boolean | `true`                    | robots.txt                   |
| `hosts[].conditionalRequests` | boolean | `true`                    | ETag / If-Modified-Since     |

Merge implementation: `ingestion/common/site_policy_merge.py`,
`src/core/admin/site-policy-merge.ts`.

### 3.9 Code constants (runtime-tunable)

| key                             | type    | default | scope     | applyMode | min/max   | location          |
| ------------------------------- | ------- | ------- | --------- | --------- | --------- | ----------------- |
| `RACE_FETCH_CONCURRENCY`        | integer | `8`     | ingestion | runtime   | 4–16      | `pipeline.py`     |
| `INACTIVITY_TIMEOUT_SECONDS`    | integer | `300`   | ingestion | runtime   | 60–3600   | `pipeline.py`     |
| `MAX_TOTAL_DURATION_SECONDS`    | integer | `3600`  | ingestion | runtime   | 300–86400 | `pipeline.py`     |
| `HTTPX_CONNECT_TIMEOUT_SECONDS` | number  | `5`     | ingestion | runtime   | 1–60      | `httpx_client.py` |
| `HTTPX_READ_TIMEOUT_SECONDS`    | number  | `20`    | ingestion | runtime   | 5–120     | `httpx_client.py` |
| `HTTPX_MAX_RETRIES`             | integer | `3`     | ingestion | runtime   | 0–10      | `httpx_client.py` |

Adaptive concurrency in the pipeline still adjusts between 4 and 16 based on
observed latency; the registry key sets the **initial** value only.

---

## 4. Auth and cache settings

| key                                    | type    | default          | scope     | applyMode | notes                         |
| -------------------------------------- | ------- | ---------------- | --------- | --------- | ----------------------------- |
| `INGESTION_ADMIN_TOKEN`                | string  | required in prod | ingestion | restart   | S2S auth; never expose in GET |
| `INGESTION_SETTINGS_CACHE_TTL_SECONDS` | integer | `30`             | both      | runtime   | Resolver cache TTL            |

**App-only feature flag** (not in registry; see `environment-variables.md`):
`ADMIN_INGESTION_SETTINGS_WRITABLE` gates PATCH and the Save bar in the admin
UI.

---

## 5. Database model

```prisma
model IngestionSetting {
  key       String   @id
  value     String   // serialised string; parse via registry type
  updatedAt DateTime @updatedAt @map("updated_at")
  updatedBy String?  @map("updated_by")

  updatedByUser User? @relation(fields: [updatedBy], references: [id], onDelete: SetNull)

  @@map("ingestion_settings")
}
```

Optional future: `IngestionSettingRevision` for history/rollback (not v1).

---

## 6. Registry parity test

Required CI check:

```
ingestion/tests/unit/test_settings_registry_parity.py
src/__tests__/core/admin/ingestion-settings-registry.test.ts
```

Both assert identical `key`, `type`, `default`, `applyMode`, `scope` sets.

---

## 7. Migration from raw env reads

**Status:** Complete for priority paths (scrape kill switch, queue, track sync,
recent events cron, practice days, site policy merge, pipeline/HTTP constants).

| Current                                              | Target                                             |
| ---------------------------------------------------- | -------------------------------------------------- |
| `os.getenv("MRE_RECENT_EVENTS_DAYS", "7")`           | `settings.get_int("MRE_RECENT_EVENTS_DAYS")`       |
| `process.env.MRE_SCRAPE_ENABLED` in `site-policy.ts` | Runtime cache + `getRuntimeEffectiveValue()`       |
| Cron shell exports only                              | Cron Python entry reads `settings` module at start |

Do not migrate `DATABASE_URL` through registry writes; read-only display only.

---

## 8. Related docs

- [Admin settings console architecture](../admin-ingestion-settings-console.md)
- [Environment variables reference](../../operations/environment-variables.md)
- [28 - Async ingestion queue](28-async-ingestion-queue.md)
- [31 - Recent events auto-ingest](31-recent-events-auto-ingest.md)
