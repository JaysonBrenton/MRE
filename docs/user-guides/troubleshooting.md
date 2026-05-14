---
created: 2026-01-27
creator: Jayson Brenton
lastModified: 2026-05-13
description: Common failure modes aligned with Alpha v0.1.0 behaviours
purpose:
  Provides deterministic triage sequences for ingestion-backed dashboards, Redux
  quirks, fuzzy matching, telemetry gaps, admin console issues, etc.
relatedFiles:
  - src/components/organisms/dashboard/EventAnalysisSection.tsx
  - src/store/slices/searchSlice.ts
---

# Troubleshooting

Use this guide alongside engineering runbooks (`docs/operations/*`) when infra
is healthy but UX misleads operators.

Always capture **Footer build string** (Alpha · v0.1.0 at time of writing) when
escalating.

## Authentication

| Symptom                           | Steps                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `Invalid credentials` persists    | Caps lock / whitespace; confirm email not legacy username-only account. Reset still manual—ops must rotate Argon hashes. |
| Infinite login spinner            | Inspect network `/api/auth/*` + container logs (`mre-app`). Hard refresh clears stale CSRF bundles.                      |
| Auto-login skipped after register | Guided to `/login?registered=true`; sign in manually once.                                                               |

## Global Search (`/search`)

| Symptom                                | Detail                                                                                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| “Enter criteria…” persists             | You have not run a search yet, or the prior request errored—use the **Search** button after filling fields. Submitting the `<form>` via Enter in a single-line field also fires the same handler in most browsers. |
| `No results found` erroneously         | Broaden timeframe; confirm ingestion completed (events invisible until warehouses populated). Logs in Admin console list pending vs ingested tally.                                                                |
| Pagination stuck disabled              | Redux `totalPages` maths—clear filters (**Clear**) to reset page index to `1`.                                                                                                                                     |
| Rows load but View Event flashes blank | Rare race if event deleted concurrently—note UUID for DB audit.                                                                                                                                                    |

## My Event Analysis / ingestion

| Symptom                                    | Remediation sequence                                                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Stuck spinner “Loading event data…”        | Check connectivity; ensure ingestion container cron healthy (`mre-liverc-ingestion-service`). Retry **Refresh Event Data**.                    |
| `No analysis data available` after spinner | Inspect API `/api/v1/events/{eventId}` from browser devtools → 404/500 indicates dataset missing—not a UI regression.                          |
| Redux lost selection unexpectedly          | Clearing storage or browsing private mode resets persist—re-import/search again. Hard reload should not drop selection when persistor healthy. |
| Practice-day tabs vanished                 | Behavioural—you opened race dataset; Redux auto-snaps Overview when toggling ingest classification.                                            |

## Actions menu / ingestion shortcuts

Shortcuts depend on keyboard focus residing in SPA shell (Safari quirks exist).
Escape closes overlays if stuck phantom menu.

See [Navigation](navigation.md) for enumerated combos.

## Fuzzy linking / My Events

| Observation                      | Explanation                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Latch missing                    | Practice-day ingest hides affordance intentionally. Need race dataset active.                                                         |
| Empty message with known history | `/api/v1/personas/driver/events` responded empty — confirm driver personas + ingestion coverage. Potentially statuses all `rejected`. |
| Suggested spam                   | Tighten transponder fidelity or reject noise; ingestion cannot auto-learn yet.                                                        |

## Weather & external API panels

Panels degrade gracefully:

- Badge states distinguish cached snapshots vs fetched forecast.
- If Open-Meteo (or whichever provider wired) denies request, overlays show
  warning ribbons while lap charts stay usable elsewhere.

Retry later before assuming ingestion fault.

## Admin console-only

| Incident                | Guidance                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `/admin` 403 loops      | Confirm `isAdmin=true` persisted; rerun seed persona assignment CLI if mismatched DB row. |
| Ingest triggers timeout | Separate ops doc— escalate with scheduler IDs.                                            |

## Performance

Large programmes (four-digit lap counts) can stress client bundle—density
toggled to **Compact** (profile modal) reduces vertical scroll pressure.

Prefer Chrome/Edge evergreen for WASM chart paths.

### DevTools overlays

Screenshots bundled with Markdown may accidentally capture Next developer badges
(“issues” capsules). Toggle off overlays before customer-facing demos.

## Where to escalate

Include:

1. Build footer string (`Alpha · v0.1.0` today).
2. URL + breadcrumbs.
3. Event UUID if applicable (`Network` panel).
4. Whether Docker stack vs hosted env (per project policy everything dev-local
   is Dockerized).

Escalate to platform owners if ingestion container logs show repeated deadlock
patterns.

---

See also **[Getting Started](getting-started.md)** for baseline orientation.
