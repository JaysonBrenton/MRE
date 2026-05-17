---
created: 2026-05-16
creator: Jayson Brenton
lastModified: 2026-05-16
description:
  Factual inventory of Docker Compose services, containers, ports, and images
  aligned with docker-compose.yml
purpose:
  Single source of truth for what the repository actually builds and runs in
  development compose. Use this to verify or update descriptive documentation;
  when compose changes, update this file first.
relatedFiles:
  - docker-compose.yml
  - Dockerfile
  - ingestion/Dockerfile
  - docker-entrypoint.sh
  - docs/operations/docker-user-guide.md
---

# Build and runtime reference (Docker Compose)

**Status:** Authoritative for `docker-compose.yml` in this repository  
**Scope:** Development-style Compose stack (`docker compose up`)

This document reflects the **current** `docker-compose.yml` service definitions.
It does not describe production hosting outside Compose unless noted.

## Compose project and network

| Item                    | Value                                                                             |
| ----------------------- | --------------------------------------------------------------------------------- |
| Default Compose project | Derived from the project directory name (often the repo folder name).             |
| User-defined network    | `mre-network` (Compose key) with **explicit name** `my-race-engineer_mre-network` |
| Network driver          | Bridge (default)                                                                  |

Containers on this network resolve each other by **Compose service name** (e.g.
`mre-postgres`, `liverc-ingestion-service`) where DNS aliases match Docker
Compose wiring.

## Services (tables)

### Application and API (Next.js)

| Compose service key | Container name | Build / image                         | Host port (default) | Container port | Purpose                      |
| ------------------- | -------------- | ------------------------------------- | ------------------- | -------------- | ---------------------------- |
| `app`               | `mre-app`      | `Dockerfile` target **`development`** | `3001` (`APP_PORT`) | `3001`         | Next.js app, `/api/v1/*`, UI |

- **Health check (inside container):** `GET http://localhost:3001/api/v1/health`
  (see `Dockerfile` / compose `healthcheck`).
- **Entrypoint:** `docker-entrypoint.sh` — dependency install when needed,
  `npx prisma migrate deploy` when `DATABASE_URL` is set, then `CMD`
  (`npm run dev`).

### PostgreSQL

| Compose service key | Container name | Image         | Host port (default)      | Container port |
| ------------------- | -------------- | ------------- | ------------------------ | -------------- |
| `postgres`          | `mre-postgres` | `postgres:16` | `5432` (`POSTGRES_PORT`) | `5432`         |

Defined **in** `docker-compose.yml` (not an externally required manual
container). `docker compose up` creates this service when the full stack is
started.

### LiveRC ingestion API (Python / FastAPI)

| Compose service key        | Container name                 | Build / image                                                                           | Host port (default)       | Container port |
| -------------------------- | ------------------------------ | --------------------------------------------------------------------------------------- | ------------------------- | -------------- |
| `liverc-ingestion-service` | `mre-liverc-ingestion-service` | `ingestion/Dockerfile` target from `INGESTION_BUILD_TARGET` (default **`development**`) | `8000` (`INGESTION_PORT`) | `8000`         |

- **Health check (inside container):** `http://localhost:8000/health`
- **Notable volume mounts:** `./ingestion` → `/app/ingestion`, `./docs/reports`
  → `/app/docs/reports`, `./policies` read-only, shared telemetry upload volume.

### Telemetry pipeline worker

| Compose service key | Container name         | Build / image                                                     | Published ports      |
| ------------------- | ---------------------- | ----------------------------------------------------------------- | -------------------- |
| `telemetry-worker`  | `mre-telemetry-worker` | Same image as `liverc-ingestion-service` (`ingestion/Dockerfile`) | None (internal only) |

- **Entrypoint override:** `python -m ingestion.telemetry.worker` (see
  `docker-compose.yml`; this bypasses the ingestion image default entrypoint so
  the worker does not run cron/uvicorn).
- **Role:** Polls/processes staged telemetry uploads (Parquet, optional
  ClickHouse materialisation per environment).

### ClickHouse (optional telemetry query cache)

| Compose service key | Container name   | Image                               | Host port (default)        | Container port |
| ------------------- | ---------------- | ----------------------------------- | -------------------------- | -------------- |
| `clickhouse`        | `mre-clickhouse` | `clickhouse/clickhouse-server:24.8` | `8123` (`CLICKHOUSE_PORT`) | HTTP `8123`    |

Used when telemetry workflows need the HTTP interface; worker ClickHouse
materialisation is controlled by worker env (e.g. `CLICKHOUSE_HOST` / compose
`TELEMETRY_WORKER_CLICKHOUSE_HOST`), not solely by this service being up.

## Named volumes (Compose)

| Volume name             | Used by                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `mre-postgres-data`     | PostgreSQL data directory                                                  |
| `mre-telemetry-uploads` | `app`, `liverc-ingestion-service`, `telemetry-worker` (shared upload root) |
| `mre-clickhouse-data`   | ClickHouse data directory                                                  |

## Cross-service URLs (inside Docker network)

These match defaults in `docker-compose.yml` and typical `.env.docker` usage:

| From / use case                | URL / hostname                                                   |
| ------------------------------ | ---------------------------------------------------------------- |
| App → PostgreSQL               | `postgresql://…@mre-postgres:5432/…`                             |
| App → ingestion HTTP           | `http://liverc-ingestion-service:8000` (`INGESTION_SERVICE_URL`) |
| App / worker → ClickHouse HTTP | `http://mre-clickhouse:8123` (when enabled)                      |

## Verification commands (host)

```bash
docker compose ps
docker compose config --services
```

## Related documentation

- [Docker User Guide](./docker-user-guide.md) — workflows, troubleshooting, and
  daily usage
- [Environment Variables Reference](./environment-variables.md) — variable
  catalogue
- [Developer Quick Start Guide](../development/quick-start.md) — onboarding
