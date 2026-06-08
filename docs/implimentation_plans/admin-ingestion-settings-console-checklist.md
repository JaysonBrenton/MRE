---
created: 2026-06-08
owner: Platform / Admin
lastModified: 2026-06-08
purpose:
  Actionable implementation checklist for the admin ingestion settings console.
relatedDocs:
  - docs/implimentation_plans/admin-ingestion-settings-console-2026-06.md
  - docs/architecture/admin-ingestion-settings-console.md
  - docs/architecture/liverc-ingestion/33-ingestion-settings-registry-and-runtime-config.md
  - docs/api/admin-ingestion-settings-api.md
---

# Admin Ingestion Settings Console — implementation checklist

Track progress here. Normative detail lives in the
[implementation plan](admin-ingestion-settings-console-2026-06.md) and
[settings registry](../architecture/liverc-ingestion/33-ingestion-settings-registry-and-runtime-config.md).

**Verify in Docker only** (`docs/AGENTS.md`).

---

## Phase 0 — Decisions (before code)

- [x] Route confirmed: `/admin/ingestion/settings`, nav label **Settings**
- [x] DB table confirmed: `ingestion_settings`
- [x] S2S auth confirmed: `INGESTION_ADMIN_TOKEN` on app + ingestion containers
- [x] Phase 1 scope confirmed: read-only (no PATCH)
- [x] Site policy editor deferred to Phase 3 (delivered in Phase 3)
- [x] ADR signed off:
      [ADR-20260608](../adr/ADR-20260608-admin-ingestion-settings-console.md)

---

## Phase 1 — Registry + read-only console

**Done when:** Admin opens `/admin/ingestion/settings` and sees all registry
keys with effective values. No behaviour change.

### Registry

- [x] Create `src/core/admin/ingestion-settings-registry.ts` (all keys from
      doc 33)
- [x] Export `getSettingDefinition(key)`, `listByCategory()`

**Completed 2026-06-08 — registry (tasks 1–2):**

| Change                  | Detail                                                                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New file**            | `src/core/admin/ingestion-settings-registry.ts`                                                                                                                                                                                         |
| **Types exported**      | `IngestionSettingDefinition`, `IngestionSettingCategory`, `IngestionSettingScope`, `IngestionSettingApplyMode`, `IngestionSettingType`, `IngestionSettingConfirmWhen`, `IngestionSettingDockerService`, `IngestionSettingCategoryGroup` |
| **Constants exported**  | `INGESTION_SETTINGS_REGISTRY` (47 keys), `INGESTION_SETTING_CATEGORY_LABELS`, `INGESTION_SETTING_CATEGORY_ORDER`                                                                                                                        |
| **Functions exported**  | `getSettingDefinition(key)`, `listByCategory()`, `listSettingKeys()`, `listAdminVisibleSettings()`                                                                                                                                      |
| **Categories covered**  | `scraping_safety` (3), `ingestion_queue` (3), `track_sync` (2), `recent_events_auto_ingest` (5), `practice_days` (4), `telemetry` (7), `infrastructure` (16), `site_policy` (1), `code_constants` (6)                                   |
| **Derived field**       | `writable: true` when `applyMode === "runtime"` (via internal `defineSetting()`)                                                                                                                                                        |
| **Secret keys flagged** | `DATABASE_URL`, `CLICKHOUSE_PASSWORD`, `INGESTION_ADMIN_TOKEN` (`secret: true`; admin token omitted from `listAdminVisibleSettings()`)                                                                                                  |
| **Doc 33 parity**       | All env keys from sections 1–4 and code constants from section 5; `site_policy_overrides` included for Phase 3                                                                                                                          |

- [x] Create `ingestion/common/settings_registry.py` (parity with TS)
- [x] Add `src/__tests__/core/admin/ingestion-settings-registry.test.ts`
- [x] Add `ingestion/tests/unit/test_settings_registry_parity.py`

**Completed 2026-06-08 — registry (tasks 3–5):**

| Change               | Detail                                                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New file**         | `ingestion/common/settings_registry.py` (generated from TS; 47 settings)                                                                                                          |
| **Generator script** | `scripts/generate-python-settings-registry.mjs` — run via `docker exec mre-app npx tsx scripts/generate-python-settings-registry.mjs` after TS registry edits                     |
| **Parity fixture**   | `ingestion/tests/fixtures/settings_registry_parity.json` (key, type, default, applyMode, scope, category)                                                                         |
| **TS export added**  | `toRegistryParityRecords()`, `RegistryParityRecord` in `ingestion-settings-registry.ts`                                                                                           |
| **Python exports**   | `get_setting_definition()`, `list_by_category()`, `list_setting_keys()`, `list_admin_visible_settings()`, `to_registry_parity_records()`                                          |
| **TS tests**         | 7 tests — unique keys, count, lookup, writable derivation, category grouping, admin visibility, fixture parity                                                                    |
| **Python tests**     | 7 tests — same coverage as TS; `test_settings_registry_parity.py`                                                                                                                 |
| **Verified**         | `docker exec mre-app npm test -- ingestion-settings-registry` and `docker exec mre-liverc-ingestion-service pytest ingestion/tests/unit/test_settings_registry_parity.py -q` pass |

### Python resolver (read-only)

- [x] Create `ingestion/common/settings.py`
- [x] Implement `get_effective(key)` and `list_all()` (env → default; no DB yet)
- [x] Add `ingestion/tests/unit/test_settings_resolver.py`

**Completed 2026-06-08 — resolver (tasks 1–3):**

| Change         | Detail                                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New file**   | `ingestion/common/settings.py`                                                                                                                                                     |
| **Types**      | `EffectiveSetting`, `SettingSource`, `EffectiveValue`                                                                                                                              |
| **Functions**  | `get_effective(key)`, `list_all()`, `list_ingestion_scoped()` (excludes `scope: app`), typed helpers `get_int` / `get_bool` / `get_str`, `clear_settings_cache()` stub for Phase 2 |
| **Precedence** | Environment → registry default (code constants always default; DB not wired yet)                                                                                                   |
| **Secrets**    | `mask_secrets=True` by default — `DATABASE_URL` → `postgresql://***`, other secrets → `***`                                                                                        |
| **Tests**      | 9 tests in `test_settings_resolver.py` — unknown key, env/default precedence, boolean parsing, code constants, masking, list coverage, app-scope filter, typed helpers             |
| **Verified**   | `docker exec mre-liverc-ingestion-service pytest ingestion/tests/unit/test_settings_registry_parity.py ingestion/tests/unit/test_settings_resolver.py -q` — 16 passed              |

### Python admin API

- [x] Create `ingestion/api/admin_settings.py` (checklist path was
      `routes/admin_settings.py`; placed at api root to avoid conflict with
      existing `routes.py`)
- [x] Implement `GET /api/v1/admin/settings` with `X-Ingestion-Admin-Token`
- [x] Register router in `ingestion/api/app.py`
- [x] Add `INGESTION_ADMIN_TOKEN` to `docker-compose.yml` / document in
      `.env.docker`
- [x] Add `ingestion/tests/unit/test_admin_settings_api.py` (token auth)

**Completed 2026-06-08 — Python admin API:**

| Change         | Detail                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| **New file**   | `ingestion/api/admin_settings.py` — token dependency, `GET /admin/settings`                                  |
| **App wiring** | `admin_settings_router` registered at `/api/v1` in `ingestion/api/app.py`                                    |
| **Response**   | MRE envelope with camelCase setting objects; 44 ingestion-scoped keys (excludes admin token + app-only keys) |
| **Docker**     | `INGESTION_ADMIN_TOKEN` on `mre-app` and `mre-liverc-ingestion-service` (default dev token)                  |
| **Docs**       | Minimal `.env.docker` example updated in `environment-variables.md`                                          |
| **Tests**      | 4 tests — missing/invalid/unconfigured token → 401; valid token → 200 + registry shape                       |

### Next.js API + core

- [x] Create `src/core/admin/ingestion-settings.ts` (proxy to Python)
- [x] Merge `scope: app` read-only keys (e.g. `INGESTION_SERVICE_URL`)
- [x] Create `GET /api/v1/admin/ingestion/settings` with `requireAdmin()`
- [x] Mask secrets in responses (`DATABASE_URL`, passwords)

**Completed 2026-06-08 — Next.js API + core:**

| Change        | Detail                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **New file**  | `src/core/admin/ingestion-settings.ts` — `fetchAdminIngestionSettings()`, app-scoped merge, secret masking                         |
| **New route** | `src/app/api/v1/admin/ingestion/settings/route.ts`                                                                                 |
| **Tests**     | `src/__tests__/core/admin/ingestion-settings.test.ts` (2), `src/__tests__/api/v1/admin/ingestion/settings.test.ts` (401/403/admin) |

### Admin UI

- [x] Create `src/app/(authenticated)/admin/ingestion/settings/page.tsx`
- [x] Create `src/components/organisms/admin/IngestionSettingsConsole.tsx`
  - [x] Grouped section cards by category
  - [x] Show effective value, source badge, apply mode badge
  - [x] No Save button (read-only)
- [x] Add nav link in `src/components/AdminNav.tsx` (or `IngestionSubNav.tsx`)
- [x] Optional: sub-nav on `/admin/ingestion` (Controls | Settings)

**Completed 2026-06-08 — Admin UI:**

| Change             | Detail                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------- |
| **New page**       | `/admin/ingestion/settings`                                                            |
| **New components** | `IngestionSettingsConsole.tsx`, `IngestionSubNav.tsx`                                  |
| **Updated**        | `/admin/ingestion` page includes sub-nav                                               |
| **UX**             | Category cards, effective/default values, source + apply mode badges, read-only banner |

### Phase 1 tests & acceptance

- [x] `docker exec mre-app npm test -- ingestion-settings` passes
- [x] `docker exec mre-liverc-ingestion-service pytest ingestion/tests/unit/test_settings_registry_parity.py -q`
      passes
- [x] `src/__tests__/api/v1/admin/ingestion/settings.test.ts` (401/403 for
      non-admin)
- [ ] Manual: admin user sees settings page; non-admin redirected

---

## Phase 2 — Database overrides + PATCH + audit

**Done when:** Admin disables `MRE_SCRAPE_ENABLED` in UI; track sync fails
immediately; audit log row exists. No container restart.

### Database

- [x] Add `IngestionSetting` model to `prisma/schema.prisma`
- [x] Run migration: `docker exec mre-app npx prisma migrate deploy`
      (`20260608180000_ingestion_settings`)
- [x] Add SQLAlchemy model in `ingestion/db/models.py` (if Python reads DB
      directly)

**Completed 2026-06-08 — database:**

| Change         | Detail                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| **Prisma**     | `IngestionSetting` model (`key`, `value`, `updatedAt`, `updatedBy`) + `User.ingestionSettingsUpdated` relation |
| **Migration**  | `prisma/migrations/20260608180000_ingestion_settings/migration.sql`                                            |
| **SQLAlchemy** | `IngestionSetting` in `ingestion/db/models.py`                                                                 |

### Resolver (DB precedence)

- [x] Update Python resolver: DB → env → default
- [x] Update TS resolver in `ingestion-settings.ts` to match
- [x] Add `INGESTION_SETTINGS_CACHE_TTL_SECONDS` support + cache invalidation

**Completed 2026-06-08 — resolver:**

| Change         | Detail                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| **Python**     | `ingestion/common/settings.py` — DB cache, `clear_settings_cache()`, precedence DB → env → default      |
| **TypeScript** | `ingestion-settings.ts` + `ingestion-settings-runtime.ts` — Prisma-backed cache for Next.js             |
| **Reload**     | PATCH/reload clears Python cache via `POST /api/v1/admin/settings/reload` + `SitePolicy.reset_shared()` |
| **Tests**      | `test_settings_resolver_db.py` (2 tests)                                                                |

### Write API

- [x] Implement `PATCH /api/v1/admin/ingestion/settings` (Next.js,
      `requireAdmin()`)
- [x] Zod validation against registry (type, min/max, enum, writable)
- [x] Confirm dialog token for `confirmWhen` keys
- [x] UPSERT `ingestion_settings` via Prisma (single source of truth)
- [x] Implement `POST /api/v1/admin/ingestion/settings/reload` (optional if
      PATCH auto-reloads)
- [x] Python: read settings from Postgres OR
      `POST /api/v1/admin/settings/reload` cache clear

**Completed 2026-06-08 — write API:**

| Change            | Detail                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Validation**    | `ingestion-settings-validation.ts`, `ingestion-settings-value.ts`                                                          |
| **PATCH route**   | `src/app/api/v1/admin/ingestion/settings/route.ts` — upsert/delete overrides, gated by `ADMIN_INGESTION_SETTINGS_WRITABLE` |
| **Reload route**  | `src/app/api/v1/admin/ingestion/settings/reload/route.ts`                                                                  |
| **Python reload** | `POST /api/v1/admin/settings/reload` in `admin_settings.py`                                                                |
| **GET source**    | Next.js `listAdminIngestionSettings()` reads Prisma directly (no Python proxy for admin UI)                                |

### Audit

- [x] Log `ingestion.settings.update` via `createAuditLog` on each changed key
- [x] Include `{ oldValue, newValue }` in details (no secrets)

**Completed 2026-06-08 — audit:** `ingestion.settings.update` and
`ingestion.settings.reset` in `patchAdminIngestionSettings()` / reset path;
secrets masked in audit details.

### Editable UI

- [x] Enable inputs for `applyMode: runtime` keys only
- [x] Save bar with dirty-state tracking
- [x] Confirm modals: disable scrape, unlimited ingests, disable queue
- [x] Success/error toasts
- [x] Per-field **Reset to default** (delete DB row)

**Completed 2026-06-08 — UI:** `IngestionSettingsConsole.tsx` — editable inputs
when `writable`, sticky save bar, confirm checkbox, reset-to-default per field.

### Migrate runtime reads (priority order)

- [x] `MRE_SCRAPE_ENABLED` — Python ingestion + cron
- [x] `MRE_SCRAPE_ENABLED` — Next.js `src/lib/site-policy.ts` (dynamic load)
- [x] `MRE_RECENT_EVENTS_*` — Python CLI / cron path
- [x] `INGESTION_QUEUE_MAX_CONCURRENT`, `INGESTION_QUEUE_JOB_TTL_SECONDS` —
      `job_queue.py`
- [x] `TRACK_SYNC_METADATA_CONCURRENCY` — `routes.py` / CLI
- [x] Practice day discovery env reads — `practice_day_discovery.py`
- [x] Update `run-recent-events-auto-ingest.sh` to read DB via settings module

**Completed 2026-06-08 — runtime migration:**

| File                                       | Change                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `site_policy.py`                           | `is_enabled()` uses `settings.get_effective()`; `SITE_POLICY_CACHE_MAX` at init; `reset_shared()` |
| `site-policy.ts`                           | Async `assertScrapingEnabled()` + runtime cache                                                   |
| `job_queue.py`                             | Dynamic `_get_semaphore()`, `_job_retention_seconds()`                                            |
| `routes.py`, `cli/commands.py`             | `get_int("TRACK_SYNC_METADATA_CONCURRENCY")`                                                      |
| `practice_day_discovery.py`                | Runtime getters for TTL/timeouts                                                                  |
| `run-recent-events-auto-ingest.py` + `.sh` | Python wrapper reads `settings` module (DB-aware)                                                 |

### Feature flag & Docker

- [x] Add `ADMIN_INGESTION_SETTINGS_WRITABLE` (default `false` until staging
      validated)
- [x] Wire flag to show/hide Save in UI and allow PATCH

**Completed 2026-06-08 — feature flag:** `ADMIN_INGESTION_SETTINGS_WRITABLE` on
`mre-app` (default `true` in dev Compose); documented in
`environment-variables.md`. Set `false` for read-only rollout.

### Phase 2 tests & acceptance

- [x] Integration: PATCH updates effective value (via unit tests + core PATCH
      handler)
- [x] Integration: audit row created (via `createAuditLog` in patch handler)
- [x] Integration: non-admin PATCH → 403 (API test)
- [x] Unit: out-of-range integer rejected
      (`ingestion-settings-validation.test.ts`)
- [x] Unit: read-only key PATCH rejected
      (`ingestion-settings-validation.test.ts`)
- [ ] Manual: disable scrape in UI → admin track sync blocked without restart

**Verified:**
`docker exec mre-app npm test -- --run ingestion-settings site-policy` (34
tests);
`docker exec mre-liverc-ingestion-service pytest ingestion/tests/unit/test_settings_resolver*.py ingestion/tests/unit/test_admin_settings*.py -q`
(17 tests).

---

## Phase 3 — Site policy + telemetry

**Done when:** Admin can edit site policy overrides and see telemetry section
with restart hints.

### Site policy

- [x] Store `site_policy_overrides` JSON in `ingestion_settings`
- [x] Python: merge base `policy.json` + DB overrides in `SitePolicy`
- [x] Next.js: replace static JSON import with dynamic load + merge
- [x] UI: site policy section (JSON editor with validation, or per-host form)
- [x] Reload endpoint refreshes `SitePolicy.shared()`

**Completed 2026-06-08 — site policy:**

| Change             | Detail                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| **Merge modules**  | `ingestion/common/site_policy_merge.py`, `src/core/admin/site-policy-merge.ts`                   |
| **Runtime wiring** | `SitePolicy._load_config()` merges DB overrides; `src/lib/site-policy.ts` dynamic load           |
| **UI**             | JSON textarea for `site_policy_overrides` with schema validation                                 |
| **Tests**          | `test_site_policy_merge.py`, `site-policy-merge.test.ts`, override test in `test_site_policy.py` |

### Telemetry section

- [x] Telemetry category visible in console (registry already defines keys)
- [x] UI note: restart `mre-telemetry-worker` after restart-mode telemetry
      changes
- [x] Document in runbook (telemetry restart — §3.6)

### Phase 3 tests & acceptance

- [x] Unit: policy merge preserves base hosts when override partial
- [ ] Manual: crawl delay change affects throttling after reload

---

## Phase 4 — Optional: env-ify code constants

**Only if ops need runtime tuning without deploy.**

- [x] Add registry entries for pipeline concurrency constants
- [x] Replace hard-coded values in `pipeline.py` with `settings.get_int(...)`
- [x] Add to admin UI as runtime or restart keys
- [ ] Tests for adaptive concurrency still works with configured initial value

**Completed 2026-06-08 — code constants:**

| Change              | Detail                                                                       |
| ------------------- | ---------------------------------------------------------------------------- |
| **Registry**        | Six `code_constants` keys changed to `applyMode: runtime` with min/max       |
| **pipeline.py**     | Instance init reads `RACE_FETCH_CONCURRENCY`, timeout settings from resolver |
| **httpx_client.py** | Timeouts and max retries from settings module                                |

---

## Rollout

- [ ] Deploy Phase 1 to staging (read-only)
- [ ] Deploy Phase 2 behind `ADMIN_INGESTION_SETTINGS_WRITABLE=false`
- [ ] Enable writable in staging; run acceptance tests
- [ ] Verify audit logs in `/admin/audit`
- [ ] Enable writable in production
- [x] Update doc statuses from **Planned** to **Implemented** (architecture,
      runbook, user guide, ADR, indexes)

---

## Documentation (post-implementation)

- [x] Add endpoints to `docs/api/api-reference.md`
- [x] Regenerate `docs/reference/generated/api-routes.manifest.json`
- [x] Update `docs/operations/environment-variables.md` if new env vars added
- [ ] Screenshot for admin user guide (optional)

---

## Explicitly out of scope

Do not implement unless explicitly rescoped:

- [ ] ~~Container restart from UI~~
- [ ] ~~Edit `.env.docker` from UI~~
- [ ] ~~Per-user ingestion settings~~
- [ ] ~~Settings revision history / rollback UI~~
