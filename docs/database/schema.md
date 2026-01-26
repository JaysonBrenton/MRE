---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-29
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

**Last Updated:** 2026-01-13 (Added practiceday value to SessionType enum documentation; previous updates: Added SessionType enum documentation; added sessionType field to Race model documentation; added AuditLog and ApplicationLog models; removed duplicate UserDriverLink and EventDriverLink sections; updated schema overview)  
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
- **1 Persona model** - Persona definitions and user personas
- **11 Ingestion models** - LiveRC data ingestion (Track, Event, EventEntry, EventRaceClass, Race, Driver, RaceDriver, RaceResult, Lap, TransponderOverride, WeatherData)
- **2 User-Driver Link models** - User-driver matching and linking (UserDriverLink, EventDriverLink)
- **2 System models** - Audit logging and application logging (AuditLog, ApplicationLog)
- **2 Profile models** - User profiles (CarProfile, DriverProfile)
- **5 Enum types** - IngestDepth, PersonaType, UserDriverLinkStatus, EventDriverLinkMatchType, SessionType

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

- **User** - Standalone, has many CarProfiles and DriverProfiles
- **Track** - Has many Events
- **Event** - Belongs to Track, has many EventEntries, EventRaceClasses, and Races
- **EventEntry** - Belongs to Event and Driver, optionally belongs to EventRaceClass
- **EventRaceClass** - Belongs to Event, has many EventEntries
- **Driver** - Has many EventEntries and RaceDrivers
- **Race** - Belongs to Event, has many RaceDrivers and RaceResults
- **RaceDriver** - Belongs to Race and Driver, has many RaceResults
- **RaceResult** - Belongs to Race and RaceDriver, has many Laps
- **Lap** - Belongs to RaceResult
- **UserDriverLink** - Belongs to User and Driver (one-to-one with Driver), has many EventDriverLinks
- **EventDriverLink** - Belongs to User, Event, Driver, and optionally UserDriverLink
- **Persona** - Has many Users
- **CarProfile** - Belongs to User
- **DriverProfile** - Belongs to User

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
| `normalizedName` | String | Optional | Normalized driver name for fuzzy matching |
| `transponderNumber` | String | Optional | User's default transponder number |
| `personaId` | String (UUID) | Foreign Key, Optional | Reference to Persona |
| `isTeamManager` | Boolean | Default: `false` | Team manager privilege flag |
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
- Index on `normalizedName`
- Index on `transponderNumber`
- Index on `personaId`
- Index on `[isTeamManager, teamName]`

---

### CarProfile

User-defined car profiles with setup information. Allows users to store car configurations and setup details.

**Table:** `car_profiles`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique car profile identifier |
| `userId` | String (UUID) | Foreign Key, Required | Reference to User |
| `name` | String | Required | Profile name (e.g., "My Buggy") |
| `carType` | String | Required | Car type (e.g., "Buggy", "Truggy") |
| `vehicleType` | String | Required | Vehicle type (e.g., "1/8 Nitro", "1/10 Electric") |
| `setupInfo` | Json | Optional | Flexible setup information (JSON) |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- Users can only access their own car profiles
- `setupInfo` is stored as JSON for flexibility (shock oil, tires, suspension settings, etc.)
- Deleted when parent User is deleted (cascade delete)
- Used for storing user's car configurations and setup preferences

**Indexes:**
- Primary key on `id`
- Index on `userId` (for filtering by user)

**Relationships:**
- Belongs to `User` (cascade delete)

---

### DriverProfile

User-defined driver profiles with preferences and transponder numbers. Allows users to store driver-specific information and preferences.

**Table:** `driver_profiles`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique driver profile identifier |
| `userId` | String (UUID) | Foreign Key, Required | Reference to User |
| `name` | String | Required | Profile name |
| `displayName` | String | Required | Display name for the profile |
| `transponderNumber` | String | Optional | Transponder number for this profile |
| `preferences` | Json | Optional | User preferences (JSON) |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- Users can only access their own driver profiles
- `preferences` is stored as JSON for flexibility (default views, chart preferences, etc.)
- `transponderNumber` is optional
- Deleted when parent User is deleted (cascade delete)
- Used for storing user's driver-specific information and preferences

**Indexes:**
- Primary key on `id`
- Index on `userId` (for filtering by user)

**Relationships:**
- Belongs to `User` (cascade delete)

---

### Track

Track catalogue entries from LiveRC with metadata extracted from dashboard pages.

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
| `latitude` | Float | Optional | Track latitude coordinate (from dashboard map) |
| `longitude` | Float | Optional | Track longitude coordinate (from dashboard map) |
| `address` | String | Optional | Full address string (from dashboard) |
| `city` | String | Optional | City name (parsed from address) |
| `state` | String | Optional | State/province name (parsed from address) |
| `country` | String | Optional | Country name (parsed from address) |
| `postalCode` | String | Optional | Postal/ZIP code (parsed from address) |
| `phone` | String | Optional | Phone number (from dashboard) |
| `website` | String | Optional | Website URL (from dashboard) |
| `email` | String | Optional | Email address (from dashboard, may be obfuscated) |
| `description` | String | Optional | Track description/amenities text (from dashboard) |
| `logoUrl` | String | Optional | Track logo image URL (from dashboard) |
| `facebookUrl` | String | Optional | Facebook page URL (from dashboard) |
| `totalLaps` | Int | Optional, Default: 0 | Total lifetime laps (from dashboard stats) |
| `totalRaces` | Int | Optional, Default: 0 | Total lifetime races (from dashboard stats) |
| `totalEvents` | Int | Optional, Default: 0 | Total lifetime events (from dashboard stats) |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- `source` + `sourceTrackSlug` must be unique (composite unique constraint)
- Tracks are discovered via LiveRC catalogue ingestion
- `isFollowed` tracks are prioritized in user-facing APIs
- **Metadata Extraction:** Location, contact info, statistics, description, and logos are extracted from track dashboard pages during sync
- Metadata fields are optional - tracks without dashboard data continue to function normally
- Stored coordinates (`latitude`, `longitude`) are used by weather service for improved geolocation accuracy
- If coordinates are not available, weather service falls back to address geocoding or name-based geocoding

**Indexes:**
- Primary key on `id`
- Unique index on `[source, sourceTrackSlug]`
- Index on `[source, sourceTrackSlug]` (for lookups)
- Index on `[isActive, isFollowed]` (for filtering)

**Relationships:**
- Has many `Event` records (cascade delete)

**Data Sources:**
- Basic track info (name, slug, URLs): Track catalogue page (`live.liverc.com`)
- Metadata (location, contact, stats, description, logos): Track dashboard page (`{slug}.liverc.com/`)

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
- Has many `WeatherData` records (cascade delete)
- Has many `EventRaceClass` records (cascade delete)

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
| `eventRaceClassId` | String (UUID) | Foreign Key, Optional | Reference to EventRaceClass |
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
- Index on `eventRaceClassId` (for filtering by event race class)

**Relationships:**
- Belongs to `Event` (cascade delete)
- Belongs to `Driver` (cascade delete)
- Belongs to `EventRaceClass` (optional, via `eventRaceClassId`, set null on delete)

---

### EventRaceClass

Race class definitions for events with vehicle type management. Tracks vehicle type assignments and review status for each class within an event.

**Table:** `event_race_classes`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique event race class identifier |
| `eventId` | String (UUID) | Foreign Key, Required | Reference to Event |
| `className` | String | Required | Racing class name (e.g., "1/8 Nitro Buggy") |
| `vehicleType` | String | Optional | Vehicle type assigned to this class (e.g., "1/8 Nitro Buggy", "1/10 2WD Buggy") |
| `vehicleTypeNeedsReview` | Boolean | Default: `true` | Whether vehicle type needs review |
| `vehicleTypeReviewedAt` | DateTime | Optional | Timestamp when vehicle type was reviewed |
| `vehicleTypeReviewedBy` | String (UUID) | Optional | User ID who reviewed the vehicle type |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- `eventId` + `className` must be unique (one record per class per event)
- Created during event ingestion when classes are discovered
- Vehicle type can be inferred automatically or set manually
- `vehicleTypeNeedsReview` is `true` by default until manually reviewed
- Deleted when parent Event is deleted (cascade delete)
- Used for vehicle type management and review workflow

**Indexes:**
- Primary key on `id`
- Unique index on `[eventId, className]`
- Index on `eventId` (for filtering by event)
- Index on `[eventId, className]` (for lookups)

**Relationships:**
- Belongs to `Event` (cascade delete)
- Has many `EventEntry` records (via `eventRaceClassId`)

**Notes:**
- Vehicle type management allows users to review and correct inferred vehicle types
- Vehicle type can be set via API endpoint: `PUT /api/v1/events/[eventId]/race-classes/[className]/vehicle-type`
- Used to normalize class names and improve data quality

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
- Index on `normalizedName` (for fuzzy matching)

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
| `sessionType` | SessionType | Optional | Type of session (race, practice, qualifying) |
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
- Index on `sessionType` (for filtering by session type)
- Index on `[eventId, sessionType]` (for filtering events by session type)

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

### Persona

Persona definitions for user personas (Driver, Admin, Team Manager, Race Engineer).

**Table:** `personas`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique persona identifier |
| `type` | PersonaType | Unique, Required | Persona type (driver, admin, team_manager, race_engineer) |
| `name` | String | Required | Human-readable persona name |
| `description` | String | Required | Persona description |
| `permissions` | Json | Optional | Persona permissions (JSON) |
| `preferences` | Json | Optional | Persona preferences (JSON) |
| `metadata` | Json | Optional | Additional metadata (JSON) |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- `type` must be unique across all personas
- Personas are created via seed script
- Four persona types are defined: driver, admin, team_manager, race_engineer
- Users are linked to personas via `User.personaId`

**Indexes:**
- Primary key on `id`
- Unique index on `type`

**Relationships:**
- Has many `User` records (users with this persona)

---

### UserDriverLink

Links users to drivers with matching status and similarity scores. Used for driver matching and user-driver association.

**Table:** `user_driver_links`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique link identifier |
| `userId` | String (UUID) | Foreign Key, Required | Reference to User |
| `driverId` | String (UUID) | Foreign Key, Required, Unique | Reference to Driver (one-to-one relationship) |
| `status` | UserDriverLinkStatus | Required | Link status (suggested, confirmed, rejected, conflict) |
| `similarityScore` | Float | Required | Similarity score from matching algorithm |
| `matchedAt` | DateTime | Required | When the match was created |
| `confirmedAt` | DateTime | Optional | When the link was confirmed |
| `rejectedAt` | DateTime | Optional | When the link was rejected |
| `matcherId` | String | Required | Matcher algorithm identifier |
| `matcherVersion` | String | Required | Matcher algorithm version |
| `conflictReason` | String | Optional | Reason for conflict status |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- `userId` + `driverId` must be unique (composite unique constraint)
- `driverId` must be unique (one driver per user)
- Status transitions: suggested → confirmed/rejected/conflict
- Deleted when parent User or Driver is deleted (cascade delete)

**Indexes:**
- Primary key on `id`
- Unique index on `[userId, driverId]`
- Unique index on `driverId`
- Index on `userId`
- Index on `driverId`
- Index on `status`

**Relationships:**
- Belongs to `User` (cascade delete)
- Belongs to `Driver` (cascade delete, one-to-one)
- Has many `EventDriverLink` records

---

### EventDriverLink

Links users to drivers within specific events with match type and similarity information. Represents event-specific driver matches.

**Table:** `event_driver_links`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique link identifier |
| `userId` | String (UUID) | Foreign Key, Required | Reference to User |
| `eventId` | String (UUID) | Foreign Key, Required | Reference to Event |
| `driverId` | String (UUID) | Foreign Key, Required | Reference to Driver |
| `userDriverLinkId` | String (UUID) | Foreign Key, Optional | Reference to UserDriverLink |
| `matchType` | EventDriverLinkMatchType | Required | Match type (transponder, exact, fuzzy) |
| `similarityScore` | Float | Required | Similarity score from matching algorithm |
| `transponderNumber` | String | Optional | Transponder number used for matching |
| `matchedAt` | DateTime | Required | When the match was created |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last update timestamp |

**Business Rules:**
- `userId` + `eventId` + `driverId` must be unique (composite unique constraint)
- Links users to drivers within specific events
- Can reference a UserDriverLink for user-level driver associations
- Deleted when parent User, Event, or Driver is deleted (cascade delete)

**Indexes:**
- Primary key on `id`
- Unique index on `[userId, eventId, driverId]`
- Index on `[userId, driverId, transponderNumber]`
- Index on `[eventId, driverId]`
- Index on `userDriverLinkId`

**Relationships:**
- Belongs to `User` (cascade delete)
- Belongs to `Event` (cascade delete)
- Belongs to `Driver` (cascade delete)
- Belongs to `UserDriverLink` (optional)

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

### WeatherData

Cached weather data for events, retrieved from Open-Meteo API.

**Table:** `weather_data`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique weather data identifier |
| `eventId` | String (UUID) | Foreign Key → Event.id, Required | Associated event |
| `latitude` | Float | Required | Latitude coordinate used for API call |
| `longitude` | Float | Required | Longitude coordinate used for API call |
| `timestamp` | DateTime | Required | When weather was observed/forecasted |
| `airTemperature` | Float | Required | Air temperature in Celsius |
| `humidity` | Int | Required | Humidity percentage (0-100) |
| `windSpeed` | Float | Required | Wind speed (km/h) |
| `windDirection` | Int? | Optional | Wind direction in degrees (0-360) |
| `precipitation` | Int | Required | Precipitation chance percentage (0-100) |
| `condition` | String | Required | Weather condition description |
| `trackTemperature` | Float | Required | Calculated track surface temperature (Celsius) |
| `forecast` | Json | Required | Array of forecast entries (JSON) |
| `isHistorical` | Boolean | Required, Default: false | Whether this is historical weather data |
| `cachedAt` | DateTime | Required, Default: now() | When this data was cached |
| `expiresAt` | DateTime | Required | When this cache entry expires (TTL) |
| `createdAt` | DateTime | Required, Default: now() | Record creation timestamp |
| `updatedAt` | DateTime | Required, Default: now(), Updated on write | Record update timestamp |

**Indexes:**
- Primary key on `id`
- Foreign key index on `eventId`
- Index on `expiresAt` for cache cleanup queries
- Index on `eventId, expiresAt` for cache lookup

**Relationships:**
- Many-to-One with Event (one event can have many weather data entries over time)

**Business Rules:**
- Weather data is cached with TTL (expiresAt) to reduce API calls
- Cache TTL is 1 hour for current/forecast data, longer for historical data
- Track temperature is calculated from air temperature using a formula
- Forecast data is stored as JSON array
- Historical flag distinguishes past events from current/future events
- Deleted when parent Event is deleted (cascade delete)

---

### AuditLog

System audit log for tracking user actions and administrative changes.

**Table:** `audit_logs`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique audit log identifier |
| `userId` | String (UUID) | Foreign Key, Optional | Reference to User (set to null if user deleted) |
| `action` | String | Required | Action type (e.g., "user_updated", "event_deleted") |
| `resourceType` | String | Required | Resource type (e.g., "user", "event", "track") |
| `resourceId` | String | Optional | Resource identifier |
| `details` | Json | Optional | Additional action details (JSON) |
| `ipAddress` | String | Optional | IP address of the request |
| `userAgent` | String | Optional | User agent string |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |

**Business Rules:**
- Audit logs are automatically created for admin actions
- `userId` is set to null if user is deleted (onDelete: SetNull)
- Audit logs are never deleted (permanent audit trail)

**Indexes:**
- Primary key on `id`
- Index on `userId`
- Index on `action`
- Index on `resourceType`
- Index on `createdAt`
- Index on `[userId, createdAt]`
- Index on `[resourceType, resourceId]`

**Relationships:**
- Belongs to `User` (set null on delete - userId is set to null if user deleted)

---

### ApplicationLog

Application logging for system monitoring and debugging.

**Table:** `application_logs`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String (UUID) | Primary Key | Unique log identifier |
| `level` | String | Required | Log level (debug, info, warn, error) |
| `message` | String | Required | Log message |
| `service` | String | Default: "nextjs" | Service name (nextjs, ingestion, database) |
| `context` | Json | Optional | Additional context data (JSON) |
| `requestId` | String | Optional | Request identifier for tracing |
| `userId` | String (UUID) | Optional | User identifier if applicable |
| `ip` | String | Optional | IP address |
| `path` | String | Optional | Request path |
| `method` | String | Optional | HTTP method |
| `userAgent` | String | Optional | User agent string |
| `createdAt` | DateTime | Auto-generated | Record creation timestamp |

**Business Rules:**
- Logs are created by application logging infrastructure
- Used for monitoring, debugging, and audit purposes
- Logs may be archived or deleted based on retention policies

**Indexes:**
- Primary key on `id`
- Index on `level`
- Index on `service`
- Index on `createdAt`
- Index on `[level, service]`
- Index on `[service, createdAt]`
- Index on `requestId`
- Index on `userId`

**Relationships:**
- No foreign key relationships (standalone logging table)

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
- `summary_only` - Event summary data (not currently used in V1)
- `laps_full` - Complete data including races, results, and all lap times

**V1 Note**: In V1, "Import Event" always means `laps_full` ingestion. The `none` depth is used for event discovery, but users always get complete data when importing. The `summary_only` value exists in the enum but is not currently used.

**Usage:**
- Set via event ingestion API or admin CLI
- Determines what data is ingested from LiveRC
- Used for filtering events by ingestion status

---

### PersonaType

Defines the types of personas available in the system.

**Values:**
- `driver` - Individual RC racer persona
- `admin` - System administrator persona
- `team_manager` - Team manager persona
- `race_engineer` - AI-backed race engineer persona

**Usage:**
- Used in Persona model `type` field
- Users are linked to personas via `User.personaId`
- Personas are created via seed script

---

### UserDriverLinkStatus

Status of user-driver link associations.

**Values:**
- `suggested` - Link suggested by matching algorithm (awaiting confirmation)
- `confirmed` - Link confirmed by user
- `rejected` - Link rejected by user
- `conflict` - Link has conflicts (e.g., driver already linked to another user)

**Usage:**
- Used in UserDriverLink model `status` field
- Status transitions: suggested → confirmed/rejected/conflict

---

### EventDriverLinkMatchType

Type of matching algorithm used to create event-driver links.

**Values:**
- `transponder` - Matched via transponder number
- `exact` - Exact name match
- `fuzzy` - Fuzzy name matching algorithm

**Usage:**
- Used in EventDriverLink model `matchType` field
- Indicates how the user-driver-event link was established

---

### SessionType

Type of racing session (race, practice, qualifying, or practiceday).

**Values:**
- `race` - Race session (main competition)
- `practice` - Practice session
- `qualifying` - Qualifying session
- `practiceday` - Practice day session (standalone practice day events)

**Usage:**
- Used in Race model `sessionType` field
- Allows filtering and searching by session type
- Used in unified search feature to filter sessions
- Nullable field (existing races may not have session type set)

**Notes:**
- Session type can be inferred from race label (e.g., "Qualifier" → `qualifying`, "Practice" → `practice`)
- `practiceday` session type is used for practice day events discovered from LiveRC
- Default behavior: if not set, race is treated as a race session
- Used for session-based search and filtering in the unified search feature

---

## Indexes

### Summary of All Indexes

**User:**
- Primary key: `id`
- Unique: `email`
- Index on `normalizedName`
- Index on `transponderNumber`
- Index on `personaId`
- Index on `[isTeamManager, teamName]`

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
- Index: `eventRaceClassId`

**EventRaceClass:**
- Primary key: `id`
- Unique: `[eventId, className]`
- Index: `eventId`
- Index: `[eventId, className]`

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

**WeatherData:**
- Primary key: `id`
- Foreign key index on `eventId`
- Index on `expiresAt`
- Index on `[eventId, expiresAt]`

**Persona:**
- Primary key: `id`
- Unique: `type`

**UserDriverLink:**
- Primary key: `id`
- Unique: `[userId, driverId]`
- Unique: `driverId`
- Index: `userId`
- Index: `driverId`
- Index: `status`

**EventDriverLink:**
- Primary key: `id`
- Unique: `[userId, eventId, driverId]`
- Index: `[userId, driverId, transponderNumber]`
- Index: `[eventId, driverId]`
- Index: `userDriverLinkId`

**AuditLog:**
- Primary key: `id`
- Index: `userId`
- Index: `action`
- Index: `resourceType`
- Index: `createdAt`
- Index: `[userId, createdAt]`
- Index: `[resourceType, resourceId]`

**ApplicationLog:**
- Primary key: `id`
- Index: `level`
- Index: `service`
- Index: `createdAt`
- Index: `[level, service]`
- Index: `[service, createdAt]`
- Index: `requestId`
- Index: `userId`

**CarProfile:**
- Primary key: `id`
- Index: `userId` (for filtering by user)

**DriverProfile:**
- Primary key: `id`
- Index: `userId` (for filtering by user)

---

## Relationships

### Relationship Summary

1. **Track → Event** (One-to-Many)
   - Foreign key: `Event.trackId`
   - Cascade delete: Events deleted when Track deleted

2. **Event → EventEntry** (One-to-Many)
   - Foreign key: `EventEntry.eventId`
   - Cascade delete: EventEntries deleted when Event deleted

3. **Event → EventRaceClass** (One-to-Many)
   - Foreign key: `EventRaceClass.eventId`
   - Cascade delete: EventRaceClasses deleted when Event deleted

4. **EventRaceClass → EventEntry** (One-to-Many)
   - Foreign key: `EventEntry.eventRaceClassId`
   - Set null on delete: EventEntry.eventRaceClassId set to null when EventRaceClass deleted

5. **Driver → EventEntry** (One-to-Many)
   - Foreign key: `EventEntry.driverId`
   - Cascade delete: EventEntries deleted when Driver deleted

6. **Event → Race** (One-to-Many)
   - Foreign key: `Race.eventId`
   - Cascade delete: Races deleted when Event deleted

7. **Driver → RaceDriver** (One-to-Many)
   - Foreign key: `RaceDriver.driverId`
   - Restrict delete: RaceDrivers prevent Driver deletion

8. **Race → RaceDriver** (One-to-Many)
   - Foreign key: `RaceDriver.raceId`
   - Cascade delete: RaceDrivers deleted when Race deleted

9. **Race → RaceResult** (One-to-Many)
   - Foreign key: `RaceResult.raceId`
   - Cascade delete: RaceResults deleted when Race deleted

10. **RaceDriver → RaceResult** (One-to-Many)
    - Foreign key: `RaceResult.raceDriverId`
    - Cascade delete: RaceResults deleted when RaceDriver deleted

11. **RaceResult → Lap** (One-to-Many)
    - Foreign key: `Lap.raceResultId`
    - Cascade delete: Laps deleted when RaceResult deleted

12. **Event → TransponderOverride** (One-to-Many)
    - Foreign key: `TransponderOverride.eventId`
    - Cascade delete: TransponderOverrides deleted when Event deleted

13. **Driver → TransponderOverride** (One-to-Many)
    - Foreign key: `TransponderOverride.driverId`
    - Restrict delete: TransponderOverrides prevent Driver deletion

14. **Race → TransponderOverride** (One-to-Many)
    - Foreign key: `TransponderOverride.effectiveFromRaceId`
    - Set null on delete: If race is deleted, override applies from first race

13. **Persona → User** (One-to-Many)
    - Foreign key: `User.personaId`
    - Set null on delete: If persona is deleted, user's personaId is set to null

14. **User → UserDriverLink** (One-to-Many)
    - Foreign key: `UserDriverLink.userId`
    - Cascade delete: UserDriverLinks deleted when User deleted

15. **Driver → UserDriverLink** (One-to-One)
    - Foreign key: `UserDriverLink.driverId`
    - Cascade delete: UserDriverLink deleted when Driver deleted

16. **User → EventDriverLink** (One-to-Many)
    - Foreign key: `EventDriverLink.userId`
    - Cascade delete: EventDriverLinks deleted when User deleted

19. **Event → EventDriverLink** (One-to-Many)
    - Foreign key: `EventDriverLink.eventId`
    - Cascade delete: EventDriverLinks deleted when Event deleted

20. **Driver → EventDriverLink** (One-to-Many)
    - Foreign key: `EventDriverLink.driverId`
    - Cascade delete: EventDriverLinks deleted when Driver deleted

21. **UserDriverLink → EventDriverLink** (One-to-Many)
    - Foreign key: `EventDriverLink.userDriverLinkId`
    - Set null on delete: If UserDriverLink is deleted, EventDriverLink.userDriverLinkId is set to null

22. **User → CarProfile** (One-to-Many)
    - Foreign key: `CarProfile.userId`
    - Cascade delete: CarProfiles deleted when User deleted

23. **User → DriverProfile** (One-to-Many)
    - Foreign key: `DriverProfile.userId`
    - Cascade delete: DriverProfiles deleted when User deleted

### Cascade Delete Behavior

Most relationships use cascade delete to maintain referential integrity:
- Deleting a Track deletes all associated Events
- Deleting an Event deletes all associated EventEntries and Races
- Deleting a Driver deletes all associated EventEntries (but RaceDrivers prevent Driver deletion)
- Deleting a Race deletes all associated RaceDrivers and RaceResults
- Deleting a RaceDriver deletes all associated RaceResults
- Deleting a RaceResult deletes all associated Laps
- Deleting an Event deletes all associated TransponderOverrides and EventDriverLinks
- Deleting a Driver deletes all associated TransponderOverrides, UserDriverLinks, and EventDriverLinks
- Deleting a User deletes all associated EventDriverLinks, UserDriverLinks, CarProfiles, and DriverProfiles

**Restrict Delete:**
- RaceDrivers prevent Driver deletion (onDelete: Restrict) to maintain referential integrity

**Cascade Delete:**
- TransponderOverrides are deleted when Driver is deleted (onDelete: Cascade)
- UserDriverLinks are deleted when User or Driver is deleted (onDelete: Cascade)
- EventDriverLinks are deleted when User, Event, or Driver is deleted (onDelete: Cascade)

**Set Null on Delete:**
- If a Race is deleted, TransponderOverride.effectiveFromRaceId is set to null (override applies from first race)
- If a Persona is deleted, User.personaId is set to null
- If a UserDriverLink is deleted, EventDriverLink.userDriverLinkId is set to null

**Note:** User records cascade delete to UserDriverLinks and EventDriverLinks, but are not cascade deleted themselves.

---

## Data Lifecycle

### Creation

**User:**
- Created via registration API endpoint
- Password is hashed using Argon2id before storage
- `isAdmin` is explicitly set to `false` (security requirement)
- Persona is auto-assigned based on user properties (driver links, isAdmin, isTeamManager)

**Persona:**
- Created via seed script
- Four default personas: driver, admin, team_manager, race_engineer
- Users are linked to personas via `User.personaId`

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

**UserDriverLink:**
- Created via driver matching algorithms
- Links users to drivers with similarity scores and status
- One driver can be linked to one user (unique constraint on driverId)
- Status can be: suggested, confirmed, rejected, or conflict

**EventDriverLink:**
- Created via event-specific driver matching
- Links users to drivers within specific events
- Can reference a UserDriverLink for user-level associations
- Match types: transponder, exact, or fuzzy

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

