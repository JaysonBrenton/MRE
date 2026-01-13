# Practice Days Discovery and Ingestion Implementation Plan

**Created**: 2026-01-XX  
**Source Feature**: `docs/feature_ideas/feature_ideas.md` - "Feature: Practice Days Discovery and Ingestion"  
**Owner**: Backend (Python Ingestion) + Frontend (Next.js) Engineering Teams  
**Objective**: Implement functionality to discover and ingest Practice Days from LiveRC, including session type inference, practice day discovery, ingestion pipeline, and UI integration.

---

## 0. Guiding Goals

1. **Session Type Inference** – Automatically determine session types (race/practice/qualifying/practiceday) during ingestion using multi-signal approach
2. **Practice Day Discovery** – Manual user-initiated discovery of practice days from LiveRC track practice pages
3. **Practice Day Ingestion** – Ingest practice day sessions with idempotent upserts and reconciliation
4. **UI Integration** – Add practice day search and display functionality, integrated with unified search
5. **Backward Compatibility** – Maintain existing API contracts and behavior for race events
6. **Feature Flagging** – Roll out features gradually using feature flags
7. **API-First Architecture** – All business logic in `src/core/` and `ingestion/`, thin UI components
8. **Testing & Observability** – Comprehensive tests and monitoring for all new functionality

---

## 1. Database Schema Changes

### 1.1 Add "practiceday" to SessionType Enum

- **File**: `prisma/schema.prisma`
- **Action**: Add `practiceday` value to existing `SessionType` enum
- **Location**: In `SessionType` enum (around line 403)
- **Current Enum**:
  ```prisma
  enum SessionType {
    race
    practice
    qualifying
  }
  ```
- **Updated Enum**:
  ```prisma
  enum SessionType {
    race
    practice
    qualifying
    practiceday
  }
  ```

### 1.2 Create Migration

- **Command**: `docker exec -it mre-app npx prisma migrate dev --name add_practiceday_session_type`
- **Location**: `prisma/migrations/YYYYMMDDHHMMSS_add_practiceday_session_type/`
- **Migration SQL**: 
  ```sql
  ALTER TYPE "SessionType" ADD VALUE 'practiceday';
  ```
- **Notes**: 
  - This is an ALTER TYPE operation (adds value to existing enum)
  - No data migration needed (existing races remain unchanged)
  - Existing `sessionType = null` values are unaffected

### 1.3 Regenerate Prisma Client

- **Command**: `docker exec -it mre-app npx prisma generate`
- **Purpose**: Update TypeScript types to include `practiceday` in `SessionType`
- **Impact**: All TypeScript code using `SessionType` will see new value
- **Breaking Changes**: None (additive change to enum)

---

## 2. Session Type Inference (Phase 1)

### 2.1 Update Normalizer to Infer Session Types

- **File**: `ingestion/ingestion/normalizer.py`
- **Function**: `normalize_race()`
- **Action**: Add session type inference logic
- **New Method**:
  ```python
  @staticmethod
  def infer_session_type(race_label: str, race_url: str = "") -> Optional[str]:
      """
      Infer session type from race label and URL.
      
      Returns: "practice", "qualifying", "race", or None (defaults to "race" in pipeline)
      """
      label_lower = race_label.lower()
      url_lower = race_url.lower() if race_url else ""
      
      # Practice sessions (within race events)
      if "practice" in label_lower or "/practice/" in url_lower:
          return "practice"
      
      # Qualifying sessions
      if any(term in label_lower for term in ["qualifying", "qualify", "q1", "q2", "q3"]):
          # Use word boundaries to avoid false positives
          import re
          if re.search(r'\b(q1|q2|q3|qualifying|qualify)\b', label_lower):
              return "qualifying"
      
      # Default to race (or None, which will default to "race" in pipeline)
      return "race"
  ```
- **Integration**: Call `infer_session_type()` in `normalize_race()` and store result
- **Note**: Practice day sessions will have `sessionType = "practiceday"` set explicitly during practice day ingestion (not inferred)

### 2.2 Update Pipeline to Include sessionType

- **File**: `ingestion/ingestion/pipeline.py`
- **Function**: `_batch_write_races_data()`
- **Action**: Include `sessionType` in race data dictionaries
- **Changes**:
  - Ensure normalized race data includes `sessionType` field
  - Pass `sessionType` to repository's `bulk_upsert_races()` method

### 2.3 Update Repository to Accept sessionType

- **File**: `ingestion/db/repository.py`
- **Function**: `bulk_upsert_races()`
- **Action**: Accept and store `sessionType` field
- **Changes**:
  - Update method signature to accept `sessionType` in race data
  - Include `session_type` in SQLAlchemy upsert operations
  - Handle `None` values (don't overwrite existing values with `None`)

### 2.4 Update TypeScript Types

- **File**: `src/core/search/types.ts`
- **Action**: Update `SessionType` type to include `practiceday`
- **Current Type**:
  ```typescript
  export type SessionType = "race" | "practice" | "qualifying"
  ```
- **Updated Type**:
  ```typescript
  export type SessionType = "race" | "practice" | "qualifying" | "practiceday"
  ```

### 2.5 Update API Route Validators

- **Files**: 
  - `src/app/api/v1/search/route.ts`
  - Any other routes that validate `sessionType`
- **Action**: Add `practiceday` to valid session type lists
- **Changes**:
  ```typescript
  const validTypes: SessionType[] = ["race", "practice", "qualifying", "practiceday"]
  ```

### 2.6 Add Backward Compatibility Fallbacks

- **Files**: All API routes and core functions that return session types
- **Action**: Add fallback logic for `null` values
- **Pattern**:
  ```typescript
  sessionType: race.sessionType ?? 'race'
  ```
- **Purpose**: Ensure backward compatibility during rollout

### 2.7 Testing: Session Type Inference

- **File**: `ingestion/tests/test_normalizer.py` (or create new test file)
- **Test Cases**:
  - Practice session inference (label contains "practice")
  - Practice session inference (URL contains "/practice/")
  - Qualifying inference (q1, q2, q3, qualifying, qualify)
  - Race inference (default case)
  - Edge cases (false positives from sponsor text, etc.)
  - Word boundary matching for qualifying terms

---

## 3. Practice Day Discovery (Phase 2)

### 3.1 Create Practice Day Parser Models

- **File**: `ingestion/connectors/liverc/models.py` (or create `ingestion/connectors/liverc/practice_models.py`)
- **Models to Create**:
  ```python
  @dataclass
  class PracticeSessionSummary:
      session_id: str
      driver_name: str
      class_name: str
      transponder_number: Optional[str]
      start_time: datetime
      duration_seconds: int
      lap_count: int
      fastest_lap: Optional[float]
      average_lap: Optional[float]
      session_url: str

  @dataclass
  class PracticeDaySummary:
      date: date
      track_slug: str
      session_count: int
      total_laps: int
      total_track_time_seconds: int
      unique_drivers: int
      unique_classes: int
      time_range_start: Optional[datetime]
      time_range_end: Optional[datetime]
      sessions: List[PracticeSessionSummary]

  @dataclass
  class PracticeSessionDetail:
      session_id: str
      driver_name: str
      class_name: str
      transponder_number: Optional[str]
      date: date
      start_time: datetime
      end_time: Optional[datetime]
      duration_seconds: int
      lap_count: int
      fastest_lap: Optional[float]
      # Additional performance metrics
      top_3_consecutive: Optional[float]
      average_lap: Optional[float]
      avg_top_5: Optional[float]
      avg_top_10: Optional[float]
      avg_top_15: Optional[float]
      std_deviation: Optional[float]
      consistency: Optional[float]
      valid_lap_range: Optional[Tuple[int, int]]
      laps: List[LapData]  # From existing lap data structures
  ```

### 3.2 Create Practice Day HTML Parsers

- **File**: `ingestion/connectors/liverc/parsers.py` (or create `ingestion/connectors/liverc/practice_parsers.py`)
- **Functions to Create**:

  **3.2.1 Parse Practice Month View**
  - **Function**: `parse_practice_month_view(html: str, track_slug: str, year: int, month: int) -> List[date]`
  - **Purpose**: Extract list of dates that have practice days
  - **Input**: HTML from `/practice/` page with month/year selector
  - **Output**: List of `date` objects

  **3.2.2 Parse Practice Day Overview**
  - **Function**: `parse_practice_day_overview(html: str, track_slug: str, date: date) -> PracticeDaySummary`
  - **Purpose**: Parse practice day overview page to extract session summaries and stats
  - **Input**: HTML from `/practice/?p=session_list&d=YYYY-MM-DD`
  - **Output**: `PracticeDaySummary` object

  **3.2.3 Parse Practice Session Detail**
  - **Function**: `parse_practice_session_detail(html: str, session_id: str) -> PracticeSessionDetail`
  - **Purpose**: Parse individual practice session page for complete lap data
  - **Input**: HTML from `/practice/?p=view_session&id=XXXXX`
  - **Output**: `PracticeSessionDetail` object

### 3.3 Add Practice Day Methods to LiveRC Connector

- **File**: `ingestion/connectors/liverc/connector.py`
- **Methods to Add**:

  **3.3.1 Fetch Practice Month View**
  - **Method**: `async def fetch_practice_month_view(self, track_slug: str, year: int, month: int) -> List[date]`
  - **Purpose**: Fetch and parse practice month view
  - **Implementation**: 
    - Use HTTPX or Playwright (per existing connector architecture)
    - Call parser to extract dates
    - Implement caching (24 hour cache)

  **3.3.2 Fetch Practice Day Overview**
  - **Method**: `async def fetch_practice_day_overview(self, track_slug: str, date: date) -> PracticeDaySummary`
  - **Purpose**: Fetch and parse practice day overview
  - **Implementation**:
    - Use HTTPX or Playwright
    - Call parser to extract session summaries
    - Implement caching (1 hour cache)
    - Handle pagination if needed

  **3.3.3 Fetch Practice Session Detail**
  - **Method**: `async def fetch_practice_session_detail(self, session_id: str) -> PracticeSessionDetail`
  - **Purpose**: Fetch and parse individual practice session
  - **Implementation**:
    - Use HTTPX or Playwright
    - Call parser to extract lap data
    - Implement caching (15 minute cache)

### 3.4 Implement Rate Limiting and Caching

- **File**: `ingestion/connectors/liverc/cache.py` (or extend existing caching)
- **Cache Keys**:
  - `practice:month:{track-slug}:{YYYY-MM}` (TTL: 24 hours)
  - `practice:day:{track-slug}:{YYYY-MM-DD}` (TTL: 1 hour)
  - `practice:session:{session-id}` (TTL: 15 minutes)
- **Rate Limiting**:
  - Per-track rate limits (max 10 requests/minute per track)
  - Exponential backoff for failed requests
  - Respect HTTP 429 responses with retry-after headers
- **Implementation**: Use existing caching infrastructure or add Redis/memory cache

### 3.5 Create Core Practice Day Discovery Logic

- **File**: `ingestion/services/practice_day_discovery.py` (new file)
- **Purpose**: Orchestrate practice day discovery
- **Functions**:

  **3.5.1 Discover Practice Days for Date Range**
  - **Function**: `async def discover_practice_days(track_slug: str, start_date: date, end_date: date) -> List[PracticeDaySummary]`
  - **Purpose**: Discover all practice days in date range
  - **Logic**:
    - Validate date range (max 3 months)
    - Iterate through months in range
    - Fetch practice month view for each month
    - Filter dates within range
    - Fetch practice day overview for each date
    - Return list of `PracticeDaySummary`

  **3.5.2 Search Practice Days (Database)**
  - **Function**: `async def search_practice_days(track_id: str, start_date: Optional[date], end_date: Optional[date]) -> List[Event]`
  - **Purpose**: Search for already-ingested practice days in database
  - **Implementation**: Query Event table for practice day events (by `sourceEventId` pattern)

### 3.6 Create API Endpoints (Next.js)

- **File**: `src/app/api/v1/practice-days/discover/route.ts` (new file)
- **Method**: POST
- **Purpose**: Discover practice days from LiveRC
- **Request Body**:
  ```typescript
  {
    track_id: string
    start_date: string (YYYY-MM-DD, required)
    end_date: string (YYYY-MM-DD, required)
  }
  ```
- **Response**:
  ```typescript
  {
    success: true
    data: {
      practice_days: PracticeDaySummary[]
    }
  }
  ```
- **Implementation**: 
  - Call ingestion service discovery endpoint
  - Handle rate limiting and errors
  - Return structured response

- **File**: `src/app/api/v1/practice-days/search/route.ts` (new file)
- **Method**: GET
- **Purpose**: Search for practice days in database
- **Query Parameters**:
  - `track_id`: string (required)
  - `start_date`: string (YYYY-MM-DD, optional)
  - `end_date`: string (YYYY-MM-DD, optional)
- **Response**:
  ```typescript
  {
    success: true
    data: {
      practice_days: Event[]
    }
  }
  ```
- **Implementation**: 
  - Call core search function
  - Filter for practice day events (by `sourceEventId` pattern)

### 3.7 Create Core Functions (Next.js)

- **File**: `src/core/practice-days/discover-practice-days.ts` (new file)
- **Function**: `discoverPracticeDays(params: DiscoverPracticeDaysInput): Promise<DiscoverPracticeDaysResult>`
- **Purpose**: Business logic for practice day discovery
- **Implementation**: Call ingestion service API

- **File**: `src/core/practice-days/search-practice-days.ts` (new file)
- **Function**: `searchPracticeDays(params: SearchPracticeDaysInput): Promise<SearchPracticeDaysResult>`
- **Purpose**: Business logic for practice day search
- **Implementation**: Query database using repository pattern

- **File**: `src/core/practice-days/types.ts` (new file)
- **Purpose**: TypeScript types for practice days
- **Types**:
  ```typescript
  export interface PracticeDaySummary {
    date: string
    trackSlug: string
    sessionCount: number
    totalLaps: number
    totalTrackTimeSeconds: number
    uniqueDrivers: number
    uniqueClasses: number
    timeRangeStart?: string
    timeRangeEnd?: string
    sessions: PracticeSessionSummary[]
  }

  export interface DiscoverPracticeDaysInput {
    trackId: string
    startDate: string
    endDate: string
  }

  export interface SearchPracticeDaysInput {
    trackId: string
    startDate?: string
    endDate?: string
  }
  ```

### 3.8 Testing: Practice Day Discovery

- **Files**: 
  - `ingestion/tests/test_practice_parsers.py` (new file)
  - `ingestion/tests/test_practice_connector.py` (new file)
  - `src/__tests__/api/practice-days/discover.test.ts` (new file)
  - `src/__tests__/api/practice-days/search.test.ts` (new file)
- **Test Cases**:
  - Parse practice month view HTML (use fixtures)
  - Parse practice day overview HTML (use fixtures)
  - Parse practice session detail HTML (use fixtures)
  - Rate limiting behavior
  - Caching behavior
  - Error handling (HTTP errors, parse errors)
  - Date range validation
  - API endpoint integration tests

### 3.9 Create Test Fixtures

- **Directory**: `ingestion/tests/fixtures/liverc/practice/`
- **Files to Create**:
  - `canberraoffroad-month-2025-10.html` (practice month view)
  - `canberraoffroad-day-2025-10-25.html` (practice day overview)
  - `practice-session-12345.html` (practice session detail)
- **Source**: Use reference material from `docs/reference_material/liverc/`

---

## 4. Practice Day Ingestion (Phase 3)

### 4.1 Extend Ingestion Pipeline for Practice Days

- **File**: `ingestion/ingestion/pipeline.py`
- **New Method**: `async def ingest_practice_day(track_id: str, date: date) -> Event`
- **Purpose**: Ingest a practice day (all sessions for a date)
- **Logic**:
  1. Fetch practice day overview from connector
  2. Check if Event already exists (by `sourceEventId`)
  3. Use advisory lock (per `sourceEventId`) to prevent concurrent ingestion
  4. Create or update Event record
  5. For each session in overview:
     - Fetch session detail if not already ingested
     - Create/update Race record with `sessionType = "practiceday"`
     - Ingest lap data
  6. Update Event metadata with practice day stats
  7. Release advisory lock
  8. Return Event record

### 4.2 Implement Idempotent Upserts

- **File**: `ingestion/db/repository.py`
- **Functions**: Extend existing upsert methods
- **Logic**:
  - Use `sourceEventId` for Event uniqueness: `{track-slug}-practice-{YYYY-MM-DD}`
  - Use `sourceRaceId` for Race uniqueness (from LiveRC session ID)
  - Implement `ON CONFLICT DO UPDATE` logic
  - Preserve existing data when re-ingesting (don't overwrite with nulls)

### 4.3 Store Practice Day Stats in Event Metadata

- **File**: `ingestion/ingestion/pipeline.py`
- **Action**: Store practice day statistics in Event metadata JSON field
- **Metadata Structure**:
  ```json
  {
    "practiceDayStats": {
      "totalLaps": 1234,
      "totalTrackTimeSeconds": 36000,
      "uniqueDrivers": 45,
      "uniqueClasses": 8,
      "timeRangeStart": "2025-10-25T08:00:00Z",
      "timeRangeEnd": "2025-10-25T17:30:00Z"
    }
  }
  ```
- **Normalization**: Use existing driver/class normalization logic for counts

### 4.4 Add Timezone Handling

- **Files**: 
  - `ingestion/ingestion/pipeline.py`
  - `ingestion/db/repository.py`
- **Action**: Store timezone information with practice day Events
- **Implementation**:
  - Extract timezone from track data or use track's known timezone
  - Store in Event metadata: `{ "timezone": "Australia/Sydney" }`
  - Convert all timestamps to UTC for database storage
  - Use timezone for display purposes

### 4.5 Create Ingestion API Endpoint

- **File**: `ingestion/api/routes.py`
- **New Route**: `POST /api/v1/practice-days/ingest`
- **Request Body**:
  ```json
  {
    "track_id": "uuid",
    "date": "2025-10-25"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "event_id": "uuid",
      "sessions_ingested": 45,
      "status": "completed"
    }
  }
  ```
- **Implementation**: Call pipeline's `ingest_practice_day()` method

### 4.6 Create Next.js API Route (Proxy)

- **File**: `src/app/api/v1/practice-days/ingest/route.ts` (new file)
- **Method**: POST
- **Purpose**: Proxy ingestion request to ingestion service
- **Implementation**: Call ingestion service API endpoint

### 4.7 Create Core Ingestion Function

- **File**: `src/core/practice-days/ingest-practice-day.ts` (new file)
- **Function**: `ingestPracticeDay(params: IngestPracticeDayInput): Promise<IngestPracticeDayResult>`
- **Purpose**: Business logic for practice day ingestion
- **Implementation**: Call ingestion service API

### 4.8 Testing: Practice Day Ingestion

- **Files**:
  - `ingestion/tests/test_practice_ingestion.py` (new file)
  - `src/__tests__/api/practice-days/ingest.test.ts` (new file)
- **Test Cases**:
  - Idempotent ingestion (ingest same practice day twice)
  - Partial failure handling (some sessions fail)
  - Concurrent ingestion prevention (advisory locks)
  - Incremental updates (new sessions added)
  - Metadata storage and retrieval
  - Timezone handling
  - Error handling and rollback

---

## 5. UI Updates (Phase 4)

### 5.1 Add Feature Flag

- **File**: `.env.docker` or environment configuration
- **Flag**: `ENABLE_PRACTICE_DAYS=false` (default: disabled)
- **Purpose**: Control UI visibility of practice day features

### 5.2 Update Event Search Form

- **File**: `src/components/event-search/EventSearchForm.tsx`
- **Changes**:
  - Add toggle/button to switch between "Events" and "Practice Days" search
  - When in Practice Days mode:
    - Show date picker (required, not optional)
    - Hide optional date range (practice days require date range)
  - Conditionally render based on `ENABLE_PRACTICE_DAYS` feature flag

### 5.3 Create Practice Day Search Container

- **File**: `src/components/practice-days/PracticeDaySearchContainer.tsx` (new file)
- **Purpose**: Container component for practice day search results
- **Features**:
  - Display practice days in similar format to events
  - Show practice day stats (session count, total laps, etc.)
  - Support practice day ingestion from UI
  - Link to practice day detail view

### 5.4 Update Event Search Container

- **File**: `src/components/event-search/EventSearchContainer.tsx`
- **Changes**:
  - Handle practice day search mode (when toggle is set)
  - Conditionally render `PracticeDaySearchContainer` or existing event search
  - Maintain existing event search functionality unchanged

### 5.5 Create Practice Day Row Component

- **File**: `src/components/practice-days/PracticeDayRow.tsx` (new file)
- **Purpose**: Display individual practice day in search results
- **Displays**:
  - Date
  - Track name
  - Number of practice sessions
  - Practice day stats (total laps, unique drivers, etc.)
  - Ingest/view buttons

### 5.6 Update Event Analysis to Support Practice Days

- **File**: `src/app/(authenticated)/events/analyse/[eventId]/EventAnalysisClient.tsx`
- **Changes**:
  - Detect if Event is a practice day (by `sourceEventId` pattern or metadata)
  - Display practice day sessions in the same manner as race events
  - Reuse existing session display components
  - Show practice-specific metrics if needed

### 5.7 Integrate with Unified Search

- **File**: `src/core/search/repo.ts`
- **Changes**: Ensure practice day sessions are included in unified search results
- **Logic**: 
  - Query Race table with `sessionType = 'practiceday'`
  - Include practice day sessions in search results
  - Filter by `sessionType` when specified in search params

- **File**: `src/app/api/v1/search/route.ts`
- **Changes**: Ensure `practiceday` is included in valid session types

### 5.8 Testing: UI Updates

- **Files**:
  - `src/__tests__/components/practice-days/PracticeDaySearchContainer.test.tsx` (new file)
  - `src/__tests__/e2e/practice-days-search.spec.ts` (new file)
- **Test Cases**:
  - Practice day search UI flow
  - Practice day ingestion from UI
  - Practice day display in event analysis
  - Feature flag behavior (hide/show practice day features)
  - Integration with unified search

---

## 6. Rollout and Migration (Phase 5)

### 6.1 Feature Flag Strategy

- **Flags to Create**:
  - `ENABLE_SESSION_TYPE_INFERENCE` (default: `false`)
  - `ENABLE_PRACTICE_DAYS` (default: `false`)
- **Rollout Plan**:
  1. Deploy code with flags disabled
  2. Enable `ENABLE_SESSION_TYPE_INFERENCE` for new ingestions only
  3. Monitor session type inference accuracy
  4. Enable `ENABLE_PRACTICE_DAYS` for beta users
  5. Gather feedback and iterate
  6. Enable for all users
  7. Remove flags after stable period (3+ months)

### 6.2 Session Type Backfill (Optional)

- **File**: `scripts/backfill-session-types.ts` (new file, optional)
- **Purpose**: Backfill session types for existing races
- **Logic**:
  - Process races in batches (1000 at a time)
  - Use same inference logic as ingestion pipeline
  - Store confidence scores in metadata
  - Support dry-run mode
  - Provide progress tracking
- **Execution**: Run manually after Phase 1 is stable
- **Note**: Only backfill high-confidence inferences initially

### 6.3 Monitoring and Observability

- **Metrics to Track**:
  - Practice day discovery request rate and latency
  - Practice day ingestion success/failure rates
  - Session type inference accuracy (confidence scores)
  - Cache hit rates for practice day pages
  - Rate limit violations
- **Logging**:
  - Log all practice day discovery requests
  - Log practice day ingestion operations
  - Log session type inference decisions
  - Log cache hits/misses
- **Alerts**:
  - High failure rate for practice day discovery (>10%)
  - High failure rate for practice day ingestion (>5%)
  - Rate limit violations exceeding threshold

### 6.4 Documentation Updates

- **Files to Update**:
  - `docs/architecture/liverc-ingestion/` - Add practice day ingestion docs
  - `docs/api/api-reference.md` - Document new API endpoints
  - `docs/operations/` - Add practice day operations guide
- **Content**:
  - Practice day discovery process
  - Practice day ingestion pipeline
  - Session type inference logic
  - API endpoint documentation
  - Troubleshooting guide

---

## 7. Implementation Checklist

### Phase 1: Session Type Inference
- [ ] Add `practiceday` to `SessionType` enum in Prisma schema
- [ ] Create migration for enum update
- [ ] Regenerate Prisma client
- [ ] Implement `infer_session_type()` in normalizer
- [ ] Update pipeline to include `sessionType`
- [ ] Update repository to accept `sessionType`
- [ ] Update TypeScript types
- [ ] Update API route validators
- [ ] Add backward compatibility fallbacks
- [ ] Write unit tests for inference logic
- [ ] Test session type inference

### Phase 2: Practice Day Discovery
- [ ] Create practice day parser models
- [ ] Create practice day HTML parsers
- [ ] Add practice day methods to LiveRC connector
- [ ] Implement rate limiting and caching
- [ ] Create core practice day discovery logic
- [ ] Create API endpoints (Next.js)
- [ ] Create core functions (Next.js)
- [ ] Create test fixtures
- [ ] Write integration tests
- [ ] Test practice day discovery

### Phase 3: Practice Day Ingestion
- [ ] Extend ingestion pipeline for practice days
- [ ] Implement idempotent upserts
- [ ] Store practice day stats in Event metadata
- [ ] Add timezone handling
- [ ] Create ingestion API endpoint
- [ ] Create Next.js API route (proxy)
- [ ] Create core ingestion function
- [ ] Write ingestion tests
- [ ] Test practice day ingestion

### Phase 4: UI Updates
- [ ] Add feature flags
- [ ] Update Event Search Form
- [ ] Create Practice Day Search Container
- [ ] Update Event Search Container
- [ ] Create Practice Day Row component
- [ ] Update Event Analysis for practice days
- [ ] Integrate with unified search
- [ ] Write UI tests
- [ ] Write E2E tests
- [ ] Test UI updates

### Phase 5: Rollout and Migration
- [ ] Set up feature flags
- [ ] Create monitoring dashboards
- [ ] Set up alerts
- [ ] Create backfill script (optional)
- [ ] Update documentation
- [ ] Enable flags for beta users
- [ ] Gather feedback
- [ ] Enable for all users
- [ ] Remove flags after stable period

---

## 8. Dependencies and Prerequisites

### External Dependencies
- LiveRC HTML structure (must remain stable or parsers need updates)
- Existing ingestion infrastructure
- Existing event search UI components

### Internal Dependencies
- Session type inference (Phase 1) must be complete before practice day ingestion (Phase 3)
- Practice day discovery (Phase 2) must be complete before UI updates (Phase 4)
- Database migration (Phase 1) must be deployed before any code using new enum value

### Prerequisites
- Understanding of existing ingestion pipeline architecture
- Access to LiveRC practice day pages for testing
- Test fixtures from reference material
- Feature flag infrastructure (environment variables)

---

## 9. Risks and Mitigations

### Risk 1: LiveRC HTML Structure Changes
- **Impact**: Parsers break, discovery fails
- **Mitigation**: 
  - Use robust parsing (CSS selectors, fallbacks)
  - Monitor parsing failures
  - Keep test fixtures up to date
  - Add integration tests that catch structure changes

### Risk 2: Rate Limiting from LiveRC
- **Impact**: Discovery requests blocked
- **Mitigation**:
  - Implement aggressive caching
  - Respect rate limits and retry-after headers
  - Use exponential backoff
  - Monitor rate limit violations

### Risk 3: Session Type Inference Accuracy
- **Impact**: Misclassified sessions
- **Mitigation**:
  - Use multi-signal approach
  - Store confidence scores
  - Support manual override
  - Monitor inference accuracy

### Risk 4: Breaking Changes to Existing APIs
- **Impact**: Existing clients break
- **Mitigation**:
  - Use dedicated endpoints for practice days
  - Maintain backward compatibility
  - Use feature flags for gradual rollout
  - Document API changes

### Risk 5: Database Performance
- **Impact**: Slow queries with new session types
- **Mitigation**:
  - Use existing indexes on `sessionType`
  - Monitor query performance
  - Optimize queries as needed

---

## 10. Success Criteria

1. **Session Type Inference**: 
   - All new race ingestions have `sessionType` populated
   - Inference accuracy >95% for high-confidence cases
   - No breaking changes to existing APIs

2. **Practice Day Discovery**:
   - Users can discover practice days for any track and date range
   - Discovery completes within 30 seconds for 3-month range
   - Cache hit rate >80% for repeated queries

3. **Practice Day Ingestion**:
   - Practice days can be ingested successfully
   - Idempotent ingestion works (no duplicates)
   - Incremental updates work (new sessions added)
   - All lap data is ingested correctly

4. **UI Integration**:
   - Users can search for practice days
   - Practice day sessions display correctly in event analysis
   - Practice day sessions appear in unified search
   - No regression in existing event search functionality

5. **Observability**:
   - All operations are logged
   - Metrics are tracked
   - Alerts are configured
   - Documentation is complete

---

## 11. References

- Feature specification: `docs/feature_ideas/feature_ideas.md`
- Current data model: `docs/architecture/liverc-ingestion/04-data-model.md`
- Database schema: `prisma/schema.prisma`
- Ingestion architecture: `docs/architecture/liverc-ingestion/03-ingestion-pipeline.md`
- Testing strategy: `docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md`
- Practice page examples: `docs/reference_material/liverc/`
- Unified search implementation: `docs/implimentation_plans/OLD/unified-search-feature-plan.md`
