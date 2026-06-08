---
created: 2026-06-08
creator: Platform / API
lastModified: 2026-06-08
description:
  HTTP API contracts for admin ingestion settings (Next.js and Python)
purpose:
  Request/response shapes, auth, and error codes for implementers and
  integrators.
relatedDocs:
  - docs/architecture/admin-ingestion-settings-console.md
  - docs/architecture/liverc-ingestion/33-ingestion-settings-registry-and-runtime-config.md
  - docs/architecture/liverc-ingestion/05-api-contracts.md
  - docs/api/api-reference.md
---

# Admin Ingestion Settings API

**Status:** Implemented. **Base paths:**

- Next.js (admin browser): `/api/v1/admin/ingestion/settings`
- Python (internal S2S): `/api/v1/admin/settings`

---

## 1. Authentication

### 1.1 Next.js routes

- **Session:** NextAuth cookie
- **Authorization:** `session.user.isAdmin === true`
- **Errors:** `401 UNAUTHORIZED`, `403 FORBIDDEN`

Uses `requireAdmin()` from `src/lib/admin-auth.ts`.

### 1.2 Python routes

- **Header:** `X-Ingestion-Admin-Token: <INGESTION_ADMIN_TOKEN>`
- **Network:** Callable from `mre-app` on Docker internal network only
- **Errors:** `401` missing/invalid token

Next.js must **never** expose the token to the browser.

---

## 2. Next.js — GET /api/v1/admin/ingestion/settings

List all registered settings with effective values.

### Request

```http
GET /api/v1/admin/ingestion/settings HTTP/1.1
Cookie: next-auth.session-token=...
```

### Response 200

```json
{
  "success": true,
  "data": {
    "settings": [
      {
        "key": "MRE_SCRAPE_ENABLED",
        "label": "LiveRC scraping enabled",
        "description": "Global kill switch for all LiveRC HTTP requests.",
        "category": "scraping_safety",
        "type": "boolean",
        "applyMode": "runtime",
        "scope": "both",
        "writable": true,
        "effectiveValue": true,
        "source": "environment",
        "envValue": true,
        "dbValue": null,
        "defaultValue": true,
        "pendingRestart": false,
        "confirmWhen": "disable_scrape"
      }
    ],
    "categories": [{ "id": "scraping_safety", "label": "Scraping and safety" }]
  }
}
```

### Response fields

| Field            | Type                                     | Description                                 |
| ---------------- | ---------------------------------------- | ------------------------------------------- |
| `effectiveValue` | typed                                    | Value used at runtime                       |
| `source`         | `database` \| `environment` \| `default` | Winner of precedence                        |
| `envValue`       | typed \| null                            | Raw env if set                              |
| `dbValue`        | typed \| null                            | DB override if set                          |
| `writable`       | boolean                                  | UI may edit                                 |
| `pendingRestart` | boolean                                  | Env changed but restart not done (optional) |

Secrets (`DATABASE_URL`, `CLICKHOUSE_PASSWORD`): `effectiveValue` masked as
`postgresql://***` or `***`.

---

## 3. Next.js — PATCH /api/v1/admin/ingestion/settings

Update runtime-writable settings (Phase 2+).

### Request

```http
PATCH /api/v1/admin/ingestion/settings HTTP/1.1
Content-Type: application/json

{
  "updates": [
    { "key": "MRE_RECENT_EVENTS_DAYS", "value": 14 },
    { "key": "MRE_SCRAPE_ENABLED", "value": false }
  ],
  "confirmToken": "disable_scrape"
}
```

`confirmToken` required when any updated key has `confirmWhen` matching.

### Response 200

```json
{
  "success": true,
  "data": {
    "updated": ["MRE_RECENT_EVENTS_DAYS", "MRE_SCRAPE_ENABLED"],
    "settings": ["... full EffectiveSetting objects ..."]
  },
  "message": "Settings updated successfully"
}
```

### Errors

| Code                    | HTTP | When                                      |
| ----------------------- | ---- | ----------------------------------------- |
| `VALIDATION_ERROR`      | 400  | Unknown key, wrong type, out of range     |
| `CONFIRMATION_REQUIRED` | 400  | Missing confirmToken for dangerous change |
| `SETTING_READ_ONLY`     | 400  | Key applyMode restart/readonly            |
| `UNAUTHORIZED`          | 401  | No session                                |
| `FORBIDDEN`             | 403  | Not admin                                 |

Each successful key write creates `audit_logs` row `ingestion.settings.update`.

---

## 4. Next.js — POST /api/v1/admin/ingestion/settings/reload

Invalidate caches (Phase 2+). Optional if PATCH triggers reload automatically.

### Request

```http
POST /api/v1/admin/ingestion/settings/reload HTTP/1.1
```

### Response 200

```json
{
  "success": true,
  "data": { "reloadedAt": "2026-06-08T12:00:00.000Z" }
}
```

Proxies to Python reload endpoint.

---

## 5. Python — GET /api/v1/admin/settings

Internal; called by Next.js `core/admin/ingestion-settings.ts`.

### Request

```http
GET /api/v1/admin/settings HTTP/1.1
X-Ingestion-Admin-Token: <secret>
Host: liverc-ingestion-service:8000
```

### Response 200

Same shape as Next.js `settings` array (Python is source for ingestion-scoped
keys).

---

## 6. Python — PATCH /api/v1/admin/settings

Optional if Next.js owns all writes via Prisma. If implemented, same body as
Next.js PATCH.

Python validates against `settings_registry` before UPSERT.

---

## 7. Python — POST /api/v1/admin/settings/reload

Clears:

- `settings` module LRU/cache
- `SitePolicy.shared()` reload (Phase 3)

Response:

```json
{ "reloaded_at": "2026-06-08T12:00:00.000Z" }
```

---

## 8. Error envelope

Matches MRE standard (`src/lib/api-utils.ts`):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "MRE_RECENT_EVENTS_DAYS must be between 1 and 90",
    "details": { "field": "MRE_RECENT_EVENTS_DAYS", "min": 1, "max": 90 }
  }
}
```

---

## 9. OpenAPI / api-reference integration

When implemented, add section to `docs/api/api-reference.md` and regenerate
manifest:

```bash
docker exec mre-app npm run docs:api-routes
```

---

## 10. Related endpoints (existing)

| Endpoint                       | Purpose                                       |
| ------------------------------ | --------------------------------------------- |
| `POST /api/v1/admin/ingestion` | Trigger track sync / event ingest (unchanged) |
| `GET /api/v1/admin/audit`      | View settings change audit rows               |
| `GET /api/v1/admin/health`     | Ingestion service health                      |

Settings console does **not** replace ingestion trigger APIs.
