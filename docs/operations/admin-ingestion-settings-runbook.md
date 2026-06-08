---
created: 2026-06-08
owner: Platform / Operations
lastModified: 2026-06-08
description:
  Operations runbook for the admin ingestion settings console and runtime
  configuration overrides.
purpose:
  Enable/disable features, tune ingestion, troubleshoot config drift, and handle
  restart-required settings safely.
relatedDocs:
  - docs/user-guides/admin-ingestion-settings.md
  - docs/architecture/admin-ingestion-settings-console.md
  - docs/architecture/liverc-ingestion/33-ingestion-settings-registry-and-runtime-config.md
  - docs/operations/environment-variables.md
  - docs/operations/liverc-operations-guide.md
  - docs/operations/recent-events-auto-ingest-runbook.md
---

# Admin Ingestion Settings — operations runbook

**Status:** Implemented  
**Admin URL:** `http://localhost:3001/admin/ingestion/settings`  
**Prerequisite:** Admin account (`isAdmin = true`)

Writable saves require `ADMIN_INGESTION_SETTINGS_WRITABLE=true` on `mre-app`
(default `true` in dev Compose; set `false` for read-only rollout).

---

## 1. Quick reference

| Task                          | Where                                                               |
| ----------------------------- | ------------------------------------------------------------------- |
| View all ingestion settings   | Admin → Ingestion → **Settings**                                    |
| Disable all LiveRC scraping   | Settings → Scraping → **MRE_SCRAPE_ENABLED** off                    |
| Enable nightly auto-ingest    | Settings → Recent events → **Auto-ingest enabled** on               |
| Tune queue concurrency        | Settings → Queue → **Max concurrent jobs**                          |
| Tune crawl delay / host rules | Settings → Site policy → **site_policy_overrides** JSON             |
| Tune pipeline / HTTP client   | Settings → Code constants section                                   |
| Change database URL           | **Not in UI** — edit `.env.docker`, restart containers              |
| Audit who changed a setting   | Admin → **Audit Logs** → filter `ingestion.settings.update`         |
| Force cache reload            | Save in UI (auto) or `POST /api/v1/admin/ingestion/settings/reload` |

---

## 2. Settings source precedence

Effective value resolution (both `mre-app` and `mre-liverc-ingestion-service`):

1. **Database override** (set via admin UI) — wins
2. **Environment variable** (Docker Compose / `.env.docker`)
3. **Registry default** (code)

If behaviour does not match the UI:

```bash
docker exec mre-liverc-ingestion-service python -c "
from ingestion.common.settings import list_all
for s in list_all(): print(s.key, s.effective_value, s.source)
"
```

Site policy effective config = base `policies/site_policy/policy.json` merged
with `site_policy_overrides` from DB (or default `{}`).

---

## 3. Common operations

### 3.1 Disable LiveRC scraping (emergency)

**UI:**

1. Open `/admin/ingestion/settings`
2. Section **Scraping and safety**
3. Turn off **MRE_SCRAPE_ENABLED**
4. Confirm dialog
5. Save

**Effect:** Immediate for runtime layer. Cron wrappers, CLI, admin ingestion
triggers, and user downloads fail fast with scrape-disabled message.

**Env fallback (if UI unavailable or read-only mode):**

```bash
# In .env.docker
MRE_SCRAPE_ENABLED=false

docker compose restart liverc-ingestion-service app
```

**Re-enable:** Reverse the step; verify in Settings that source shows `database`
or `environment` as expected.

### 3.2 Enable recent events auto-ingest

1. Ensure **MRE_SCRAPE_ENABLED** is on
2. Settings → **Recent events auto-ingest**
3. Enable **MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED**
4. Review defaults: 7 days, `followed` tracks, max 50 ingests, min age 12h
5. Save

Cron runs at **02:00 UTC** (`ingestion/crontab`). See
[recent-events-auto-ingest-runbook.md](recent-events-auto-ingest-runbook.md).

**Manual dry run:**

```bash
docker exec mre-liverc-ingestion-service \
  python -m ingestion.cli ingest liverc refresh-recent-events --dry-run
```

### 3.3 Tune ingestion queue

| Setting                           | When to change                                                       |
| --------------------------------- | -------------------------------------------------------------------- |
| `INGESTION_QUEUE_MAX_CONCURRENT`  | Increase for faster parallel ingests; decrease if LiveRC rate limits |
| `INGESTION_QUEUE_JOB_TTL_SECONDS` | Increase if admins poll old job IDs for debugging                    |

**Note:** `INGESTION_USE_QUEUE=false` requires container **restart** and forces
multi-worker mode; do not change in UI without maintenance window.

### 3.4 Adjust track sync parallelism

Increase `TRACK_SYNC_METADATA_CONCURRENCY` cautiously (default 6). Watch LiveRC
429 responses in ingestion logs.

### 3.5 Site policy overrides

1. Settings → **Site policy** → edit **site_policy_overrides** JSON
2. Partial host overrides merge by `pattern` (other hosts unchanged)
3. Save (triggers cache reload + `SitePolicy.reset_shared()` in Python)

**Verify crawl delay:**

```bash
docker exec mre-liverc-ingestion-service python -c "
from ingestion.common.site_policy import SitePolicy
SitePolicy.reset_shared()
p = SitePolicy.shared()
print(p._match_rule('live.liverc.com').crawl_delay)
"
```

### 3.6 Telemetry worker settings

| Apply mode                                      | Action after Save                         |
| ----------------------------------------------- | ----------------------------------------- |
| **Runtime** (e.g. poll interval)                | May apply on next poll; restart if unsure |
| **Restart** (paths, ClickHouse host, worker ID) | `docker compose restart telemetry-worker` |

The admin UI shows a restart reminder in the **Telemetry worker** section.

### 3.7 Pipeline / HTTP tuning (code constants)

Runtime keys in the **Code constants** section map to `pipeline.py` and
`httpx_client.py`. New ingestion jobs pick up values at pipeline init; in-flight
jobs keep prior limits until completion.

---

## 4. Restart-required settings

These appear **read-only** in the admin UI (apply mode: restart). To change:

1. Edit `.env.docker` (or Compose `environment:` block)
2. Restart affected service:

```bash
docker compose restart liverc-ingestion-service
# If app-scoped env changed:
docker compose restart app
# Telemetry worker:
docker compose restart telemetry-worker
```

| Setting                                                    | Service                           |
| ---------------------------------------------------------- | --------------------------------- |
| `UVICORN_WORKERS`, `UVICORN_RELOAD`, `INGESTION_USE_QUEUE` | `liverc-ingestion-service`        |
| `DATABASE_URL`, `DB_POOL_SIZE`                             | `liverc-ingestion-service`, `app` |
| `TELEMETRY_UPLOAD_ROOT`, ClickHouse vars                   | `telemetry-worker`                |

---

## 5. Troubleshooting

### 5.1 UI shows Ready but cron behaves differently

**Cause:** Cron env file (`.env.cron`) stale vs DB overrides.

**Fix:** Cron Python entry reads `settings` module at start (DB-aware). If drift
persists, restart the ingestion container so cron entrypoint regenerates
`.env.cron` from current Compose env.

### 5.2 Setting saved but ingestion unchanged

1. Check apply mode in UI (restart vs runtime)
2. Save again (PATCH auto-reloads) or call
   `POST /api/v1/admin/ingestion/settings/reload`
3. Verify audit log entry exists
4. For site policy: confirm `SitePolicy.reset_shared()` ran (reload endpoint)

### 5.3 Admin GET settings returns 502

1. Verify ingestion container healthy:
   `docker exec mre-liverc-ingestion-service curl -sf http://localhost:8000/health`
2. Verify `INGESTION_SERVICE_URL` from app container
3. Verify `INGESTION_ADMIN_TOKEN` matches on both services

### 5.4 Scrape enabled in UI but Next.js admin sync fails

**Cause:** `MRE_SCRAPE_ENABLED` scope is `both`; app container cache may be
stale.

**Fix:** Save triggers Next.js runtime cache refresh. Confirm effective value in
UI shows `database` or `environment` on both services.

### 5.5 Config drift after manual DB edit

Avoid raw SQL on `ingestion_settings`. Prefer admin UI. To reset one key:

```sql
DELETE FROM ingestion_settings WHERE key = 'MRE_RECENT_EVENTS_DAYS';
```

Then reload caches via Save on any setting or the reload endpoint.

### 5.6 Read-only mode / Save disabled

**Cause:** `ADMIN_INGESTION_SETTINGS_WRITABLE=false`.

**Fix:** Set `true` in Compose for staging/production after acceptance testing;
recreate `mre-app` container.

---

## 6. Security operations

| Action                         | Procedure                                             |
| ------------------------------ | ----------------------------------------------------- |
| Rotate `INGESTION_ADMIN_TOKEN` | Update `.env.docker` on app + ingestion; restart both |
| Review config changes          | Audit Logs → `ingestion.settings.update`              |
| Restrict admin access          | Admin → Users → revoke `isAdmin`                      |

Never commit tokens or `DATABASE_URL` to git.

---

## 7. Monitoring

Watch:

- Audit log volume for settings changes
- Ingestion metrics when queue concurrency or race fetch concurrency changed
- Cron log: `/var/log/recent-events-auto-ingest.log` inside ingestion container
- Scrape kill switch: sudden drop in LiveRC HTTP metrics
- Site policy: crawl-delay changes reflected in throttle logs

---

## 8. Rollback

### 8.1 Single setting

1. Admin UI → **Reset to default**, or
2. Delete DB row:

```sql
DELETE FROM ingestion_settings WHERE key = 'MRE_RECENT_EVENTS_DAYS';
```

Effective value reverts to environment/default.

### 8.2 Full override reset

```sql
TRUNCATE ingestion_settings;
```

Call reload endpoint or restart ingestion service to clear caches.

---

## 9. Related runbooks

- [LiveRC Operations Guide](liverc-operations-guide.md)
- [Recent Events Auto-Ingest Runbook](recent-events-auto-ingest-runbook.md)
- [Ingestion lock recovery](ingestion-lock-recovery-runbook.md)
- [Docker User Guide](docker-user-guide.md)
