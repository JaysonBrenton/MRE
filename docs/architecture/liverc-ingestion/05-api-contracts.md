---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: API contracts for LiveRC ingestion subsystem HTTP endpoints
purpose: Defines the backend HTTP API contracts used by MRE to interact with ingested
         LiveRC data and trigger ingestion operations. Specifies versioned endpoints,
         request/response formats, error handling, and authentication requirements.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/06-admin-cli-spec.md
  - docs/specs/mre-alpha-feature-scope.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
---

# 05. API Contracts (LiveRC Ingestion Subsystem)

**Status:** This ingestion subsystem is **in scope for the Alpha release**. See [MRE Alpha Feature Scope](../../specs/mre-alpha-feature-scope.md) for Alpha feature specifications.

**Related Documentation:**
- [LiveRC Ingestion Overview](01-overview.md) - System overview
- [Mobile-Safe Architecture Guidelines](../mobile-safe-architecture-guidelines.md) - Overall MRE architecture principles (Section 3 defines API versioning standards)

This document defines the backend HTTP API contracts used by My Race Engineer (MRE) to interact with data ingested from LiveRC and to trigger ingestion operations.

All routes described here are:
- Backend-only.
- Versioned and stable.
- Independent of connector implementation details.
- Strictly read-from-DB, except for explicit ingestion triggers.

The goals of these APIs are:
- To allow the frontend to query the Track and Event catalogues.
- To allow the frontend or admin tools to trigger ingestion for a specific event.
- To expose structured race and lap data for visualisation and analytics.
- To maintain clear separation between ingestion, storage, and presentation.

---

## 1. Conventions

### 1.1 Base Path and Versioning

All endpoints in this document are prefixed with the path:

/api/v1/

Example endpoint:
GET /api/v1/tracks

**Note:** This follows the Mobile-Safe Architecture Guidelines (see `docs/architecture/mobile-safe-architecture-guidelines.md` Section 3.1) which mandate `/api/v1/...` for all API endpoints. The ingestion subsystem APIs are part of the overall MRE API structure.

### 1.2 ID Semantics

track_id refers to the primary key from the Track table.  
event_id refers to the primary key from the Event table.  
race_id refers to the primary key from the Race table.  
race_result_id refers to the primary key from the RaceResult table.  

Clients MUST treat these as opaque identifiers.

### 1.3 Error Shape

All errors MUST follow a standard envelope:

{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": {}
  }
}

Standard error codes include:
- NOT_FOUND: Requested resource does not exist
- VALIDATION_ERROR: Invalid parameters or request body
- INGESTION_IN_PROGRESS: Ingestion already running for this resource
- INGESTION_FAILED: Upstream scraping, parsing, or ingestion failure
- INTERNAL_ERROR: Unknown server-side error

---

## 2. Track Catalogue APIs

### 2.1 GET /tracks

Returns the list of known tracks.  
By default, this returns followed and active tracks suitable for user selection.

Query parameters:
- followed (boolean, optional): If true (default), return only tracks where is_followed = true AND is_active = true
- active (boolean, optional): If false, include inactive tracks as well

Example response:

{
  "tracks": [
    {
      "id": 42,
      "source": "liverc",
      "source_track_slug": "canberraoffroad",
      "track_name": "Canberra Off Road Model Car Club",
      "track_url": "https://canberraoffroad.liverc.com/",
      "events_url": "https://canberraoffroad.liverc.com/events",
      "liverc_track_last_updated": "1 minute ago",
      "is_active": true,
      "is_followed": true
    }
  ]
}

Backend behaviour:
- MUST operate purely on the Track table.
- MUST NOT call LiveRC.
- MUST return an empty list when no rows match.

---

## 3. Event Catalogue APIs

### 3.1 GET /events/search

Returns events for a given track, optionally filtered by a Held-Between date range.

Required query parameters:
- track_id
- start_date (ISO date)
- end_date (ISO date)

Example response:

{
  "track": {
    "id": 42,
    "source": "liverc",
    "source_track_slug": "canberraoffroad",
    "track_name": "Canberra Off Road Model Car Club"
  },
  "events": [
    {
      "id": 101,
      "source": "liverc",
      "source_event_id": "6304829",
      "event_name": "Cormcc 2025 Rudi Wensing Memorial, Clay Cup",
      "event_date": "2025-11-16T08:30:00Z",
      "event_entries": 114,
      "event_drivers": 87,
      "event_url": "https://canberraoffroad.liverc.com/results/?p=view_event&id=6304829",
      "ingest_depth": "none",
      "last_ingested_at": null
    }
  ]
}

Backend behaviour:
- MUST validate that track_id exists.
- MUST validate that start_date <= end_date.
- MUST apply the date filter to event_date.
- MUST NOT call LiveRC.
- MUST return an empty event list if no matches are found.

---

### 3.2 GET /events/{event_id}

Returns metadata and ingestion status for a specific event.

Example response:

{
  "id": 101,
  "source": "liverc",
  "source_event_id": "6304829",
  "track_id": 42,
  "event_name": "Cormcc 2025 Rudi Wensing Memorial, Clay Cup",
  "event_date": "2025-11-16T08:30:00Z",
  "event_entries": 114,
  "event_drivers": 87,
  "event_url": "https://canberraoffroad.liverc.com/results/?p=view_event&id=6304829",
  "ingest_depth": "laps_full",
  "last_ingested_at": "2025-11-17T02:15:00Z",
  "races": [
    {
      "id": 501,
      "event_id": 101,
      "class_name": "1/8 Nitro Buggy",
      "race_label": "A-Main",
      "race_order": 14,
      "start_time": "2025-11-16T17:30:00Z",
      "duration_seconds": 1800
    }
  ]
}

Backend behaviour:
- If ingest_depth = none, MAY omit races or return an empty race list.
- If ingest_depth = laps_full, SHOULD include race summaries.
- MUST NOT call LiveRC.
- MUST return NOT_FOUND if event_id does not exist.

---

## 4. Event Discovery and Ingestion APIs

### 4.1 POST /events/discover

Discovers events from LiveRC for a track. This is a **pure connector endpoint** with **no database access**.

**Python Ingestion Service Endpoint:** `POST /api/v1/events/discover`

Request body:
- `track_slug` (string, required) - Track slug from LiveRC
- `start_date` (string, optional) - ISO-like date string for filtering
- `end_date` (string, optional) - ISO-like date string for filtering

Example request:
```json
{
  "track_slug": "canberraoffroad",
  "start_date": "2025-01-01",
  "end_date": "2025-12-31"
}
```

Example response:
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "source": "liverc",
        "source_event_id": "6304829",
        "track_slug": "canberraoffroad",
        "event_name": "Event Name",
        "event_date": "2025-11-16T08:30:00Z",
        "event_entries": 114,
        "event_drivers": 87,
        "event_url": "https://canberraoffroad.liverc.com/results/?p=view_event&id=6304829"
      }
    ]
  }
}
```

Backend behaviour:
- MUST NOT access the database
- MUST call `connector.list_events_for_track(track_slug)` to fetch events from LiveRC
- MUST filter events by date range in Python if `start_date` and/or `end_date` are provided
- MUST return standard envelope: `{ success: true, data: { events: [...] } }` on success
- MUST return standard error envelope on failure with `source: "liverc_discovery"`

**TypeScript v1 Route:** `POST /api/v1/events/discover`

Request body:
- `track_id` (UUID string, required) - Track ID from database
- `start_date` (string, optional) - ISO date string
- `end_date` (string, optional) - ISO date string

Example response:
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
        "eventUrl": "https://canberraoffroad.liverc.com/results/?p=view_event&id=6304829"
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
        "eventUrl": "https://canberraoffroad.liverc.com/results/?p=view_event&id=6304830"
      }
    ]
  }
}
```

Backend behaviour:
- MUST look up track by `track_id` to get track slug
- MUST load existing DB events for that track and date range
- MUST call Python discovery endpoint
- MUST compare LiveRC events with DB events using `sourceEventId` as join key
- MUST separate into `new_events` (in LiveRC but not in DB) and `existing_events` (in both)
- MUST return standard envelope with comparison results

---

### 4.2 POST /events/ingest

Ingests an event by `source_event_id` and `track_id`. This endpoint can create the Event row if it doesn't exist.

**Python Ingestion Service Endpoint:** `POST /api/v1/events/ingest`

Request body:
- `source_event_id` (string, required) - LiveRC event ID
- `track_id` (UUID string, required) - Track ID from database
- `depth` (string, optional) - Ingestion depth, default: "laps_full"

Example request:
```json
{
  "source_event_id": "6304829",
  "track_id": "uuid",
  "depth": "laps_full"
}
```

Example response:
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

Backend behaviour:
- MUST validate request body
- MUST verify track exists
- MUST call pipeline method that can handle ingest-by-source-id
- Pipeline MUST fetch full event metadata from LiveRC if Event doesn't exist
- Pipeline MUST upsert Event row with correct `track_id` and metadata
- Pipeline MUST proceed with normal ingestion flow using the Event row
- MUST be idempotent - repeated calls converge on a single Event row
- MUST return standard envelope

**TypeScript v1 Route:** `POST /api/v1/events/ingest`

Request body: Same as Python endpoint

Response: Same standard envelope format

---

### 4.3 POST /events/{event_id}/ingest

Triggers ingestion (or re-ingestion) of an existing event by event ID.

**Python Ingestion Service Endpoint:** `POST /api/v1/events/{event_id}/ingest`

Request body:
- `depth` (string, optional) - Ingestion depth, default: "laps_full"

Example request:
```json
{
  "depth": "laps_full"
}
```

Example response:
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

Backend behaviour:
- MUST validate that the event exists.
- MUST validate depth.
- MUST be idempotent.
- MUST NOT duplicate data if already fully ingested.
- MAY run synchronously for V1.
- MUST update ingest_depth and last_ingested_at.
- MUST return standard envelope: `{ success: true, data: {...} }` on success
- MUST return standard error envelope on failure with `source: "ingest_event"`

Disallowed transitions:
- MUST NOT regress from laps_full to none.

**TypeScript v1 Route:** `POST /api/v1/events/{eventId}/ingest`

Request body: Same as Python endpoint

Response: Same standard envelope format

---

## 5. Race and Result APIs

### 5.1 GET /races/{race_id}

Returns race metadata and all driver results.

Example response:

{
  "race": {
    "id": 501,
    "event_id": 101,
    "class_name": "1/8 Nitro Buggy",
    "race_label": "A-Main",
    "race_order": 14,
    "start_time": "2025-11-16T17:30:00Z",
    "duration_seconds": 1800
  },
  "results": [
    {
      "race_result_id": 9001,
      "position_final": 1,
      "laps_completed": 47,
      "total_time_seconds": 1831.382,
      "fast_lap_time": 37.234,
      "avg_lap_time": 38.983,
      "consistency": 92.82,
      "driver": {
        "race_driver_id": 8001,
        "display_name": "FELIX KOEGLER",
        "source_driver_id": "346997"
      }
    }
  ]
}

Backend behaviour:
- MUST read exclusively from the database.
- MUST NOT call LiveRC.
- MUST return results ordered by position_final.

---

## 6. Lap Data APIs

### 6.1 GET /race-results/{race_result_id}/laps

Returns all laps for a single driver.

Example response:

{
  "race_result_id": 9001,
  "laps": [
    {
      "lap_number": 1,
      "position_on_lap": 1,
      "lap_time_seconds": 38.170,
      "lap_time_raw": "38.17",
      "pace_string": "48/30:32.160",
      "elapsed_race_time": 38.170,
      "segments_json": []
    }
  ]
}

---

### 6.2 GET /races/{race_id}/laps

Returns lap data for multiple drivers.

Example response:

{
  "race_id": 501,
  "series": [
    {
      "race_result_id": 9001,
      "driver": {
        "race_driver_id": 8001,
        "display_name": "FELIX KOEGLER",
        "source_driver_id": "346997"
      },
      "laps": [
        { "lap_number": 1, "lap_time_seconds": 38.170, "elapsed_race_time": 38.170 },
        { "lap_number": 2, "lap_time_seconds": 37.922, "elapsed_race_time": 76.092 }
      ]
    }
  ]
}

Backend rules for overlays:
- MUST return full lap datasets for all drivers when no filter is supplied.
- MUST support any subset when race_result_ids is provided.
- MUST NOT impose any backend limit.
- MUST NOT aggregate or truncate lap data.
- MUST maintain deterministic ordering of drivers and laps.

---

## 7. Rate Limiting and Safety

- SHOULD apply ingestion throttling (e.g., one ingestion per event per N minutes unless forced).
- GET endpoints generally should not be rate-limited.
- Rate limiting MUST NOT change response schemas.

---

## 8. Stability Guarantees

- All /api/v1/ endpoints MUST remain backward compatible.
- Breaking changes require a new API version prefix.
- IDs and data formats MUST remain stable within a version.
- Ingestion MUST be deterministic for the same LiveRC inputs.

---

End of 05-api-contracts.md.
