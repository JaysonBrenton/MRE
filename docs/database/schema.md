---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Human-readable database schema documentation for MRE application
purpose: Provides comprehensive documentation of the database schema, including all models,
         relationships, indexes, constraints, and business rules. This document serves as
         a human-readable reference for developers who need to understand the data model
         without reading the Prisma schema directly.
relatedFiles:
  - prisma/schema.prisma (source of truth for schema)
  - docs/architecture/liverc-ingestion/04-data-model.md (ingestion-specific models)
  - src/lib/prisma.ts (Prisma client instance)
  - src/core/users/repo.ts (database access functions)
---

# Database Schema Documentation

**Last Updated:** 2025-01-27 (Added TransponderOverride model documentation)  
**Database:** PostgreSQL  
**ORM:** Prisma  
**Schema File:** `prisma/schema.prisma`

This document provides a comprehensive overview of the MRE database schema. The Prisma schema file (`prisma/schema.prisma`) is the single source of truth for the database structure.

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Models](#models)
4. [Transponder Number Storage Strategy](#transponder-number-storage-strategy)
5. [Enums](#enums)
6. [Indexes](#indexes)
7. [Relationships](#relationships)
8. [Data Lifecycle](#data-lifecycle)
9. [Common Query Patterns](#common-query-patterns)
10. [Performance Considerations](#performance-considerations)

---

## Schema Overview

The MRE database schema consists of:

- **1 User model** - User accounts and authentication
- **8 Ingestion models** - LiveRC data ingestion (Track, Event, EventEntry, Race, Driver, RaceDriver, RaceResult, Lap, TransponderOverride)
- **1 Enum type** - IngestDepth

All models use UUID primary keys and include `createdAt` and `updatedAt` timestamps.

---

## Entity Relationship Diagram

```
User (1) ──┐
           │
           │ (no direct relationship)
           │
Track (1) ─┼──< (many) Event ──< (many) Race ──< (many) RaceDriver
           │                                                      │
           │                                                      │
           │                                                      │
           └──< (many) RaceResult ──< (many) Lap                │
                                      (many) ────────────────────┘
```

**Text-based ERD:**

- **User** - Standalone, no foreign keys
- **Track** - Has many Events
- **Event** - Belongs to Track, has many EventEntries and Races
- **EventEntry** - Belongs to Event and Driver, links drivers to classes
- **Driver** - Has many EventEntries and RaceDrivers
- **Race** - Belongs to Event, has many RaceDrivers and RaceResults
- **RaceDriver** - Belongs to Race and Driver, has many RaceResults
- **RaceResult** - Belongs to Race and RaceDriver, has many Laps
- **Lap** - Belongs to RaceResult

**Note:** For a visual ERD, use Prisma Studio (`npx prisma studio`) or generate a diagram using a tool like `prisma-erd-generator`.

---

## Models

### User

User accounts for authentication and user management.

**Table:** `users`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique user identifier |
| `email` | String | Unique, Required | User email address (used for login) |
| `passwordHash` | String | Required | Argon2id hashed password |
| `driverName` | String | Required | Primary display name |
| `teamName` | String | Optional | Optional team name |
| `isAdmin` | Boolean | Default: `false` | Admin privilege flag |
| `createdAt` | DateTime | Auto-generated | Account creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- Email must be unique across all users
- `isAdmin` cannot be set to `true` via registration endpoint (security requirement)
- Admin accounts must be created via seed script, migration, or manual database update
- Password is hashed using Argon2id (required by mobile-safe architecture)

**Indexes:**
- Primary key on `id`
- Unique index on `email`

---

### Track

Track catalogue entries from LiveRC.

**Table:** `tracks`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique track identifier |
| `source` | String | Required | Data source (always "liverc" for this connector) |
| `sourceTrackSlug` | String | Required | LiveRC track slug identifier |
| `trackName` | String | Required | Human-readable track name |
| `trackUrl` | String | Required | LiveRC track page URL |
| `eventsUrl` | String | Required | LiveRC events listing URL for this track |
| `livercTrackLastUpdated` | String | Optional | Last update timestamp from LiveRC |
| `lastSeenAt` | DateTime | Optional | Last time track was seen in LiveRC catalogue |
| `isActive` | Boolean | Default: `true` | Whether track is currently active |
| `isFollowed` | Boolean | Default: `false` | Whether track is followed by users |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- `source` + `sourceTrackSlug` must be unique (composite unique constraint)
- Tracks are discovered via LiveRC catalogue ingestion
- `isFollowed` tracks are prioritized in user-facing APIs

**Indexes:**
- Primary key on `id`
- Unique index on `[source, sourceTrackSlug]`
- Index on `[source, sourceTrackSlug]` (for lookups)
- Index on `[isActive, isFollowed]` (for filtering)

**Relationships:**
- Has many `Event` records (cascade delete)

---

### Event

Race events associated with tracks.

**Table:** `events`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique event identifier |
| `source` | String | Required | Data source (always "liverc") |
| `sourceEventId` | String | Required | LiveRC event identifier |
| `trackId` | String (UUID) | Foreign Key, Required | Reference to Track |
| `eventName` | String | Required | Human-readable event name |
| `eventDate` | DateTime | Required | Event date/time |
| `eventEntries` | Int | Required | Number of entries |
| `eventDrivers` | Int | Required | Number of drivers |
| `eventUrl` | String | Required | LiveRC event page URL |
| `ingestDepth` | IngestDepth | Default: `none` | Ingestion depth level |
| `lastIngestedAt` | DateTime | Optional | Last successful ingestion timestamp |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- `source` + `sourceEventId` must be unique (composite unique constraint)
- Events are discovered via track event listing ingestion
- `ingestDepth` controls what data is ingested (see IngestDepth enum)
- Deleted when parent Track is deleted (cascade delete)

**Indexes:**
- Primary key on `id`
- Unique index on `[source, sourceEventId]`
- Index on `[source, sourceEventId]` (for lookups)
- Index on `trackId` (for filtering by track)
- Index on `eventDate` (for date range queries)
- Index on `ingestDepth` (for filtering by ingestion status)

**Relationships:**
- Belongs to `Track` (cascade delete)
- Has many `EventEntry` records (cascade delete)
- Has many `Race` records (cascade delete)

---

### EventEntry

Driver entries in classes for an event. Links drivers to racing classes and stores transponder numbers from entry lists.

**Table:** `event_entries`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique event entry identifier |
| `eventId` | String (UUID) | Foreign Key, Required | Reference to Event |
| `driverId` | String (UUID) | Foreign Key, Required | Reference to Driver |
| `className` | String | Required | Racing class name |
| `transponderNumber` | String | Optional | Transponder number from entry list |
| `carNumber` | String | Optional | Car number from entry list |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- `eventId` + `driverId` + `className` must be unique (one entry per driver per class per event)
- Created from entry list during event ingestion
- Deleted when parent Event or Driver is deleted (cascade delete)
- Supports drivers participating in multiple classes within the same event
- Transponder numbers are captured from entry lists, not race results
- **Transponder Number Storage:** EventEntry is the primary source of truth for transponder numbers per driver-class-event combination. See [Transponder Number Storage Strategy](#transponder-number-storage-strategy) for complete architecture details.

**Indexes:**
- Primary key on `id`
- Unique index on `[eventId, driverId, className]`
- Index on `eventId` (for filtering by event)
- Index on `driverId` (for filtering by driver)
- Index on `className` (for filtering by class)

**Relationships:**
- Belongs to `Event` (cascade delete)
- Belongs to `Driver` (cascade delete)

---

### Driver

Normalized driver identity across all races/events.

**Table:** `drivers`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique driver identifier |
| `source` | String | Required | Data source (always "liverc") |
| `sourceDriverId` | String | Required | LiveRC driver identifier |
| `displayName` | String | Required | Driver display name |
| `normalizedName` | String | Optional | Normalized name for fuzzy matching |
| `transponderNumber` | String | Optional | Default transponder number (from entry list) |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- `source` + `sourceDriverId` must be unique (composite unique constraint)
- Drivers are created from entry lists during event ingestion
- `sourceDriverId` may be temporary (starts with "entry_") until matched to race results
- Transponder number is set from entry list and updated when matched to race results
- **Transponder Number Storage:** Driver-level transponder number is a fallback/default value. EventEntry is the primary source. See [Transponder Number Storage Strategy](#transponder-number-storage-strategy) for complete architecture details.

**Indexes:**
- Primary key on `id`
- Unique index on `[source, sourceDriverId]`
- Index on `[source, sourceDriverId]` (for lookups)
- Index on `displayName` (for name-based queries)

**Relationships:**
- Has many `EventEntry` records (cascade delete)
- Has many `RaceDriver` records (cascade delete)

---

### Race

Individual races within an event.

**Table:** `races`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique race identifier |
| `eventId` | String (UUID) | Foreign Key, Required | Reference to Event |
| `source` | String | Required | Data source (always "liverc") |
| `sourceRaceId` | String | Required | LiveRC race identifier |
| `className` | String | Required | Race class name extracted from LiveRC labels (e.g., "1/8 Nitro Buggy", "1/10 2WD Buggy Modified", "Junior"). See [Racing Classes Domain Model](../domain/racing-classes.md) for complete taxonomy and definitions. |
| `raceLabel` | String | Required | Race label (e.g., "A-Main", "B-Main") |
| `raceOrder` | Int | Optional | Order of race within event |
| `raceUrl` | String | Required | LiveRC race page URL |
| `startTime` | DateTime | Optional | Race start time |
| `durationSeconds` | Int | Optional | Race duration in seconds |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- `eventId` + `sourceRaceId` must be unique (composite unique constraint)
- Races are created during event ingestion
- Deleted when parent Event is deleted (cascade delete)
- `className` is currently stored as free-form text extracted from LiveRC labels
- `className` may contain car classes (vehicle types), modification rules (Modified/Stock), or skill groupings (Junior/Pro/Expert)
- Future versions may normalize or validate `className` against a canonical taxonomy

**Indexes:**
- Primary key on `id`
- Unique index on `[eventId, sourceRaceId]`
- Index on `[eventId, sourceRaceId]` (for lookups)
- Index on `eventId` (for filtering by event)
- Index on `raceOrder` (for ordering races within event)

**Relationships:**
- Belongs to `Event` (cascade delete)
- Has many `RaceDriver` records (cascade delete)
- Has many `RaceResult` records (cascade delete)

---

### RaceDriver

Drivers participating in a race.

**Table:** `race_drivers`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique race driver identifier |
| `raceId` | String (UUID) | Foreign Key, Required | Reference to Race |
| `source` | String | Required | Data source (always "liverc") |
| `sourceDriverId` | String | Required | LiveRC driver identifier |
| `displayName` | String | Required | Driver display name |
| `transponderNumber` | String | Optional | Race-specific transponder number (overrides Driver default) |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- `raceId` + `sourceDriverId` must be unique (composite unique constraint)
- Drivers are created during race ingestion
- Deleted when parent Race is deleted (cascade delete)
- **Transponder Number Storage:** RaceDriver does not store transponder numbers in the entry-list-first architecture. Transponder numbers are retrieved from EventEntry records via the driver relationship. See [Transponder Number Storage Strategy](#transponder-number-storage-strategy) for complete architecture details.

**Indexes:**
- Primary key on `id`
- Unique index on `[raceId, sourceDriverId]`
- Index on `[raceId, sourceDriverId]` (for lookups)
- Index on `raceId` (for filtering by race)

**Relationships:**
- Belongs to `Race` (cascade delete)
- Belongs to `Driver` (restrict delete - prevents deletion if driver has race results)
- Has many `RaceResult` records (cascade delete)

---

### RaceResult

Race results for a driver in a race.

**Table:** `race_results`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique race result identifier |
| `raceId` | String (UUID) | Foreign Key, Required | Reference to Race |
| `raceDriverId` | String (UUID) | Foreign Key, Required | Reference to RaceDriver |
| `positionFinal` | Int | Required | Final finishing position |
| `lapsCompleted` | Int | Required | Number of laps completed |
| `totalTimeRaw` | String | Optional | Total time as raw string (e.g., "1:05:30.500") |
| `totalTimeSeconds` | Float | Optional | Total time in seconds |
| `fastLapTime` | Float | Optional | Fastest lap time in seconds |
| `avgLapTime` | Float | Optional | Average lap time in seconds |
| `consistency` | Float | Optional | Consistency percentage (e.g., 92.82) |
| `rawFieldsJson` | Json | Optional | Additional raw fields from LiveRC |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- `raceId` + `raceDriverId` must be unique (one result per driver per race)
- Results are created during race ingestion
- Deleted when parent Race or RaceDriver is deleted (cascade delete)

**Indexes:**
- Primary key on `id`
- Unique index on `[raceId, raceDriverId]`
- Index on `[raceId, raceDriverId]` (for lookups)
- Index on `raceId` (for filtering by race)
- Index on `raceDriverId` (for filtering by driver)
- Index on `positionFinal` (for ordering results)

**Relationships:**
- Belongs to `Race` (cascade delete)
- Belongs to `RaceDriver` (cascade delete)
- Has many `Lap` records (cascade delete)

---

### Lap

Individual lap times for a race result.

**Table:** `laps`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique lap identifier |
| `raceResultId` | String (UUID) | Foreign Key, Required | Reference to RaceResult |
| `lapNumber` | Int | Required | Lap number (1-indexed) |
| `positionOnLap` | Int | Required | Driver position at end of this lap |
| `lapTimeRaw` | String | Required | Lap time as raw string (e.g., "1:10.500") |
| `lapTimeSeconds` | Float | Required | Lap time in seconds |
| `paceString` | String | Optional | Pace string (e.g., "+0.0s", "-2.3s") |
| `elapsedRaceTime` | Float | Required | Cumulative elapsed race time at end of lap |
| `segmentsJson` | Json | Optional | Sector/segment times as JSON |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- `raceResultId` + `lapNumber` must be unique (one record per lap per result)
- Laps are created during race ingestion when `ingestDepth` is `laps_full`
- Deleted when parent RaceResult is deleted (cascade delete)

**Indexes:**
- Primary key on `id`
- Unique index on `[raceResultId, lapNumber]`
- Index on `[raceResultId, lapNumber]` (for lookups)
- Index on `raceResultId` (for filtering by result)
- Index on `lapNumber` (for ordering laps)

**Relationships:**
- Belongs to `RaceResult` (cascade delete)

---

### TransponderOverride

Manual transponder number overrides for drivers in events. Allows administrators to correct or override transponder numbers when the ingested data is incorrect.

**Table:** `transponder_overrides`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique transponder override identifier |
| `eventId` | String (UUID) | Foreign Key, Required | Reference to Event |
| `driverId` | String (UUID) | Foreign Key, Required | Reference to Driver |
| `effectiveFromRaceId` | String (UUID) | Foreign Key, Optional | Reference to Race where override takes effect (null = from first race) |
| `transponderNumber` | String | Required | Override transponder number |
| `createdBy` | String (UUID) | Optional | User ID who created the override (for audit) |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- `eventId` + `driverId` + `effectiveFromRaceId` must be unique (composite unique constraint)
- `effectiveFromRaceId` can be null, meaning the override applies from the first race
- Overrides take precedence over ingested transponder numbers
- Deleted when parent Event is deleted (cascade delete)
- Driver deletion is restricted if overrides exist (onDelete: Restrict)

**Indexes:**
- Primary key on `id`
- Unique index on `[eventId, driverId, effectiveFromRaceId]`
- Index on `[eventId, driverId]` (for filtering by event and driver)
- Index on `effectiveFromRaceId` (for filtering by race)

**Relationships:**
- Belongs to `Event` (cascade delete)
- Belongs to `Driver` (cascade delete - overrides deleted when driver deleted)
- Belongs to `Race` (set null on delete - if race is deleted, override applies from first race)

---

## Transponder Number Storage Strategy

Transponder numbers are stored at multiple levels in the MRE database to support different use cases and ensure data accuracy. This section explains the architecture and data flow.

### Overview

The MRE ingestion system uses an **entry-list-first architecture** where transponder numbers are captured from event entry lists before race results are processed. This ensures accurate transponder assignment even when race results have incomplete or incorrect transponder data.

### Storage Levels

Transponder numbers are stored at three levels:

1. **EventEntry-Level** (Primary Source of Truth)
   - Stored in `EventEntry.transponderNumber`
   - Captured from entry lists during event ingestion
   - One transponder per driver-class-event combination
   - Supports drivers using different transponders in different classes

2. **Driver-Level** (Default/Fallback)
   - Stored in `Driver.transponderNumber`
   - Set from EventEntry records during ingestion
   - Used as fallback when event-specific transponder is not available
   - Updated when new values are provided during re-ingestion

3. **RaceDriver-Level** (Not Used)
   - `RaceDriver.transponderNumber` field exists but is **not populated** in the entry-list-first architecture
   - Transponder numbers are retrieved from EventEntry records via the driver relationship when needed

### Entry-List-First Architecture

The ingestion pipeline processes entry lists **before** race results:

1. **Entry List Processing** (First)
   - Entry list is fetched and parsed
   - Drivers are created from entry list (with temporary IDs if needed)
   - EventEntry records are created for each driver-class combination
   - Transponder numbers are captured from entry lists

2. **Race Result Processing** (Second)
   - Race results are processed after entry list
   - Race result drivers are matched to EventEntry records
   - Transponder numbers are retrieved from EventEntry records
   - Driver `sourceDriverId` is updated from temporary to real ID when matched

### Matching Strategy

Race result drivers are matched to EventEntry records using a multi-field strategy (in order of preference):

1. **Driver ID**: Match by `source_driver_id` if available
2. **Driver Name**: Match by normalized driver name (exact match, case-insensitive)

Matching is performed within the same racing class to avoid false matches.

### Data Flow

```
Entry List → EventEntry (transponderNumber) → Driver (transponderNumber)
                                              ↓
Race Results → RaceDriver → Lookup EventEntry → Get transponderNumber
```

### Idempotency

- Re-ingestion updates transponder numbers if new values are found
- EventEntry transponder numbers are updated if new values provided
- Driver-level transponder is only updated if not already set, or if new value provided
- RaceDriver records do not store transponder numbers (retrieved from EventEntry when needed)

### Transponder Overrides

Manual transponder overrides can be created via the `TransponderOverride` model to correct or override transponder numbers when ingested data is incorrect. Overrides take precedence over EventEntry transponder numbers.

See the [TransponderOverride model](#transponderoverride) section for details on manual overrides.

### Related Documentation

- [Racing Classes Domain Model](../domain/racing-classes.md) - Complete taxonomy of racing classes
- [LiveRC Ingestion Architecture](../architecture/liverc-ingestion/04-data-model.md) - Ingestion-specific data model documentation

---

## Enums

### IngestDepth

Controls the depth of data ingestion for events.

**Values:**
- `none` - Event metadata only (discovery/browsing, default for newly discovered events)
- `laps_full` - Complete data including races, results, and all lap times

**V1 Note**: In V1, "Import Event" always means `laps_full` ingestion. The `none` depth is used for event discovery, but users always get complete data when importing.

**Usage:**
- Set via event ingestion API or admin CLI
- Determines what data is ingested from LiveRC
- Used for filtering events by ingestion status

---

## Indexes

### Summary of All Indexes

**User:**
- Primary key: `id`
- Unique: `email`

**Track:**
- Primary key: `id`
- Unique: `[source, sourceTrackSlug]`
- Index: `[source, sourceTrackSlug]`
- Index: `[isActive, isFollowed]`

**Event:**
- Primary key: `id`
- Unique: `[source, sourceEventId]`
- Index: `[source, sourceEventId]`
- Index: `trackId`
- Index: `eventDate`
- Index: `ingestDepth`

**Race:**
- Primary key: `id`
- Unique: `[eventId, sourceRaceId]`
- Index: `[eventId, sourceRaceId]`
- Index: `eventId`
- Index: `raceOrder`

**EventEntry:**
- Primary key: `id`
- Unique: `[eventId, driverId, className]`
- Index: `eventId`
- Index: `driverId`
- Index: `className`

**Driver:**
- Primary key: `id`
- Unique: `[source, sourceDriverId]`
- Index: `[source, sourceDriverId]`
- Index: `displayName`

**RaceDriver:**
- Primary key: `id`
- Unique: `[raceId, sourceDriverId]`
- Index: `[raceId, sourceDriverId]`
- Index: `raceId`
- Index: `driverId`

**RaceResult:**
- Primary key: `id`
- Unique: `[raceId, raceDriverId]`
- Index: `[raceId, raceDriverId]`
- Index: `raceId`
- Index: `raceDriverId`
- Index: `positionFinal`

**Lap:**
- Primary key: `id`
- Unique: `[raceResultId, lapNumber]`
- Index: `[raceResultId, lapNumber]`
- Index: `raceResultId`
- Index: `lapNumber`

**TransponderOverride:**
- Primary key: `id`
- Unique: `[eventId, driverId, effectiveFromRaceId]`
- Index: `[eventId, driverId]`
- Index: `effectiveFromRaceId`

---

## Relationships

### Relationship Summary

1. **Track → Event** (One-to-Many)
   - Foreign key: `Event.trackId`
   - Cascade delete: Events deleted when Track deleted

2. **Event → EventEntry** (One-to-Many)
   - Foreign key: `EventEntry.eventId`
   - Cascade delete: EventEntries deleted when Event deleted

3. **Driver → EventEntry** (One-to-Many)
   - Foreign key: `EventEntry.driverId`
   - Cascade delete: EventEntries deleted when Driver deleted

4. **Event → Race** (One-to-Many)
   - Foreign key: `Race.eventId`
   - Cascade delete: Races deleted when Event deleted

5. **Driver → RaceDriver** (One-to-Many)
   - Foreign key: `RaceDriver.driverId`
   - Restrict delete: RaceDrivers prevent Driver deletion

6. **Race → RaceDriver** (One-to-Many)
   - Foreign key: `RaceDriver.raceId`
   - Cascade delete: RaceDrivers deleted when Race deleted

7. **Race → RaceResult** (One-to-Many)
   - Foreign key: `RaceResult.raceId`
   - Cascade delete: RaceResults deleted when Race deleted

8. **RaceDriver → RaceResult** (One-to-Many)
   - Foreign key: `RaceResult.raceDriverId`
   - Cascade delete: RaceResults deleted when RaceDriver deleted

9. **RaceResult → Lap** (One-to-Many)
   - Foreign key: `Lap.raceResultId`
   - Cascade delete: Laps deleted when RaceResult deleted

10. **Event → TransponderOverride** (One-to-Many)
    - Foreign key: `TransponderOverride.eventId`
    - Cascade delete: TransponderOverrides deleted when Event deleted

11. **Driver → TransponderOverride** (One-to-Many)
    - Foreign key: `TransponderOverride.driverId`
    - Restrict delete: TransponderOverrides prevent Driver deletion

12. **Race → TransponderOverride** (One-to-Many)
    - Foreign key: `TransponderOverride.effectiveFromRaceId`
    - Set null on delete: If race is deleted, override applies from first race

### Cascade Delete Behavior

Most relationships use cascade delete to maintain referential integrity:
- Deleting a Track deletes all associated Events
- Deleting an Event deletes all associated EventEntries and Races
- Deleting a Driver deletes all associated EventEntries (but RaceDrivers prevent Driver deletion)
- Deleting a Race deletes all associated RaceDrivers and RaceResults
- Deleting a RaceDriver deletes all associated RaceResults
- Deleting a RaceResult deletes all associated Laps
- Deleting an Event deletes all associated TransponderOverrides
- Deleting a Driver deletes all associated TransponderOverrides

**Restrict Delete:**
- RaceDrivers prevent Driver deletion (onDelete: Restrict) to maintain referential integrity

**Cascade Delete:**
- TransponderOverrides are deleted when Driver is deleted (onDelete: Cascade)

**Set Null on Delete:**
- If a Race is deleted, TransponderOverride.effectiveFromRaceId is set to null (override applies from first race)

**Note:** User records are standalone and have no cascade relationships.

---

## Data Lifecycle

### Creation

**User:**
- Created via registration API endpoint
- Password is hashed using Argon2id before storage
- `isAdmin` is explicitly set to `false` (security requirement)

**Track:**
- Created via LiveRC catalogue ingestion
- Discovered through connector scraping

**Event:**
- Created via LiveRC event listing ingestion
- Associated with Track during ingestion

**EventEntry:**
- Created from entry list during event ingestion
- Links drivers to racing classes within an event
- Stores transponder numbers from entry lists

**Driver:**
- Created from entry list during event ingestion
- Initially created with temporary `sourceDriverId` (starts with "entry_")
- Updated with real `sourceDriverId` when matched to race results

**Race, RaceDriver, RaceResult, Lap:**
- Created during event ingestion process
- Depth controlled by `Event.ingestDepth` field
- RaceDrivers are matched to EventEntry records to get transponder numbers

**TransponderOverride:**
- Created via API endpoint (`POST /api/v1/transponder-overrides`)
- Allows manual correction of transponder numbers when ingested data is incorrect
- Can be effective from a specific race or from the first race (if `effectiveFromRaceId` is null)

### Updates

- `updatedAt` timestamps are automatically maintained by Prisma
- Ingestion updates existing records based on source identifiers
- Idempotent ingestion ensures no duplicates

### Deletion

- Cascade deletes maintain referential integrity
- User records are not cascade deleted (standalone)
- Ingestion data can be re-ingested after deletion

---

## Common Query Patterns

### Find User by Email

```typescript
const user = await prisma.user.findUnique({
  where: { email: "user@example.com" }
})
```

### Get Tracks (Active and Followed)

```typescript
const tracks = await prisma.track.findMany({
  where: {
    isActive: true,
    isFollowed: true
  },
  orderBy: {
    trackName: "asc"
  }
})
```

### Get Events by Track and Date Range

```typescript
const events = await prisma.event.findMany({
  where: {
    trackId: trackId,
    eventDate: {
      gte: new Date(startDate),
      lte: new Date(endDate)
    }
  },
  orderBy: {
    eventDate: "desc"
  }
})
```

### Get Race with Results

```typescript
const race = await prisma.race.findUnique({
  where: { id: raceId },
  include: {
    results: {
      include: {
        raceDriver: true
      },
      orderBy: {
        positionFinal: "asc"
      }
    }
  }
})
```

### Get Laps for Race Result

```typescript
const laps = await prisma.lap.findMany({
  where: { raceResultId: raceResultId },
  orderBy: {
    lapNumber: "asc"
  }
})
```

**Note:** All database queries should be in `src/core/<domain>/repo.ts` files, not in API routes or UI components (see mobile-safe architecture guidelines).

---

## Performance Considerations

### Index Usage

- Composite indexes support efficient lookups by source identifiers
- Date indexes support efficient date range queries
- Foreign key indexes support efficient joins

### Query Optimization

- Use `select` to limit fields returned when full objects aren't needed
- Use `include` judiciously to avoid N+1 queries
- Consider pagination for large result sets (not yet implemented)

### Data Volume

- Lap data can be large (hundreds of laps per race, multiple drivers)
- Consider archiving old events if storage becomes an issue
- `rawFieldsJson` fields store flexible data but may grow large

### Migration Strategy

- All schema changes must go through Prisma migrations
- Migrations are stored in `prisma/migrations/`
- Always test migrations on development database first
- Consider data migration scripts for complex changes

**Placeholder for future documentation:**
- Query performance benchmarks
- Index optimization recommendations
- Archiving strategies
- Data retention policies

---

## Related Documentation

- [Prisma Schema](../prisma/schema.prisma) - Source of truth for schema definition
- [LiveRC Ingestion Data Model](../architecture/liverc-ingestion/04-data-model.md) - Ingestion-specific model documentation
- [Racing Classes Domain Model](../domain/racing-classes.md) - Complete taxonomy of racing classes, vehicle types, and skill groupings
- [Mobile-Safe Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md) - Database rules and architecture requirements
- [Prisma/PostgreSQL Backend Engineer Role](../roles/prisma-postgresql-backend-engineer.md) - Role responsibilities for database management

---

---

**End of Database Schema Documentation**

