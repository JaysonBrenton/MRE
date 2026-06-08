---
created: 2026-06-08
creator: Documentation
lastModified: 2026-06-08
description: Admin guide for the ingestion settings console
purpose:
  Step-by-step instructions for administrators configuring LiveRC ingestion from
  the MRE admin area.
relatedDocs:
  - docs/operations/admin-ingestion-settings-runbook.md
  - docs/architecture/admin-ingestion-settings-console.md
  - docs/user-stories/admin.md
  - docs/user-guides/navigation.md
---

# Admin guide: Ingestion settings

**Audience:** MRE administrators  
**Route:** [http://localhost:3001/admin/ingestion/settings](http://localhost:3001/admin/ingestion/settings)  
**Status:**
Implemented

---

## Overview

The **Ingestion settings** console lets you view and change how MRE pulls data
from LiveRC: scraping safety, background job limits, nightly auto-ingest,
practice day discovery, and more.

This is separate from **Ingestion controls** (`/admin/ingestion`), which
**trigger** one-off jobs (track sync, event download). Settings define how those
jobs and cron tasks behave.

---

## Access

1. Sign in with an **admin** account
2. Open **MRE Admin** (you are redirected to `/admin` after login if admin)
3. Go to **Ingestion** → **Settings** in the admin navigation

Non-admins cannot access `/admin/*` routes.

---

## Understanding the settings table

Each setting shows:

| Column / badge          | Meaning                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| **Effective value**     | What the system uses right now                                           |
| **Source: Database**    | You changed it in this console (saved override)                          |
| **Source: Environment** | Value comes from Docker / `.env.docker`                                  |
| **Source: Default**     | Built-in default; no override                                            |
| **Runtime**             | Saves apply immediately (no container restart)                           |
| **Restart required**    | View only in UI; change via Docker env + restart (see runbook)           |
| **Read-only**           | Informational only (infra secrets, build args); env still shown when set |

---

## Settings sections

### Scraping and safety

- **LiveRC scraping enabled (`MRE_SCRAPE_ENABLED`)** — Master off switch. When
  off, no LiveRC HTTP requests run (cron, downloads, admin sync). Use during
  LiveRC outages or maintenance. Requires confirmation to disable.

### Async ingestion queue

- **Use ingestion queue** — How downloads run in the background (usually leave
  on). Changing requires a service restart (read-only in UI).
- **Max concurrent jobs** — How many event imports run at once (default 2).
- **Job retention (seconds)** — How long completed job status stays available
  for polling.

### Track sync

- **Metadata concurrency** — Parallelism when refreshing the track catalogue.
- **Report retention (days)** — How long track sync reports are kept on disk.

### Recent events auto-ingest

Automated nightly full import for recent events on followed tracks. See
[Recent events auto-ingest runbook](../operations/recent-events-auto-ingest-runbook.md).

| Setting               | Typical value                      |
| --------------------- | ---------------------------------- |
| Auto-ingest enabled   | Off until you intentionally enable |
| Window (days)         | 7                                  |
| Track scope           | `followed`                         |
| Max ingests per run   | 50                                 |
| Min event age (hours) | 12                                 |

### Practice days

Timeouts and cache for practice day discovery. Adjust only if you see timeouts
in logs.

### Telemetry worker

Settings for the separate telemetry processing container. The console shows a
note: after changing **restart-mode** telemetry keys, restart
`mre-telemetry-worker`:

```bash
docker compose restart telemetry-worker
```

Runtime keys (for example poll interval) may take effect on the next worker
cycle; restart if behaviour does not change.

### Site policy

Edit **Site policy overrides** (`site_policy_overrides`) as JSON merged onto the
base file (`policies/site_policy/policy.json`). Host rules match by `pattern`;
you can override a single field (for example `crawlDelaySeconds`) without
repeating the full host block.

Example partial override:

```json
{
  "hosts": [
    {
      "pattern": "live.liverc.com",
      "crawlDelaySeconds": 0.5
    }
  ]
}
```

Save applies after cache reload (automatic on Save).

### Pipeline tuning (code constants)

These runtime keys tune ingestion pipeline and HTTP client behaviour without a
deploy:

- **Race fetch concurrency (initial)** — starting parallelism for race page
  fetches
- **Inactivity / max duration timeouts** — stall and wall-clock caps per ingest
- **HTTPX timeouts and max retries** — LiveRC HTTP client limits

Adaptive concurrency still adjusts within 4–16 based on observed latency.

### Infrastructure

Read-only view of connection strings (masked), ports, and worker counts. Change
via Docker configuration, not this UI.

---

## Saving changes

1. Edit fields marked **Runtime** (including JSON site policy overrides)
2. Click **Save changes**
3. Confirm if prompted (e.g. disabling scraping)
4. Check for success message

When `ADMIN_INGESTION_SETTINGS_WRITABLE=false`, the page is read-only (no Save
bar).

Changes are recorded in **Audit logs** (`ingestion.settings.update`).

---

## Common tasks

### Turn off all LiveRC scraping temporarily

Settings → Scraping → disable **LiveRC scraping enabled** → confirm → Save.

### Enable nightly auto-import for followed tracks

Settings → Recent events → enable **Auto-ingest** → review caps → Save. Ensure
scraping is enabled.

### Revert a setting to default

Use **Reset to default** on any field with a database override (source badge
shows **Database**).

---

## Troubleshooting

| Problem                  | What to do                                               |
| ------------------------ | -------------------------------------------------------- |
| Save button disabled     | No runtime fields changed, or you lack admin role        |
| Setting does not stick   | Check if apply mode is Restart; use runbook              |
| Track sync still blocked | App and ingestion both need scrape flag; check audit log |
| Page empty / error       | Admin → Health → verify ingestion service is up          |

Full ops procedures:
[admin-ingestion-settings-runbook.md](../operations/admin-ingestion-settings-runbook.md)

---

## Related admin pages

| Page                                 | Purpose                            |
| ------------------------------------ | ---------------------------------- |
| [/admin/ingestion](/admin/ingestion) | Trigger track sync or event ingest |
| [/admin/audit](/admin/audit)         | Who changed settings               |
| [/admin/health](/admin/health)       | Service health                     |
| [/admin/logs](/admin/logs)           | Application logs                   |

---

## See also

- [Admin user stories: Ingestion settings](../user-stories/admin.md#ingestion-settings-console)
- [Environment variables reference](../operations/environment-variables.md)
