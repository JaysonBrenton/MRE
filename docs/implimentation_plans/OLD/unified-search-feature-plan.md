# Unified Search Feature Implementation Plan

**Created**: 2026-01-XX  
**Owner**: Frontend + Backend Engineering Teams  
**Objective**: Implement a unified search feature that allows users to search
for both events and sessions (races/practice/qualifying), with filtering by
driver name. This replaces the standalone `/event-search` page while preserving
dashboard event search functionality.

---

## 0. Guiding Goals

1. **Unified Search Experience** – Single search interface for events and
   sessions (races, practice, qualifying)
2. **Driver Filtering** – Filter results by driver name (exact match with fuzzy
   fallback) who have at least one valid lap time
3. **Session Type Support** – Add `sessionType` field to Race model to
   distinguish race/practice/qualifying
4. **Redux State Management** – Use Redux for search state, filters, pagination,
   and results
5. **Pagination Consistency** – Follow existing table pagination patterns
   (ListPagination component with `mb-16`)
6. **Non-Breaking Changes** – Dashboard event search modal must continue to work
   unchanged
7. **API-First Architecture** – All business logic in `src/core/`, thin UI
   components
8. **Database Migration** – Add `sessionType` field with proper migration and
   backfill strategy

---

## 1. Database Schema Changes

### 1.1 Add SessionType Enum

- **File**: `prisma/schema.prisma`
- **Action**: Add new enum `SessionType` with values: `race`, `practice`,
  `qualifying`
- **Location**: After existing enums (around line 366)
- **Code**:
  ```prisma
  enum SessionType {
    race
    practice
    qualifying
  }
  ```

### 1.2 Add sessionType Field to Race Model

- **File**: `prisma/schema.prisma`
- **Action**: Add `sessionType` field to `Race` model
- **Location**: In `Race` model (around line 159-182)
- **Field Definition**:
  ```prisma
  sessionType  SessionType?  @map("session_type")
  ```
- **Index**: Add index for efficient filtering:
  ```prisma
  @@index([sessionType])
  @@index([eventId, sessionType])
  ```

### 1.3 Create Migration

- **Command**: `npx prisma migrate dev --name add_session_type`
- **Location**: `prisma/migrations/YYYYMMDDHHMMSS_add_session_type/`
- **Migration SQL**:
  - Add enum type:
    `CREATE TYPE "SessionType" AS ENUM ('race', 'practice', 'qualifying');`
  - Add column: `ALTER TABLE "races" ADD COLUMN "session_type" "SessionType";`
  - Add indexes:
    - `CREATE INDEX "races_session_type_idx" ON "races"("session_type");`
    - `CREATE INDEX "races_event_id_session_type_idx" ON "races"("event_id", "session_type");`
- **Backfill Strategy**:
  - Default all existing races to `sessionType = 'race'` (most common)
  - Or create a script to infer from `raceLabel` (e.g., "Qualifier" →
    `qualifying`, "Practice" → `practice`, else → `race`)
  - Script location: `scripts/backfill-session-types.ts`

### 1.4 Backfill Script (Optional but Recommended)

- **File**: `scripts/backfill-session-types.ts`
- **Purpose**: Infer session type from existing `raceLabel` for historical data
- **Logic**:
  ```typescript
  // If raceLabel contains "qualif" or "qual" → qualifying
  // If raceLabel contains "practice" → practice
  // Otherwise → race
  ```
- **Execution**: Run after migration:
  `docker exec -it mre-app npm run ts-node scripts/backfill-session-types.ts`

---

## 2. Core Business Logic

### 2.1 Create Search Domain Structure

- **Directory**: `src/core/search/`
- **Files to Create**:
  - `repo.ts` - All Prisma queries for search
  - `search.ts` - Main search business logic
  - `driver-matching.ts` - Driver name matching (exact + fuzzy)
  - `types.ts` - TypeScript types for search

### 2.2 Search Repository (`src/core/search/repo.ts`)

- **Purpose**: Centralize all database queries for search
- **Functions**:
  - `searchEvents(params: SearchEventsParams): Promise<SearchEventsResult>`
    - Search events by name, track, date range
    - Filter by driver (if provided)
    - Returns paginated results
  - `searchSessions(params: SearchSessionsParams): Promise<SearchSessionsResult>`
    - Search races by label, class, event
    - Filter by sessionType (race/practice/qualifying)
    - Filter by driver (if provided)
    - Returns paginated results
  - `findDriversWithValidLaps(driverName: string): Promise<Driver[]>`
    - Find drivers matching name (exact first, then fuzzy)
    - Filter to only drivers with at least one valid lap (`lapTimeSeconds > 0`)
    - Returns array of matching drivers

### 2.3 Driver Matching Logic (`src/core/search/driver-matching.ts`)

- **Purpose**: Implement exact + fuzzy driver name matching
- **Functions**:
  - `findDriversExactMatch(name: string): Promise<Driver[]>`
    - Case-insensitive exact match on `displayName` and `normalizedName`
    - Returns matching drivers
  - `findDriversFuzzyMatch(name: string): Promise<Driver[]>`
    - Fuzzy matching using similarity (e.g., Levenshtein distance or PostgreSQL
      `pg_trgm`)
    - Fallback when exact match returns no results
    - Returns top N matches (e.g., top 10 by similarity score)
  - `findDriversWithValidLaps(driverName: string): Promise<Driver[]>`
    - Combines exact + fuzzy matching
    - Filters to drivers with valid laps:
      ```sql
      WHERE EXISTS (
        SELECT 1 FROM laps l
        JOIN race_results rr ON l.race_result_id = rr.id
        JOIN race_drivers rd ON rr.race_driver_id = rd.id
        WHERE rd.driver_id = d.id
        AND l.lap_time_seconds > 0
      )
      ```

### 2.4 Main Search Logic (`src/core/search/search.ts`)

- **Purpose**: Orchestrate search across events and sessions
- **Functions**:
  - `unifiedSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResult>`
    - Accepts: query (optional), driverName (optional), sessionType (optional),
      dateRange (optional), pagination
    - If driverName provided: find matching drivers first, then filter
      events/sessions
    - Search events and sessions in parallel
    - Combine and sort results
    - Return paginated unified results
  - **Result Structure**:
    ```typescript
    {
      events: Array<{
        id: string
        eventName: string
        eventDate: string
        trackName: string
        // ... other event fields
      }>
      sessions: Array<{
        id: string
        raceId: string
        raceLabel: string
        className: string
        sessionType: SessionType
        eventId: string
        eventName: string
        eventDate: string
        // ... other session fields
      }>
      totalEvents: number
      totalSessions: number
      currentPage: number
      totalPages: number
      itemsPerPage: number
    }
    ```

### 2.5 Types (`src/core/search/types.ts`)

- **Purpose**: TypeScript type definitions
- **Types**:

  ```typescript
  export type SessionType = "race" | "practice" | "qualifying"

  export interface UnifiedSearchParams {
    query?: string
    driverName?: string
    sessionType?: SessionType
    startDate?: string
    endDate?: string
    page?: number
    itemsPerPage?: number
  }

  export interface UnifiedSearchResult {
    events: EventSearchResult[]
    sessions: SessionSearchResult[]
    totalEvents: number
    totalSessions: number
    currentPage: number
    totalPages: number
    itemsPerPage: number
  }

  // ... other types
  ```

---

## 3. API Endpoint

### 3.1 Create Search API Route

- **File**: `src/app/api/v1/search/route.ts`
- **Method**: `GET`
- **Query Parameters**:
  - `q` (optional) - General search query
  - `driver_name` (optional) - Filter by driver name
  - `session_type` (optional) - Filter by session type
    (race/practice/qualifying)
  - `start_date` (optional) - Date range start
  - `end_date` (optional) - Date range end
  - `page` (optional, default: 1) - Page number
  - `items_per_page` (optional, default: 10) - Items per page
- **Response Format**:
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
- **Error Handling**:
  - Validation errors (400)
  - Authentication required (401)
  - Server errors (500)

### 3.2 Preserve Existing Event Search API

- **File**: `src/app/api/v1/events/search/route.ts`
- **Action**: **DO NOT MODIFY** - This endpoint is used by dashboard modal
- **Status**: Keep unchanged to ensure dashboard compatibility

---

## 4. Redux State Management

### 4.1 Create Search Slice

- **File**: `src/store/slices/searchSlice.ts`
- **Purpose**: Manage search state, filters, pagination, and results
- **State Structure**:

  ```typescript
  interface SearchState {
    // Search parameters
    query: string
    driverName: string
    sessionType: SessionType | null
    startDate: string | null
    endDate: string | null

    // Results
    events: EventSearchResult[]
    sessions: SessionSearchResult[]
    totalEvents: number
    totalSessions: number

    // Pagination
    currentPage: number
    itemsPerPage: number
    totalPages: number

    // UI state
    isLoading: boolean
    error: string | null
    hasSearched: boolean
  }
  ```

### 4.2 Async Thunks

- **Thunks**:
  - `performSearch(params: UnifiedSearchParams)` - Main search action
    - Sets loading state
    - Calls `/api/v1/search` endpoint
    - Updates results and pagination
    - Handles errors
  - `setSearchQuery(query: string)` - Update search query
  - `setDriverFilter(driverName: string)` - Update driver filter
  - `setSessionTypeFilter(sessionType: SessionType | null)` - Update session
    type filter
  - `setDateRange(startDate: string | null, endDate: string | null)` - Update
    date range
  - `setPage(page: number)` - Change page
  - `setItemsPerPage(itemsPerPage: number)` - Change items per page
  - `clearSearch()` - Reset search state

### 4.3 Reducers

- **Actions**:
  - `setQuery`, `setDriverName`, `setSessionType`, `setDateRange`
  - `setPage`, `setItemsPerPage`
  - `clearSearch`
- **Extra Reducers**: Handle async thunk states (pending, fulfilled, rejected)

### 4.4 Register Slice in Store

- **File**: `src/store/index.ts`
- **Action**: Import and add `searchReducer` to `rootReducer`
- **Persistence**: Consider sessionStorage for search state (optional)

---

## 5. UI Components

### 5.1 Search Page

- **File**: `src/app/(authenticated)/search/page.tsx`
- **Purpose**: Main search page (replaces `/event-search`)
- **Structure**:
  - Breadcrumbs
  - Page title and description
  - Search form component
  - Search results table component
  - Pagination component

### 5.2 Search Form Component

- **File**: `src/components/search/SearchForm.tsx`
- **Purpose**: Search input and filters
- **Fields**:
  - General search query input
  - Driver name filter (with autocomplete suggestions)
  - Session type filter (dropdown: All / Race / Practice / Qualifying)
  - Date range picker (optional)
  - Search button
  - Clear filters button
- **State**: Connected to Redux search slice

### 5.3 Search Results Table Component

- **File**: `src/components/search/SearchResultsTable.tsx`
- **Purpose**: Display unified search results
- **Structure**:
  - Use `StandardTable` component
  - Two sections: Events and Sessions (or tabs)
  - Columns:
    - **Events**: Event Name, Track, Date, Actions (View Event)
    - **Sessions**: Session Name, Class, Type, Event, Date, Actions (View
      Session)
  - Empty state when no results
  - Loading state during search
- **Pagination**: Use `ListPagination` component with `mb-16` spacing

### 5.4 Search Result Row Components

- **Files**:
  - `src/components/search/EventResultRow.tsx` - Individual event result row
  - `src/components/search/SessionResultRow.tsx` - Individual session result row
- **Purpose**: Render individual search results with proper styling and actions

### 5.5 Driver Autocomplete Component (Optional Enhancement)

- **File**: `src/components/search/DriverAutocomplete.tsx`
- **Purpose**: Autocomplete suggestions for driver name filter
- **API**: New endpoint `/api/v1/drivers/autocomplete?q=<query>` (optional)
- **Behavior**: Show suggestions as user types, filter to drivers with valid
  laps

---

## 6. Navigation Updates

### 6.1 Update Navigation Rail

- **File**: `src/components/dashboard/shell/AdaptiveNavigationRail.tsx`
- **Action**: Replace "Event Search" menu item with "Search"
- **Changes**:
  - Update `href` from `/event-search` to `/search`
  - Update `label` from "Event Search" to "Search"
  - Update `description` to "Search events and sessions"
  - Keep icon (search icon is appropriate)

### 6.2 Update Command Palette

- **File**: `src/components/dashboard/shell/CommandPalette.tsx`
- **Action**: Update search command to point to `/search`

### 6.3 Update Guides (Optional)

- **File**: `src/components/dashboard/shell/AdaptiveNavigationRail.tsx`
- **Action**: Update guide link if it references event search

### 6.4 Remove or Redirect Old Route

- **Option A**: Delete `/event-search` page (recommended)
  - **File**: `src/app/(authenticated)/event-search/page.tsx` - DELETE
- **Option B**: Add redirect (if needed for bookmarks)
  - **File**: `src/app/(authenticated)/event-search/page.tsx`
  - **Action**: Redirect to `/search` using Next.js redirect

---

## 7. Testing Requirements

### 7.1 Unit Tests

- **Core Logic Tests**:
  - `src/core/search/search.test.ts` - Test unified search logic
  - `src/core/search/driver-matching.test.ts` - Test exact + fuzzy matching
  - `src/core/search/repo.test.ts` - Test repository queries (mocked Prisma)
- **Redux Tests**:
  - `src/store/slices/searchSlice.test.ts` - Test search slice actions and
    reducers

### 7.2 Integration Tests

- **API Tests**:
  - `src/__tests__/api/v1/search.test.ts` - Test search endpoint
  - Test authentication, validation, pagination, filtering
- **Component Tests**:
  - Test search form interactions
  - Test results table rendering
  - Test pagination controls

### 7.3 E2E Tests (Playwright)

- **File**: `tests/e2e/search.spec.ts`
- **Scenarios**:
  - Search for events
  - Search for sessions
  - Filter by driver name
  - Filter by session type
  - Pagination navigation
  - Clear filters

---

## 8. Documentation Updates

### 8.1 Architecture Documentation

- **File**: `docs/architecture/search-feature.md` (new)
- **Content**:
  - Search architecture overview
  - API endpoint documentation
  - Redux state management
  - Database schema changes

### 8.2 API Documentation

- **File**: `docs/api/api-reference.md`
- **Action**: Add `/api/v1/search` endpoint documentation
- **Include**: Request/response examples, query parameters, error codes

### 8.3 User Guide (Optional)

- **File**: `docs/user-guides/search.md` (new)
- **Content**: How to use the search feature, filtering options, tips

---

## 9. Migration & Rollout Strategy

### 9.1 Phase 1: Database Migration

1. Update Prisma schema
2. Create migration
3. Run migration in development
4. Create and run backfill script
5. Verify data integrity
6. Test queries with new field

### 9.2 Phase 2: Core Logic & API

1. Create core search domain (`src/core/search/`)
2. Implement repository functions
3. Implement driver matching logic
4. Implement unified search logic
5. Create API endpoint
6. Write unit tests
7. Test API endpoint manually

### 9.3 Phase 3: Redux Integration

1. Create search slice
2. Register in store
3. Test Redux actions and state updates
4. Verify persistence (if implemented)

### 9.4 Phase 4: UI Components

1. Create search page
2. Create search form component
3. Create results table component
4. Connect to Redux
5. Test UI interactions
6. Verify pagination

### 9.5 Phase 5: Navigation & Cleanup

1. Update navigation rail
2. Update command palette
3. Remove/redirect old `/event-search` page
4. Test navigation flow
5. Verify dashboard modal still works

### 9.6 Phase 6: Testing & Documentation

1. Write comprehensive tests
2. Run E2E tests
3. Update documentation
4. Code review
5. Final testing

### 9.7 Phase 7: Deployment

1. Deploy to staging
2. Test in staging environment
3. Monitor for errors
4. Deploy to production
5. Monitor production metrics

---

## 10. Rollback Strategy

### 10.1 Database Rollback

- **Migration**: Create reverse migration to remove `sessionType` field
- **Data**: No data loss (field is nullable, can be set to null)

### 10.2 Code Rollback

- **Git**: Revert commits or use feature flag
- **Navigation**: Revert navigation changes to point back to `/event-search`
- **API**: Keep old `/api/v1/events/search` endpoint (unchanged)

### 10.3 Feature Flag (Optional)

- Add feature flag `ENABLE_UNIFIED_SEARCH` to control rollout
- Default to `false`, enable gradually
- Allows A/B testing and gradual rollout

---

## 11. Success Metrics

### 11.1 Functional Requirements

- ✅ Users can search for events
- ✅ Users can search for sessions (races/practice/qualifying)
- ✅ Users can filter by driver name (exact + fuzzy)
- ✅ Users can filter by session type
- ✅ Results are paginated correctly
- ✅ Dashboard event search modal continues to work

### 11.2 Performance Requirements

- Search API responds in < 500ms (p95) for typical queries
- Pagination loads in < 200ms
- Driver autocomplete (if implemented) responds in < 300ms

### 11.3 Quality Requirements

- Test coverage > 80% for core search logic
- All E2E tests pass
- No breaking changes to existing functionality
- Documentation is complete and accurate

---

## 12. Dependencies & Decisions

### 12.1 Fuzzy Matching Implementation

- **Decision Needed**: Which fuzzy matching algorithm?
  - **Option A**: PostgreSQL `pg_trgm` extension (requires DB extension)
  - **Option B**: JavaScript library (e.g., `fuse.js`, `fuzzy-search`)
  - **Option C**: Simple Levenshtein distance in application code
- **Recommendation**: Start with Option C (simple), upgrade to Option A if
  performance needed

### 12.2 Driver Autocomplete

- **Decision**: Implement immediately or as Phase 2 enhancement?
- **Recommendation**: Phase 2 enhancement (can use simple text input initially)

### 12.3 Results Display

- **Decision**: Single table with type indicator, or separate sections/tabs?
- **Recommendation**: Separate sections (Events section, Sessions section) for
  clarity

### 12.4 Pagination Strategy

- **Decision**: Separate pagination for events/sessions, or unified pagination?
- **Recommendation**: Unified pagination (combine events + sessions, sort by
  relevance/date)

### 12.5 Search State Persistence

- **Decision**: Persist search state in Redux (sessionStorage) or reset on page
  load?
- **Recommendation**: Persist in sessionStorage for better UX (user can refresh
  without losing search)

---

## 13. Environment Considerations (Docker-Only Workflow)

### 13.1 Database Migration

- **Execution**: Run migrations inside Docker container
- **Command**: `docker exec -it mre-app npx prisma migrate dev`
- **Backfill Script**:
  `docker exec -it mre-app npm run ts-node scripts/backfill-session-types.ts`

### 13.2 Development Testing

- **API Testing**: Test endpoints via
  `docker exec -it mre-app curl http://localhost:3001/api/v1/search?q=test`
- **Database Queries**: Use Prisma Studio:
  `docker exec -it mre-app npx prisma studio`

### 13.3 Build & Deploy

- **Prisma Generate**: Automatically runs on container start (postinstall
  script)
- **Type Generation**: Ensure Prisma client is regenerated after schema changes

---

## 14. Open Questions

1. **Fuzzy Matching**: Which algorithm/library to use? (See 12.1)
2. **Autocomplete**: Implement in Phase 1 or Phase 2? (See 12.2)
3. **Results Sorting**: How to sort unified results? (Date? Relevance? Type?)
4. **Performance**: Do we need caching for driver name lookups?
5. **Analytics**: Should we track search queries for analytics?
6. **Accessibility**: Any specific a11y requirements for search interface?

---

## 15. Implementation Checklist

### Database

- [ ] Add `SessionType` enum to schema
- [ ] Add `sessionType` field to `Race` model
- [ ] Add indexes for `sessionType`
- [ ] Create migration
- [ ] Run migration in development
- [ ] Create backfill script
- [ ] Run backfill script
- [ ] Verify data integrity

### Core Logic

- [ ] Create `src/core/search/` directory
- [ ] Create `types.ts` with type definitions
- [ ] Create `repo.ts` with repository functions
- [ ] Create `driver-matching.ts` with matching logic
- [ ] Create `search.ts` with unified search logic
- [ ] Write unit tests for core logic

### API

- [ ] Create `/api/v1/search/route.ts`
- [ ] Implement GET handler
- [ ] Add validation
- [ ] Add error handling
- [ ] Write API tests
- [ ] Test manually

### Redux

- [ ] Create `searchSlice.ts`
- [ ] Define state interface
- [ ] Create async thunks
- [ ] Create reducers
- [ ] Register in store
- [ ] Test Redux actions

### UI Components

- [ ] Create `/search` page
- [ ] Create `SearchForm` component
- [ ] Create `SearchResultsTable` component
- [ ] Create `EventResultRow` component
- [ ] Create `SessionResultRow` component
- [ ] Connect to Redux
- [ ] Add pagination
- [ ] Test UI interactions

### Navigation

- [ ] Update navigation rail
- [ ] Update command palette
- [ ] Remove/redirect old `/event-search` page
- [ ] Test navigation

### Testing

- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Write E2E tests
- [ ] Run all tests
- [ ] Fix any failures

### Documentation

- [ ] Create architecture doc
- [ ] Update API reference
- [ ] Create user guide (optional)
- [ ] Update README if needed

### Deployment

- [ ] Deploy to staging
- [ ] Test in staging
- [ ] Deploy to production
- [ ] Monitor metrics

---

## 16. Estimated Timeline

- **Phase 1 (Database)**: 2-3 hours
- **Phase 2 (Core Logic)**: 4-6 hours
- **Phase 3 (Redux)**: 2-3 hours
- **Phase 4 (UI)**: 6-8 hours
- **Phase 5 (Navigation)**: 1-2 hours
- **Phase 6 (Testing)**: 4-6 hours
- **Phase 7 (Documentation)**: 2-3 hours
- **Total**: ~21-31 hours (3-4 days)

---

## 17. Risk Assessment

### 17.1 High Risk

- **Database Migration**: Risk of data loss or corruption
  - **Mitigation**: Test migration on copy of production data, have rollback
    plan
- **Breaking Changes**: Risk of breaking dashboard event search
  - **Mitigation**: Keep existing API/component unchanged, thorough testing

### 17.2 Medium Risk

- **Performance**: Risk of slow search queries
  - **Mitigation**: Add database indexes, optimize queries, add pagination
    limits
- **Fuzzy Matching**: Risk of poor matching quality
  - **Mitigation**: Start with simple algorithm, iterate based on user feedback

### 17.3 Low Risk

- **UI/UX**: Risk of confusing interface
  - **Mitigation**: Follow existing design patterns, user testing
- **Documentation**: Risk of incomplete docs
  - **Mitigation**: Document as you go, review before deployment

---

## 18. Post-Implementation Tasks

1. **Monitor Performance**: Track API response times, query performance
2. **Gather User Feedback**: Collect feedback on search experience
3. **Iterate on Fuzzy Matching**: Improve matching algorithm based on usage
4. **Add Enhancements**: Consider autocomplete, advanced filters, saved searches
5. **Analytics**: Track search usage patterns (if analytics added)

---

**End of Implementation Plan**
