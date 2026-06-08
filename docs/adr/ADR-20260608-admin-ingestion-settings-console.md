---
created: 2026-06-08
status: Accepted
deciders: Engineering, Platform
lastModified: 2026-06-08
---

# ADR-20260608 — Admin ingestion settings console with runtime config overrides

## Context

LiveRC ingestion behaviour is controlled by **environment variables** (see
`docs/operations/environment-variables.md`) and a shared **site policy JSON
file** (`policies/site_policy/policy.json`). Operators change values by editing
`.env.docker` and restarting Docker containers.

The admin console at `/admin` already provides **Ingestion Controls**
(`/admin/ingestion`) to trigger track sync and event ingestion jobs, but it
cannot view or change ingestion settings. This creates operational friction and
inconsistency:

- Some settings affect **both** `mre-app` and `mre-liverc-ingestion-service`
  (e.g. `MRE_SCRAPE_ENABLED`).
- Cron jobs read env from `.env.cron`, which can drift from container env.
- There is no audit trail for configuration changes (unlike admin actions, which
  write to `audit_logs`).
- Operators cannot distinguish **runtime-tunable** settings from
  **restart-required** infrastructure settings.

Product need: administrators configure ingestion safely from
`http://localhost:3001/admin` without SSH or manual `.env.docker` edits for
day-to-day tuning.

## Decision

1. Add an **Admin Ingestion Settings Console** at `/admin/ingestion/settings`
   (nav label: **Settings** under Ingestion, or a sub-tab on the existing
   Ingestion page).

2. Introduce a **settings registry** (canonical schema in code) describing every
   ingestion-related setting: type, default, validation, scope, apply mode, and
   UI grouping. Normative spec:
   [33-ingestion-settings-registry-and-runtime-config.md](../architecture/liverc-ingestion/33-ingestion-settings-registry-and-runtime-config.md).

3. Introduce **database-backed runtime overrides** in table `ingestion_settings`
   (`key`, `value`, `updated_at`, `updated_by`). **Effective value** resolution:

   ```
   DB override → environment variable → registry default
   ```

4. Add **Python ingestion service admin settings API** (internal network only,
   token-authenticated from `mre-app`):
   - `GET /api/v1/admin/settings` — effective values + metadata
   - `PATCH /api/v1/admin/settings` — update runtime keys
   - `POST /api/v1/admin/settings/reload` — invalidate in-process caches

5. Add **Next.js admin API** (session + `requireAdmin()`):
   - `GET /api/v1/admin/ingestion/settings`
   - `PATCH /api/v1/admin/ingestion/settings`

   All writes create **`audit_logs`** entries (`ingestion.settings.update`).

6. **Apply modes** (enforced by registry, surfaced in UI):

   | Mode       | Behaviour                                                             |
   | ---------- | --------------------------------------------------------------------- |
   | `runtime`  | DB write + cache reload; effective immediately (or on next cron read) |
   | `restart`  | Display current vs pending; require container restart to apply        |
   | `readonly` | Display only (infra, secrets, code constants)                         |

7. **Phased delivery** (see implementation plan):
   - Phase 1: Read-only console + registry + GET APIs
   - Phase 2: Runtime PATCH for tunable subset + audit
   - Phase 3: Site policy editor + telemetry worker section
   - Phase 4 (optional): Env-ify pipeline code constants

8. **Do not** allow the admin UI to edit `.env.docker` or restart containers
   directly. Restart-required changes remain an ops procedure documented in the
   runbook.

## Consequences

**Positive**

- Single audited place to tune scrape kill switch, recent-events auto-ingest,
  queue limits, and practice-day discovery without redeploy.
- Registry prevents unknown keys and enforces validation in UI and API.
- Clear UX for settings that still require Docker restart.
- Cron and API share the same effective config via DB overrides.

**Negative**

- Additional moving parts: registry sync (TypeScript + Python), DB table, cache
  invalidation.
- Cross-container settings (`scope: both`) require both services to use the
  resolver (migration from raw `process.env` / `os.getenv`).
- Site policy overrides merge at runtime via `site_policy_overrides` JSON (Phase
  3).

## Alternatives considered

1. **Env-only + documentation** — Status quo. Rejected: no audit trail, high ops
   friction, cron drift.

2. **Admin UI writes `.env.docker`** — Rejected: unsafe from app container, race
   conditions, no rollback.

3. **Redis / Consul for config** — Rejected for v0.1.1: PostgreSQL already
   available; keep scope minimal.

4. **Settings only in Next.js** — Rejected: Python cron and ingestion pipeline
   would not see changes.

## Security

- Admin session required on all Next.js routes (`requireAdmin()`).
- Python admin settings routes require `INGESTION_ADMIN_TOKEN` header from
  `mre-app` only; not exposed on public ingress.
- Never return secret values unmasked (`DATABASE_URL`, `CLICKBOX_PASSWORD`).
- Confirm dialog for destructive changes (disable scraping, unlimited ingests).

See
[17-ingestion-security.md](../architecture/liverc-ingestion/17-ingestion-security.md)
and the architecture doc § Security.

## Implementation and operations

- Architecture:
  [admin-ingestion-settings-console.md](../architecture/admin-ingestion-settings-console.md)
- Registry (normative keys):
  [33-ingestion-settings-registry-and-runtime-config.md](../architecture/liverc-ingestion/33-ingestion-settings-registry-and-runtime-config.md)
- Implementation plan:
  [admin-ingestion-settings-console-2026-06.md](../implimentation_plans/admin-ingestion-settings-console-2026-06.md)
- Runbook:
  [admin-ingestion-settings-runbook.md](../operations/admin-ingestion-settings-runbook.md)
- API reference:
  [admin-ingestion-settings-api.md](../api/admin-ingestion-settings-api.md)
- Admin user guide:
  [admin-ingestion-settings.md](../user-guides/admin-ingestion-settings.md)

**Status:** Accepted — implemented 2026-06-08 (Phases 1–4). See
[checklist](../implimentation_plans/admin-ingestion-settings-console-checklist.md).
