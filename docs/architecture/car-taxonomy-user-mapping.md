---
created: 2026-04-07
owner: Frontend / Platform
lastModified: 2026-04-07
description: Per-user global car taxonomy mapping for event analysis
purpose:
  Document the canonical vehicle-type tree, user mapping rules, APIs, resolution
  order, Session Analysis integration, migrations, and operational notes.
relatedFiles:
  - prisma/schema.prisma (CarTaxonomyNode, UserCarTaxonomyRule,
    CarTaxonomyMatchType)
  - prisma/migrations/20260409120000_car_taxonomy_user_rules/
  - prisma/migrations/20260410120000_car_taxonomy_canonical_v1/
  - src/core/car-taxonomy/
  - src/core/events/get-event-analysis-data.ts
  - src/core/events/session-analysis-filters.ts
  - src/app/api/v1/car-taxonomy/route.ts
  - src/app/api/v1/user/car-taxonomy-rules/route.ts
  - src/components/organisms/event-analysis/CarTaxonomyModal.tsx
---

# Car taxonomy and user car-type mapping

**Scope:** MRE lets each **authenticated user** define **global** rules that map
LiveRC-derived strings (class names, race titles, section headers, session
types, or class+title pairs) to **canonical vehicle classes** in a seeded
hierarchy. Rules are **per user**; they do not change shared ingestion data or
other users’ views.

## Why this exists

LiveRC (and other sources) do not expose a consistent “vehicle type” field.
Class names vary widely (`1/8 E. Buggy`, `Pro Nitro Buggy`, `1:10 2WD`,
`SC 4WD`). Ingestion may populate `Race.vehicleType` /
`EventRaceClass.vehicleType` when inference succeeds, but users still need a way
to align ambiguous labels to a **stable vocabulary** for Session Analysis chips
and filters.

## Data model

| Table                     | Purpose                                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `car_taxonomy_nodes`      | Canonical tree: **discipline** roots (Off-Road, On-Road, Oval, …), optional **group** nodes (e.g. 1/10, 1/8), and **leaf** nodes selectable in the UI. Only **leaves** may be assigned to rules (enforced in API). |
| `user_car_taxonomy_rules` | One row per user rule: `match_type`, `pattern_normalized`, `taxonomy_node_id` (FK to a leaf). Unique on `(user_id, match_type, pattern_normalized)`.                                                               |

**Enum `CarTaxonomyMatchType`:** `CLASS_AND_LABEL`, `CLASS_NAME`, `RACE_LABEL`,
`SECTION_HEADER`, `SESSION_TYPE`.

**Pattern normalization:** `pattern_normalized` is lowercase, trimmed, collapsed
whitespace. `CLASS_AND_LABEL` uses `normalize(className)||normalize(raceLabel)`.

## Canonical seed (v1)

Migration `20260410120000_car_taxonomy_canonical_v1` replaces the initial
12-node seed with a **~30-leaf** canonical set covering off-road (1/10, 1/8,
large scale), on-road (touring, GT12, pan, VTA, etc.), oval, and crawler.
Discipline rows use slugs such as `disc-off-road`, `disc-on-road`.

Earlier migration `20260409120000_car_taxonomy_user_rules` introduced the tables
and the first seed; the canonical migration renames legacy slugs, inserts the
new tree, **remaps** `user_car_taxonomy_rules` from old leaf IDs to new leaves
where semantics match, and deletes legacy nodes.

## Rule resolution order

For each race row, the server applies the first matching rule in this order:

1. `CLASS_AND_LABEL`
2. `CLASS_NAME`
3. `RACE_LABEL`
4. `SECTION_HEADER`
5. `SESSION_TYPE`

Implementation: `src/core/car-taxonomy/resolve.ts`
(`resolveUserCarTaxonomyForRace`).

## Event analysis payload

When the analysis API runs with an authenticated user id,
`getEventAnalysisData(eventId, userId)` loads all taxonomy nodes and the user’s
rules, then attaches optional `userCarTaxonomy` on each race:

- `taxonomyNodeId`, `slug`, `pathLabels`, `pathLabel`

Display uses the **leaf label** for `pathLabel` / `pathLabels` (single canonical
name), not a full breadcrumb.

Session Analysis chips use `effectiveSessionAnalysisScopeKey` in
`session-analysis-filters.ts`: **user taxonomy slug** when present, else
`className` chip behavior.

## HTTP API

| Method   | Path                                       | Role                                                                                                                         |
| -------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/v1/car-taxonomy`                     | Auth required. Returns `{ nodes }` for the picker.                                                                           |
| `GET`    | `/api/v1/user/car-taxonomy-rules`          | Lists the current user’s rules (includes `taxonomyNode`).                                                                    |
| `POST`   | `/api/v1/user/car-taxonomy-rules`          | Create rule. Body: `matchType`, `taxonomyNodeId`, and either `pattern` or (`className` + `raceLabel` for `CLASS_AND_LABEL`). |
| `PATCH`  | `/api/v1/user/car-taxonomy-rules/[ruleId]` | Change target leaf: `{ taxonomyNodeId }`.                                                                                    |
| `DELETE` | `/api/v1/user/car-taxonomy-rules/[ruleId]` | Remove rule.                                                                                                                 |

`GET /api/v1/events/[eventId]/analysis` includes merged `userCarTaxonomy` on
races when the session user is present.

## UI

- **Dashboard → Event Analysis:** **Actions** menu → **Map car types** opens
  `CarTaxonomyModal`: pick match type, source value(s) from the **current
  event** (dropdowns), choose a **leaf** vehicle class, save. **Suggestions**
  uses keyword overlap plus `suggestion-keywords.ts` hints for common
  LiveRC/Everlaps strings.

## Operational notes (Docker)

- After schema changes: `docker exec -it mre-app npx prisma migrate deploy`
- If the Prisma client is stale (missing `carTaxonomyNode` delegate):  
  `docker exec -it mre-app npx prisma generate` then
  `docker compose restart app`  
  The app entrypoint also checks generated client vs schema for
  `carTaxonomyNode`.
- Runtime guard: `src/core/car-taxonomy/prisma-delegates.ts` throws a clear
  error if delegates are missing.

## Related code

- **Core:** `src/core/car-taxonomy/` (normalize, resolve, repo, user-rules-crud,
  suggestions, prisma-delegates)
- **Analysis merge:** `src/core/events/get-event-analysis-data.ts`
- **Session filters:** `src/core/events/session-analysis-filters.ts`
- **Routes:** `src/app/api/v1/car-taxonomy/`,
  `src/app/api/v1/user/car-taxonomy-rules/`
