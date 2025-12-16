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

**Last Updated:** 2025-01-27  
**Database:** PostgreSQL  
**ORM:** Prisma  
**Schema File:** `prisma/schema.prisma`

This document provides a comprehensive overview of the MRE database schema. The Prisma schema file (`prisma/schema.prisma`) is the single source of truth for the database structure.

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Models](#models)
4. [Enums](#enums)
5. [Indexes](#indexes)
6. [Relationships](#relationships)
7. [Data Lifecycle](#data-lifecycle)
8. [Common Query Patterns](#common-query-patterns)
9. [Performance Considerations](#performance-considerations)

---

## Schema Overview

The MRE database schema consists of:

- **1 User model** - User accounts and authentication
- **6 Ingestion models** - LiveRC data ingestion (Track, Event, Race, RaceDriver, RaceResult, Lap)
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
- **Event** - Belongs to Track, has many Races
- **Race** - Belongs to Event, has many RaceDrivers and RaceResults
- **RaceDriver** - Belongs to Race, has many RaceResults
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
- Has many `Race` records (cascade delete)

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
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- `raceId` + `sourceDriverId` must be unique (composite unique constraint)
- Drivers are created during race ingestion
- Deleted when parent Race is deleted (cascade delete)

**Indexes:**
- Primary key on `id`
- Unique index on `[raceId, sourceDriverId]`
- Index on `[raceId, sourceDriverId]` (for lookups)
- Index on `raceId` (for filtering by race)

**Relationships:**
- Belongs to `Race` (cascade delete)
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

**RaceDriver:**
- Primary key: `id`
- Unique: `[raceId, sourceDriverId]`
- Index: `[raceId, sourceDriverId]`
- Index: `raceId`

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

---

## Relationships

### Relationship Summary

1. **Track → Event** (One-to-Many)
   - Foreign key: `Event.trackId`
   - Cascade delete: Events deleted when Track deleted

2. **Event → Race** (One-to-Many)
   - Foreign key: `Race.eventId`
   - Cascade delete: Races deleted when Event deleted

3. **Race → RaceDriver** (One-to-Many)
   - Foreign key: `RaceDriver.raceId`
   - Cascade delete: RaceDrivers deleted when Race deleted

4. **Race → RaceResult** (One-to-Many)
   - Foreign key: `RaceResult.raceId`
   - Cascade delete: RaceResults deleted when Race deleted

5. **RaceDriver → RaceResult** (One-to-Many)
   - Foreign key: `RaceResult.raceDriverId`
   - Cascade delete: RaceResults deleted when RaceDriver deleted

6. **RaceResult → Lap** (One-to-Many)
   - Foreign key: `Lap.raceResultId`
   - Cascade delete: Laps deleted when RaceResult deleted

### Cascade Delete Behavior

All relationships use cascade delete to maintain referential integrity:
- Deleting a Track deletes all associated Events
- Deleting an Event deletes all associated Races
- Deleting a Race deletes all associated RaceDrivers and RaceResults
- Deleting a RaceDriver deletes all associated RaceResults
- Deleting a RaceResult deletes all associated Laps

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

**Race, RaceDriver, RaceResult, Lap:**
- Created during event ingestion process
- Depth controlled by `Event.ingestDepth` field

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

**End of Database Schema Documentation**

