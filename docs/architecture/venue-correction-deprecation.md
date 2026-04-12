---
created: 2026-04-13
owner: Frontend / Platform
lastModified: 2026-04-13
description: Full deprecation of admin-moderated venue correction (all flows)
purpose:
  Record product and documentation policy: EventVenueCorrection and related
  APIs, UI, and call sites are deprecated end-to-end; replacement is per-user
  host track (see event-host-track-user-override.md).
relatedFiles:
  - docs/architecture/event-host-track-user-override.md
  - prisma/schema.prisma (EventVenueCorrection, EventVenueCorrectionRequest)
  - src/core/events/venue-correction.ts
  - src/app/api/v1/events/[eventId]/venue-correction/route.ts
  - src/app/api/v1/admin/venue-correction-requests/
  - src/app/(authenticated)/admin/venue-corrections/page.tsx
  - src/core/events/get-event-analysis-data.ts
  - src/core/weather/get-weather-for-event.ts
---

# Venue correction — full deprecation

## Policy

All **venue correction** flows introduced under **`EventVenueCorrection`** /
**`EventVenueCorrectionRequest`** are **deprecated in full**:

- User-facing **request** and **undo** flows
- **Admin** review, approve, and reject flows
- **HTTP APIs** under `/api/v1/events/[eventId]/venue-correction` and
  `/api/v1/admin/venue-correction-requests`
- **Admin UI** (e.g. venue corrections page and requests table)
- Any **server** use of **`getApprovedCorrection`** to override **effective
  venue**, **analysis payload**, or **weather** geocoding

**Do not** extend these features. **Do not** add new callers.\*\*

**Replacement:**
[Event host track (per-user override)](./event-host-track-user-override.md) —
**Update Host Track** in event analysis (catalogue pick, per user, per event).

## Rationale (short)

LiveRC’s event-linked `Track` often reflects **organiser / club office**
metadata, not the physical host facility. The old model tried to fix that with a
**single global** approved track per event and admin moderation. The product
direction is **per-user host track** from the synced catalogue, without admin
workflow or shared canonical override.

## Removal checklist (code)

Tracking item for implementation (not necessarily complete in this repo yet):

1. Remove or stop registering **API routes** for venue correction (user and
   admin).
2. Remove **admin page** and **VenueCorrectionRequestsTable** (and **AdminNav**
   link if present).
3. Remove **client** fetches and `fetchVenueCorrection` / success handlers from
   event analysis (e.g. dashboard shell).
4. Delete **`getApprovedCorrection`** usage from
   **`get-event-analysis-data.ts`** and **`get-weather-for-event.ts`**; use
   **`event.track`** only for geocoding/venue until host-track wiring is defined
   for weather (if ever).
5. Drop **`src/core/events/venue-correction.ts`** or reduce to stubs if needed
   during migration.
6. **Prisma migration** to drop `event_venue_corrections`,
   `event_venue_correction_requests`, and related enums when no longer
   referenced.

Until removal lands, **documentation** treats these as **deprecated**; **new**
work uses **host track** only.
