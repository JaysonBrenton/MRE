<!--
File: telemetry/API_Contract_Telemetry.md
Author: Jayson Brenton
Co-author: The Brainy One
Date: 2026-01-30
Purpose: Define the public API contract, UX query patterns, and service boundaries for telemetry in MRE.
License: Proprietary, internal to MRE
-->

# Telemetry API Contract and Query Patterns

This document locks in section 2 from `Gaps And Recommended Additions.md`: a
clear API contract and query patterns that match the Telemetry UX.

It also defines where the existing Python service should be used versus what
belongs in the Next.js app.

---

## 1. Goals

- Provide an implementation ready API spec that supports the Telemetry UX
  screens.
- Make common reads fast, predictable, and cacheable.
- Make charting efficient using windowed queries, downsample levels, and payload
  caps.
- Support large exports and heavy reads using signed URLs.
- Ensure reproducibility using processing run versioning and immutable derived
  artefacts.
- Define pagination, filtering, time window semantics, caching, and error
  shapes.

## 2. Non goals

- Algorithm internals for GNSS plus IMU fusion, lap detection, and corner
  classification.
- Internal storage layout, queue selection, and worker orchestration details
  (covered elsewhere).

---

## 3. Service boundaries, Python vs Next.js

### 3.1 What the Python service should own

Use Python for compute heavy, stateful, or batch style workloads:

- Ingest and parsing: decode vendor formats, validate fields, normalise to
  canonical schema.
- Fusion and derivation: GNSS plus IMU alignment, filtering, EKF style fusion,
  smoothing.
- Downsampling: produce precomputed levels (raw, 50 Hz, 10 Hz, 5 Hz, 1 Hz, or
  equivalent).
- Derived analytics: lap boundaries, split timing, segments, corners, racing
  line hints.
- Quality scoring: compute quality metrics, flags, and explainers.
- Artefact generation: Parquet or Arrow datasets, map polylines, derived
  summaries.
- Background jobs: idempotent processing runs with retries and progress
  reporting.

Python outputs should be treated as immutable artefacts keyed by
`(session_id, processing_run_id, level, dataset_type)`.

### 3.2 What the Next.js app should own

Use Next.js (API routes) for auth, tenancy, orchestration, and small fast reads:

- API gateway: authentication, authorisation, multi tenant scoping.
- Metadata store: Postgres reads for sessions, laps, segments, processing run
  status.
- Signed URL minting: return short lived URLs for uploading and downloading
  artefacts.
- Read optimisation: ETag, cache headers, request shaping, response shaping for
  the UI.
- Job triggering: accept uploads, create session records, enqueue processing
  runs.
- Thin query layer: for time series windows, either
  - read from an analytics store or object storage level that is already
    downsampled, or
  - call into the Python service to produce missing windows or levels.

Rule of thumb:

- If it can be answered from Postgres metadata in under 400 ms P95, it belongs
  in Next.js.
- If it requires scanning time series, resampling, or fusion, it belongs in
  Python.

### 3.3 Interaction model

Recommended model:

- Next.js exposes the public API under `/api/v1/telemetry/*`.
- Python is internal only and runs workers or an internal processing API.
- Next.js stores metadata and pointers to artefacts (object keys) in Postgres.
- Time series is served as either inline JSON for small windows, or signed URL
  for large payloads.

---

## 4. Conventions

### 4.1 Base URL and versioning

- Base path: `/api/v1`
- Telemetry namespace: `/api/v1/telemetry`
- Responses are JSON unless stated otherwise.
- Backwards incompatible changes require a new major version.

### 4.2 Identifiers

- All IDs are UUIDs (see
  `docs/adr/ADR-20260131-telemetry-identifier-strategy.md`).
- Never expose object storage paths or internal keys.

### 4.3 Time semantics

Telemetry time is expressed as:

- `t_ms`: milliseconds since session start.
- `t_unix_ms`: milliseconds since Unix epoch.

Rules:

- Windows are start inclusive, end exclusive: `[start, end)`.
- Endpoints accept either `t_ms` or `t_unix_ms`, but not both.
- Charting and lap compare should prefer `t_ms`.

### 4.4 Pagination

Cursor pagination:

- Query: `limit` (default 50, max 200), `cursor`
- Response: `next_cursor` (string or null)

### 4.5 Errors

All errors return:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {},
    "request_id": "string"
  }
}
```

### 4.6 Caching

- GET responses should include `ETag`.
- Use `If-None-Match` to allow cheap `304`.
- While processing is ongoing, keep cache short.
- Completed processing outputs can have longer caching.

### 4.7 Large payload handling

Time series delivery modes:

- Inline JSON for small windows.
- Signed URL for large payloads, with `arrow` or `parquet` formats.

The server may reject oversized inline responses with `413`.

---

## 5. Resource model overview

Primary resources:

- Uploads: raw file intake, validation staging.
- Sessions: a user visible telemetry session.
- Processing runs: versioned execution records.
- Laps: lap boundaries and lap metrics.
- Segments and corners: derived and user editable.
- Time series: windowed traces at a selectable downsample level.

---

## 6. API endpoints

### 6.1 Upload intake

#### POST `/api/v1/telemetry/uploads`

Creates an upload record and returns a signed URL for direct upload.

Request:

```json
{
  "filename": "string",
  "content_type": "string",
  "size_bytes": 123,
  "source_device": {
    "make": "string",
    "model": "string",
    "firmware": "string"
  },
  "capture_hint": {
    "track_id": "string|null",
    "session_name": "string|null",
    "local_start_time": "string|null"
  }
}
```

Response `201`:

```json
{
  "upload": {
    "id": "upl_01H...",
    "status": "created",
    "created_at": "2026-01-30T10:00:00Z"
  },
  "upload_target": {
    "mode": "signed_url",
    "method": "PUT",
    "url": "string",
    "headers": {
      "Content-Type": "string"
    },
    "expires_at": "2026-01-30T10:10:00Z",
    "max_size_bytes": 104857600
  }
}
```

#### GET `/api/v1/telemetry/uploads/{uploadId}`

Response `200`:

```json
{
  "upload": {
    "id": "upl_01H...",
    "status": "created|uploaded|validated|failed",
    "filename": "string",
    "content_type": "string",
    "size_bytes": 123,
    "created_at": "string",
    "updated_at": "string",
    "failure": {
      "code": "string",
      "message": "string"
    }
  }
}
```

#### POST `/api/v1/telemetry/uploads/{uploadId}/finalise`

Signals upload completion, creates a session, and triggers ingestion.

Response `202`:

```json
{
  "accepted": true,
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "processing_run_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "next": {
    "poll_session": "/api/v1/telemetry/sessions/550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### 6.2 Sessions

#### GET `/api/v1/telemetry/sessions`

Query:

- `from`, `to` ISO date (optional)
- `track_id` (optional)
- `status` (optional)
- `q` free text (optional)
- `limit`, `cursor`

Response `200`:

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "string",
      "track_id": "trk_01H...",
      "device_summary": "string",
      "status": "processing|ready|failed",
      "start_time": { "t_unix_ms": 1738202400000 },
      "duration_ms": 600000,
      "lap_count": 12,
      "quality": { "score": 0.87, "tier": "good" },
      "created_at": "string"
    }
  ],
  "next_cursor": "string|null"
}
```

#### GET `/api/v1/telemetry/sessions/{sessionId}`

Session detail and overview summary.

Response `200`:

```json
{
  "session": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "string",
    "status": "processing|ready|failed",
    "track": {
      "id": "trk_01H...",
      "name": "string"
    },
    "device": {
      "make": "string",
      "model": "string",
      "firmware": "string"
    },
    "time_bounds": {
      "start_t_ms": 0,
      "end_t_ms": 600000,
      "start_t_unix_ms": 1738202400000,
      "end_t_unix_ms": 1738203000000
    },
    "sample_rates_hz": {
      "gnss": 10,
      "imu": 200
    },
    "channels": {
      "available": ["lat_deg", "lon_deg", "speed_mps", "ax_mps2", "ay_mps2"],
      "recommended": ["speed_mps", "ax_mps2", "ay_mps2"]
    },
    "laps_summary": {
      "lap_count": 12,
      "best_lap_ms": 41234,
      "median_lap_ms": 43110
    },
    "quality": {
      "score": 0.87,
      "tier": "good",
      "flags": ["gnss_ok", "imu_ok"],
      "notes": []
    },
    "processing": {
      "latest_run_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "algorithm_versions": {
        "parser": "parser_0.3.0",
        "fusion": "fusion_0.2.1",
        "lap_detect": "lap_0.1.0"
      }
    }
  }
}
```

---

### 6.3 Laps

#### GET `/api/v1/telemetry/sessions/{sessionId}/laps`

Query:

- `valid_only` (default true)
- `sort` (default `lap_number`)
- `limit`, `cursor`

Response `200`:

```json
{
  "items": [
    {
      "id": "lap_01H...",
      "lap_number": 1,
      "valid": true,
      "lap_time_ms": 43110,
      "time_bounds": { "start_t_ms": 12000, "end_t_ms": 55110 },
      "quality": { "score": 0.85, "tier": "good", "flags": [] },
      "metrics": {
        "max_speed_mps": 18.2,
        "avg_speed_mps": 12.1,
        "distance_m": 523.4
      }
    }
  ],
  "next_cursor": "string|null"
}
```

#### GET `/api/v1/telemetry/sessions/{sessionId}/laps/{lapId}`

Response `200`:

```json
{
  "lap": {
    "id": "lap_01H...",
    "lap_number": 3,
    "valid": true,
    "lap_time_ms": 41234,
    "time_bounds": { "start_t_ms": 133000, "end_t_ms": 174234 },
    "quality": { "score": 0.91, "tier": "excellent", "flags": [] },
    "splits": [
      {
        "segment_id": "seg_01H...",
        "name": "Main straight",
        "duration_ms": 6123
      }
    ],
    "notes": []
  }
}
```

---

### 6.4 Channels and schemas

#### GET `/api/v1/telemetry/sessions/{sessionId}/channels`

Response `200`:

```json
{
  "channels": [
    {
      "name": "speed_mps",
      "unit": "m/s",
      "dtype": "float32",
      "sources": ["gnss", "fusion"],
      "levels": ["raw", "ds_50hz", "ds_10hz", "ds_5hz", "ds_1hz"]
    }
  ],
  "defaults": {
    "max_points": 4000,
    "preferred_level": "ds_10hz"
  }
}
```

---

### 6.5 Time series query

#### GET `/api/v1/telemetry/sessions/{sessionId}/timeseries`

Primary windowed time series endpoint for interactive charts.

Query:

- `channels` required, comma separated
- choose one window selector:
  - `start_t_ms`, `end_t_ms`
  - `start_t_unix_ms`, `end_t_unix_ms`
  - `lap_id`

- downsample:
  - `level` optional: `raw|ds_50hz|ds_10hz|ds_5hz|ds_1hz`
  - `target_points` optional, server chooses nearest level
  - `max_points` optional, default 4000, max 20000

- delivery:
  - `format` optional: `json` default, or `arrow`, or `parquet`
  - `delivery` optional: `inline` or `signed_url`

Response `200` inline JSON:

```json
{
  "meta": {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "window": { "start_t_ms": 133000, "end_t_ms": 174234 },
    "level": "ds_10hz",
    "point_count": 4124,
    "time_key": "t_ms"
  },
  "schema": {
    "t_ms": { "dtype": "int64", "unit": "ms" },
    "speed_mps": { "dtype": "float32", "unit": "m/s" },
    "ax_mps2": { "dtype": "float32", "unit": "m/s^2" }
  },
  "data": {
    "t_ms": [133000, 133100],
    "speed_mps": [12.1, 12.2],
    "ax_mps2": [0.1, 0.2]
  }
}
```

Response `200` signed URL:

```json
{
  "meta": {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "window": { "start_t_ms": 0, "end_t_ms": 600000 },
    "level": "ds_5hz",
    "point_count": 30000,
    "time_key": "t_ms"
  },
  "delivery": {
    "mode": "signed_url",
    "format": "arrow",
    "url": "string",
    "expires_at": "string",
    "bytes_estimate": 1200000
  }
}
```

Where Python is used:

- If requested data is not already present as an artefact (level missing,
  derived missing), Next.js should trigger a processing run or an on demand
  materialisation job in Python.
- If requested data is present, Next.js returns it directly from storage via
  inline JSON or signed URL.

---

### 6.6 Lap compare

#### POST `/api/v1/telemetry/sessions/{sessionId}/laps/compare`

Request:

```json
{
  "lap_ids": ["lap_01H...", "lap_01H..."],
  "align": {
    "mode": "distance",
    "resample_points": 1500
  },
  "channels": ["speed_mps", "ax_mps2"],
  "include": {
    "delta_to": "first",
    "splits": true
  }
}
```

Response `200`:

```json
{
  "meta": {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "align": { "mode": "distance", "resample_points": 1500 }
  },
  "laps": [
    {
      "lap_id": "lap_01H...",
      "lap_number": 3,
      "lap_time_ms": 41234,
      "series": {
        "s_m": [0, 1.2],
        "speed_mps": [12.1, 12.2],
        "ax_mps2": [0.1, 0.2]
      }
    }
  ],
  "delta": {
    "baseline_lap_id": "lap_01H...",
    "to_baseline": [
      {
        "lap_id": "lap_01H...",
        "lap_time_delta_ms": 420,
        "time_delta_series_ms": [0, 5, 10]
      }
    ]
  },
  "splits": [
    {
      "segment_id": "seg_01H...",
      "name": "Main straight",
      "baseline_ms": 6123,
      "other_ms": 6210
    }
  ]
}
```

Python responsibility:

- Alignment by distance and resampling is compute heavy and should be served by
  Python generated artefacts when possible.
- For interactive compare, a fast path is a cached compare artefact keyed by
  `(session_id, lap_ids_hash, channels_hash, align)`.

---

### 6.7 Track map and racing line

#### GET `/api/v1/telemetry/sessions/{sessionId}/map`

Query:

- `level` optional, default `ds_1hz`
- `lap_id` optional

Response `200`:

```json
{
  "meta": { "level": "ds_1hz", "point_count": 600 },
  "data": {
    "lat_deg": [-35.2, -35.2],
    "lon_deg": [149.1, 149.1]
  }
}
```

Python responsibility:

- Precompute map polylines per session and optionally per lap.

---

### 6.8 Segments and corners

#### GET `/api/v1/telemetry/sessions/{sessionId}/segments`

Response `200`:

```json
{
  "segments": [
    {
      "id": "seg_01H...",
      "name": "Main straight",
      "kind": "segment",
      "bounds": {
        "mode": "track_progress",
        "start": 0.12,
        "end": 0.21
      },
      "source": "derived|user",
      "version": 3
    }
  ],
  "corners": [
    {
      "id": "cor_01H...",
      "name": "Turn 1",
      "kind": "corner",
      "bounds": { "mode": "track_progress", "start": 0.21, "end": 0.28 },
      "classification": { "type": "right", "severity": "medium" },
      "source": "derived|user",
      "version": 1
    }
  ]
}
```

#### PUT `/api/v1/telemetry/sessions/{sessionId}/segments`

Headers:

- `If-Match: "etag_value"`

Request:

```json
{
  "segments": [
    {
      "id": "seg_01H...",
      "name": "Main straight",
      "bounds": { "mode": "track_progress", "start": 0.11, "end": 0.22 },
      "version": 3
    }
  ]
}
```

Response `200`:

- Returns updated objects and a new `ETag`.

---

### 6.9 Processing runs

#### GET `/api/v1/telemetry/sessions/{sessionId}/processing-runs`

Response `200`:

```json
{
  "items": [
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "status": "queued|running|succeeded|failed",
      "started_at": "string|null",
      "finished_at": "string|null",
      "algorithm_versions": {
        "parser": "parser_0.3.0",
        "fusion": "fusion_0.2.1",
        "lap_detect": "lap_0.1.0"
      },
      "outputs": {
        "laps": true,
        "segments": true,
        "timeseries_levels": ["raw", "ds_10hz", "ds_1hz"]
      }
    }
  ]
}
```

---

## 7. Query patterns by screen

This section describes recommended request sequences that match the UX
assumptions.

### 7.1 Session Overview

Goal: page shell and key numbers in one call, then hydrate.

1. `GET /telemetry/sessions/{sessionId}`

- ETag and revalidate on focus.

2. `GET /telemetry/sessions/{sessionId}/laps?valid_only=true&limit=200`

3. `GET /telemetry/sessions/{sessionId}/map?level=ds_1hz`

Lazy loads:

- `GET /telemetry/sessions/{sessionId}/segments`
- `GET /telemetry/sessions/{sessionId}/channels`

### 7.2 Lap detail charting

1. `GET /telemetry/sessions/{sessionId}/laps/{lapId}`

2. `GET /telemetry/sessions/{sessionId}/timeseries?lap_id={lapId}&channels=speed_mps,ax_mps2&target_points=2500`

When zooming:

- Use explicit `start_t_ms` and `end_t_ms` for the visible window, keep
  `target_points` constant.

### 7.3 Lap compare

1. `POST /telemetry/sessions/{sessionId}/laps/compare`

- Use `align.mode=distance`.

2. Add channels by repeating the request with a new `channels` list.

### 7.4 Full session export

1. `GET /telemetry/sessions/{sessionId}/timeseries?channels=...&level=ds_10hz&format=arrow&delivery=signed_url`

### 7.5 Processing status polling

1. `GET /telemetry/sessions/{sessionId}`

- If `status=processing`, poll at 2 seconds for the first 10 seconds, then back
  off to 5 seconds.
- Use ETag and `If-None-Match` to get cheap `304` responses.

---

## 8. Validation rules

- `channels` must be non empty and valid for the session, else `400`.
- Time bounds must be within session bounds, else `422`.
- `end` must be greater than `start`, else `400`.
- `max_points` must be within allowed limits, else `400`.
- `level` must be supported for the session, else `400`.
- `lap_id` must belong to the session, else `404`.

---

## 9. Performance expectations

- Session summary, laps list, segments list should be served from Postgres and
  cached, target P95 under 400 ms.
- Timeseries inline responses should cap points to keep payload small, target
  P95 under 800 ms.
- Signed URL responses should return quickly, actual download bypasses API.

---

## 10. Open decisions to lock in next

1. Binary format preference for signed URL time series:

- Arrow IPC recommended for fast client parsing.
- Parquet recommended for storage and batch processing.

2. Downsample naming and generation policy:

- Rate based names (`ds_10hz`) are easiest to reason about.
- Define which levels are always generated by default.

3. Lap compare caching:

- Define compare artefact caching strategy and TTL.

4. Track progress mapping:

- `track_progress` bounds are easiest for editing segments, but require a stable
  mapping function and versioning.
