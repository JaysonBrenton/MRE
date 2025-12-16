---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Data model specification for LiveRC ingestion domain entities
purpose: Defines the persistent domain model for the LiveRC ingestion pipeline, including
         Track, Event, Race, RaceResult, and Lap entities. This model is stable, normalized,
         connector-agnostic, and idempotent, serving as the foundation for all ingestion
         storage operations.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/14-ingestion-idempotency-design.md
  - docs/specs/mre-alpha-feature-scope.md
---

# Data Model Specification (Finalised Draft)

This document defines the persistent domain model for the My Race Engineer (MRE)
LiveRC ingestion pipeline. All structures in this model have been validated
against real LiveRC pages, including:

- The global track catalogue at https://live.liverc.com
- Per-track dashboards such as https://canberraoffroad.liverc.com
- Track event listings at https://{slug}.liverc.com/events
- Event results listings at `...?p=view_event&id=...`
- Individual race result pages at `...?p=view_race_result&id=...`
- Embedded `racerLaps[...]` JavaScript data blocks

This model is designed to be stable, normalised, connector-agnostic, and
idempotent.

---

# Guiding Principles

1. **Tracks and Events are lightweight metadata.**  
   Event tables never contain race sessions or lap data.

2. **Races, Results, and Laps are fully normalised.**

3. **LiveRC external IDs are preserved** wherever they exist.

4. **Idempotency is guaranteed** through natural keys.

5. **Future connectors will fit cleanly** via the `source` field.

6. **Analytics tables are separate** and optional.

---

# Entity Relationship Overview

Track (1) ──── () Event (1) ──── () Race (1) ──── () RaceResult (1) ──── () Lap
│
│
(*) RaceDriver

markdown
Copy code

Drivers are per-race identities for V1. Global/canonical driver profiles will be added later.

---

# TABLE: Track

Tracks represent LiveRC subdomains such as `canberraoffroad`.

### Fields

| Field | Type | Description |
|------|------|-------------|
| `id` | PK | Internal primary key |
| `source` | text | Always `"liverc"` for this connector |
| `source_track_slug` | text | The LiveRC subdomain slug, e.g. `"canberraoffroad"` |
| `track_name` | text | Human-readable name from the track dashboard |
| `track_url` | text | Canonical URL, e.g. `https://canberraoffroad.liverc.com/` |
| `events_url` | text | Canonical events URL, `https://{slug}.liverc.com/events` |
| `liverc_track_last_updated` | text | Raw LiveRC status string from global list (e.g. `"1 minute ago"`, `"last month"`) |
| `last_seen_at` | timestamptz | When the track was last observed during sync |
| `is_active` | boolean | True if the track appeared in the latest global track sync |
| `is_followed` | boolean | Admin-controlled: true if MRE should allow event syncing or display in UI |

### Natural Key

`(source = "liverc", source_track_slug)`

---

# TABLE: Event

Events represent high-level race meetings, not individual races.

### Fields

| Field | Type | Description |
|-------|-------|-------------|
| `id` | PK | Internal primary key |
| `source` | text | `"liverc"` |
| `source_event_id` | text or int | Value from the event URL: `...?p=view_event&id=6304829` |
| `track_id` | FK → Track | Track this event belongs to |
| `event_name` | text | Title extracted from event header (e.g. `"2025 Rudi Wensing Memorial"`) |
| `event_date` | timestamptz | Machine-readable timestamp shown in the event list (e.g. `2025-11-16 08:30:00`) |
| `event_entries` | int | Total entries |
| `event_drivers` | int | Total unique drivers |
| `event_url` | text | Canonical event results URL |
| `ingest_depth` | enum | `"none"` \| `"laps_full"` |
| `last_ingested_at` | timestamptz | Timestamp of last deep ingestion |

### Natural Key

`(source = "liverc", source_event_id)`

---

# TABLE: Race

A Race (or Session) is one class run (e.g., A-Main, Q1, Heat 3/3).

### Fields

| Field | Type | Description |
|-------|-------|-------------|
| `id` | PK | Internal primary key |
| `event_id` | FK → Event | Event this race belongs to |
| `source` | text | `"liverc"` |
| `source_race_id` | text or int | Value from race result URL: `...?p=view_race_result&id=6304829` |
| `class_name` | text | Race class name extracted from LiveRC labels. May contain car classes (e.g., `"1/8 Nitro Buggy"`, `"1/10 2WD Buggy"`), modification rules (e.g., `"Modified"`, `"Stock"`), or skill groupings (e.g., `"Junior"`, `"Pro"`, `"Expert"`). See [Racing Classes Domain Model](../../domain/racing-classes.md) for complete taxonomy. Currently stored as free-form text; future versions may normalize or validate. |
| `race_label` | text | Label such as `"A-Main"`, `"Heat 1/3"`, `"Qualifier Round 3"` |
| `race_order` | int | Numeric prefix if present (e.g. `14` from `"Race 14"`) |
| `race_url` | text | Canonical race result URL |
| `start_time` | timestamptz | Parsed from race list (e.g. `"Nov 16, 2025 at 5:30pm"`) |
| `duration_seconds` | int | Converted from `"Length: 30:00 Timed"` |

### Natural Key

`(event_id, source_race_id)`

If LiveRC ever changes reliability of this ID, a synthetic fallback will be defined.

### Class Name Extraction

The `class_name` field is extracted from LiveRC race labels using the following pattern:

**LiveRC Label Format:**
```
Race {number}: {class_name} ({race_label})
```

**Extraction Process:**
1. Parse the race label from the event page HTML
2. Remove the "Race X: " prefix if present
3. Extract text before parentheses as `class_name`
4. Extract text within parentheses as `race_label`
5. If no parentheses exist, use entire label for both fields

**Examples:**
- `"Race 14: 1/8 Nitro Buggy (1/8 Nitro Buggy A-Main)"`
  - `class_name` = `"1/8 Nitro Buggy"`
  - `race_label` = `"1/8 Nitro Buggy A-Main"`

- `"Race 5: 1/10 2WD Buggy Modified (1/10 2WD Buggy Modified A-Main)"`
  - `class_name` = `"1/10 2WD Buggy Modified"`
  - `race_label` = `"1/10 2WD Buggy Modified A-Main"`

- `"Race 9: Junior (Junior A-Main)"`
  - `class_name` = `"Junior"`
  - `race_label` = `"Junior A-Main"`

**Current Normalization:**
- Class names are normalized only for whitespace (trimmed)
- No validation against predefined taxonomy
- No normalization to canonical forms
- Variations in spacing, capitalization, and formatting are preserved as-is

**Future Considerations:**
- Class name normalization to canonical forms
- Validation against known car classes
- Structured representation separating vehicle type, modification rules, and skill groupings

See [Racing Classes Domain Model](../../domain/racing-classes.md) for complete taxonomy and definitions.

---

# TABLE: RaceDriver

Represents the driver identity *within a specific race*.  
This is not a global driver profile.

### Fields

| Field | Type | Description |
|-------|-------|-------------|
| `id` | PK | Internal primary key |
| `race_id` | FK → Race | Race they belong to |
| `source` | text | `"liverc"` |
| `source_driver_id` | text or int | From the key of `racerLaps[...]` (e.g. `346997`) |
| `display_name` | text | Exact driver name string from results |

### Natural Key

If available: `(race_id, source_driver_id)`  
Fallback: `(race_id, display_name)`

---

# TABLE: RaceResult

Represents a single driver’s result in a single race.

### Fields

| Field | Type | Description |
|-------|-------|-------------|
| `id` | PK | Internal primary key |
| `race_id` | FK → Race | The race |
| `race_driver_id` | FK → RaceDriver | Associated driver |
| `position_final` | int | Finishing position |
| `laps_completed` | int | From `47/30:31.382` (example) |
| `total_time_raw` | text | Raw string such as `"47/30:31.382"` |
| `total_time_seconds` | float | Parsed numeric total time |
| `fast_lap_time` | float | Fastest lap time in seconds |
| `avg_lap_time` | float | Mean lap time |
| `consistency` | float | LiveRC % consistency (e.g. `92.82`) |
| `raw_fields_json` | jsonb | Optional extra metrics (std deviation, top 3 consecutive, etc) |

### Natural Key

`(race_id, race_driver_id)`

---

# TABLE: Lap

Normalised lap data for a specific race result.  
All fields are derived from the `racerLaps[...]` array.

### Fields

| Field | Type | Description |
|-------|-------|-------------|
| `id` | PK | Internal primary key |
| `race_result_id` | FK → RaceResult | The driver’s race result |
| `lap_number` | int | Lap index |
| `position_on_lap` | int | Position on that lap |
| `lap_time_raw` | text | For example `"38.17"` |
| `lap_time_seconds` | float | Numeric conversion |
| `pace_string` | text | The `"48/30:32.160"` style “pace” string |
| `elapsed_race_time` | float | Cumulative race time, derived |
| `segments_json` | jsonb | Raw LiveRC segments array |

### Natural Key

`(race_result_id, lap_number)`

---

# Future Tables (Optional – For Analytics)

These tables are not required for ingestion but may support LLM analysis and
fast rendering.

## TABLE: DriverEventSummary (Future)

Aggregated metrics per driver per event.

## TABLE: DriverTrackSummary (Future)

Aggregated performance trends per driver per track.

These will be designed once actual user analytics requirements stabilise.

---

# Summary

This data model:

- Directly matches LiveRC’s real HTML, JSON, and JS structures.  
- Separates ingestion, metadata, results, and lap series cleanly.  
- Guarantees idempotency.  
- Allows future connectors to plug in without schema changes.  
- Supports rich analytics and LLM-based insights.

This document is now the **canonical reference** for all database schema,
connector parsing, and ingestion pipeline behaviour.