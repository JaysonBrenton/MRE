---
created: 2026-01-16
creator: Documentation & Knowledge Steward
lastModified: 2026-01-16
description: Architecture documentation for unified search feature
purpose:
  Defines the architecture, components, and implementation patterns for the
  unified search feature that allows users to search across events and sessions
  (races, practice, qualifying)
relatedFiles:
  - src/core/search/ (core business logic)
  - src/app/api/v1/search/route.ts (API endpoint)
  - src/store/slices/searchSlice.ts (Redux state management)
  - src/components/search/ (UI components)
  - src/app/(authenticated)/search/page.tsx (search page)
  - docs/api/api-reference.md (API documentation)
---

# Search Feature Architecture

**Status:** Implemented and in production  
**Feature Scope:** Unified search across events and sessions (races, practice,
qualifying) with filtering by driver name, session type, and date range

This document describes the architecture and implementation of the unified
search feature in MRE version 0.1.1.

---

## Overview

The unified search feature provides a single search interface for finding events
and sessions (races, practice, qualifying) with optional filtering by:

- General text query (searches event names, track names, session labels, class
  names)
- Driver name (exact match with fuzzy fallback, only drivers with valid lap
  times)
- Session type (race, practice, qualifying, heat, main)
- Date range

**Key Features:**

- Unified search across events and sessions
- Driver name matching (exact + fuzzy)
- Session type filtering
- Date range filtering
- Pagination support
- Redux state management
- Mobile-safe architecture compliance

---

## Architecture Overview

The search feature follows the mobile-safe architecture guidelines:

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Search Page  │  │ Search Form  │  │ Results Table│ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │         │
│         └──────────────────┼──────────────────┘         │
│                            │                            │
│                    ┌───────▼───────┐                    │
│                    │  Redux Store  │                    │
│                    │ (searchSlice) │                    │
│                    └───────┬───────┘                    │
└────────────────────────────┼────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Layer    │
                    │ /api/v1/search │
                    └────────┬───────┘
                             │
                    ┌────────▼────────┐
                    │  Core Logic    │
                    │ src/core/search│
                    │  - search.ts   │
                    │  - repo.ts     │
                    │  - driver-     │
                    │    matching.ts │
                    └────────┬───────┘
                             │
                    ┌────────▼────────┐
                    │   Database     │
                    │   (Prisma)     │
                    └────────────────┘
```

---

## Component Architecture

### 1. Core Business Logic (`src/core/search/`)

All business logic is separated from UI and API layers, following mobile-safe
architecture.

#### `types.ts`

TypeScript type definitions for search domain:

- `SessionType` - Session type enum (race, practice, qualifying, heat, main)
- `UnifiedSearchParams` - Search parameters
- `UnifiedSearchResult` - Search results
- `EventSearchResult` - Individual event result
- `SessionSearchResult` - Individual session result

#### `search.ts`

Main search orchestration:

- `unifiedSearch()` - Orchestrates search across events and sessions
- Handles driver name matching
- Parallel search execution for events and sessions
- Pagination calculation

#### `repo.ts`

Database access layer (all Prisma queries):

- `searchEvents()` - Search events with filters
- `searchSessions()` - Search sessions (races) with filters
- Implements filtering by query, driver IDs, date range, session type
- Handles pagination

#### `driver-matching.ts`

Driver name matching logic:

- `findDriversExactMatch()` - Exact name matching (case-insensitive)
- `findDriversFuzzyMatch()` - Fuzzy name matching (contains search)
- `findDriversWithValidLaps()` - Filters to drivers with valid lap times
- Matching strategy: exact first, then fuzzy fallback

**Business Rules:**

- Only drivers with at least one valid lap time (`lapTimeSeconds > 0`) are
  included
- Fuzzy matching limited to top 20 results
- Matching searches both `displayName` and `normalizedName` fields

---

### 2. API Layer (`src/app/api/v1/search/route.ts`)

REST API endpoint following mobile-safe architecture:

- **Method:** GET
- **Authentication:** Required
- **Query Parameters:**
  - `q` - General search query
  - `driver_name` - Driver name filter
  - `session_type` - Session type filter (race/practice/qualifying)
  - `start_date` - Date range start (ISO 8601)
  - `end_date` - Date range end (ISO 8601)
  - `page` - Page number
  - `items_per_page` - Items per page (max 100)

**Response Format:**

```json
{
  "success": true,
  "data": {
    "events": [...],
    "sessions": [...],
    "totalEvents": 42,
    "totalSessions": 15,
    "currentPage": 1,
    "totalPages": 3,
    "itemsPerPage": 10
  }
}
```

**Error Handling:**

- Validation errors (400) - Invalid parameters
- Authentication errors (401) - Not authenticated
- Server errors (500) - Internal errors

---

### 3. Redux State Management (`src/store/slices/searchSlice.ts`)

State management for search UI:

- **State Structure:**
  - Search parameters (query, driverName, sessionType, dateRange)
  - Results (events, sessions, totals)
  - Pagination (currentPage, itemsPerPage, totalPages)
  - UI state (isLoading, error, hasSearched)

- **Async Thunks:**
  - `performSearch()` - Performs search API call
  - Handles loading states and errors

- **Actions:**
  - `setQuery()`, `setDriverName()`, `setSessionType()`, `setDateRange()`
  - `setPage()`, `setItemsPerPage()`
  - `clearSearch()`

---

### 4. UI Components (`src/components/search/`)

#### `SearchForm.tsx`

Search form component:

- Text input for general query
- Driver name input
- Session type dropdown (All / Race / Practice / Qualifying)
- Date range picker
- Search and clear buttons
- Connected to Redux state

#### `SearchResultsTable.tsx`

Results display component:

- Displays events and sessions in separate sections
- Uses `StandardTable` component
- Empty state when no results
- Loading state during search
- Pagination controls

---

### 5. Search Page (`src/app/(authenticated)/search/page.tsx`)

Main search page:

- Combines SearchForm and SearchResultsTable
- Breadcrumb navigation
- Page title and description
- Connected to Redux store

---

## Data Flow

### Search Execution Flow

1. **User Input** → SearchForm component
2. **State Update** → Redux actions update search parameters
3. **Search Trigger** → User clicks search or changes filters
4. **API Call** → Redux thunk calls `/api/v1/search`
5. **Core Logic** → API route calls `unifiedSearch()` from
   `src/core/search/search.ts`
6. **Driver Matching** → If driver name provided, `findDriversWithValidLaps()`
   finds matching drivers
7. **Database Queries** → Parallel execution:
   - `searchEvents()` - Searches events
   - `searchSessions()` - Searches sessions
8. **Results Aggregation** → Core logic combines and paginates results
9. **Response** → API returns unified results
10. **State Update** → Redux updates with results
11. **UI Update** → SearchResultsTable displays results

---

## Database Schema

### Relevant Models

**Event Model:**

- `id`, `eventName`, `eventDate`, `trackId`
- Relationship to `Track` (for track name)
- Relationship to `EventEntry` (for driver filtering)
- Relationship to `Race` (for session filtering)

**Race Model:**

- `id`, `eventId`, `raceLabel`, `className`
- `sessionType` - Session type enum (race, practice, qualifying, heat, main)
- `startTime`, `durationSeconds`, `raceOrder`
- Relationship to `Event` (for event name and date)
- Relationship to `RaceDriver` (for driver filtering)

**Driver Model:**

- `id`, `displayName`, `normalizedName`
- Used for driver name matching

**Lap Model:**

- `lapTimeSeconds` - Used to filter drivers with valid lap times

### Indexes Used

- `Event.eventDate` - Date range filtering
- `Event.trackId` - Track filtering
- `Race.sessionType` - Session type filtering
- `Race.[eventId, sessionType]` - Combined event and session type filtering
- `Driver.displayName`, `Driver.normalizedName` - Driver name matching

---

## Performance Considerations

### Optimization Strategies

1. **Parallel Execution:** Events and sessions are searched in parallel
2. **Indexed Queries:** All filters use indexed database fields
3. **Pagination:** Results are paginated to limit data transfer
4. **Driver Filtering:** Driver matching happens first, then filters
   events/sessions
5. **Fuzzy Match Limit:** Fuzzy matching limited to top 20 results

### Query Performance

- **Event Search:** Uses indexed fields (eventDate, trackId) for fast filtering
- **Session Search:** Uses indexed fields (sessionType, eventId) for fast
  filtering
- **Driver Matching:** Uses indexed name fields for fast lookups
- **Lap Validation:** Uses EXISTS subquery for efficient filtering

---

## Error Handling

### API Error Handling

- **Validation Errors:** Invalid parameters return 400 with error details
- **Authentication Errors:** Unauthenticated requests return 401
- **Server Errors:** Unexpected errors return 500 with error code

### UI Error Handling

- Redux state tracks error messages
- SearchResultsTable displays error state
- User-friendly error messages displayed to users

---

## Testing Considerations

### Unit Tests

- Core search logic (`search.ts`)
- Driver matching logic (`driver-matching.ts`)
- Repository functions (`repo.ts`)

### Integration Tests

- API endpoint (`/api/v1/search`)
- Redux thunks and actions
- Component interactions

### E2E Tests

- Search form interactions
- Results display
- Pagination
- Filter combinations

---

## Future Enhancements

### Potential Improvements

1. **Advanced Fuzzy Matching:** Use PostgreSQL `pg_trgm` extension for better
   fuzzy matching
2. **Search Result Ranking:** Implement relevance scoring
3. **Search History:** Store recent searches
4. **Saved Searches:** Allow users to save search queries
5. **Autocomplete:** Driver name autocomplete suggestions
6. **Advanced Filters:** Additional filter options (track, class, etc.)

---

## Related Documentation

- [API Reference - Search Endpoints](../../api/api-reference.md#search-endpoints)
- [Database Schema - SessionType Enum](../../database/schema.md#sessiontype)
- [Mobile-Safe Architecture Guidelines](./mobile-safe-architecture-guidelines.md)

---

**End of Search Feature Architecture Documentation**
