---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2026-04-14
description: Complete API reference documentation for all MRE API endpoints
purpose:
  Provides a comprehensive catalog of all API endpoints, including
  request/response formats, authentication requirements, error codes, and usage
  examples. This serves as the single source of truth for API consumers
  including frontend developers, mobile developers, and API integration
  partners.
relatedFiles:
  - docs/architecture/mobile-safe-architecture-guidelines.md (API standards)
  - docs/architecture/venue-correction-deprecation.md (venue correction APIs
    deprecated)
  - docs/architecture/car-taxonomy-user-mapping.md (car taxonomy APIs)
  - docs/architecture/liverc-ingestion/05-api-contracts.md (LiveRC ingestion
    APIs)
  - src/lib/api-utils.ts (response format utilities)
  - src/app/api/v1/ (API route implementations)
---

# API Reference Documentation

**Last Updated:** 2026-04-12 — Telemetry: session list/detail/map; worker ingest
for CSV, GPX, NMEA 0183, JSON (Garmin FIT is **not** supported — see
[`docs/telemetry/README.md`](../telemetry/README.md)). **2026-04-13:** Venue
correction endpoints are **deprecated** (see
[`docs/architecture/venue-correction-deprecation.md`](../architecture/venue-correction-deprecation.md));
replacement direction is per-user host track. **2026-04-07:** car taxonomy and
user car-taxonomy-rules endpoints; event analysis notes `userCarTaxonomy` on
races. Aligned with `src/app/api/**/route.ts` and
[`docs/reference/generated/api-routes.manifest.json`](../reference/generated/api-routes.manifest.json):
documented event entry list, laps, lap trend, track leaderboard, leaderboards,
practice day discover-range, ingestion job status, track maps. Removed obsolete
`/api/v1/tracks/[trackId]/performance-trends` (no route implementation).  
**API Version:** v1  
**Base URL:** `/api/v1/` (relative to application root)

This document provides a complete reference for all API endpoints in the My Race
Engineer (MRE) application. All endpoints follow the mobile-safe architecture
guidelines and use standardized request/response formats.

---

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication Endpoints](#authentication-endpoints)
3. [LiveRC Ingestion Endpoints](#liverc-ingestion-endpoints)
4. [Driver Endpoints](#driver-endpoints)
5. [Transponder Override Endpoints](#transponder-override-endpoints)
6. [Weather Endpoints](#weather-endpoints)
7. [Personas Endpoints](#personas-endpoints)
8. [Practice Days Endpoints](#practice-days-endpoints)
9. [Search Endpoints](#search-endpoints)
10. [Car Profiles Endpoints](#car-profiles-endpoints)
11. [Driver Profiles Endpoints](#driver-profiles-endpoints)
12. [User Endpoints](#user-endpoints)
13. [Admin Endpoints](#admin-endpoints)
14. [Leaderboard Endpoints](#leaderboard-endpoints)
15. [Track Maps Endpoints](#track-maps-endpoints)
16. [Ingestion Job Status](#ingestion-job-status)
17. [Telemetry (stage 1)](#telemetry-stage-1)
18. [Health Check](#health-check)
19. [Error Handling](#error-handling)
20. [Authentication Requirements](#authentication-requirements)
21. [Rate Limiting](#rate-limiting)

---

## API Overview

### Base Path

All API endpoints are prefixed with `/api/v1/`, including the health check
endpoint at `/api/v1/health`. The only exception is the NextAuth framework route
at `/api/auth/[...nextauth]`.

### Response Format

All API responses follow a standardized format defined in
`docs/architecture/mobile-safe-architecture-guidelines.md`:

**Success Response:**

```json
{
  "success": true,
  "data": {
    /* response data */
  },
  "message": "Optional success message"
}
```

**Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      /* optional error details */
    }
  }
}
```

### Content Type

All endpoints accept and return `application/json`.

---

## Authentication Endpoints

### POST /api/v1/auth/register

Registers a new user account.

**Authentication:** Not required

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "driverName": "John Doe",
  "teamName": "Team Alpha" // optional
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "driverName": "John Doe",
      "teamName": "Team Alpha",
      "isAdmin": false,
      "createdAt": "2025-01-27T00:00:00.000Z",
      "updatedAt": "2025-01-27T00:00:00.000Z"
    }
  },
  "message": "Registration successful"
}
```

**Error Codes:**

- `EMAIL_ALREADY_EXISTS` (409) - Email is already registered
- `VALIDATION_ERROR` (400) - Invalid input data
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests (10 per hour)
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123",
    "driverName": "John Doe",
    "teamName": "Team Alpha"
  }'
```

---

### POST /api/v1/auth/login

Authenticates a user and creates a session.

**Authentication:** Not required

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "userPassword123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "driverName": "John Doe",
      "teamName": "Team Alpha",
      "isAdmin": false
    }
  },
  "message": "Login successful"
}
```

**Error Codes:**

- `INVALID_CREDENTIALS` (401) - Invalid email or password
- `VALIDATION_ERROR` (400) - Missing required fields
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests (5 per 15 minutes)
- `INTERNAL_ERROR` (500) - Server error

**Note:** This endpoint returns user data but session management is handled by
NextAuth. For web clients, cookies are set automatically. Future mobile clients
will receive tokens.

**Example:**

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "userPassword123"
  }'
```

---

## LiveRC Ingestion Endpoints

### GET /api/v1/tracks

Returns the list of known tracks from the database.

**Authentication:** Required

**Query Parameters:**

- `followed` (boolean, optional, default: `true`) - If true, return only tracks
  where `is_followed = true` AND `is_active = true`
- `active` (boolean, optional, default: `true`) - If false, include inactive
  tracks

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "tracks": [
      {
        "id": "uuid",
        "source": "liverc",
        "source_track_slug": "track-slug",
        "track_name": "Track Name",
        "track_url": "https://liverc.com/track/...",
        "events_url": "https://liverc.com/track/.../events",
        "liverc_track_last_updated": "2025-01-27",
        "last_seen_at": "2025-01-27T00:00:00.000Z",
        "is_active": true,
        "is_followed": true,
        "created_at": "2025-01-27T00:00:00.000Z",
        "updated_at": "2025-01-27T00:00:00.000Z"
      }
    ]
  }
}
```

**Error Codes:**

- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl "http://localhost:3001/api/v1/tracks?followed=true&active=true"
```

---

### GET /api/v1/events/search

Searches for events by track and optional date range.

**Authentication:** Required

**Query Parameters:**

- `track_id` (string, required) - Track UUID
- `start_date` (string, optional) - Start date in ISO 8601 format (YYYY-MM-DD).
  When provided with `end_date`, both must be valid, start ≤ end, no future
  dates, and the range must not exceed 12 months (366 days).
- `end_date` (string, optional) - End date in ISO 8601 format (YYYY-MM-DD). See
  `start_date` for validation rules when both are provided.

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "track": {
      "id": "uuid",
      "source": "liverc",
      "source_track_slug": "track-slug",
      "track_name": "Track Name"
    },
    "events": [
      {
        "id": "uuid",
        "source": "liverc",
        "source_event_id": "event-id",
        "event_name": "Event Name",
        "event_date": "2025-01-27T00:00:00.000Z",
        "event_entries": 50,
        "event_drivers": 45,
        "event_url": "https://liverc.com/event/...",
        "ingest_depth": "none",
        "last_ingested_at": null
      }
    ]
  }
}
```

**Error Codes:**

- `VALIDATION_ERROR` (400) - Missing or invalid query parameters (e.g. invalid
  `track_id`, missing `end_date` when `start_date` is set, date range &gt; 12
  months, or future dates).
- `NOT_FOUND` (404) - Track not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl "http://localhost:3001/api/v1/events/search?track_id=uuid&start_date=2025-01-01&end_date=2025-12-31"
```

---

### GET /api/v1/events/[eventId]

Gets detailed information about a specific event.

**Authentication:** Required

**Path Parameters:**

- `eventId` (string, required) - Event UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "source": "liverc",
    "source_event_id": "event-id",
    "track_id": "uuid",
    "event_name": "Event Name",
    "event_date": "2025-01-27T00:00:00.000Z",
    "event_entries": 50,
    "event_drivers": 45,
    "event_url": "https://liverc.com/event/...",
    "ingest_depth": "laps_full",
    "last_ingested_at": "2025-01-27T00:00:00.000Z",
    "races": [
      {
        "id": "uuid",
        "event_id": "uuid",
        "class_name": "1.8 Nitro Buggy",
        "race_label": "A-Main",
        "race_order": 1,
        "start_time": "2025-01-27T10:00:00.000Z",
        "duration_seconds": 3600
      }
    ]
  }
}
```

**Error Codes:**

- `NOT_FOUND` (404) - Event not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl "http://localhost:3001/api/v1/events/uuid"
```

---

### POST /api/v1/events/discover

Discovers events from LiveRC for a track and date range. This endpoint compares
LiveRC events with existing database events and returns which events are new vs
already in the database.

**Authentication:** Required

**Request Body:**

```json
{
  "track_id": "uuid", // required - Track UUID
  "start_date": "2025-01-01", // optional - ISO date string
  "end_date": "2025-12-31" // optional - ISO date string
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "new_events": [
      {
        "id": undefined,
        "sourceEventId": "6304829",
        "eventName": "Event Name",
        "eventDate": "2025-11-16T08:30:00Z",
        "eventEntries": 114,
        "eventDrivers": 87,
        "eventUrl": "https://track.liverc.com/results/?p=view_event&id=6304829"
      }
    ],
    "existing_events": [
      {
        "id": "uuid",
        "sourceEventId": "6304830",
        "eventName": "Existing Event",
        "eventDate": "2025-11-17T08:30:00Z",
        "eventEntries": 100,
        "eventDrivers": 80,
        "eventUrl": "https://track.liverc.com/results/?p=view_event&id=6304830"
      }
    ]
  }
}
```

**Notes:**

- This is a read-only operation - it does not sync events into the database
- Uses LiveRC to discover events
- Compares with existing database events using `sourceEventId` as the join key
- `new_events` are events found on LiveRC but not yet in the database
- `existing_events` are events present in both LiveRC and the database

**Error Codes:**

- `VALIDATION_ERROR` (400) - Missing or invalid request body
- `NOT_FOUND` (404) - Track not found
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests (20 per minute)
- `EXTERNAL_SERVICE_ERROR` (502) - LiveRC ingestion service error
- `SERVICE_UNAVAILABLE` (503) - LiveRC ingestion service unavailable (connection
  error)
- `SERVICE_TIMEOUT` (504) - LiveRC ingestion service timeout
- `INTERNAL_ERROR` (500) - Server error

**Error Response Details:** When an external service error occurs, the error
response includes additional details:

```json
{
  "success": false,
  "error": {
    "code": "EXTERNAL_SERVICE_ERROR",
    "message": "LiveRC service error",
    "details": {
      "originalMessage": "Discovery failed: Internal server error during discovery",
      "errorName": "Error",
      "source": "ingestion_service",
      "code": "INGESTION_ERROR"
    }
  }
}
```

**Example:**

```bash
curl -X POST "http://localhost:3001/api/v1/events/discover" \
  -H "Content-Type: application/json" \
  -d '{"track_id": "uuid", "start_date": "2025-01-01", "end_date": "2025-12-31"}'
```

---

### POST /api/v1/events/ingest

Ingests a newly discovered LiveRC event by `source_event_id` and `track_id`.
This endpoint creates the Event row if it doesn't exist, then proceeds with full
ingestion.

**Authentication:** Required

**Request Body:**

```json
{
  "source_event_id": "6304829", // required - LiveRC event ID
  "track_id": "uuid", // required - Track UUID
  "depth": "laps_full" // optional, default: "laps_full"
}
```

**Valid `depth` values:**

- `none` - Event metadata only (discovery/browsing)
- `laps_full` - Complete data including races, results, and all lap times
  (default)

**V1 Note**: In V1, "Import Event" always means `laps_full` ingestion. The
`none` depth is used for event discovery, but users always get complete data
when importing an event.

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "event_id": "uuid",
    "ingest_depth": "laps_full",
    "last_ingested_at": "2025-11-17T02:20:00Z",
    "races_ingested": 12,
    "results_ingested": 120,
    "laps_ingested": 2400,
    "status": "updated"
  }
}
```

**Notes:**

- Used for importing newly discovered LiveRC events where no Event row exists
  yet
- The pipeline fetches full event metadata from LiveRC and creates the Event row
  if needed
- Idempotent - repeated calls with the same `source_event_id` and `track_id`
  converge on a single Event row

**Error Codes:**

- `VALIDATION_ERROR` (400) - Missing or invalid request body
- `NOT_FOUND` (404) - Track not found
- `INGESTION_IN_PROGRESS` (409) - Ingestion already running for this event
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests (10 per minute)
- `INGESTION_FAILED` (500) - Ingestion failed
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X POST "http://localhost:3001/api/v1/events/ingest" \
  -H "Content-Type: application/json" \
  -d '{"source_event_id": "6304829", "track_id": "uuid", "depth": "laps_full"}'
```

---

### POST /api/v1/events/[eventId]/ingest

Triggers on-demand ingestion of an existing event by event ID.

**Authentication:** Required

**Path Parameters:**

- `eventId` (string, required) - Event UUID

**Request Body:**

```json
{
  "depth": "laps_full" // optional, default: "laps_full"
}
```

**Valid `depth` values:**

- `none` - Event metadata only (discovery/browsing)
- `laps_full` - Complete data including races, results, and all lap times
  (default)

**V1 Note**: In V1, "Import Event" always means `laps_full` ingestion. The
`none` depth is used for event discovery, but users always get complete data
when importing an event.

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "event_id": "uuid",
    "ingest_depth": "laps_full",
    "last_ingested_at": "2025-11-17T02:20:00Z",
    "races_ingested": 12,
    "results_ingested": 120,
    "laps_ingested": 2400,
    "status": "updated"
  }
}
```

**Error Codes:**

- `NOT_FOUND` (404) - Event not found
- `INGESTION_IN_PROGRESS` (409) - Ingestion already running for this event
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests (10 per minute)
- `INGESTION_FAILED` (500) - Ingestion process failed
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X POST http://localhost:3001/api/v1/events/uuid/ingest \
  -H "Content-Type: application/json" \
  -d '{"depth": "laps_full"}'
```

**Note:** This endpoint proxies requests to the Python ingestion service. See
`docs/architecture/liverc-ingestion/05-api-contracts.md` for detailed ingestion
API documentation.

---

### GET /api/v1/races/[raceId]

Gets detailed race results for a specific race.

**Authentication:** Required

**Path Parameters:**

- `raceId` (string, required) - Race UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "race": {
      "id": "uuid",
      "event_id": "uuid",
      "class_name": "1.8 Nitro Buggy",
      "race_label": "A-Main",
      "race_order": 1,
      "start_time": "2025-01-27T10:00:00.000Z",
      "duration_seconds": 3600
    },
    "results": [
      {
        "race_result_id": "uuid",
        "position_final": 1,
        "laps_completed": 50,
        "total_time_seconds": 3600.5,
        "fast_lap_time": 70.2,
        "avg_lap_time": 72.0,
        "consistency": 92.5,
        "driver": {
          "race_driver_id": "uuid",
          "display_name": "Driver Name",
          "source_driver_id": "driver-id",
          "transponder_number": "12345",
          "transponder_source": "entry_list"
        }
      }
    ]
  }
}
```

**Response Fields:**

- `transponder_number` (string | null) - Transponder number for the driver in
  this race
- `transponder_source` (string | null) - Source of the transponder number:
  `"entry_list"`, `"override"`, `"driver"`, or `null`

**Error Codes:**

- `NOT_FOUND` (404) - Race not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl "http://localhost:3001/api/v1/races/uuid"
```

---

### GET /api/v1/races/[raceId]/laps

Gets lap data for all drivers in a race.

**Authentication:** Required

**Path Parameters:**

- `raceId` (string, required) - Race UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "race_id": "uuid",
    "series": [
      {
        "race_result_id": "uuid",
        "driver": {
          "race_driver_id": "uuid",
          "display_name": "Driver Name",
          "source_driver_id": "driver-id"
        },
        "laps": [
          {
            "lap_number": 1,
            "lap_time_seconds": 70.5,
            "elapsed_race_time": 70.5
          }
        ]
      }
    ]
  }
}
```

**Error Codes:**

- `NOT_FOUND` (404) - Race not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl "http://localhost:3001/api/v1/races/uuid/laps"
```

---

### GET /api/v1/race-results/[raceResultId]/laps

Gets detailed lap data for a specific race result.

**Authentication:** Required

**Path Parameters:**

- `raceResultId` (string, required) - Race Result UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "race_result_id": "uuid",
    "laps": [
      {
        "lap_number": 1,
        "position_on_lap": 1,
        "lap_time_seconds": 70.5,
        "lap_time_raw": "1:10.500",
        "pace_string": "+0.0s",
        "elapsed_race_time": 70.5,
        "segments_json": {
          "sector1": 25.2,
          "sector2": 30.1,
          "sector3": 15.2
        }
      }
    ]
  }
}
```

**Error Codes:**

- `NOT_FOUND` (404) - Race result not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl "http://localhost:3001/api/v1/race-results/uuid/laps"
```

---

### GET /api/v1/events

Gets a list of events with filtering, sorting, and pagination. By default,
returns only fully imported events (events with `ingest_depth` = `laps_full`),
but can be configured to return all events.

**Authentication:** Required

**Query Parameters:**

- `limit` (number, optional, default: `20`, max: `100`) - Maximum number of
  events to return
- `offset` (number, optional, default: `0`) - Number of events to skip for
  pagination
- `trackId` (string, optional) - Filter by track UUID
- `startDate` (string, optional) - Filter by start date (ISO 8601 format)
- `endDate` (string, optional) - Filter by end date (ISO 8601 format)
- `status` (string, optional, default: `imported`) - Filter by status:
  `imported` (only fully imported events) or `all` (all events regardless of
  ingestion status)
- `orderBy` (string, optional, default: `eventDate`) - Field to sort by:
  `eventDate`, `eventName`, `trackName`, `eventEntries`, `eventDrivers`
- `orderDirection` (string, optional, default: `desc`) - Sort direction: `asc`
  or `desc`
- `filter` (string, optional) - Special filter: `my` to filter to events where
  the user has linked drivers

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "uuid",
        "source": "liverc",
        "source_event_id": "event-id",
        "track_id": "uuid",
        "event_name": "Event Name",
        "event_date": "2025-01-27T00:00:00.000Z",
        "event_entries": 50,
        "event_drivers": 45,
        "event_url": "https://liverc.com/event/...",
        "ingest_depth": "laps_full",
        "last_ingested_at": "2025-01-27T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 245,
      "limit": 20,
      "offset": 0
    }
  }
}
```

**Notes:**

- Response is cached for 30 minutes (1800 seconds)
- Default status filter is `imported` (only events with `ingest_depth` =
  `laps_full`)
- Use `status=all` to include events with any ingestion status
- Use `filter=my` to filter to events where the authenticated user has linked
  drivers
- Pagination uses limit/offset pattern, not page/pageSize

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
# Get first page of imported events
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/events?limit=20&offset=0"

# Get events for a specific track, sorted by name
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/events?trackId=uuid&orderBy=eventName&orderDirection=asc"

# Get user's events only
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/events?filter=my"
```

---

### GET /api/v1/events/[eventId]/analysis

Gets analysis data for a specific event including summary statistics.

**Authentication:** Required

**Path Parameters:**

- `eventId` (string, required) - Event UUID

**User-specific car taxonomy:** For the authenticated user, each item in
`data.races` may include optional `userCarTaxonomy` (`taxonomyNodeId`, `slug`,
`pathLabel`, `pathLabels`) when global user rules match that race’s class name,
race label, section header, or session type. See
[Car taxonomy and user car-type mapping](../architecture/car-taxonomy-user-mapping.md).

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "event": {
      "id": "uuid",
      "eventName": "Event Name",
      "eventDate": "2025-01-27T00:00:00.000Z",
      "trackName": "Track Name"
    },
    "summary": {
      "totalRaces": 12,
      "totalDrivers": 87,
      "totalLaps": 2400,
      "dateRange": {
        "earliest": "2025-01-27T10:00:00.000Z",
        "latest": "2025-01-27T18:00:00.000Z"
      }
    }
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `NOT_FOUND` (404) - Event not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/events/uuid/analysis"
```

---

### GET /api/v1/car-taxonomy

Returns the full **canonical car taxonomy** tree (`car_taxonomy_nodes`) for
building the vehicle-class picker. Authentication required.

**Response (200 OK):** `{ "success": true, "data": { "nodes": [ ... ] } }`

**Cache-Control:** `public, max-age=3600` (reference data).

**Related:**
[Car taxonomy and user car-type mapping](../architecture/car-taxonomy-user-mapping.md).

---

### GET /api/v1/user/car-taxonomy-rules

Lists the authenticated user’s **global** car mapping rules (includes nested
`taxonomyNode`).

**Authentication:** Required

**Response (200 OK):** `{ "success": true, "data": { "rules": [ ... ] } }`

**Cache-Control:** `no-store`

---

### POST /api/v1/user/car-taxonomy-rules

Creates a rule. Target must be a **leaf** taxonomy node.

**Authentication:** Required

**Body (examples):**

- `CLASS_NAME` / `RACE_LABEL` / `SECTION_HEADER` / `SESSION_TYPE`:
  `{ "matchType", "pattern", "taxonomyNodeId" }`
- `CLASS_AND_LABEL`:
  `{ "matchType": "CLASS_AND_LABEL", "className", "raceLabel", "taxonomyNodeId" }`

**Errors:** `409 CONFLICT` if a rule already exists for the same match key;
`400` if the target is not a leaf.

---

### PATCH /api/v1/user/car-taxonomy-rules/[ruleId]

Updates the target leaf: `{ "taxonomyNodeId" }`.

**Authentication:** Required

---

### DELETE /api/v1/user/car-taxonomy-rules/[ruleId]

Deletes a rule.

**Authentication:** Required

---

### GET /api/v1/events/[eventId]/entry-list

Returns the LiveRC entry list for an event by calling the ingestion service.
Requires the event to be resolvable to a LiveRC track slug and source event id
(from the database or parsed from `eventUrl`).

**Authentication:** Required

**Path Parameters:**

- `eventId` (string, required) - Event UUID

**Response (200 OK):** Success envelope whose `data` shape matches the ingestion
service entry-list payload (see implementation in
`src/app/api/v1/events/[eventId]/entry-list/route.ts`).

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `NOT_FOUND` (404) - Event not found or not a LiveRC event
- `INGESTION_ERROR` / upstream errors when the ingestion service fails

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/events/uuid/entry-list"
```

---

### GET /api/v1/events/[eventId]/laps

Returns lap data for an event, optionally filtered by class. Used for session /
lap tables.

**Authentication:** Not required (public event timing data; same policy as lap
trend route).

**Path Parameters:**

- `eventId` (string, required) - Event UUID

**Query Parameters:**

- `className` (string, optional) - Filter by race class name

**Response (200 OK):** `{ "success": true, "data": ... }` with lap groupings per
`src/core/events/get-lap-data.ts`.

**Error Codes:**

- `EVENT_NOT_FOUND` (404) - Event not found

**Example:**

```bash
curl "http://localhost:3001/api/v1/events/uuid/laps?className=1.8%20Nitro%20Buggy"
```

---

### GET /api/v1/events/[eventId]/lap-trend

Returns lap-by-lap times for selected drivers (for trend charts). Query:
`driverIds` (comma-separated driver UUIDs), optional `className`.

**Authentication:** Not required

**Path Parameters:**

- `eventId` (string, required) - Event UUID

**Query Parameters:**

- `driverIds` (string, optional) - Comma-separated list of driver UUIDs
- `className` (string, optional) - Filter by class

**Example:**

```bash
curl "http://localhost:3001/api/v1/events/uuid/lap-trend?driverIds=id1,id2"
```

---

### GET /api/v1/events/[eventId]/track-leaderboard

Returns aggregate main-race points leaderboard for the **track** of the given
event (the event id selects the track). Supports date-range presets and class
filters via query parameters (see
`src/app/api/v1/events/[eventId]/track-leaderboard/route.ts`).

**Authentication:** Required

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/events/uuid/track-leaderboard"
```

---

### GET /api/v1/events/[eventId]/venue-correction

> **Deprecated.** Full venue correction is deprecated; do not integrate new
> clients. See
> [`docs/architecture/venue-correction-deprecation.md`](../architecture/venue-correction-deprecation.md).
> Replacement: per-user **host track**
> ([`event-host-track-user-override.md`](../architecture/event-host-track-user-override.md)).

Gets approved venue correction (if any) and the current user’s pending request
for this event, plus whether the user may submit.

**Authentication:** Required

---

### POST /api/v1/events/[eventId]/venue-correction

> **Deprecated.** See GET note above.

Submits a venue correction request for admin review.

**Authentication:** Required

**Request Body:**

```json
{
  "venueTrackId": "uuid-or-null"
}
```

---

### DELETE /api/v1/events/[eventId]/venue-correction

> **Deprecated.** See GET note above.

Deletes the current user’s **pending** venue correction request for this event.

**Authentication:** Required

---

### GET /api/v1/events/[eventId]/race-classes/[className]/vehicle-type

Gets the vehicle type for a specific race class in an event.

**Authentication:** Required

**Path Parameters:**

- `eventId` (string, required) - Event UUID
- `className` (string, required) - Race class name (URL-encoded)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "vehicleType": "1/8 Nitro Buggy",
    "needsReview": true,
    "reviewedAt": null,
    "reviewedBy": null
  }
}
```

**Response (200 OK) - No vehicle type set:**

```json
{
  "success": true,
  "data": null
}
```

**Response Fields:**

- `vehicleType` (string | null) - Vehicle type for the race class, or null if
  not set
- `needsReview` (boolean) - Whether the vehicle type needs review
- `reviewedAt` (string | null) - ISO 8601 timestamp when vehicle type was
  reviewed
- `reviewedBy` (string | null) - User ID who reviewed the vehicle type

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Missing eventId or className
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/events/uuid/race-classes/1.8%20Nitro%20Buggy/vehicle-type"
```

---

### PUT /api/v1/events/[eventId]/race-classes/[className]/vehicle-type

Updates the vehicle type for a specific race class in an event. Used for vehicle
type review and editing functionality.

**Authentication:** Required

**Path Parameters:**

- `eventId` (string, required) - Event UUID
- `className` (string, required) - Race class name (URL-encoded)

**Request Body:**

```json
{
  "vehicleType": "1/8 Nitro Buggy", // required - Vehicle type (use "Unknown" to set to null)
  "acceptInference": false // optional - Whether to accept inferred vehicle type (default: false)
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "vehicleType": "1/8 Nitro Buggy",
    "needsReview": false,
    "reviewedAt": "2025-01-27T10:00:00.000Z",
    "reviewedBy": "uuid"
  }
}
```

**Response Fields:**

- `vehicleType` (string | null) - Updated vehicle type for the race class
- `needsReview` (boolean) - Whether the vehicle type still needs review (false
  after manual update)
- `reviewedAt` (string) - ISO 8601 timestamp when vehicle type was reviewed
- `reviewedBy` (string) - User ID who reviewed/updated the vehicle type

**Notes:**

- Setting `vehicleType` to `"Unknown"` will set it to `null`
- Setting `acceptInference` to `true` accepts an inferred vehicle type without
  marking it as manually reviewed
- Manual updates (without `acceptInference`) mark the vehicle type as reviewed

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Missing eventId, className, or vehicleType
- `NOT_FOUND` (404) - Event or race class not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X PUT "http://localhost:3001/api/v1/events/uuid/race-classes/1.8%20Nitro%20Buggy/vehicle-type" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"vehicleType": "1/8 Nitro Buggy"}'
```

---

### GET /api/v1/events/[eventId]/summary

Gets lightweight event summary data including metadata and aggregated
statistics. This endpoint is optimized for performance and does not load the
full event graph, making it faster than the analysis endpoint.

**Authentication:** Required

**Path Parameters:**

- `eventId` (string, required) - Event UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "event": {
      "id": "uuid",
      "eventName": "Event Name",
      "eventDate": "2025-01-27T00:00:00.000Z",
      "trackName": "Track Name"
    },
    "summary": {
      "totalRaces": 12,
      "totalDrivers": 87,
      "totalLaps": 2400,
      "dateRange": {
        "earliest": "2025-01-27T10:00:00.000Z",
        "latest": "2025-01-27T18:00:00.000Z"
      }
    },
    "topDrivers": [],
    "mostConsistentDrivers": [],
    "bestAvgLapDrivers": [],
    "userBestLap": null,
    "userBestConsistency": null,
    "userBestAvgLap": null
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `NOT_FOUND` (404) - Event not found
- `INTERNAL_ERROR` (500) - Server error

**Notes:**

- Response is cached for 1 hour (3600 seconds)
- Uses database aggregations for better performance compared to the analysis
  endpoint
- Includes user-specific stats if the user has linked drivers

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/events/uuid/summary"
```

---

### POST /api/v1/events/check-entry-lists

Checks if a driver name appears in entry lists for LiveRC events. This endpoint
processes both LiveRC events (not yet in database) and database events to
determine driver participation.

**Authentication:** Required

**Request Body:**

```json
{
  "events": [
    {
      "source_event_id": "6304829"
    },
    {
      "event_id": "uuid"
    }
  ],
  "track_slug": "track-slug"
}
```

**Request Fields:**

- `events` (array, required) - Array of events to check. Each event must have
  either:
  - `source_event_id` (string) - For LiveRC events not yet in database (requires
    `track_slug`)
  - `event_id` (string) - For events already in database
- `track_slug` (string, required if any event has `source_event_id`) - Track
  slug for LiveRC events

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "driver_in_events": {
      "6304829": true,
      "uuid": false
    },
    "errors": {}
  }
}
```

**Response Fields:**

- `driver_in_events` (object) - Map of event IDs to boolean indicating if driver
  name was found
- `errors` (object) - Map of event IDs to error messages for events that failed
  to check

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Missing or invalid request body
- `INTERNAL_ERROR` (500) - Server error

**Notes:**

- Uses the driver name from the authenticated user's session
- Has a 5-minute timeout to prevent long-running requests
- Processes events in parallel where possible

**Example:**

```bash
curl -X POST "http://localhost:3001/api/v1/events/check-entry-lists" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "events": [
      {"source_event_id": "6304829"},
      {"event_id": "uuid"}
    ],
    "track_slug": "track-slug"
  }'
```

---

### GET /api/v1/drivers/[driverId]

Gets detailed information about a specific driver including transponder numbers
and event entries.

**Authentication:** Required

**Path Parameters:**

- `driverId` (string, required) - Driver UUID

**Query Parameters:**

- `eventId` (string, optional) - Filter event entries to a specific event

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "display_name": "Driver Name",
    "source_driver_id": "driver-id",
    "transponder_number": "12345",
    "event_entries": [
      {
        "event_id": "uuid",
        "event_name": "Event Name",
        "class_name": "1.8 Nitro Buggy",
        "transponder_number": "12345",
        "car_number": "5",
        "override": {
          "transponder_number": "67890",
          "effective_from_race_id": "uuid",
          "effective_from_race_label": "A-Main (Race 1)",
          "created_at": "2025-01-27T00:00:00.000Z"
        }
      }
    ]
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `NOT_FOUND` (404) - Driver not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/drivers/uuid?eventId=uuid"
```

---

### POST /api/v1/transponder-overrides

Creates a new transponder override for a driver in an event.

**Authentication:** Required

**Request Body:**

```json
{
  "eventId": "uuid", // required - Event UUID
  "driverId": "uuid", // required - Driver UUID
  "transponderNumber": "12345", // required - Transponder number
  "effectiveFromRaceId": "uuid" // optional - Race ID where override takes effect (null = from first race)
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "event_id": "uuid",
    "driver_id": "uuid",
    "effective_from_race_id": "uuid",
    "transponder_number": "12345",
    "created_at": "2025-01-27T00:00:00.000Z",
    "updated_at": "2025-01-27T00:00:00.000Z",
    "created_by": "uuid"
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Missing required fields or invalid transponder
  number
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X POST "http://localhost:3001/api/v1/transponder-overrides" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "eventId": "uuid",
    "driverId": "uuid",
    "transponderNumber": "12345"
  }'
```

---

### GET /api/v1/transponder-overrides

Lists transponder overrides, optionally filtered by event or driver.

**Authentication:** Required

**Query Parameters:**

- `eventId` (string, optional) - Filter by event UUID
- `driverId` (string, optional) - Filter by driver UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "overrides": [
      {
        "id": "uuid",
        "event_id": "uuid",
        "driver_id": "uuid",
        "effective_from_race_id": "uuid",
        "effective_from_race_label": "A-Main (Race 1)",
        "transponder_number": "12345",
        "created_at": "2025-01-27T00:00:00.000Z",
        "updated_at": "2025-01-27T00:00:00.000Z",
        "created_by": "uuid"
      }
    ]
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/transponder-overrides?eventId=uuid"
```

---

### GET /api/v1/transponder-overrides/[overrideId]

Gets a specific transponder override by ID.

**Authentication:** Required

**Path Parameters:**

- `overrideId` (string, required) - Transponder override UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "event_id": "uuid",
    "driver_id": "uuid",
    "effective_from_race_id": "uuid",
    "effective_from_race_label": "A-Main (Race 1)",
    "transponder_number": "12345",
    "created_at": "2025-01-27T00:00:00.000Z",
    "updated_at": "2025-01-27T00:00:00.000Z",
    "created_by": "uuid"
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `NOT_FOUND` (404) - Transponder override not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/transponder-overrides/uuid"
```

---

### PATCH /api/v1/transponder-overrides/[overrideId]

Updates a transponder override.

**Authentication:** Required

**Path Parameters:**

- `overrideId` (string, required) - Transponder override UUID

**Request Body:**

```json
{
  "transponderNumber": "67890", // optional - New transponder number
  "effectiveFromRaceId": "uuid" // optional - New effective race ID (null = from first race)
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "event_id": "uuid",
    "driver_id": "uuid",
    "effective_from_race_id": "uuid",
    "transponder_number": "67890",
    "created_at": "2025-01-27T00:00:00.000Z",
    "updated_at": "2025-01-27T00:00:00.000Z",
    "created_by": "uuid"
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Invalid transponder number or already in use
- `NOT_FOUND` (404) - Transponder override not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X PATCH "http://localhost:3001/api/v1/transponder-overrides/uuid" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "transponderNumber": "67890"
  }'
```

---

### DELETE /api/v1/transponder-overrides/[overrideId]

Deletes a transponder override.

**Authentication:** Required

**Path Parameters:**

- `overrideId` (string, required) - Transponder override UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "message": "Transponder override deleted successfully"
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `NOT_FOUND` (404) - Transponder override not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X DELETE -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/transponder-overrides/uuid"
```

---

## Weather Endpoints

### GET /api/v1/events/[eventId]/weather

Retrieves weather data for a specific event, including current conditions,
forecast, and historical weather (if available).

**Authentication:** Required

**URL Parameters:**

- `eventId` (string, required) - The UUID of the event

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "condition": "Clear skies",
    "wind": "12 km/h",
    "humidity": 62,
    "air": 24,
    "track": 32,
    "precip": 18,
    "forecast": [
      { "label": "+15m", "detail": "Clouds, stable" },
      { "label": "+30m", "detail": "Light breeze" },
      { "label": "+45m", "detail": "Spotty drizzle" }
    ],
    "cachedAt": "2025-01-27T10:30:00Z",
    "isCached": false
  }
}
```

**Response Fields:**

- `condition` (string) - Weather condition description
- `wind` (string) - Wind speed and direction (e.g., "12 km/h N")
- `humidity` (number) - Humidity percentage (0-100)
- `air` (number) - Air temperature in Celsius
- `track` (number) - Estimated track surface temperature in Celsius (calculated)
- `precip` (number) - Precipitation chance percentage (0-100)
- `forecast` (array) - Array of forecast entries with `label` and `detail`
  fields
- `cachedAt` (string, optional) - ISO 8601 timestamp indicating when data was
  cached (present if `isCached` is true)
- `isCached` (boolean) - Indicates if the response contains cached data

**Error Responses:**

- `401 UNAUTHORIZED` - Authentication required
- `404 NOT_FOUND` - Event not found
- `503 SERVICE_UNAVAILABLE` - Weather service unavailable (may include last
  cached data if available)

**Notes:**

- Weather data is cached in the database with TTL (1 hour for current/forecast,
  longer for historical)
- If weather API is unavailable, the endpoint returns the last cached data (if
  available) with `isCached: true`
- Track temperature is estimated from air temperature using a calculation
  formula
- Historical weather data availability depends on Open-Meteo API tier
- **Geocoding Priority:** Weather service uses a three-tier geocoding strategy:
  1. **Priority 1:** Uses stored coordinates (`latitude`, `longitude`) from
     track dashboard extraction if available
  2. **Priority 2:** Uses stored address from track dashboard if coordinates are
     unavailable
  3. **Priority 3:** Falls back to name-based geocoding using track name and
     location hints from event name
- Track metadata (coordinates, address) is extracted from LiveRC dashboard pages
  during track sync

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/events/uuid/weather"
```

---

## Personas Endpoints

**Note:** Personas endpoints provide user-specific views of data (driver
persona, team manager persona). These endpoints are in scope for version 0.1.1
but may be expanded in future releases. See
[MRE Version 0.1.1 Feature Scope](../specs/mre-v0.1-feature-scope.md) for
complete feature specifications.

### GET /api/v1/personas

Gets available personas for the current user.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "personas": [
      {
        "id": "driver",
        "name": "Driver",
        "description": "View events and race data as a driver"
      },
      {
        "id": "team-manager",
        "name": "Team Manager",
        "description": "Manage team data and view team statistics"
      }
    ]
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/personas"
```

---

### GET /api/v1/personas/driver/events

Gets events for the driver persona view.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "uuid",
        "event_name": "Event Name",
        "event_date": "2025-01-27T00:00:00.000Z",
        "track_name": "Track Name"
      }
    ]
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/personas/driver/events"
```

---

### GET /api/v1/personas/team-manager/team

Gets team data for the team manager persona view.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "team": {
      "name": "Team Name",
      "members": [],
      "statistics": {}
    }
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/personas/team-manager/team"
```

---

## Practice Days Endpoints

**Note:** Practice days endpoints allow discovery, search, and ingestion of
practice day sessions from LiveRC. Practice days are treated as special event
types with session type `practiceday`.

### GET /api/v1/practice-days/search

Searches for practice days in the database by track and optional date range.

**Authentication:** Required

**Query Parameters:**

- `track_id` (string, required) - The UUID of the track
- `start_date` (string, optional) - Start date in ISO 8601 format (YYYY-MM-DD)
- `end_date` (string, optional) - End date in ISO 8601 format (YYYY-MM-DD)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "practiceDays": [
      {
        "id": "uuid",
        "eventName": "Practice Day - 2025-01-27",
        "eventDate": "2025-01-27T00:00:00.000Z",
        "sourceEventId": "event-id",
        "trackId": "uuid",
        "ingestDepth": "laps_full"
      }
    ]
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Missing required track_id parameter
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/practice-days/search?track_id=uuid&start_date=2025-01-01&end_date=2025-01-31"
```

---

### POST /api/v1/practice-days/discover

Discovers practice days from LiveRC for a specific track and month.

**Authentication:** Required

**Request Body:**

```json
{
  "track_id": "uuid",
  "year": 2025,
  "month": 1
}
```

**Request Fields:**

- `track_id` (string, required) - The UUID of the track
- `year` (number, required) - Year (e.g., 2025)
- `month` (number, required) - Month (1-12)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "practiceDays": [
      {
        "date": "2025-01-27",
        "trackSlug": "track-slug",
        "sessionCount": 15,
        "totalLaps": 450,
        "totalTrackTimeSeconds": 18000,
        "uniqueDrivers": 12,
        "uniqueClasses": 3,
        "timeRangeStart": "2025-01-27T08:00:00Z",
        "timeRangeEnd": "2025-01-27T17:00:00Z",
        "sessions": [
          {
            "sessionId": "session-id",
            "driverName": "Driver Name",
            "className": "1.8 Nitro Buggy",
            "transponderNumber": "123",
            "startTime": "2025-01-27T08:00:00Z",
            "durationSeconds": 600,
            "lapCount": 30,
            "fastestLap": 20.5,
            "averageLap": 22.1,
            "sessionUrl": "https://liverc.com/session/..."
          }
        ]
      }
    ]
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Missing required fields or invalid month (must be
  1-12)
- `NOT_FOUND` (404) - Track not found
- `INTERNAL_ERROR` (500) - Server error or ingestion service unavailable

**Notes:**

- Discovery requests may take up to 60 seconds to complete
- Results include practice day summaries with session details
- Sessions are grouped by date

**Example:**

```bash
curl -X POST -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json" \
  -d '{"track_id": "uuid", "year": 2025, "month": 1}' \
  "http://localhost:3001/api/v1/practice-days/discover"
```

---

### POST /api/v1/practice-days/discover-range

Discovers practice days for a **date range** in one request (server fans out per
month with bounded concurrency). Optional `stream: true` returns NDJSON for
progressive UI updates.

**Authentication:** Required

**Request Body (required fields):**

- `track_id` (string) - Track UUID
- `start_date` (string) - ISO date `YYYY-MM-DD`
- `end_date` (string) - ISO date `YYYY-MM-DD`
- `track_slug` (string, optional) - Passed through when known
- `stream` (boolean, optional) - If true, response is a streaming NDJSON body

**Error Codes:**

- `VALIDATION_ERROR` (400) - Missing dates, invalid range, or range too large
- `UNAUTHORIZED` (401) - Authentication required

**Example:**

```bash
curl -X POST -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json" \
  -d '{"track_id":"uuid","start_date":"2025-01-01","end_date":"2025-03-31"}' \
  "http://localhost:3001/api/v1/practice-days/discover-range"
```

---

### POST /api/v1/practice-days/ingest

Ingests practice day data for a specific track and date.

**Authentication:** Required

**Request Body:**

```json
{
  "track_id": "uuid",
  "date": "2025-01-27"
}
```

**Request Fields:**

- `track_id` (string, required) - The UUID of the track
- `date` (string, required) - Date in ISO 8601 format (YYYY-MM-DD)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "eventId": "uuid",
    "sessionsIngested": 15,
    "sessionsFailed": 0,
    "sessionsWithLaps": 12,
    "lapsIngested": 450,
    "sessionsDetailFailed": 0,
    "status": "completed"
  }
}
```

**Response Fields:**

- `eventId` (string) - UUID of the created event
- `sessionsIngested` (number) - Number of sessions successfully ingested
- `sessionsFailed` (number) - Number of sessions that failed to ingest
- `sessionsWithLaps` (number, optional) - Sessions for which at least one lap
  was written (full ingestion)
- `lapsIngested` (number, optional) - Total laps ingested (full ingestion)
- `sessionsDetailFailed` (number, optional) - Sessions whose detail fetch failed
  (full ingestion)
- `status` (string) - Ingestion status (e.g., "completed", "partial", "failed")

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Missing required track_id or date
- `NOT_FOUND` (404) - Track not found
- `INGESTION_IN_PROGRESS` (409) - Ingestion already in progress for this
  practice day
- `INGESTION_FAILED` (500) - Ingestion process failed
- `INTERNAL_ERROR` (500) - Server error

**Notes:**

- Creates an Event with session type `practiceday`. Full ingestion fetches the
  session list, creates Driver/RaceDriver/RaceResult per session, then fetches
  each session's detail page (with bounded concurrency) and persists
  race_metadata, result stats, and laps.
- Ingests all practice sessions for the specified date
- Results include counts of successful and failed session ingestions. Optional
  fields `sessionsWithLaps`, `lapsIngested`, and `sessionsDetailFailed` are
  returned when full ingestion is enabled (additive, non-breaking).

**Example:**

```bash
curl -X POST -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json" \
  -d '{"track_id": "uuid", "date": "2025-01-27"}' \
  "http://localhost:3001/api/v1/practice-days/ingest"
```

---

## Search Endpoints

### GET /api/v1/search

Performs unified search across events and sessions (races, practice, qualifying)
with optional filtering by driver name, session type, and date range.

**Authentication:** Required

**Query Parameters:**

- `q` (string, optional) - General search query (searches event names, track
  names, session labels, class names)
- `driver_name` (string, optional) - Filter by driver name (exact match with
  fuzzy fallback, only drivers with valid lap times)
- `session_type` (string, optional) - Filter by session type: `race`,
  `practice`, or `qualifying`
- `start_date` (string, optional) - Start date in ISO 8601 format (YYYY-MM-DD)
- `end_date` (string, optional) - End date in ISO 8601 format (YYYY-MM-DD)
- `page` (number, optional, default: `1`) - Page number (must be positive
  integer)
- `items_per_page` (number, optional, default: `10`, max: `100`) - Items per
  page (must be between 1 and 100)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "uuid",
        "eventName": "Event Name",
        "eventDate": "2025-01-27T00:00:00.000Z",
        "trackName": "Track Name",
        "trackId": "uuid",
        "source": "liverc",
        "sourceEventId": "event-id",
        "eventUrl": "https://liverc.com/event/...",
        "ingestDepth": "laps_full"
      }
    ],
    "sessions": [
      {
        "id": "uuid",
        "raceId": "uuid",
        "raceLabel": "A-Main",
        "className": "1.8 Nitro Buggy",
        "sessionType": "race",
        "eventId": "uuid",
        "eventName": "Event Name",
        "eventDate": "2025-01-27T00:00:00.000Z",
        "trackName": "Track Name",
        "startTime": "2025-01-27T10:00:00.000Z",
        "durationSeconds": 3600,
        "raceOrder": 1
      }
    ],
    "totalEvents": 42,
    "totalSessions": 15,
    "currentPage": 1,
    "totalPages": 3,
    "itemsPerPage": 10
  }
}
```

**Response Fields:**

- `events` (array) - Array of event search results
- `sessions` (array) - Array of session (race/practice/qualifying) search
  results
- `totalEvents` (number) - Total number of matching events
- `totalSessions` (number) - Total number of matching sessions
- `currentPage` (number) - Current page number
- `totalPages` (number) - Total number of pages (calculated from combined
  events + sessions)
- `itemsPerPage` (number) - Number of items per page

**Session Type Values:**

- `race` - Race sessions
- `practice` - Practice sessions
- `qualifying` - Qualifying sessions

**Notes:**

- If `driver_name` is provided, the search finds matching drivers first (exact
  match, then fuzzy match)
- Only drivers with at least one valid lap time are included in driver filtering
- If no drivers match the `driver_name` filter, returns empty results
- Date range filtering applies to both events and sessions
- Search is performed in parallel for events and sessions
- Pagination is unified across events and sessions

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Invalid query parameters (invalid date format,
  invalid session_type, invalid page/items_per_page values)
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
# Search for events and sessions
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/search?q=nitro&page=1&items_per_page=20"

# Search filtered by driver name
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/search?driver_name=John%20Doe"

# Search filtered by session type and date range
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/search?session_type=race&start_date=2025-01-01&end_date=2025-12-31"
```

---

## Car Profiles Endpoints

### GET /api/v1/car-profiles

Gets all car profiles for the authenticated user.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "profiles": [
      {
        "id": "uuid",
        "userId": "uuid",
        "name": "My Buggy",
        "carType": "Buggy",
        "vehicleType": "1/8 Nitro",
        "setupInfo": {
          "shockOil": "35wt",
          "tires": "Pro-Line Blockade"
        },
        "createdAt": "2025-01-27T00:00:00.000Z",
        "updatedAt": "2025-01-27T00:00:00.000Z"
      }
    ]
  },
  "message": "Car profiles retrieved successfully"
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/car-profiles"
```

---

### POST /api/v1/car-profiles

Creates a new car profile for the authenticated user.

**Authentication:** Required

**Request Body:**

```json
{
  "name": "My Buggy", // required
  "carType": "Buggy", // required
  "vehicleType": "1/8 Nitro", // required
  "setupInfo": {
    // optional
    "shockOil": "35wt",
    "tires": "Pro-Line Blockade"
  }
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "uuid",
      "userId": "uuid",
      "name": "My Buggy",
      "carType": "Buggy",
      "vehicleType": "1/8 Nitro",
      "setupInfo": {
        "shockOil": "35wt",
        "tires": "Pro-Line Blockade"
      },
      "createdAt": "2025-01-27T00:00:00.000Z",
      "updatedAt": "2025-01-27T00:00:00.000Z"
    }
  },
  "message": "Car profile created successfully"
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Missing required fields (name, carType,
  vehicleType)
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X POST "http://localhost:3001/api/v1/car-profiles" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "name": "My Buggy",
    "carType": "Buggy",
    "vehicleType": "1/8 Nitro",
    "setupInfo": {"shockOil": "35wt"}
  }'
```

---

### GET /api/v1/car-profiles/[id]

Gets a single car profile by ID. Users can only access their own car profiles.

**Authentication:** Required

**Path Parameters:**

- `id` (string, required) - Car profile UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "uuid",
      "userId": "uuid",
      "name": "My Buggy",
      "carType": "Buggy",
      "vehicleType": "1/8 Nitro",
      "setupInfo": {
        "shockOil": "35wt",
        "tires": "Pro-Line Blockade"
      },
      "createdAt": "2025-01-27T00:00:00.000Z",
      "updatedAt": "2025-01-27T00:00:00.000Z"
    }
  },
  "message": "Car profile retrieved successfully"
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Invalid UUID format
- `NOT_FOUND` (404) - Car profile not found or does not belong to user
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/car-profiles/uuid"
```

---

### PUT /api/v1/car-profiles/[id]

Updates an existing car profile. Users can only update their own car profiles.

**Authentication:** Required

**Path Parameters:**

- `id` (string, required) - Car profile UUID

**Request Body:**

```json
{
  "name": "Updated Buggy Name", // optional
  "carType": "Truggy", // optional
  "vehicleType": "1/8 Electric", // optional
  "setupInfo": {
    // optional
    "shockOil": "40wt",
    "tires": "Pro-Line M3"
  }
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "uuid",
      "userId": "uuid",
      "name": "Updated Buggy Name",
      "carType": "Truggy",
      "vehicleType": "1/8 Electric",
      "setupInfo": {
        "shockOil": "40wt",
        "tires": "Pro-Line M3"
      },
      "createdAt": "2025-01-27T00:00:00.000Z",
      "updatedAt": "2025-01-27T01:00:00.000Z"
    }
  },
  "message": "Car profile updated successfully"
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Invalid UUID format
- `NOT_FOUND` (404) - Car profile not found or does not belong to user
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X PUT "http://localhost:3001/api/v1/car-profiles/uuid" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"name": "Updated Buggy Name", "carType": "Truggy"}'
```

---

### DELETE /api/v1/car-profiles/[id]

Deletes a car profile. Users can only delete their own car profiles.

**Authentication:** Required

**Path Parameters:**

- `id` (string, required) - Car profile UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "uuid",
      "userId": "uuid",
      "name": "My Buggy",
      "carType": "Buggy",
      "vehicleType": "1/8 Nitro",
      "setupInfo": null,
      "createdAt": "2025-01-27T00:00:00.000Z",
      "updatedAt": "2025-01-27T00:00:00.000Z"
    }
  },
  "message": "Car profile deleted successfully"
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Invalid UUID format
- `NOT_FOUND` (404) - Car profile not found or does not belong to user
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X DELETE -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/car-profiles/uuid"
```

---

## Driver Profiles Endpoints

### GET /api/v1/driver-profiles

Gets all driver profiles for the authenticated user.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "profiles": [
      {
        "id": "uuid",
        "userId": "uuid",
        "name": "John Doe",
        "displayName": "John D.",
        "transponderNumber": "12345",
        "preferences": {
          "defaultView": "lap-times"
        },
        "createdAt": "2025-01-27T00:00:00.000Z",
        "updatedAt": "2025-01-27T00:00:00.000Z"
      }
    ]
  },
  "message": "Driver profiles retrieved successfully"
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/driver-profiles"
```

---

### POST /api/v1/driver-profiles

Creates a new driver profile for the authenticated user.

**Authentication:** Required

**Request Body:**

```json
{
  "name": "John Doe", // required
  "displayName": "John D.", // required
  "transponderNumber": "12345", // optional
  "preferences": {
    // optional
    "defaultView": "lap-times"
  }
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "uuid",
      "userId": "uuid",
      "name": "John Doe",
      "displayName": "John D.",
      "transponderNumber": "12345",
      "preferences": {
        "defaultView": "lap-times"
      },
      "createdAt": "2025-01-27T00:00:00.000Z",
      "updatedAt": "2025-01-27T00:00:00.000Z"
    }
  },
  "message": "Driver profile created successfully"
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Missing required fields (name, displayName)
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X POST "http://localhost:3001/api/v1/driver-profiles" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "name": "John Doe",
    "displayName": "John D.",
    "transponderNumber": "12345"
  }'
```

---

### GET /api/v1/driver-profiles/[id]

Gets a single driver profile by ID. Users can only access their own driver
profiles.

**Authentication:** Required

**Path Parameters:**

- `id` (string, required) - Driver profile UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "uuid",
      "userId": "uuid",
      "name": "John Doe",
      "displayName": "John D.",
      "transponderNumber": "12345",
      "preferences": {
        "defaultView": "lap-times"
      },
      "createdAt": "2025-01-27T00:00:00.000Z",
      "updatedAt": "2025-01-27T00:00:00.000Z"
    }
  },
  "message": "Driver profile retrieved successfully"
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Invalid UUID format
- `NOT_FOUND` (404) - Driver profile not found or does not belong to user
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/driver-profiles/uuid"
```

---

### PUT /api/v1/driver-profiles/[id]

Updates an existing driver profile. Users can only update their own driver
profiles.

**Authentication:** Required

**Path Parameters:**

- `id` (string, required) - Driver profile UUID

**Request Body:**

```json
{
  "name": "John Smith", // optional
  "displayName": "John S.", // optional
  "transponderNumber": "67890", // optional
  "preferences": {
    // optional
    "defaultView": "results"
  }
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "uuid",
      "userId": "uuid",
      "name": "John Smith",
      "displayName": "John S.",
      "transponderNumber": "67890",
      "preferences": {
        "defaultView": "results"
      },
      "createdAt": "2025-01-27T00:00:00.000Z",
      "updatedAt": "2025-01-27T01:00:00.000Z"
    }
  },
  "message": "Driver profile updated successfully"
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Invalid UUID format
- `NOT_FOUND` (404) - Driver profile not found or does not belong to user
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X PUT "http://localhost:3001/api/v1/driver-profiles/uuid" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"displayName": "John S.", "transponderNumber": "67890"}'
```

---

### DELETE /api/v1/driver-profiles/[id]

Deletes a driver profile. Users can only delete their own driver profiles.

**Authentication:** Required

**Path Parameters:**

- `id` (string, required) - Driver profile UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "uuid",
      "userId": "uuid",
      "name": "John Doe",
      "displayName": "John D.",
      "transponderNumber": "12345",
      "preferences": null,
      "createdAt": "2025-01-27T00:00:00.000Z",
      "updatedAt": "2025-01-27T00:00:00.000Z"
    }
  },
  "message": "Driver profile deleted successfully"
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Invalid UUID format
- `NOT_FOUND` (404) - Driver profile not found or does not belong to user
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X DELETE -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/driver-profiles/uuid"
```

---

## User Endpoints

### GET /api/v1/users/me/persona

Gets the current user's active persona.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "persona": {
      "id": "driver",
      "name": "Driver"
    }
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/users/me/persona"
```

---

### POST /api/v1/users/me/persona

Sets the current user's active persona. Only the Race Engineer persona can be
manually selected. Driver, Admin, and Team Manager personas are auto-assigned
based on user properties and cannot be manually selected.

**Authentication:** Required

**Request Body:**

```json
{
  "personaId": "uuid"
}
```

**Request Fields:**

- `personaId` (string, required) - Persona UUID (must be Race Engineer persona
  type)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "persona": {
      "id": "uuid",
      "type": "race_engineer",
      "name": "Race Engineer",
      "description": "AI-backed assistant providing setup and tuning guidance"
    }
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `VALIDATION_ERROR` (400) - Missing personaId or invalid persona type
- `PERSONA_NOT_FOUND` (404) - Persona not found
- `INVALID_PERSONA` (400) - Only Race Engineer persona can be manually selected
- `INTERNAL_ERROR` (500) - Server error

**Notes:**

- Only Race Engineer persona can be manually selected via this endpoint
- Driver persona is automatically assigned based on user driver links
- Admin persona is automatically assigned based on isAdmin flag
- Team Manager persona is automatically assigned based on isTeamManager flag

**Example:**

```bash
curl -X POST "http://localhost:3001/api/v1/users/me/persona" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"personaId": "uuid"}'
```

---

### GET /api/v1/users/me

Returns basic information about the authenticated user. This endpoint is used by
dashboard components to determine admin capabilities or to fetch the user ID for
driver link operations.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "driver@example.com",
    "name": "Driver Name",
    "isAdmin": false
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) – Missing or invalid session
- `INTERNAL_ERROR` (500) – Unexpected failure retrieving the session

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." \
  "http://localhost:3001/api/v1/users/me"
```

---

### PATCH /api/v1/users/me/driver-links/events/[eventId]

Updates the driver link status for the currently authenticated user without
requiring the caller to know their user ID. This is the endpoint used by the My
Events tab and dashboard to confirm or reject fuzzy matches.

**Authentication:** Required

**Path Parameters:**

- `eventId` (string, required) – Event UUID

**Request Body:**

```json
{
  "status": "confirmed" // or "rejected"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "link": {
      "id": "uuid",
      "userId": "uuid",
      "driverId": "uuid",
      "status": "confirmed"
    }
  },
  "message": "Driver link updated successfully"
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) – Authentication required
- `NOT_FOUND` (404) – Driver link not found for the user/event combination
- `VALIDATION_ERROR` (400) – Invalid status value
- `INTERNAL_ERROR` (500) – Server error

**Example:**

```bash
curl -X PATCH "http://localhost:3001/api/v1/users/me/driver-links/events/uuid" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"status": "confirmed"}'
```

---

### PATCH /api/v1/users/[userId]/driver-links/events/[eventId]

Updates driver link status for a specific event. This endpoint allows users to
confirm or reject driver link suggestions for specific events. The status update
applies to the UserDriverLink, affecting all events for that driver link.

**Authentication:** Required

**Path Parameters:**

- `userId` (string, required) - User UUID (must match authenticated user)
- `eventId` (string, required) - Event UUID

**Request Body:**

```json
{
  "status": "confirmed" // required - Either "confirmed" or "rejected"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "link": {
      "id": "uuid",
      "userId": "uuid",
      "driverId": "uuid",
      "status": "confirmed",
      "similarityScore": 0.95,
      "matchedAt": "2025-01-27T00:00:00.000Z",
      "confirmedAt": "2025-01-27T10:00:00.000Z",
      "rejectedAt": null,
      "matcherId": "uuid",
      "matcherVersion": "1.0.0"
    }
  },
  "message": "Driver link confirmed successfully"
}
```

**Response Fields:**

- `link` (object) - Updated UserDriverLink object with status change
- `status` (string) - New status: `confirmed` or `rejected`
- `confirmedAt` (string | null) - ISO 8601 timestamp when confirmed (null if
  rejected)
- `rejectedAt` (string | null) - ISO 8601 timestamp when rejected (null if
  confirmed)

**Notes:**

- Users can only update their own driver links (userId must match authenticated
  user)
- Status update affects the UserDriverLink, which applies to all events for that
  driver
- Confirming a link makes it available for all events where the driver appears
- Rejecting a link prevents it from being used in future event matching

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - User can only update their own driver links
- `VALIDATION_ERROR` (400) - Missing status or invalid status value (must be
  "confirmed" or "rejected")
- `NOT_FOUND` (404) - User, event, or driver link not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X PATCH "http://localhost:3001/api/v1/users/uuid/driver-links/events/uuid" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"status": "confirmed"}'
```

---

### GET /api/v1/users/[userId]/driver-links

Gets driver links for a specific user.

**Authentication:** Required

**Path Parameters:**

- `userId` (string, required) - User UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "driver_links": [
      {
        "driver_id": "uuid",
        "driver_name": "Driver Name",
        "linked_at": "2025-01-27T00:00:00.000Z"
      }
    ]
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `NOT_FOUND` (404) - User not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/users/uuid/driver-links"
```

---

### GET /api/v1/users/[userId]/profile

Gets comprehensive user profile data including user information, activity
statistics, and driver links.

**Authentication:** Required

**Path Parameters:**

- `userId` (string, required) - User UUID (must match authenticated user)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "driverName": "John Doe",
      "teamName": "Team Alpha",
      "isAdmin": false,
      "isTeamManager": false,
      "transponderNumber": "12345",
      "persona": {
        "id": "uuid",
        "type": "driver",
        "name": "Driver",
        "description": "Individual RC racer persona"
      },
      "createdAt": "2025-01-27T00:00:00.000Z",
      "updatedAt": "2025-01-27T00:00:00.000Z"
    },
    "activityStats": {
      "eventCount": 10,
      "raceCount": 25,
      "bestLapTime": 70.5,
      "bestAvgLapTime": 72.3,
      "bestConsistency": 95.2
    },
    "driverLinks": [
      {
        "driver_id": "uuid",
        "driver_name": "Driver Name",
        "status": "confirmed",
        "linked_at": "2025-01-27T00:00:00.000Z"
      }
    ]
  },
  "message": "User profile retrieved successfully"
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - User can only access their own profile
- `NOT_FOUND` (404) - User not found
- `INTERNAL_ERROR` (500) - Server error

**Notes:**

- Users can only access their own profile (userId must match authenticated user
  ID)
- Response includes user data with persona information, activity statistics
  (event count, race count, best lap times), and driver links with status
- `persona` may be null if user has no assigned persona
- Activity stats fields may be null if user has no activity data

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/users/uuid/profile"
```

---

## Admin Endpoints

All admin endpoints require authentication and admin privileges
(`isAdmin: true`).

### GET /api/v1/admin/stats

Gets system statistics for the admin dashboard.

**Authentication:** Required (Admin only)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "users": {
      "total": 150,
      "admins": 5
    },
    "events": {
      "total": 1245,
      "fully_ingested": 245
    },
    "tracks": {
      "total": 150,
      "followed": 12
    },
    "database": {
      "size_mb": 1024
    }
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Admin privileges required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/admin/stats"
```

---

### GET /api/v1/admin/health

Gets detailed health check information for admin monitoring.

**Authentication:** Required (Admin only)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "database": {
      "status": "healthy",
      "response_time_ms": 5
    },
    "ingestion_service": {
      "status": "healthy",
      "response_time_ms": 10
    },
    "disk_space": {
      "status": "healthy",
      "usage_percent": 45
    },
    "memory": {
      "status": "healthy",
      "usage_percent": 60
    }
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Admin privileges required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/admin/health"
```

---

### POST /api/v1/admin/ingestion

Triggers ingestion jobs (track sync or event ingestion). Admin-only endpoint for
manual ingestion control.

**Authentication:** Required (Admin only)

**Request Body:**

```json
{
  "type": "track_sync"
}
```

or

```json
{
  "type": "event_ingestion",
  "eventId": "uuid"
}
```

**Request Fields:**

- `type` (string, required) - Type of ingestion job: `"track_sync"` or
  `"event_ingestion"`
- `eventId` (string, required if type is `"event_ingestion"`) - Event UUID for
  event ingestion

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Track sync triggered successfully"
  },
  "message": "Track sync triggered successfully"
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Admin privileges required
- `VALIDATION_ERROR` (400) - Missing or invalid request body
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
# Trigger track sync
curl -X POST "http://localhost:3001/api/v1/admin/ingestion" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"type": "track_sync"}'

# Trigger event ingestion
curl -X POST "http://localhost:3001/api/v1/admin/ingestion" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"type": "event_ingestion", "eventId": "uuid"}'
```

---

### GET /api/v1/admin/events

Gets all events with pagination and filtering (admin-only endpoint).

**Authentication:** Required (Admin only)

**Query Parameters:**

- `trackId` (string, optional) - Filter by track UUID
- `startDate` (string, optional) - Filter by start date (ISO 8601 format)
- `endDate` (string, optional) - Filter by end date (ISO 8601 format)
- `ingestDepth` (string, optional) - Filter by ingestion depth (`none`,
  `laps_full`)
- `page` (number, optional) - Page number (default: 1)
- `pageSize` (number, optional) - Page size (default: 50)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "uuid",
        "source": "liverc",
        "source_event_id": "event-id",
        "track_id": "uuid",
        "event_name": "Event Name",
        "event_date": "2025-01-27T00:00:00.000Z",
        "event_entries": 50,
        "event_drivers": 45,
        "event_url": "https://liverc.com/event/...",
        "ingest_depth": "laps_full",
        "last_ingested_at": "2025-01-27T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 50,
      "total": 1245,
      "totalPages": 25
    }
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Admin privileges required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/admin/events?page=1&pageSize=50&trackId=uuid"
```

---

### DELETE /api/v1/admin/events/[eventId]

Deletes an event and all associated data (admin-only endpoint). This operation
cascades to delete all related races, results, laps, and other associated
records.

**Authentication:** Required (Admin only)

**Path Parameters:**

- `eventId` (string, required) - Event UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {},
  "message": "Event deleted successfully"
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Admin privileges required
- `NOT_FOUND` (404) - Event not found
- `INTERNAL_ERROR` (500) - Server error

**Notes:**

- This operation permanently deletes the event and all cascading data
- Deleted events cannot be recovered
- Consider re-ingestion instead of deletion if data correction is needed

**Example:**

```bash
curl -X DELETE -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/admin/events/uuid"
```

---

### POST /api/v1/admin/events/[eventId]/reingest

Triggers re-ingestion of an event (admin-only endpoint).

**Authentication:** Required (Admin only)

**Path Parameters:**

- `eventId` (string, required) - Event UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "event_id": "uuid",
    "ingest_depth": "laps_full",
    "last_ingested_at": "2025-01-27T14:22:00Z",
    "races_ingested": 12,
    "results_ingested": 120,
    "laps_ingested": 2400,
    "status": "updated"
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Admin privileges required
- `NOT_FOUND` (404) - Event not found
- `INGESTION_IN_PROGRESS` (409) - Ingestion already running for this event
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X POST -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/admin/events/uuid/reingest"
```

---

### GET /api/v1/admin/logs

Gets application logs for admin viewing.

**Authentication:** Required (Admin only)

**Query Parameters:**

- `level` (string, optional) - Filter by log level (debug, info, warn, error)
- `service` (string, optional) - Filter by service (nextjs, ingestion)
- `start_date` (string, optional) - Start date in ISO format
- `end_date` (string, optional) - End date in ISO format
- `search` (string, optional) - Search term
- `limit` (number, optional) - Maximum number of logs to return (default: 100)
- `offset` (number, optional) - Offset for pagination (default: 0)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "timestamp": "2025-01-27T10:00:00.000Z",
        "level": "info",
        "service": "nextjs",
        "message": "User logged in",
        "metadata": {}
      }
    ],
    "total": 1000,
    "limit": 100,
    "offset": 0
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Admin privileges required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/admin/logs?level=error&limit=50"
```

---

### GET /api/v1/admin/logs/sources

Gets available log sources.

**Authentication:** Required (Admin only)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "sources": [
      {
        "id": "nextjs",
        "name": "Next.js Application",
        "description": "Application logs from Next.js server"
      },
      {
        "id": "ingestion",
        "name": "Ingestion Service",
        "description": "Logs from Python ingestion service"
      }
    ]
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Admin privileges required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/admin/logs/sources"
```

---

### GET /api/v1/admin/audit

Gets audit log entries for admin review.

**Authentication:** Required (Admin only)

**Query Parameters:**

- `user_id` (string, optional) - Filter by user UUID
- `action_type` (string, optional) - Filter by action type
- `resource_type` (string, optional) - Filter by resource type
- `start_date` (string, optional) - Start date in ISO format
- `end_date` (string, optional) - End date in ISO format
- `limit` (number, optional) - Maximum number of entries to return
  (default: 100)
- `offset` (number, optional) - Offset for pagination (default: 0)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "audit_logs": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "user_email": "admin@example.com",
        "action_type": "user_updated",
        "resource_type": "user",
        "resource_id": "uuid",
        "details": {},
        "created_at": "2025-01-27T10:00:00.000Z"
      }
    ],
    "total": 500,
    "limit": 100,
    "offset": 0
  }
}
```

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Admin privileges required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/admin/audit?action_type=user_updated&limit=50"
```

---

### GET /api/v1/admin/users

Gets all users with pagination and filtering (admin-only endpoint).

**Authentication:** Required (Admin only)

**Query Parameters:**

- `email` (string, optional) - Filter by email (case-insensitive partial match)
- `driverName` (string, optional) - Filter by driver name (case-insensitive
  partial match)
- `isAdmin` (boolean, optional) - Filter by admin status
- `page` (number, optional) - Page number (default: 1)
- `pageSize` (number, optional) - Page size (default: 50)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "driverName": "John Doe",
        "teamName": "Team Alpha",
        "isAdmin": false,
        "createdAt": "2025-01-27T00:00:00.000Z",
        "updatedAt": "2025-01-27T00:00:00.000Z"
      }
    ],
    "total": 150,
    "page": 1,
    "pageSize": 50,
    "totalPages": 3
  },
  "message": "Users retrieved successfully"
}
```

**Note:** The `passwordHash` field is excluded from the response for security.

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Admin privileges required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/admin/users?page=1&pageSize=50&isAdmin=false"
```

---

### PATCH /api/v1/admin/users/[userId]

Updates user details (admin-only endpoint).

**Authentication:** Required (Admin only)

**Path Parameters:**

- `userId` (string, required) - User UUID

**Request Body:**

```json
{
  "driverName": "Updated Name", // optional
  "teamName": "Updated Team", // optional (can be null)
  "email": "newemail@example.com", // optional
  "isAdmin": true // optional
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "newemail@example.com",
    "driverName": "Updated Name",
    "teamName": "Updated Team",
    "isAdmin": true,
    "createdAt": "2025-01-27T00:00:00.000Z",
    "updatedAt": "2025-01-27T00:00:00.000Z"
  },
  "message": "User updated successfully"
}
```

**Notes:**

- All fields in the request body are optional
- Admin status changes are tracked in audit logs
- Email updates must be unique (not already registered)
- If no fields are provided, returns success with no changes

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Admin privileges required
- `VALIDATION_ERROR` (400) - Invalid request body or email already exists
- `NOT_FOUND` (404) - User not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X PATCH "http://localhost:3001/api/v1/admin/users/uuid" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"driverName": "Updated Name", "isAdmin": true}'
```

---

### DELETE /api/v1/admin/users/[userId]

Deletes a user (admin-only endpoint).

**Authentication:** Required (Admin only)

**Path Parameters:**

- `userId` (string, required) - User UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {},
  "message": "User deleted successfully"
}
```

**Notes:**

- This operation permanently deletes the user
- Deleted users cannot be recovered
- User deletion is tracked in audit logs

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Admin privileges required
- `NOT_FOUND` (404) - User not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X DELETE -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/admin/users/uuid"
```

---

### PATCH /api/v1/admin/tracks/[trackId]

Updates track follow status (admin-only endpoint).

**Authentication:** Required (Admin only)

**Path Parameters:**

- `trackId` (string, required) - Track UUID

**Request Body:**

```json
{
  "isFollowed": true // required - boolean
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "source": "liverc",
    "source_track_slug": "track-slug",
    "track_name": "Track Name",
    "track_url": "https://liverc.com/track/...",
    "events_url": "https://liverc.com/track/.../events",
    "liverc_track_last_updated": "2025-01-27",
    "last_seen_at": "2025-01-27T00:00:00.000Z",
    "is_active": true,
    "is_followed": true,
    "created_at": "2025-01-27T00:00:00.000Z",
    "updated_at": "2025-01-27T00:00:00.000Z"
  },
  "message": "Track updated successfully"
}
```

**Notes:**

- Track follow status changes are tracked in audit logs
- Only the `isFollowed` field can be updated via this endpoint

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Admin privileges required
- `VALIDATION_ERROR` (400) - Missing or invalid request body
- `NOT_FOUND` (404) - Track not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -X PATCH "http://localhost:3001/api/v1/admin/tracks/uuid" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"isFollowed": true}'
```

---

### GET /api/v1/admin/track-sync/jobs/[jobId]

Gets the status of a track sync job.

**Authentication:** Required (Admin only)

**Path Parameters:**

- `jobId` (string, required) - Track sync job ID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "jobId": "job-uuid",
    "status": "completed",
    "startedAt": "2025-01-27T10:00:00.000Z",
    "completedAt": "2025-01-27T10:05:00.000Z",
    "tracksProcessed": 150,
    "tracksUpdated": 12,
    "tracksCreated": 3,
    "errors": []
  },
  "message": "Job status fetched"
}
```

**Response Fields:**

- `jobId` (string) - Track sync job ID
- `status` (string) - Job status: `pending`, `running`, `completed`, `failed`
- `startedAt` (string) - ISO 8601 timestamp when job started
- `completedAt` (string | null) - ISO 8601 timestamp when job completed (null if
  still running)
- `tracksProcessed` (number) - Total number of tracks processed
- `tracksUpdated` (number) - Number of tracks updated
- `tracksCreated` (number) - Number of new tracks created
- `errors` (array) - Array of error messages (if any)

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Admin privileges required
- `BAD_REQUEST` (400) - Missing jobId
- `NOT_FOUND` (404) - Job not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/admin/track-sync/jobs/job-uuid"
```

---

### GET /api/v1/admin/tracks

Gets all tracks with pagination and filtering (admin-only endpoint).

**Authentication:** Required (Admin only)

**Query Parameters:**

- `source` (string, optional) - Filter by source (e.g., "liverc")
- `isFollowed` (boolean, optional) - Filter by follow status
- `isActive` (boolean, optional) - Filter by active status
- `page` (number, optional) - Page number (default: 1)
- `pageSize` (number, optional) - Page size (default: 50)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "tracks": [
      {
        "id": "uuid",
        "source": "liverc",
        "source_track_slug": "track-slug",
        "track_name": "Track Name",
        "track_url": "https://liverc.com/track/...",
        "events_url": "https://liverc.com/track/.../events",
        "liverc_track_last_updated": "2025-01-27",
        "last_seen_at": "2025-01-27T00:00:00.000Z",
        "is_active": true,
        "is_followed": true,
        "created_at": "2025-01-27T00:00:00.000Z",
        "updated_at": "2025-01-27T00:00:00.000Z",
        "eventCount": 15
      }
    ],
    "total": 150,
    "page": 1,
    "pageSize": 50,
    "totalPages": 3
  },
  "message": "Tracks retrieved successfully"
}
```

**Notes:**

- Tracks include an `eventCount` field showing the number of events associated
  with each track
- Response includes pagination metadata (total, page, pageSize, totalPages)

**Error Codes:**

- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Admin privileges required
- `INTERNAL_ERROR` (500) - Server error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/admin/tracks?page=1&pageSize=50&isActive=true"
```

---

### GET /api/v1/admin/venue-correction-requests

> **Deprecated.** Admin venue correction is deprecated end-to-end. See
> [`docs/architecture/venue-correction-deprecation.md`](../architecture/venue-correction-deprecation.md).

Lists venue correction requests (admin only).

**Authentication:** Required (Admin only)

**Query Parameters:**

- `status` (string, optional) - `pending` | `approved` | `rejected`

---

### PATCH /api/v1/admin/venue-correction-requests/[id]

> **Deprecated.** See GET admin venue-correction-requests note above.

Approves or rejects a venue correction request (admin only).

**Authentication:** Required (Admin only)

**Request Body:**

```json
{
  "action": "approve",
  "adminNotes": "optional"
}
```

`action` must be `approve` or `reject`.

---

## Leaderboard Endpoints

### GET /api/v1/leaderboards/countries

Returns distinct track countries that have at least one event (for country
filter UI).

**Authentication:** Required

**Response (200 OK):** `{ "success": true, "data": { "countries": ["..."] } }`

---

### GET /api/v1/leaderboards/country

Returns aggregate main-race points leaderboard for a country and year.

**Authentication:** Required

**Query Parameters:**

- `country` (string, required)
- `year` (number, optional) - Defaults to current calendar year
- `class_name` (string, optional)
- `limit`, `offset` (optional)
- `sort_by` (optional) - `name` | `points`

---

## Track Maps Endpoints

User-drawn track maps: list/create under `/api/v1/track-maps`, single map CRUD
under `/api/v1/track-maps/[mapId]`, share link generation under
`/api/v1/track-maps/[mapId]/share`, and public read by token under
`/api/v1/track-maps/shared/[shareToken]`.

### GET /api/v1/track-maps

Lists the authenticated user’s maps, or public maps when `public=true`.

**Authentication:** Required

**Query Parameters:** `trackId` (optional), `public` (boolean string `true` for
public catalogue)

### POST /api/v1/track-maps

Creates a track map for the authenticated user.

**Authentication:** Required

### GET /api/v1/track-maps/[mapId]

Gets a single map for the authenticated user (ownership enforced in the repo
layer).

**Authentication:** Required

### PUT /api/v1/track-maps/[mapId]

Updates a map.

**Authentication:** Required (owner)

### DELETE /api/v1/track-maps/[mapId]

Deletes a map.

**Authentication:** Required (owner)

### POST /api/v1/track-maps/[mapId]/share

Creates or returns a share token for the map.

**Authentication:** Required

### GET /api/v1/track-maps/shared/[shareToken]

Loads a map by opaque share token (unauthenticated access for shared links).

**Authentication:** Not required

---

## Ingestion Job Status

### GET /api/v1/ingestion/jobs/[jobId]

Returns ingestion job status from the Python ingestion service (used after
`202 Accepted` from ingest endpoints when queue mode is enabled). Proxies to the
ingestion HTTP API.

**Authentication:** Required

**Error Codes:**

- `NOT_FOUND` (404) - Unknown job id
- `INGESTION_ERROR` / `502` - Ingestion service error

**Example:**

```bash
curl -H "Cookie: next-auth.session-token=..." "http://localhost:3001/api/v1/ingestion/jobs/job-uuid"
```

---

## Telemetry (stage 1)

GNSS/IMU file intake: metadata in Postgres, raw bytes on a shared volume
(`TELEMETRY_UPLOAD_ROOT`, default `/data/telemetry` in Docker), processing by
the **`telemetry-worker`** container (`artifact_validate` job). Normative API
details:
[`docs/telemetry/Design/API_Contract_Telemetry.md`](../telemetry/Design/API_Contract_Telemetry.md).
Implementation status:
[`docs/implimentation_plans/telemetry-implementation-plan.md`](../implimentation_plans/telemetry-implementation-plan.md).

**Ingest formats (telemetry-worker `parse_raw`):** UTF-8 CSV with GNSS columns,
GPX 1.1 track points, NMEA 0183 text (`RMC`/`GGA` sentences, including `GN`
talker IDs), UTF-8 JSON (array of points or `points`/`samples`/`records`/`data`
wrapper), and u-blox UBX where enabled. **Garmin FIT (`.fit`) is not supported**
— uploads are rejected with `GARMIN_FIT_NOT_SUPPORTED` (see
[`docs/telemetry/README.md`](../telemetry/README.md)). Successful runs set
`telemetry_artifacts.format_detected` to values such as `csv_gnss`, `gpx`,
`nmea_gnss`, `json_gnss`, or `ubx_gnss`.

### POST /api/v1/telemetry/uploads

Creates a `telemetry_artifacts` row (no session yet) and returns the upload id
and absolute `uploadUrl` for the bytes step.

**Authentication:** Required

**Request JSON:**

```json
{ "originalFileName": "session.csv", "contentType": "text/csv" }
```

**Success `data`:** `uploadId`, `uploadUrl`, `method` (`PUT`), `storagePath`
(relative key under `TELEMETRY_UPLOAD_ROOT`).

### PUT /api/v1/telemetry/uploads/[uploadId]/bytes

Request body is the raw file bytes. Updates `byte_size` and `sha256` on the
artifact.

**Authentication:** Required

**Errors:** `404` (not found), `409` (already finalised).

### POST /api/v1/telemetry/uploads/[uploadId]/finalise

Creates `telemetry_sessions`, links the artifact, creates
`telemetry_processing_runs`, enqueues `telemetry_jobs` (`artifact_validate`).
Optional JSON body `{ "name": "My session" }` or empty body.

**Authentication:** Required

**Success `data`:** `sessionId`, `runId` (when not idempotent),
`sessionPollUrl`, `idempotent`.

### GET /api/v1/telemetry/sessions

Lists the signed-in user’s telemetry sessions (newest first).

**Authentication:** Required

**Query parameters (MVP):**

| Parameter | Description                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------- |
| `limit`   | Page size (default `50`, max `200`)                                                                 |
| `cursor`  | Opaque cursor from the previous response’s `nextCursor`                                             |
| `status`  | Optional filter: `uploading`, `processing`, `ready`, `failed`, … (matches `TelemetrySessionStatus`) |

**Success `data`:** `{ items: [...], nextCursor: string | null }`  
Each item includes `id`, `name`, `status`, `startTimeUtc`, `endTimeUtc`,
`createdAt`, and `summary: { datasetCount, hasGnss }`.

### GET /api/v1/telemetry/sessions/[sessionId]

Returns session metadata, `datasets[]` (type, `parquetRelativePath` when the run
succeeded), `currentRun` summary, and `failure` `{ code, message }` when
`status` is `failed`. User-facing `message` is derived from stable worker codes
(see `src/core/telemetry/telemetry-failure-messages.ts`).

**Authentication:** Required

### GET /api/v1/telemetry/sessions/[sessionId]/map

Returns a **downsampled** GNSS polyline for map/path preview from canonical
`gnss_pvt.parquet` (bounded read; not full resolution analytics).

**Authentication:** Required

**Query parameters:**

| Parameter    | Description                                                     |
| ------------ | --------------------------------------------------------------- |
| `max_points` | Optional cap on polyline points (default ~2000, hard max 10000) |

**Success `data`:**
`{ meta: { level, pointCount, rowCount, timeBounds }, data: { lat_deg, lon_deg } }`  
**Errors:**
`404` (session or file), `409` (session not `ready`), `413` (file/row limits).

### GET /api/v1/telemetry/sessions/[sessionId]/timeseries

GNSS columns from ClickHouse (if materialised) or Parquet.

**Query parameters:** `t_ns_min`, `t_ns_max`, `max_rows`, optional `stride`
(subsample after read), optional `ds_rate` (`10hz` / `ds_10hz` or `1hz` /
`ds_1hz`) as hints for stride.

### GET /api/v1/telemetry/sessions/[sessionId]/export

Streams canonical GNSS Parquet bytes. `?format=arrow` or `format=ipc` returns
**501** (Arrow IPC not implemented).

### GET /api/v1/telemetry/sessions/compare

**Query:** `ids=uuid,uuid` (2–4 **READY** sessions, same owner). Returns lap
summaries and best lap per session.

### POST / DELETE /api/v1/telemetry/sessions/[sessionId]/share

Mint or revoke a **read-only share token** (`telemetry_sessions.share_token`).

### GET /api/v1/telemetry/share/[token] and …/map

**No authentication.** Public session summary and map polyline when token is
valid.

### POST /api/v1/telemetry/sessions/[sessionId]/reprocess

Full re-ingest for **READY** sessions. **429** when
`TELEMETRY_REPROCESS_COOLDOWN_SEC` is violated.

### PATCH /api/v1/admin/tracks/[trackId]

Admin may set `startFinishLineGeoJson` (catalogue SFL) in addition to
`isFollowed`.

---

## Health Check

### GET /api/v1/health

Health check endpoint for Docker health checks and monitoring.

**Authentication:** Not required

**Response (200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2025-01-27T00:00:00.000Z"
}
```

**Example:**

```bash
curl "http://localhost:3001/api/v1/health"
```

**Note:** This endpoint is unversioned and used by Docker health checks. It does
not follow the standard API response format.

---

## Error Handling

**Related Documentation:** See
[Error Handling Guide](../architecture/error-handling.md) for comprehensive
error handling documentation, error code catalog, and error handling patterns.

### Standard Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

**Note:** This format is defined in
[Mobile-Safe Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md#32-api-format).
See [Error Handling Guide](../architecture/error-handling.md) for complete error
code catalog and error handling patterns.

### Error Code Catalog

| Error Code              | HTTP Status | Description                                 |
| ----------------------- | ----------- | ------------------------------------------- |
| `VALIDATION_ERROR`      | 400         | Invalid request parameters or body          |
| `INVALID_CREDENTIALS`   | 401         | Invalid email or password                   |
| `EMAIL_ALREADY_EXISTS`  | 409         | Email is already registered                 |
| `NOT_FOUND`             | 404         | Requested resource does not exist           |
| `INGESTION_IN_PROGRESS` | 409         | Ingestion already running for this resource |
| `INGESTION_FAILED`      | 500         | Ingestion process failed                    |
| `INTERNAL_ERROR`        | 500         | Unexpected server error                     |

### Error Handling Best Practices

1. **Client-side:** Always check the `success` field before accessing `data`
2. **Error Messages:** Display `error.message` to users, log `error.code` for
   debugging
3. **Retry Logic:** Only retry on `INTERNAL_ERROR` (500), not on client errors
   (4xx)
4. **Error Details:** The `details` field may contain additional context for
   debugging

---

## Authentication Requirements

### Current State (Version 0.1.1)

- Authentication endpoints (`/api/v1/auth/*`) do not require authentication
- All data endpoints require authentication (session-based via NextAuth cookies)
- Web sessions are managed via NextAuth cookies
- Mobile token-based authentication is architecturally supported but not yet
  implemented

### Future State

- Data endpoints will require authentication
- Admin endpoints will require admin privileges
- Mobile clients will use token-based authentication
- Rate limiting will be implemented per user/session

**See:** `docs/architecture/mobile-safe-architecture-guidelines.md` Section 5
for authentication architecture details.

---

## Rate Limiting

**Status:** Implemented

Rate limiting is applied to authentication and resource-intensive endpoints to
prevent abuse and ensure fair usage.

### Rate Limits

| Endpoint                          | Limit       | Window     | Purpose                          |
| --------------------------------- | ----------- | ---------- | -------------------------------- |
| `POST /api/v1/auth/login`         | 5 requests  | 15 minutes | Prevent brute force attacks      |
| `POST /api/v1/auth/register`      | 10 requests | 1 hour     | Prevent account spam             |
| `POST /api/v1/events/{id}/ingest` | 10 requests | 1 minute   | Prevent resource exhaustion      |
| `POST /api/v1/events/ingest`      | 10 requests | 1 minute   | Prevent resource exhaustion      |
| `POST /api/v1/events/discover`    | 20 requests | 1 minute   | Prevent excessive external calls |

**Note:** Rate limits are applied per IP address and endpoint path. The current
implementation uses in-memory storage, so limits reset on server restart.

### Rate Limit Headers

Successful responses include rate limit information in headers:

| Header                  | Description                          |
| ----------------------- | ------------------------------------ |
| `X-RateLimit-Limit`     | Maximum requests allowed in window   |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset`     | Unix timestamp when window resets    |

### Rate Limit Exceeded (429)

When rate limit is exceeded, the API returns:

**Response Headers:**

- `Retry-After` - Seconds until rate limit resets

**Response Body:**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "retryAfterSeconds": 60
    }
  }
}
```

### Rate Limiting Implementation

- **Algorithm:** Sliding window (in-memory)
- **Key:** IP address + endpoint path
- **Location:** `middleware.ts`, `src/lib/rate-limiter.ts`

**Note:** Current implementation uses in-memory storage. Rate limits reset on
server restart. For production clusters, consider Redis-based rate limiting.

---

## API Versioning

All endpoints use `/api/v1/` prefix. See `docs/api/versioning-strategy.md` for:

- Versioning approach
- Deprecation policy
- Breaking change policy
- Migration guide

---

## Related Documentation

- [Mobile-Safe Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md) -
  API standards and architecture rules
- [LiveRC Ingestion API Contracts](../architecture/liverc-ingestion/05-api-contracts.md) -
  Detailed ingestion API documentation
- [Error Handling Guide](../architecture/error-handling.md) - Comprehensive
  error handling documentation
- [API Versioning Strategy](./versioning-strategy.md) - API versioning and
  deprecation policies

---

**End of API Reference**
