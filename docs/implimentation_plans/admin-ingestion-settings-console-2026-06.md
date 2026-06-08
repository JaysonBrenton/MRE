---
created: 2026-06-08
owner: Platform / Admin
lastModified: 2026-06-08
purpose:
  Phased implementation plan for the admin ingestion settings console and
  runtime configuration layer.
relatedDocs:
  - docs/adr/ADR-20260608-admin-ingestion-settings-console.md
  - docs/architecture/admin-ingestion-settings-console.md
  - docs/architecture/liverc-ingestion/33-ingestion-settings-registry-and-runtime-config.md
  - docs/operations/admin-ingestion-settings-runbook.md
  - docs/api/admin-ingestion-settings-api.md
  - docs/implimentation_plans/admin-ingestion-settings-console-checklist.md
  - docs/AGENTS.md
---

# Admin Ingestion Settings Console — implementation plan (June 2026)

**Status:** Implemented — Phases 1–4 complete (2026-06-08).  
Track historical tasks in the
[implementation checklist](admin-ingestion-settings-console-checklist.md).  
All runtime verification is **Docker-only** per [AGENTS.md](../AGENTS.md).

---

## Phase 0 — Decisions (lock before coding)

- [x] Confirm route: `/admin/ingestion/settings` with nav label **Settings**
- [x] Confirm DB table name: `ingestion_settings`
- [x] Confirm S2S token env: `INGESTION_ADMIN_TOKEN` (shared secret, rotatable)
- [x] Confirm Phase 1 is **read-only** (no PATCH) to de-risk
- [x] Confirm site policy Phase 3 (not blocking Phases 1–2)
- [x] Sign off ADR:
      [ADR-20260608](../adr/ADR-20260608-admin-ingestion-settings-console.md)

---

## Phase 1 — Registry + read-only console

**Goal:** Admin can view all effective settings; no writes.

### 1.1 Registry (TypeScript)

Create `src/core/admin/ingestion-settings-registry.ts`:

- Export `INGESTION_SETTINGS_REGISTRY` array per
  [doc 33](../architecture/liverc-ingestion/33-ingestion-settings-registry-and-runtime-config.md)
- Export helpers: `getSettingDefinition(key)`, `listByCategory()`

### 1.2 Registry (Python)

Create `ingestion/common/settings_registry.py` — mirror keys/types/defaults.

### 1.3 Settings resolver (Python, read-only)

Create `ingestion/common/settings.py`:

```python
def get_effective(key: str) -> EffectiveSetting: ...
def list_all() -> list[EffectiveSetting]: ...
```

Reads env + registry default (no DB yet in early Phase 1; add DB in 1.4).

### 1.4 Python admin GET API

Create `ingestion/api/routes/admin_settings.py`:

- `GET /api/v1/admin/settings` — requires `X-Ingestion-Admin-Token`
- Register router in `ingestion/api/app.py` (internal only)

### 1.5 Next.js core + GET API

- `src/core/admin/ingestion-settings.ts` — proxy to Python, merge with local
  `scope: app` readonly keys
- `GET /api/v1/admin/ingestion/settings` — `requireAdmin()`

### 1.6 Admin UI (read-only)

- `src/app/(authenticated)/admin/ingestion/settings/page.tsx`
- `src/components/organisms/admin/IngestionSettingsConsole.tsx`
  - Grouped cards, no Save button
  - Badges: source, apply mode
- Update `AdminNav.tsx`: add **Settings** link under Ingestion area or sub-nav
  on `/admin/ingestion`

### 1.7 Tests

| Test                        | Location                                                |
| --------------------------- | ------------------------------------------------------- |
| Registry parity TS ↔ Python | `ingestion/tests/unit/test_settings_registry_parity.py` |
| GET admin API auth          | `src/__tests__/api/v1/admin/ingestion/settings.test.ts` |
| Python token rejection      | `ingestion/tests/unit/test_admin_settings_api.py`       |

**Acceptance:**

```bash
docker exec mre-app npm test -- ingestion-settings
docker exec mre-liverc-ingestion-service pytest ingestion/tests/unit/test_settings_registry_parity.py -q
```

Admin at `/admin/ingestion/settings` shows all registry keys with effective
values.

---

## Phase 2 — Database overrides + PATCH + audit

**Goal:** Runtime-tunable settings editable from admin UI.

### 2.1 Prisma migration

```prisma
model IngestionSetting {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt @map("updated_at")
  updatedBy String?  @map("updated_by")
  @@map("ingestion_settings")
}
```

Run migration in Docker:

```bash
docker exec mre-app npx prisma migrate dev --name ingestion_settings
```

### 2.2 Resolver precedence

Update Python + TS resolvers: DB → env → default.

### 2.3 Python PATCH + reload

- `PATCH /api/v1/admin/settings` — body `{ "updates": [{ "key", "value" }] }`
- Validate each key against registry (`writable`, type, min/max)
- `POST /api/v1/admin/settings/reload` — clear caches

### 2.4 Next.js PATCH

- `PATCH /api/v1/admin/ingestion/settings`
- Zod validate against registry
- UPSERT via Prisma **and** forward to Python (or Python reads DB directly;
  **choose one source of truth**: recommend **DB only**, Python reads Postgres,
  Next.js writes Prisma — single store)

**Recommended:** Single store in PostgreSQL; Python reads via SQLAlchemy;
Next.js writes via Prisma. Python PATCH optional (Next.js owns writes).

### 2.5 Audit logging

```typescript
await createAuditLog({
  action: "ingestion.settings.update",
  resourceType: "ingestion_settings",
  resourceId: key,
  details: { oldValue, newValue },
})
```

### 2.6 UI: editable fields

- Enable inputs for `applyMode: runtime`
- Save bar, dirty state, confirm modals for `confirmWhen`
- Toast on success / error

### 2.7 Migrate hot-path reads

Priority order:

1. `MRE_SCRAPE_ENABLED` (both services)
2. `MRE_RECENT_EVENTS_*` (cron script → Python CLI wrapper)
3. `INGESTION_QUEUE_*` (job_queue.py)
4. `TRACK_SYNC_METADATA_CONCURRENCY`
5. Practice day discovery env reads

Update `ingestion/scripts/run-recent-events-auto-ingest.sh` to invoke CLI that
reads DB settings instead of shell exports only.

### 2.8 Tests

- Integration: PATCH → effective value changes → audit row
- Integration: non-admin 403
- Unit: validation rejects out-of-range integer

**Acceptance:** Disable `MRE_SCRAPE_ENABLED` in UI → admin track sync button
shows scrape-disabled error without container restart.

---

## Phase 3 — Site policy editor + telemetry section

### 3.1 Site policy

- DB key `site_policy_overrides` (JSON)
- Python `SitePolicy` merge base file + overrides
- Next.js dynamic policy load (remove static import)
- UI: JSON editor with schema validation OR form per host

### 3.2 Telemetry

- Telemetry section in console (already in registry)
- Document worker restart in UI after poll interval change
- Optional: `POST` hook to signal worker (future)

---

## Phase 4 — Optional code constant env-ification

Move pipeline concurrency constants to registry as runtime keys:

- `INGESTION_RACE_FETCH_CONCURRENCY_INITIAL`
- etc.

Only if ops need tuning without deploy.

---

## File checklist (all phases)

### Next.js

```
src/core/admin/ingestion-settings-registry.ts
src/core/admin/ingestion-settings.ts
src/app/(authenticated)/admin/ingestion/settings/page.tsx
src/app/api/v1/admin/ingestion/settings/route.ts
src/components/organisms/admin/IngestionSettingsConsole.tsx
src/components/organisms/admin/IngestionSubNav.tsx          (optional)
src/__tests__/core/admin/ingestion-settings-registry.test.ts
src/__tests__/api/v1/admin/ingestion/settings.test.ts
```

### Python

```
ingestion/common/settings_registry.py
ingestion/common/settings.py
ingestion/api/routes/admin_settings.py
ingestion/db/models.py                                      (+ IngestionSetting if SQLAlchemy model needed)
ingestion/tests/unit/test_settings_registry_parity.py
ingestion/tests/unit/test_settings_resolver.py
ingestion/tests/unit/test_admin_settings_api.py
```

### Database

```
prisma/migrations/*_ingestion_settings/migration.sql
prisma/schema.prisma
```

### Docs (this commit)

Already created; update status to **In progress** when Phase 1 starts.

---

## Rollout

1. Deploy Phase 1 read-only (no behaviour change)
2. Deploy Phase 2 with feature flag `ADMIN_INGESTION_SETTINGS_WRITABLE=true`
3. Enable write in staging; verify audit + scrape kill switch
4. Production: enable write; document in runbook

---

## Out of scope reminders

- Container restart from UI
- `.env.docker` file editing
- Per-user settings
- Settings revision history / rollback UI (future)
