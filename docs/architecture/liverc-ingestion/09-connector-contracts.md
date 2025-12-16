---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Interface contracts between ingestion pipeline and LiveRC connector
purpose: Defines the strict interface contracts between the MRE ingestion pipeline and
         the LiveRC connector, specifying data types, method signatures, error handling,
         and expected behaviours. Ensures clean separation between connector and pipeline
         layers.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/02-connector-architecture.md
  - docs/architecture/liverc-ingestion/10-connector-browser-strategy.md
  - docs/specs/mre-alpha-feature-scope.md
---

# 09. Connector Contracts (LiveRC Ingestion Subsystem)

This document defines the strict interface contracts between the MRE ingestion
pipeline and the LiveRC connector. The connector is responsible for retrieving
and parsing LiveRC web pages. The ingestion pipeline is responsible for
normalisation and persistence. These roles MUST remain fully separated.

All connector functions MUST return structured domain objects and MUST NEVER
return raw HTML to the ingestion layer.

---

## 1. Purpose of the Connector Layer

The connector:

- Fetches pages from LiveRC using HTTPX or Playwright (only when required)
- Parses event pages into structured objects
- Parses race result pages into structured objects
- Extracts driver lap series
- Detects unexpected page conditions (e.g., missing tables, malformed rows)
- Raises structured errors when LiveRC content cannot be interpreted

The connector MUST NOT know anything about the MRE database schema.

---

## 2. Connector Guiding Principles

1. **Deterministic output**  
   Same HTML → same structured object.

2. **Strict type guarantees**  
   All fields MUST be present and valid. Missing fields MUST raise an error.

3. **Zero business logic**  
   No ingestion state checks. No DB writes. No timestamps.

4. **Idempotency at the data level**  
   A second parse of the same page MUST produce the same object.

5. **Browser automation minimized**  
   Playwright SHOULD only be used when absolutely necessary, typically for:
   - event pages that require expanding sections
   - race pages with dynamic content

6. **Connector errors must be domain-specific**  
   The ingestion layer should receive errors such as:
   - EventPageFormatError
   - RacePageFormatError
   - LapTableMissingError
   - ConnectorHTTPError

Never generic exceptions.

---

## 3. Core Domain Output Models

The connector MUST output the following domain objects:

### 3.1 ConnectorEventSummary
Represents the high-level parsed data from an event page.

Fields:
- source_event_id (string)
- event_name (string)
- event_date (ISO timestamp)
- event_entries (integer)
- event_drivers (integer)
- races (list of ConnectorRaceSummary)

### 3.2 ConnectorRaceSummary
Represents metadata describing a single race within an event.

Fields:
- source_race_id (string)
- class_name (string)
- race_label (string)  
  (e.g. “A-Main”, “Heat 2”, “Qualifier 1”)
- race_order (integer)
- race_url (string)
- start_time (ISO timestamp) or null
- duration_seconds (integer or null)

### 3.3 ConnectorRaceResult
Represents a driver’s results in a race.

Fields:
- source_driver_id (string)
- display_name (string)
- position_final (integer)
- laps_completed (integer)
- total_time_seconds (float)
- fast_lap_time (float or null)
- avg_lap_time (float or null)
- consistency (float or null)

### 3.4 ConnectorLap
Represents a single lap.

Fields:
- lap_number (integer)
- position_on_lap (integer)
- lap_time_seconds (float)
- lap_time_raw (string)
- pace_string (string or null)
- elapsed_race_time (float)
- segments (list of segment strings or empty list)

### 3.5 ConnectorRacePackage
Represents a full race ingestion unit returned from parsing a race page.

Fields:
- race_summary (ConnectorRaceSummary)
- results (list of ConnectorRaceResult)
- laps_by_driver (dict keyed by source_driver_id → list of ConnectorLap)

---

## 4. Required Connector Functions

The connector MUST export the following functions. These are contracts the
ingestion pipeline depends on.

### 4.1 fetch_event_page(track_slug, source_event_id)
Returns: ConnectorEventSummary

Responsibilities:
- Build the correct event URL
- Fetch page (HTTP or Playwright)
- Extract top-level event metadata
- Extract list of races
- Validate all race summaries
- Raise EventPageFormatError on malformed content

---

### 4.2 fetch_race_page(race_summary)
Returns: ConnectorRacePackage

Responsibilities:
- Fetch race result page
- Extract result table
- Extract lap tables for each driver
- Produce a ConnectorRacePackage
- Raise RacePageFormatError on malformed content

This function MUST fully resolve lap data for all drivers in the race.

---

### 4.3 fetch_lap_series(race_summary, source_driver_id)
Returns: List[ConnectorLap]

This is an optional helper depending on implementation.

Responsibilities:
- Extract lap table for a single driver
- Raise LapTableMissingError if data cannot be found

In V1, this SHOULD NOT be called by the ingestion layer directly. The pipeline
will rely on fetch_race_page, which handles all drivers.

---

## 5. Error Contracts

Connector errors MUST be MRE-specific and MUST NOT expose low-level details.

Required error types:

- ConnectorHTTPError  
- EventPageFormatError  
- RacePageFormatError  
- LapTableMissingError  
- UnsupportedLiveRCVariantError  

Rules:
- Errors MUST include both a human-readable message and a machine-readable code.
- Errors MUST NOT contain HTML snippets or raw responses.
- Errors MUST be logged by the ingestion pipeline, not the connector itself.

---

## 6. URL Construction Rules

The connector MUST consistently derive URLs based on:

- Track slug  
  (e.g. “canberraoffroad” → https://canberraoffroad.liverc.com)

- Event page  
  /results/?p=view_event&id={source_event_id}

- Race page  
  /results/?p=view_race_result&id={source_race_id}

URL rules MUST be centralised in a utility module to prevent duplication.

---

## 7. Connector Determinism Guarantees

The connector MUST ensure:

1. Race ordering matches the source page  
2. Drivers appear in the same order as LiveRC shows  
3. Laps appear in correct lap_number order  
4. All timestamps parsed deterministically  
5. Parsing is insensitive to whitespace, HTML formatting quirks, or irrelevant markup

If LiveRC changes its structure:
- The connector MUST fail loudly with UnsupportedLiveRCVariantError.

---

## 8. When to Use HTTPX vs Playwright

### Use HTTPX for:
- Static content (most race result pages)
- Known predictable HTML tables
- Fast repeated ingestion

### Use Playwright only for:
- Pages requiring expansion of HTML sections (e.g. “View laps” anchors)
- Pages rendering dynamic tables
- Pages protected by anti-bot heuristics requiring a real browser

The connector MUST hide this complexity from the ingestion layer.

---

## 9. Non-Goals of the Connector

Connector MUST NOT:
- Apply ingestion state machine rules  
- Persist anything to the database  
- Filter or sort races  
- Augment data with derived metrics  
- Infer missing data (must raise errors instead)

---

## 10. Future Evolution

The connector interface is designed to expand for:

- multi-source ingestion (other RC sites)
- telemetry integration
- segment-level lap parsing
- dedicated browser cluster for scraping
- formal schema validation via Pydantic or equivalent

Any extensions MUST remain compatible with:

- deterministic parsing
- strict domain object contracts
- ingestion pipeline expectations

---

End of 09-connector-contracts.md.
