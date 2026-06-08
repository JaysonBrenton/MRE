---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2026-05-31
description:
  Complete reference for all environment variables used in MRE application
purpose:
  Provides comprehensive documentation of all environment variables, including
  required vs optional, default values, validation rules, and
  environment-specific configurations. Essential for deployment, environment
  setup, and troubleshooting.
relatedFiles:
  - docker-compose.yml (Docker environment configuration)
  - README.md (basic setup instructions)
  - .env.docker (environment file template, if exists)
  - src/lib/prisma.ts (database connection)
  - src/lib/auth.ts (NextAuth configuration)
  - src/lib/ingestion-client.ts (ingestion service URL)
---

# Environment Variables Reference

**Last Updated:** 2026-05-31 (Synced with `docker-compose.yml`: added telemetry
worker, ClickHouse, app feature-flag, and Uvicorn variables; confirmed
recent-events auto-ingest variables are live)  
**Environment File:** `.env.docker` (for Docker Compose)

This document provides a complete reference for all environment variables used
in the MRE application. All variables are configured via Docker Compose
environment files or can be set directly in the environment.

---

## Table of Contents

1. [Variable Groups](#variable-groups)
2. [Next.js Application Variables](#nextjs-application-variables)
3. [Database Variables](#database-variables)
4. [Authentication Variables](#authentication-variables)
5. [Ingestion Service Variables](#ingestion-service-variables)
6. [Environment-Specific Values](#environment-specific-values)
7. [Security Considerations](#security-considerations)
8. [Example Configuration Files](#example-configuration-files)

---

## Variable Groups

Environment variables are organized into the following groups:

- **Database** - PostgreSQL connection and configuration
- **Application** - Next.js application configuration
- **Authentication** - NextAuth session and security
- **Ingestion Service** - Python ingestion service configuration
- **Telemetry Worker & ClickHouse** - `telemetry-worker` and `clickhouse`
  service configuration
- **System** - Timezone and system-level settings

---

## Next.js Application Variables

### NODE_ENV

**Type:** String  
**Required:** Yes  
**Default:** `development`  
**Values:** `development` | `production` | `test`

Controls the Node.js environment mode. Affects:

- Logging levels
- Error handling
- Prisma query logging
- Development vs production optimizations

**Example:**

```bash
NODE_ENV=development
```

---

### PORT

**Type:** Number  
**Required:** No  
**Default:** `3001`  
**Environment:** Docker Compose

Port on which the Next.js application listens. Configured via Docker Compose
port mapping.

**Example:**

```bash
PORT=3001
```

**Note:** In Docker Compose, this is mapped to `APP_PORT` environment variable
for host port configuration.

---

### APP_PORT

**Type:** Number  
**Required:** No  
**Default:** `3001`  
**Environment:** Docker Compose (host)

Host port mapping for Docker Compose. Maps to container port 3001.

**Example:**

```bash
APP_PORT=3001
```

---

### APP_URL

**Type:** URL String  
**Required:** No  
**Default:** `http://localhost:3001`  
**Environment:** Docker Compose

Base URL of the application. Used for:

- Generating absolute URLs
- CORS configuration (if needed)
- OAuth redirects (if implemented)

**Example:**

```bash
APP_URL=http://localhost:3001
```

---

### HOST

**Type:** String  
**Required:** No  
**Default:** `0.0.0.0`  
**Environment:** Docker Compose

Host address to bind the Next.js server. Set to `0.0.0.0` to accept connections
from any interface (required for Docker).

**Example:**

```bash
HOST=0.0.0.0
```

---

### NODE_OPTIONS

**Type:** String  
**Required:** No  
**Default:** `--dns-result-order=ipv4first`  
**Environment:** Docker Compose (`app`)

Node.js runtime options. The compose default forces IPv4-first DNS resolution to
avoid Alpine Linux IPv6 timeout issues.

**Example:**

```bash
NODE_OPTIONS=--dns-result-order=ipv4first
```

---

### NEXT_PUBLIC_ENABLE_PRACTICE_DAYS

**Type:** Boolean (string)  
**Required:** No  
**Default:** `true`  
**Environment:** Docker Compose (`app`)

Client-visible feature flag (read in `src/lib/feature-flags.ts`) that toggles
the Practice Days UI. The `NEXT_PUBLIC_` prefix is required so the value is
available in the browser bundle.

**Example:**

```bash
NEXT_PUBLIC_ENABLE_PRACTICE_DAYS=true
```

---

### CLICKHOUSE_URL

**Type:** URL String  
**Required:** No  
**Default:** `http://mre-clickhouse:8123`  
**Environment:** Docker Compose (`app`)

Optional ClickHouse HTTP URL used by the Next.js app
(`src/core/telemetry/telemetry-clickhouse.ts`) to read materialised GNSS samples
and to clean up the telemetry query cache on session delete. When unset, the app
falls back to Parquet-backed telemetry only.

**Example:**

```bash
CLICKHOUSE_URL=http://mre-clickhouse:8123
```

---

### TELEMETRY_UPLOAD_ROOT

**Type:** Path String  
**Required:** No  
**Default:** `/data/telemetry`  
**Environment:** Docker Compose (`app`, `liverc-ingestion-service`,
`telemetry-worker`)

Shared filesystem root for raw telemetry uploads. Backed by the
`mre-telemetry-uploads` named volume mounted into all three services so the app
can stage uploads and the worker can process them.

**Example:**

```bash
TELEMETRY_UPLOAD_ROOT=/data/telemetry
```

---

## Database Variables

### DATABASE_URL

**Type:** PostgreSQL Connection String  
**Required:** Yes  
**Default:** None  
**Format:** `postgresql://[user]:[password]@[host]:[port]/[database]?schema=public`

PostgreSQL database connection string used by Prisma. Contains:

- Database user
- Password
- Host (container name: `mre-postgres`)
- Port (5432)
- Database name
- Schema (public)

**Example:**

```bash
DATABASE_URL=postgresql://pacetracer:change-me@mre-postgres:5432/pacetracer?schema=public
```

**Security:** Contains sensitive credentials. Never commit to version control.

**Components:**

- User: `pacetracer` (default)
- Password: `change-me` (default, MUST be changed in production)
- Host: `mre-postgres` (Docker container name)
- Port: `5432`
- Database: `pacetracer` (default)

**Note:** This variable is used by both the Next.js application and the Python
ingestion service.

---

### POSTGRES_USER

**Type:** String  
**Required:** No  
**Default:** `pacetracer`  
**Environment:** Docker Compose (used to construct DATABASE_URL)

PostgreSQL database user name. Used in DATABASE_URL construction.

**Example:**

```bash
POSTGRES_USER=pacetracer
```

---

### POSTGRES_PASSWORD

**Type:** String  
**Required:** No  
**Default:** `change-me`  
**Environment:** Docker Compose (used to construct DATABASE_URL)

PostgreSQL database password. Used in DATABASE_URL construction.

**Example:**

```bash
POSTGRES_PASSWORD=change-me
```

**Security:** MUST be changed in production. Use a strong, randomly generated
password.

---

### POSTGRES_DB

**Type:** String  
**Required:** No  
**Default:** `pacetracer`  
**Environment:** Docker Compose (used to construct DATABASE_URL)

PostgreSQL database name. Used in DATABASE_URL construction.

**Example:**

```bash
POSTGRES_DB=pacetracer
```

---

### POSTGRES_PORT

**Type:** Number  
**Required:** No  
**Default:** `5432`  
**Environment:** Docker Compose (host port mapping for `postgres`)

Host port published for the `mre-postgres` container (maps to container port
5432).

**Example:**

```bash
POSTGRES_PORT=5432
```

---

## Authentication Variables

### AUTH_SECRET

**Type:** String  
**Required:** Yes  
**Default:** None (must be explicitly set)  
**Minimum Length:** 32 characters  
**Environment:** Docker Compose (via .env.docker)

Secret key used by NextAuth for:

- JWT token signing
- Session encryption
- CSRF protection

**Build-Time Validation:**  
The application validates AUTH_SECRET at build time via `src/lib/env.ts`. The
build will fail with a clear error message if:

- AUTH_SECRET is not set
- AUTH_SECRET is less than 32 characters
- AUTH_SECRET uses the default development value in production
  (`NODE_ENV=production`)

**Example:**

```bash
# Generate a secure secret
openssl rand -base64 32

# Set in .env.docker
AUTH_SECRET=your-generated-secret-here-at-least-32-chars
```

**Security:**

- MUST be at least 32 characters
- MUST be randomly generated
- MUST be unique per environment
- MUST NOT be committed to version control

**Generation:**

```bash
openssl rand -base64 32
```

**Note:** NextAuth also checks `NEXTAUTH_SECRET` as a fallback (for
compatibility).

---

### NEXTAUTH_SECRET

**Type:** String  
**Required:** No  
**Default:** Falls back to `AUTH_SECRET`  
**Environment:** Optional (NextAuth compatibility)

Alternative name for `AUTH_SECRET` for NextAuth compatibility. If not set,
`AUTH_SECRET` is used.

**Example:**

```bash
NEXTAUTH_SECRET=your-secret-here
```

---

## Ingestion Service Variables

### INGESTION_SERVICE_URL

**Type:** URL String  
**Required:** Yes (Production), No (Development)  
**Default:** `http://liverc-ingestion-service:8000` (Development only)  
**Environment:** Next.js application (used by ingestion client)

Base URL of the Python ingestion service. Used by the Next.js application to
communicate with the ingestion service.

**Environment-Specific Requirements:**

- **Development:** Optional (defaults to `http://liverc-ingestion-service:8000`
  if not set)
- **Production:** Required (application will fail to start if not set)

**Example:**

```bash
INGESTION_SERVICE_URL=http://liverc-ingestion-service:8000
```

**Note:**

- In Docker Compose, this uses the service name `liverc-ingestion-service` and
  default port `8000`
- The application validates this variable at startup: required in production,
  optional in development

---

### INGESTION_PORT

**Type:** Number  
**Required:** No  
**Default:** `8000`  
**Environment:** Docker Compose (host)

Host port mapping for the Python ingestion service. Maps to container port 8000.

**Example:**

```bash
INGESTION_PORT=8000
```

---

### LOG_LEVEL

**Type:** String  
**Required:** No  
**Default:** `INFO`  
**Environment:** Python ingestion service

Logging level for the Python ingestion service.

**Values:** `DEBUG` | `INFO` | `WARNING` | `ERROR` | `CRITICAL`

**Example:**

```bash
LOG_LEVEL=INFO
```

---

### PYTHONUNBUFFERED

**Type:** String  
**Required:** No  
**Default:** `1`  
**Environment:** Python ingestion service

Disables Python output buffering for real-time log output in Docker.

**Example:**

```bash
PYTHONUNBUFFERED=1
```

---

### Admin UI overrides (planned)

After the **Admin Ingestion Settings Console** ships (see
[admin-ingestion-settings-console.md](../architecture/admin-ingestion-settings-console.md)),
many ingestion variables below may also be set from `/admin/ingestion/settings`.
Effective value precedence:

1. Database override (`ingestion_settings` table)
2. Environment variable (this document)
3. Registry default
   ([doc 33](../architecture/liverc-ingestion/33-ingestion-settings-registry-and-runtime-config.md))

Settings with **apply mode: restart** remain env-only in Docker; the admin UI
displays them read-only. Ops runbook:
[admin-ingestion-settings-runbook.md](admin-ingestion-settings-runbook.md).

**Status:** Planned — env vars remain authoritative until Phase 2 implementation
merges.

---

### UVICORN_RELOAD

**Type:** Boolean (string)  
**Required:** No  
**Default:** `false`  
**Environment:** Python ingestion service (`liverc-ingestion-service`)

Enables Uvicorn hot reload (single worker). When `true`, the entrypoint starts
`uvicorn ... --reload`. Leave `false` for production-like behaviour with
workers.

**Example:**

```bash
UVICORN_RELOAD=false
```

---

### INGESTION_USE_QUEUE

**Type:** Boolean (string)  
**Required:** No  
**Default:** `true`  
**Environment:** Python ingestion service

Queue mode for ingestion. When enabled (`true`/`1`/`yes`), ingest requests
return `202` and process in the background. Because the job store is in-process,
the entrypoint forces a single Uvicorn worker so status polling hits the same
process.

**Example:**

```bash
INGESTION_USE_QUEUE=true
```

---

### UVICORN_WORKERS

**Type:** Number  
**Required:** No  
**Default:** `1`  
**Environment:** Python ingestion service

Number of Uvicorn workers when `UVICORN_RELOAD=false`. Only honoured when
`INGESTION_USE_QUEUE=false`; with the queue enabled the entrypoint forces `1`
worker. Set `INGESTION_USE_QUEUE=false` and `UVICORN_WORKERS=4` for synchronous
ingest with multiple workers.

**Example:**

```bash
UVICORN_WORKERS=1
```

---

### SITE_POLICY_PATH

**Type:** Path String  
**Required:** No  
**Default:** `/app/policies/site_policy/policy.json`  
**Environment:** Python ingestion service

Path to the shared site-policy configuration (throttling, robots, scrape kill
switch). Mounted read-only from `./policies` so Python and TypeScript honour the
same rules.

**Example:**

```bash
SITE_POLICY_PATH=/app/policies/site_policy/policy.json
```

---

### TRACK_SYNC_METADATA_CONCURRENCY

**Type:** Number  
**Required:** No  
**Default:** `6` (in code)  
**Environment:** Python ingestion service (`refresh-tracks`)

Maximum concurrent track dashboard-metadata fetches during `refresh-tracks`.
Read directly from the environment in `ingestion/cli/commands.py`.

**Example:**

```bash
TRACK_SYNC_METADATA_CONCURRENCY=6
```

---

### TRACK_SYNC_REPORT_RETENTION_DAYS

**Type:** Number  
**Required:** No  
**Default:** `30`  
**Environment:** Python ingestion service

Number of days to retain track sync reports before automatic cleanup. Reports
older than this value are automatically deleted.

**Example:**

```bash
TRACK_SYNC_REPORT_RETENTION_DAYS=30
```

---

### MRE_SCRAPE_ENABLED

**Type:** Boolean (string)  
**Required:** No  
**Default:** `true`  
**Environment:** Python ingestion service (cron + CLI)

Global kill switch for all LiveRC HTTP scraping. When `false`:

- Cron wrappers (`run-track-sync.sh`, `run-followed-event-sync.sh`,
  `run-recent-events-auto-ingest.sh`) exit before HTTP calls.
- CLI commands fail fast via `_ensure_scraping_enabled`.

Documented in
[27-web-scraping-best-practices.md](../architecture/liverc-ingestion/27-web-scraping-best-practices.md)
and [liverc-operations-guide.md](./liverc-operations-guide.md).

**Example:**

```bash
MRE_SCRAPE_ENABLED=true
```

---

### MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED

**Type:** Boolean (string)  
**Required:** No  
**Default:** `false`  
**Environment:** Python ingestion service (cron wrapper)

Feature gate for the **Recent Events Auto-Ingest** nightly job. When `false`,
`run-recent-events-auto-ingest.sh` logs a skip message and exits 0. Requires
`MRE_SCRAPE_ENABLED=true` for any scraping to occur.

**Status:** Implemented but **disabled by default** (`false`). The CLI command
`ingest liverc refresh-recent-events`, the module
`ingestion/ingestion/recent_events.py`, and the cron wrapper
`run-recent-events-auto-ingest.sh` (02:00 UTC) all exist; set this to `true` to
activate the nightly job.

**Example:**

```bash
MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED=false
```

**Related:**
[recent-events-auto-ingest-runbook.md](./recent-events-auto-ingest-runbook.md)

---

### MRE_RECENT_EVENTS_DAYS

**Type:** Number  
**Required:** No  
**Default:** `7`  
**Environment:** Python ingestion service (cron wrapper → CLI `--days`)

Recency window length in calendar days for `refresh-recent-events`.

**Example:**

```bash
MRE_RECENT_EVENTS_DAYS=7
```

---

### MRE_RECENT_EVENTS_TRACKS

**Type:** String (enum)  
**Required:** No  
**Default:** `followed`  
**Environment:** Python ingestion service (cron wrapper → CLI `--tracks`)

Track scope for recent-events auto-ingest: `followed` | `active` | `all`.
Production should use `followed` unless explicitly approved.

**Example:**

```bash
MRE_RECENT_EVENTS_TRACKS=followed
```

---

### MRE_RECENT_EVENTS_MAX_INGESTS

**Type:** Number  
**Required:** No  
**Default:** `50`  
**Environment:** Python ingestion service (cron wrapper → CLI `--max-ingests`)

Maximum full (`laps_full`) ingests per nightly run. Use `0` only in development
(unlimited).

**Example:**

```bash
MRE_RECENT_EVENTS_MAX_INGESTS=50
```

---

### MRE_RECENT_EVENTS_MIN_AGE_HOURS

**Type:** Number  
**Required:** No  
**Default:** `12`  
**Environment:** Python ingestion service (cron wrapper → CLI
`--min-event-age-hours`)

Skip auto-ingest for events newer than this many hours (avoids in-progress
meetings).

**Example:**

```bash
MRE_RECENT_EVENTS_MIN_AGE_HOURS=12
```

---

### INGESTION_BUILD_TARGET

**Type:** String  
**Required:** No  
**Default:** `development`  
**Environment:** Docker Compose

Docker build target for the ingestion service. Controls which stage of the
multi-stage Dockerfile is used.

**Values:** `development` | `production`

**Example:**

```bash
INGESTION_BUILD_TARGET=development
```

### PRACTICE_DAY_DETAIL_CONCURRENCY

**Type:** Number  
**Required:** No  
**Default:** 5 (in code)

Maximum concurrent session-detail fetches during practice day full ingestion.
Used to avoid hammering LiveRC when importing a day with many sessions.

**Example:**

```bash
PRACTICE_DAY_DETAIL_CONCURRENCY=3
```

---

### PRACTICE_DISCOVER_CACHE_TTL_SECONDS

**Type:** Number (seconds)  
**Required:** No  
**Default:** `600` (10 minutes)  
**Environment:** Python ingestion service

TTL for the in-memory cache of discovered practice days per (track_slug, year,
month). Repeat requests for the same track and month within the TTL are served
from cache without re-scraping LiveRC, improving performance for repeat
searches.

**Example:**

```bash
PRACTICE_DISCOVER_CACHE_TTL_SECONDS=600
```

---

### PRACTICE_DISCOVER_MONTH_VIEW_TIMEOUT_SECONDS

**Type:** Number (seconds)  
**Required:** No  
**Default:** `15`  
**Environment:** Python ingestion service

Timeout for fetching the practice month view from LiveRC. Prevents one slow
month from blocking the whole discover.

**Example:**

```bash
PRACTICE_DISCOVER_MONTH_VIEW_TIMEOUT_SECONDS=15
```

---

### PRACTICE_DISCOVER_DAY_OVERVIEW_TIMEOUT_SECONDS

**Type:** Number (seconds)  
**Required:** No  
**Default:** `25`  
**Environment:** Python ingestion service

Timeout for each practice day overview fetch within a month. Prevents one slow
day from dominating latency.

**Example:**

```bash
PRACTICE_DISCOVER_DAY_OVERVIEW_TIMEOUT_SECONDS=25
```

---

### INGESTION_QUEUE_MAX_CONCURRENT

**Type:** Number  
**Required:** No  
**Default:** `2`  
**Environment:** Python ingestion service

Maximum concurrent background ingestion jobs when queue mode is enabled. Also
controls worker task count. Tunable from admin settings console when implemented
(apply mode: runtime).

**Example:**

```bash
INGESTION_QUEUE_MAX_CONCURRENT=2
```

---

### INGESTION_QUEUE_JOB_TTL_SECONDS

**Type:** Number (seconds)  
**Required:** No  
**Default:** `3600`  
**Environment:** Python ingestion service

Retention window for completed/failed in-memory job metadata before eviction.

**Example:**

```bash
INGESTION_QUEUE_JOB_TTL_SECONDS=3600
```

---

### INGESTION_ADMIN_TOKEN

**Type:** String (secret)  
**Required:** Yes in production (when admin settings API is implemented)  
**Environment:** `mre-app` and `mre-liverc-ingestion-service`

Shared secret for service-to-service calls to Python
`GET/PATCH /api/v1/admin/settings`. Must never be sent to the browser. Rotate
via `.env.docker` and restart both services.

**Example:**

```bash
INGESTION_ADMIN_TOKEN=generate-a-long-random-string
```

---

### INGESTION_SETTINGS_CACHE_TTL_SECONDS

**Type:** Number (seconds)  
**Required:** No  
**Default:** `30`  
**Environment:** Python ingestion service and Next.js (when resolver
implemented)

TTL for in-process cache of effective settings values after DB/env resolution.

**Example:**

```bash
INGESTION_SETTINGS_CACHE_TTL_SECONDS=30
```

---

### ADMIN_INGESTION_SETTINGS_WRITABLE

**Type:** Boolean (`true` / `false`)  
**Required:** No  
**Default:** `true` in Docker Compose (development); set `false` in production
until validated  
**Environment:** `mre-app` only

When `false`, the admin settings UI is read-only and
`PATCH /api/v1/admin/ingestion/settings` returns 403.

**Example:**

```bash
ADMIN_INGESTION_SETTINGS_WRITABLE=true
```

---

## Telemetry Worker & ClickHouse Variables

These variables configure the `telemetry-worker` service (same image as the
ingestion service, started with entrypoint
`python -m ingestion.telemetry.worker`) and the optional `clickhouse` service.

### CLICKHOUSE_PORT

**Type:** Number  
**Required:** No  
**Default:** `8123`  
**Environment:** Docker Compose (host port mapping for `clickhouse`)

Host port published for the `mre-clickhouse` container HTTP interface (maps to
container port 8123).

**Example:**

```bash
CLICKHOUSE_PORT=8123
```

---

### TELEMETRY_WORKER_ID

**Type:** String  
**Required:** No  
**Default:** `telemetry-worker-1`  
**Environment:** Docker Compose (`telemetry-worker`)

Identifier for the telemetry worker instance (used in logs / job ownership).

**Example:**

```bash
TELEMETRY_WORKER_ID=telemetry-worker-1
```

---

### TELEMETRY_WORKER_POLL_INTERVAL_SEC

**Type:** Number (seconds)  
**Required:** No  
**Default:** `2`  
**Environment:** Docker Compose (`telemetry-worker`)

How often the worker polls for staged telemetry uploads to process.

**Example:**

```bash
TELEMETRY_WORKER_POLL_INTERVAL_SEC=2
```

---

### TELEMETRY_WORKER_CLICKHOUSE_HOST

**Type:** String (hostname)  
**Required:** No  
**Default:** _empty_ (GNSS materialisation skipped)  
**Environment:** Docker Compose (`telemetry-worker`; mapped to `CLICKHOUSE_HOST`
inside the container)

Optional ClickHouse host for GNSS materialisation. Leave empty to skip
ClickHouse writes (Parquet + API still work). Set to `mre-clickhouse` when
credentials match your ClickHouse server.

**Example:**

```bash
TELEMETRY_WORKER_CLICKHOUSE_HOST=mre-clickhouse
```

---

### CLICKHOUSE_HTTP_PORT

**Type:** Number  
**Required:** No  
**Default:** `8123`  
**Environment:** Docker Compose (`telemetry-worker`)

ClickHouse HTTP port the worker uses when materialising GNSS data.

**Example:**

```bash
CLICKHOUSE_HTTP_PORT=8123
```

---

### CLICKHOUSE_USER

**Type:** String  
**Required:** No  
**Default:** `default`  
**Environment:** Docker Compose (`telemetry-worker`)

ClickHouse username for the worker's HTTP connection.

**Example:**

```bash
CLICKHOUSE_USER=default
```

---

### CLICKHOUSE_PASSWORD

**Type:** String  
**Required:** No  
**Default:** _empty_  
**Environment:** Docker Compose (`telemetry-worker`)

ClickHouse password for the worker's HTTP connection.

**Security:** Treat as sensitive when set in production.

**Example:**

```bash
CLICKHOUSE_PASSWORD=
```

---

## Performance Monitoring Variables

### PERF_THRESHOLD_API

**Type:** Number (milliseconds)  
**Required:** No  
**Default:** `300`  
**Environment:** Next.js application

Performance threshold for API requests. Requests exceeding this duration are
logged as slow operations.

**Example:**

```bash
PERF_THRESHOLD_API=300
```

---

### PERF_THRESHOLD_DB

**Type:** Number (milliseconds)  
**Required:** No  
**Default:** `100`  
**Environment:** Next.js application

Performance threshold for database queries. Queries exceeding this duration are
logged as slow operations.

**Example:**

```bash
PERF_THRESHOLD_DB=100
```

---

### PERF_THRESHOLD_EXTERNAL

**Type:** Number (milliseconds)  
**Required:** No  
**Default:** `500`  
**Environment:** Next.js application

Performance threshold for external service calls (e.g., ingestion service).
Calls exceeding this duration are logged as slow operations.

**Example:**

```bash
PERF_THRESHOLD_EXTERNAL=500
```

---

## System Variables

### TZ

**Type:** Timezone String  
**Required:** No  
**Default:** `Australia/Sydney`  
**Environment:** Docker Compose (both services)

System timezone for both Next.js and Python services. Affects:

- Log timestamps
- Date/time parsing
- Scheduled tasks (if implemented)

**Example:**

```bash
TZ=Australia/Sydney
```

**Common Values:**

- `UTC` - Coordinated Universal Time
- `America/New_York` - Eastern Time
- `Europe/London` - British Time
- `Australia/Sydney` - Australian Eastern Time

---

## Environment Variable Requirements Matrix

The following table shows which variables are required vs optional for each
environment:

| Variable                | Development                                                   | Production  | Notes                                          |
| ----------------------- | ------------------------------------------------------------- | ----------- | ---------------------------------------------- |
| `DATABASE_URL`          | ✅ Required                                                   | ✅ Required | Must be valid PostgreSQL URL                   |
| `AUTH_SECRET`           | ✅ Required                                                   | ✅ Required | Min 32 chars; cannot use default in production |
| `NODE_ENV`              | ✅ Required                                                   | ✅ Required | Must be "development" or "production"          |
| `APP_URL`               | ⚪ Optional (default: `http://localhost:3001`)                | ✅ Required | Should be HTTPS in production                  |
| `INGESTION_SERVICE_URL` | ⚪ Optional (default: `http://liverc-ingestion-service:8000`) | ✅ Required | Must be set in production                      |
| `PORT`                  | ⚪ Optional                                                   | ⚪ Optional | Defaults to 3001                               |
| `HOST`                  | ⚪ Optional                                                   | ⚪ Optional | Defaults to 0.0.0.0                            |
| `TZ`                    | ⚪ Optional                                                   | ⚪ Optional | Timezone (default: Australia/Sydney)           |

**Legend:**

- ✅ Required - Application will fail to start if not set
- ⚪ Optional - Has default value or is not needed

**Production Validation:** The application performs environment-aware validation
at startup (`src/lib/env.ts`):

- `INGESTION_SERVICE_URL` is validated as required in production
- `AUTH_SECRET` cannot use the default development value in production
- All required variables must be set and valid

---

## Environment-Specific Values

### Development

**File:** `.env.docker` (local development)

```bash
# Database
DATABASE_URL=postgresql://pacetracer:change-me@mre-postgres:5432/pacetracer?schema=public
POSTGRES_USER=pacetracer
POSTGRES_PASSWORD=change-me
POSTGRES_DB=pacetracer

# Application
NODE_ENV=development
PORT=3001
APP_PORT=3001
APP_URL=http://localhost:3001
HOST=0.0.0.0

# Authentication
AUTH_SECRET=development-secret-change-in-production

# Ingestion Service
INGESTION_SERVICE_URL=http://liverc-ingestion-service:8000
INGESTION_PORT=8000
LOG_LEVEL=INFO
PYTHONUNBUFFERED=1

# System
TZ=Australia/Sydney
```

---

### Staging

**Placeholder:** Staging environment configuration

```bash
# Database
DATABASE_URL=postgresql://[user]:[password]@[host]:5432/[database]?schema=public
POSTGRES_USER=[user]
POSTGRES_PASSWORD=[strong-password]
POSTGRES_DB=[database-name]

# Application
NODE_ENV=production
PORT=3001
APP_URL=https://staging.mre.example.com
HOST=0.0.0.0

# Authentication
AUTH_SECRET=[strong-random-secret]

# Ingestion Service
INGESTION_SERVICE_URL=http://liverc-ingestion-service:8000
LOG_LEVEL=INFO

# System
TZ=UTC
```

**Note:** Replace placeholders with actual staging values.

---

### Production

**Placeholder:** Production environment configuration

```bash
# Database
DATABASE_URL=postgresql://[user]:[strong-password]@[host]:5432/[database]?schema=public&sslmode=require
POSTGRES_USER=[user]
POSTGRES_PASSWORD=[strong-random-password]
POSTGRES_DB=[database-name]

# Application
NODE_ENV=production
PORT=3001
APP_URL=https://mre.example.com
HOST=0.0.0.0

# Authentication
AUTH_SECRET=[strong-random-secret-minimum-32-chars]

# Ingestion Service
INGESTION_SERVICE_URL=http://liverc-ingestion-service:8000
LOG_LEVEL=WARNING

# System
TZ=UTC
```

**Security Requirements:**

- All secrets MUST be strong and randomly generated
- Database connection MUST use SSL (`sslmode=require`)
- Passwords MUST be unique and not reused
- Secrets MUST be stored in secure secret management (not in code)

**Note:** Replace placeholders with actual production values. Use a secret
management service (e.g., AWS Secrets Manager, HashiCorp Vault) in production.

---

## Security Considerations

### Sensitive Variables

The following variables contain sensitive information and MUST be protected:

1. **DATABASE_URL** - Contains database credentials
2. **POSTGRES_PASSWORD** - Database password
3. **AUTH_SECRET** - Session encryption key

### Security Best Practices

1. **Never commit secrets to version control**
   - Use `.env.docker` (already in `.gitignore`)
   - Use secret management services in production

2. **Use strong, random secrets**
   - Minimum 32 characters for `AUTH_SECRET`
   - Use `openssl rand -base64 32` to generate secrets

3. **Rotate secrets regularly**
   - Change passwords and secrets periodically
   - Rotate `AUTH_SECRET` when compromised

4. **Use different secrets per environment**
   - Development, staging, and production MUST use different secrets
   - Never reuse production secrets in development

5. **Limit access to secrets**
   - Only grant access to authorized personnel
   - Use least-privilege access principles

6. **Monitor secret usage**
   - Log access to sensitive variables (if possible)
   - Alert on unauthorized access attempts

### Validation Rules

**DATABASE_URL:**

- Must be a valid PostgreSQL connection string
- Must include user, password, host, port, and database
- Format:
  `postgresql://[user]:[password]@[host]:[port]/[database]?schema=public`

**AUTH_SECRET:**

- Minimum 32 characters (recommended)
- Should be randomly generated
- Must be unique per environment

**NODE_ENV:**

- Must be one of: `development`, `production`, `test`
- Affects application behavior and security

**Placeholder for future documentation:**

- Environment variable validation scripts
- Secret rotation procedures
- Security audit checklist

---

## Example Configuration Files

### Minimal Development Setup

**File:** `.env.docker` (minimum required variables)

```bash
# Generate AUTH_SECRET with: openssl rand -base64 32
DATABASE_URL=postgresql://pacetracer:change-me@mre-postgres:5432/pacetracer?schema=public
AUTH_SECRET=your-generated-secret-here-minimum-32-characters
NODE_ENV=development
APP_URL=http://localhost:3001
INGESTION_ADMIN_TOKEN=dev-ingestion-admin-token-change-me
ADMIN_INGESTION_SETTINGS_WRITABLE=true
```

**Note:** AUTH_SECRET must be at least 32 characters. The build will fail if
this requirement is not met.

### Complete Development Setup

See [Development](#development) section above for complete example.

---

## Variable Reference Table

| Variable                                | Required   | Default                                 | Group          | Security Sensitive |
| --------------------------------------- | ---------- | --------------------------------------- | -------------- | ------------------ |
| `DATABASE_URL`                          | Yes        | None                                    | Database       | Yes                |
| `POSTGRES_USER`                         | No         | `pacetracer`                            | Database       | No                 |
| `POSTGRES_PASSWORD`                     | No         | `change-me`                             | Database       | Yes                |
| `POSTGRES_DB`                           | No         | `pacetracer`                            | Database       | No                 |
| `POSTGRES_PORT`                         | No         | `5432`                                  | Database       | No                 |
| `NODE_ENV`                              | Yes        | `development`                           | Application    | No                 |
| `PORT`                                  | No         | `3001`                                  | Application    | No                 |
| `APP_PORT`                              | No         | `3001`                                  | Application    | No                 |
| `APP_URL`                               | No         | `http://localhost:3001`                 | Application    | No                 |
| `HOST`                                  | No         | `0.0.0.0`                               | Application    | No                 |
| `NODE_OPTIONS`                          | No         | `--dns-result-order=ipv4first`          | Application    | No                 |
| `NEXT_PUBLIC_ENABLE_PRACTICE_DAYS`      | No         | `true`                                  | Application    | No                 |
| `CLICKHOUSE_URL`                        | No         | `http://mre-clickhouse:8123`            | Application    | No                 |
| `TELEMETRY_UPLOAD_ROOT`                 | No         | `/data/telemetry`                       | Shared         | No                 |
| `AUTH_SECRET`                           | Yes        | None (min 32 chars)                     | Authentication | Yes                |
| `NEXTAUTH_SECRET`                       | No         | Falls back to `AUTH_SECRET`             | Authentication | Yes                |
| `INGESTION_SERVICE_URL`                 | No         | `http://liverc-ingestion-service:8000`  | Ingestion      | No                 |
| `INGESTION_PORT`                        | No         | `8000`                                  | Ingestion      | No                 |
| `LOG_LEVEL`                             | No         | `INFO`                                  | Ingestion      | No                 |
| `UVICORN_RELOAD`                        | No         | `false`                                 | Ingestion      | No                 |
| `INGESTION_USE_QUEUE`                   | No         | `true`                                  | Ingestion      | No                 |
| `UVICORN_WORKERS`                       | No         | `1`                                     | Ingestion      | No                 |
| `SITE_POLICY_PATH`                      | No         | `/app/policies/site_policy/policy.json` | Ingestion      | No                 |
| `TRACK_SYNC_METADATA_CONCURRENCY`       | No         | `6`                                     | Ingestion      | No                 |
| `TRACK_SYNC_REPORT_RETENTION_DAYS`      | No         | `30`                                    | Ingestion      | No                 |
| `MRE_SCRAPE_ENABLED`                    | No         | `true`                                  | Ingestion      | No                 |
| `MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED` | No         | `false`                                 | Ingestion      | No                 |
| `MRE_RECENT_EVENTS_DAYS`                | No         | `7`                                     | Ingestion      | No                 |
| `MRE_RECENT_EVENTS_TRACKS`              | No         | `followed`                              | Ingestion      | No                 |
| `MRE_RECENT_EVENTS_MAX_INGESTS`         | No         | `50`                                    | Ingestion      | No                 |
| `MRE_RECENT_EVENTS_MIN_AGE_HOURS`       | No         | `12`                                    | Ingestion      | No                 |
| `INGESTION_QUEUE_MAX_CONCURRENT`        | No         | `2`                                     | Ingestion      | No                 |
| `INGESTION_QUEUE_JOB_TTL_SECONDS`       | No         | `3600`                                  | Ingestion      | No                 |
| `INGESTION_ADMIN_TOKEN`                 | Yes (prod) | None                                    | Ingestion      | Yes                |
| `INGESTION_SETTINGS_CACHE_TTL_SECONDS`  | No         | `30`                                    | Ingestion      | No                 |
| `INGESTION_BUILD_TARGET`                | No         | `development`                           | Docker         | No                 |
| `PERF_THRESHOLD_API`                    | No         | `300`                                   | Performance    | No                 |
| `PERF_THRESHOLD_DB`                     | No         | `100`                                   | Performance    | No                 |
| `PERF_THRESHOLD_EXTERNAL`               | No         | `500`                                   | Performance    | No                 |
| `PYTHONUNBUFFERED`                      | No         | `1`                                     | Ingestion      | No                 |
| `CLICKHOUSE_PORT`                       | No         | `8123`                                  | ClickHouse     | No                 |
| `TELEMETRY_WORKER_ID`                   | No         | `telemetry-worker-1`                    | Telemetry      | No                 |
| `TELEMETRY_WORKER_POLL_INTERVAL_SEC`    | No         | `2`                                     | Telemetry      | No                 |
| `TELEMETRY_WORKER_CLICKHOUSE_HOST`      | No         | _empty_                                 | Telemetry      | No                 |
| `CLICKHOUSE_HTTP_PORT`                  | No         | `8123`                                  | Telemetry      | No                 |
| `CLICKHOUSE_USER`                       | No         | `default`                               | Telemetry      | No                 |
| `CLICKHOUSE_PASSWORD`                   | No         | _empty_                                 | Telemetry      | Yes                |
| `TZ`                                    | No         | `Australia/Sydney`                      | System         | No                 |

---

## Unused / Legacy Variables

- **`OPENWEATHERMAP_API_KEY`** — Present in the example `.env.docker` but **not
  referenced anywhere in the current codebase** (no `process.env` lookup in
  `src/`). Treat as legacy/placeholder; it has no runtime effect today.

---

## Related Documentation

- [Docker User Guide](./docker-user-guide.md) - Docker setup and configuration
- [Build and runtime reference](./build-runtime-reference.md) - Compose defaults
  and service wiring
- [Deployment Guide](./deployment-guide.md) - Production deployment procedures
- [Security Overview](../security/security-overview.md) - Security best
  practices
- [README.md](../../README.md) - Basic setup instructions

---

**End of Environment Variables Reference**
