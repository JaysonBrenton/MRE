---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Complete API reference documentation for all MRE API endpoints
purpose: Provides a comprehensive catalog of all API endpoints, including request/response
         formats, authentication requirements, error codes, and usage examples. This serves
         as the single source of truth for API consumers including frontend developers,
         mobile developers, and API integration partners.
relatedFiles:
  - docs/architecture/mobile-safe-architecture-guidelines.md (API standards)
  - docs/architecture/liverc-ingestion/05-api-contracts.md (LiveRC ingestion APIs)
  - src/lib/api-utils.ts (response format utilities)
  - src/app/api/v1/ (API route implementations)
---

# API Reference Documentation

**Last Updated:** 2025-01-27  
**API Version:** v1  
**Base URL:** `/api/v1/` (relative to application root)

This document provides a complete reference for all API endpoints in the My Race Engineer (MRE) application. All endpoints follow the mobile-safe architecture guidelines and use standardized request/response formats.

---

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication Endpoints](#authentication-endpoints)
3. [LiveRC Ingestion Endpoints](#liverc-ingestion-endpoints)
4. [Health Check](#health-check)
5. [Error Handling](#error-handling)
6. [Authentication Requirements](#authentication-requirements)
7. [Rate Limiting](#rate-limiting)

---

## API Overview

### Base Path

All versioned API endpoints are prefixed with `/api/v1/`. The health check endpoint uses `/api/health` (unversioned).

### Response Format

All API responses follow a standardized format defined in `docs/architecture/mobile-safe-architecture-guidelines.md`:

**Success Response:**
```json
{
  "success": true,
  "data": { /* response data */ },
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
    "details": { /* optional error details */ }
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

**Note:** This endpoint returns user data but session management is handled by NextAuth. For web clients, cookies are set automatically. Future mobile clients will receive tokens.

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

**Authentication:** Not required (may change in future)

**Query Parameters:**
- `followed` (boolean, optional, default: `true`) - If true, return only tracks where `is_followed = true` AND `is_active = true`
- `active` (boolean, optional, default: `true`) - If false, include inactive tracks

**Response (200 OK):**
```json
{
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
```

**Error Codes:**
- `INTERNAL_ERROR` (500) - Server error

**Example:**
```bash
curl "http://localhost:3001/api/v1/tracks?followed=true&active=true"
```

---

### GET /api/v1/events/search

Searches for events by track and date range.

**Authentication:** Not required (may change in future)

**Query Parameters:**
- `track_id` (string, required) - Track UUID
- `start_date` (string, required) - Start date in ISO 8601 format (YYYY-MM-DD)
- `end_date` (string, required) - End date in ISO 8601 format (YYYY-MM-DD)

**Response (200 OK):**
```json
{
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
```

**Error Codes:**
- `VALIDATION_ERROR` (400) - Missing or invalid query parameters
- `NOT_FOUND` (404) - Track not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**
```bash
curl "http://localhost:3001/api/v1/events/search?track_id=uuid&start_date=2025-01-01&end_date=2025-12-31"
```

---

### GET /api/v1/events/[eventId]

Gets detailed information about a specific event.

**Authentication:** Not required (may change in future)

**Path Parameters:**
- `eventId` (string, required) - Event UUID

**Response (200 OK):**
```json
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

Discovers events from LiveRC for a track and date range. This endpoint compares LiveRC events with existing database events and returns which events are new vs already in the database.

**Authentication:** Not required (may change in future)

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
- `DISCOVERY_FAILED` (500) - Failed to discover events from LiveRC
- `INTERNAL_ERROR` (500) - Server error

**Example:**
```bash
curl -X POST "http://localhost:3001/api/v1/events/discover" \
  -H "Content-Type: application/json" \
  -d '{"track_id": "uuid", "start_date": "2025-01-01", "end_date": "2025-12-31"}'
```

---

### POST /api/v1/events/ingest

Ingests a newly discovered LiveRC event by `source_event_id` and `track_id`. This endpoint creates the Event row if it doesn't exist, then proceeds with full ingestion.

**Authentication:** Not required (may require admin in future)

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
- `laps_full` - Complete data including races, results, and all lap times (default)

**V1 Note**: In V1, "Import Event" always means `laps_full` ingestion. The `none` depth is used for event discovery, but users always get complete data when importing an event.

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
- Used for importing newly discovered LiveRC events where no Event row exists yet
- The pipeline fetches full event metadata from LiveRC and creates the Event row if needed
- Idempotent - repeated calls with the same `source_event_id` and `track_id` converge on a single Event row

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

**Authentication:** Not required (may require admin in future)

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
- `laps_full` - Complete data including races, results, and all lap times (default)

**V1 Note**: In V1, "Import Event" always means `laps_full` ingestion. The `none` depth is used for event discovery, but users always get complete data when importing an event.

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

**Note:** This endpoint proxies requests to the Python ingestion service. See `docs/architecture/liverc-ingestion/05-api-contracts.md` for detailed ingestion API documentation.

---

### GET /api/v1/races/[raceId]

Gets detailed race results for a specific race.

**Authentication:** Not required (may change in future)

**Path Parameters:**
- `raceId` (string, required) - Race UUID

**Response (200 OK):**
```json
{
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
        "source_driver_id": "driver-id"
      }
    }
  ]
}
```

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

**Authentication:** Not required (may change in future)

**Path Parameters:**
- `raceId` (string, required) - Race UUID

**Response (200 OK):**
```json
{
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

**Authentication:** Not required (may change in future)

**Path Parameters:**
- `raceResultId` (string, required) - Race Result UUID

**Response (200 OK):**
```json
{
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
```

**Error Codes:**
- `NOT_FOUND` (404) - Race result not found
- `INTERNAL_ERROR` (500) - Server error

**Example:**
```bash
curl "http://localhost:3001/api/v1/race-results/uuid/laps"
```

---

## Health Check

### GET /api/health

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
curl "http://localhost:3001/api/health"
```

**Note:** This endpoint is unversioned and used by Docker health checks. It does not follow the standard API response format.

---

## Error Handling

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

### Error Code Catalog

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters or body |
| `INVALID_CREDENTIALS` | 401 | Invalid email or password |
| `EMAIL_ALREADY_EXISTS` | 409 | Email is already registered |
| `NOT_FOUND` | 404 | Requested resource does not exist |
| `INGESTION_IN_PROGRESS` | 409 | Ingestion already running for this resource |
| `INGESTION_FAILED` | 500 | Ingestion process failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Error Handling Best Practices

1. **Client-side:** Always check the `success` field before accessing `data`
2. **Error Messages:** Display `error.message` to users, log `error.code` for debugging
3. **Retry Logic:** Only retry on `INTERNAL_ERROR` (500), not on client errors (4xx)
4. **Error Details:** The `details` field may contain additional context for debugging

---

## Authentication Requirements

### Current State (Alpha)

- Authentication endpoints (`/api/v1/auth/*`) do not require authentication
- Most data endpoints do not require authentication (may change in future)
- Web sessions are managed via NextAuth cookies
- Mobile token-based authentication is architecturally supported but not yet implemented

### Future State

- Data endpoints will require authentication
- Admin endpoints will require admin privileges
- Mobile clients will use token-based authentication
- Rate limiting will be implemented per user/session

**See:** `docs/architecture/mobile-safe-architecture-guidelines.md` Section 5 for authentication architecture details.

---

## Rate Limiting

**Status:** Implemented

Rate limiting is applied to authentication and resource-intensive endpoints to prevent abuse and ensure fair usage.

### Rate Limits

| Endpoint | Limit | Window | Purpose |
|----------|-------|--------|---------|
| `POST /api/v1/auth/login` | 5 requests | 15 minutes | Prevent brute force attacks |
| `POST /api/v1/auth/register` | 10 requests | 1 hour | Prevent account spam |
| `POST /api/v1/events/{id}/ingest` | 10 requests | 1 minute | Prevent resource exhaustion |
| `POST /api/v1/events/ingest` | 10 requests | 1 minute | Prevent resource exhaustion |
| `POST /api/v1/events/discover` | 20 requests | 1 minute | Prevent excessive external calls |

### Rate Limit Headers

Successful responses include rate limit information in headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in window |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Unix timestamp when window resets |

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

**Note:** Current implementation uses in-memory storage. Rate limits reset on server restart. For production clusters, consider Redis-based rate limiting.

---

## API Versioning

All endpoints use `/api/v1/` prefix. See `docs/api/versioning-strategy.md` for:
- Versioning approach
- Deprecation policy
- Breaking change policy
- Migration guide

---

## Related Documentation

- [Mobile-Safe Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md) - API standards and architecture rules
- [LiveRC Ingestion API Contracts](../architecture/liverc-ingestion/05-api-contracts.md) - Detailed ingestion API documentation
- [Error Handling Guide](../architecture/error-handling.md) - Comprehensive error handling documentation
- [API Versioning Strategy](./versioning-strategy.md) - API versioning and deprecation policies

---

**End of API Reference**

