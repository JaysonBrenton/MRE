# Feature Ideas

This document captures feature ideas for future implementation in My Race Engineer (MRE). These are aspirational features that may be implemented when priorities and resources allow.

---

## Feature: Bumpup Driver Discovery

**Created:** 2025-01-27  
**Status:** Idea  
**Priority:** TBD

### Overview

Implement functionality to automatically detect and track drivers who "bump up" from lower mains to higher mains in RC racing events.

### Background

In RC racing, "bumpups" refer to drivers who advance from a lower main race (e.g., B-Main, C-Main) to the next higher main (e.g., A-Main) based on their finishing position. This is a common racing format where:

- Lower mains are typically run first (e.g., C-Main, then B-Main, then A-Main)
- Top finishers in each lower main advance to the next higher main
- The number of drivers who bump up varies by event format (commonly top 2-4 drivers)

### Current State

The MRE system currently:
- ✅ Captures race labels (A-Main, B-Main, C-Main, etc.) in the `race_label` field
- ✅ Stores individual race results with finishing positions
- ✅ Tracks race order and timing
- ❌ Does not explicitly track bumpup relationships between races
- ❌ Does not identify which drivers advanced from lower mains

### Proposed Functionality

#### 1. Bumpup Detection

Automatically detect bumpup relationships by:
- Analyzing race sequence within an event (race order, start times)
- Identifying drivers who appear in both a lower main and the next higher main
- Determining bumpup positions based on finishing order in lower mains
- Validating against race timing (lower mains must occur before higher mains)

#### 2. Data Model Extensions

Potential additions to track bumpup information:
- **Bumpup Relationship Table**: Links drivers from lower mains to higher mains
  - Source race (e.g., B-Main)
  - Target race (e.g., A-Main)
  - Driver ID
  - Bumpup position (e.g., "1st in B-Main")
  - Finishing position in source race
  - Starting position in target race (if applicable)

#### 3. UI/Display Features

- Show bumpup indicators in race results (e.g., "↑ Bumped from B-Main")
- Display bumpup progression charts/visualizations
- Filter drivers by bumpup status
- Show bumpup statistics (e.g., "X drivers bumped up to A-Main")

#### 4. Analytics

- Track bumpup success rates (how well do bumpup drivers perform in higher mains?)
- Analyze bumpup patterns across events and tracks
- Identify drivers who frequently bump up
- Compare performance of bumpup drivers vs. direct qualifiers

### Technical Considerations

#### Detection Algorithm

1. **Race Sequencing**: Determine race order within an event
   - Use `race_order` field if available
   - Fall back to `start_time` comparison
   - Consider race labels (C-Main → B-Main → A-Main pattern)

2. **Driver Matching**: Identify drivers in multiple mains
   - Match by `source_driver_id` across races
   - Validate same event and class
   - Handle edge cases (DNS, DNF in higher main)

3. **Bumpup Validation**: Confirm legitimate bumpups
   - Verify lower main finished before higher main started
   - Check finishing position in lower main (top N positions)
   - Exclude drivers who qualified directly to higher main

#### Data Sources

- Existing `Race` table (race labels, order, timing)
- Existing `RaceResult` table (finishing positions)
- Existing `RaceDriver` table (driver participation)

#### Edge Cases

- Triple mains (A1, A2, A3) - may have different bumpup rules
- Drivers who qualify directly to A-Main (no bumpup)
- Drivers who DNS/DNF in higher main after bumping up
- Events with non-standard main structures
- Missing or incomplete race data

### Implementation Phases

#### Phase 1: Detection Logic
- Implement bumpup detection algorithm
- Add validation and edge case handling
- Create unit tests with sample data

#### Phase 2: Data Storage
- Design and implement bumpup relationship table
- Create migration scripts
- Populate historical data (if applicable)

#### Phase 3: API/Backend
- Add endpoints to query bumpup data
- Integrate detection into ingestion pipeline
- Add bumpup information to race result responses

#### Phase 4: Frontend Display
- Add bumpup indicators to race results UI
- Create bumpup visualization components
- Add filtering and analytics views

### Open Questions

1. How many drivers typically bump up? (varies by event format)
2. Should bumpup detection run during ingestion or as a post-processing step?
3. How to handle events with non-standard main structures?
4. Should we track bumpup history across multiple events?
5. Do we need to support manual correction/adjustment of detected bumpups?

### Related Features

- Race progression tracking
- Driver performance analytics
- Event format detection
- Qualifying vs. main race analysis

### References

- Current data model: `docs/architecture/liverc-ingestion/04-data-model.md`
- Race structure examples in test fixtures: `ingestion/tests/fixtures/liverc/486677/`

---

## Feature: Practice Days Discovery and Ingestion

**Created:** 2026-01-13  
**Status:** Idea  
**Priority:** TBD

### Overview

Implement functionality to discover and ingest "Practice Days" from LiveRC. Practice Days are standalone practice events where drivers can run unlimited laps for testing and setup changes. This is distinct from practice sessions that are part of regular race events.

### Background

On LiveRC, tracks can host Practice Days where drivers can run practice sessions throughout the day. These are different from practice sessions within race events:

- **Practice Days:** Standalone events where drivers can run multiple practice sessions throughout a single day for testing and setup changes
- **Practice Sessions (within events):** Practice sessions that are part of a structured race event (alongside qualifying and race sessions)

LiveRC presents Practice Days through:
1. A practice page (`/practice/`) with a month/year selector showing practice days by date
2. Practice day overview pages (`/practice/?p=session_list&d=YYYY-MM-DD`) showing all practice sessions for a specific date
3. Individual practice session detail pages (`/practice/?p=view_session&id=XXXXX`) with complete lap-by-lap data

Example: Canberra Off Road Model Car Club practice page shows practice days by month, and clicking a date (e.g., "Sat, Oct 25, 2025") shows all practice sessions from that day.

### Current State

#### Session Type Determination

**How Session Types Are Currently Determined:**

The MRE system currently has the infrastructure for session types but does NOT automatically determine them:

- The `SessionType` enum exists in the database schema with values: `race`, `practice`, `qualifying`
- The `Race` model has an optional `sessionType` field
- **Session types are NOT currently being inferred or set during ingestion**
- All races are ingested with `sessionType = NULL` (defaults to `race` in migrations for existing data)
- The field exists but is never populated during the normalization or ingestion pipeline

**Evidence:**
- `ingestion/ingestion/normalizer.py` - `normalize_race()` method does not set `sessionType`
- `ingestion/ingestion/pipeline.py` - `_batch_write_races_data()` does not include `sessionType` in race data
- `ingestion/db/repository.py` - `bulk_upsert_races()` does not accept or set `sessionType`

**Current Event Search Flow:**
1. User selects track and optional date range
2. Frontend calls `/api/v1/events/search` (searches database)
3. Frontend calls `/api/v1/events/discover` (discovers from LiveRC)
4. Results are displayed in `EventSearchContainer` component
5. Events can be imported/ingested individually or in bulk

**What's Missing:**
- ❌ No discovery mechanism for Practice Days
- ❌ No ingestion pipeline for practice day sessions
- ❌ No UI for searching/browsing practice days
- ❌ Session types are not inferred during ingestion
- ❌ No distinction between practice sessions in events vs. standalone practice days

### Proposed Functionality

#### 1. Session Type Inference

Automatically determine session types during ingestion:

- **Practice:** Race label contains "practice" (case-insensitive) OR race URL contains `/practice/` (for practice sessions within race events)
- **PracticeDay:** Set explicitly during practice day ingestion (always "practiceday" for practice day sessions)
- **Qualifying:** Race label contains "qualifying", "qualify", "q1", "q2", "q3" (case-insensitive)
- **Race:** Default for all other races (mains, heats, etc.)

**Enhanced Inference Strategy:**

To address brittleness concerns, the inference logic should:

1. **Multi-Signal Approach:** Combine multiple signals rather than relying solely on label matching:
   - Race label analysis (with context-aware matching)
   - URL pattern matching (`/practice/` vs `/race/` vs `/qualify/`)
   - Event context (practice days vs race events)
   - Race order patterns (qualifying typically precedes races)
   - Session timing patterns (practice often earlier in day)

2. **Context-Aware Matching:** 
   - Avoid false positives from sponsor text by checking if "practice" appears in structured fields (race label, not description)
   - Use word boundaries for "q1", "q2", "q3" to avoid matching "qualify" in other contexts
   - Cross-reference with event metadata when available

3. **Confidence Scoring:** Assign confidence levels to inferred types:
   - High confidence: Multiple signals agree (e.g., label + URL + context)
   - Medium confidence: Single strong signal (e.g., explicit `/practice/` URL)
   - Low confidence: Weak signal only (e.g., label contains "practice" but no other indicators)
   - Default to "race" when confidence is low

4. **Manual Override Support:** Allow manual correction of misclassified sessions through admin interface

**Backward Compatibility Strategy:**

To maintain stability for existing API consumers:

1. **Dual-Write Period:** During initial rollout, maintain both old and new behavior:
   - Continue returning `sessionType = null` for existing races (legacy contract)
   - Populate `sessionType` for new ingestions (new contract)
   - Add feature flag to control which contract is used

2. **API Versioning:** 
   - Existing endpoints continue to return `sessionType: null | undefined` for backward compatibility
   - New endpoints or versioned endpoints (`/api/v2/...`) can return populated `sessionType`
   - Or use query parameter `?include_session_types=true` to opt-in to new behavior

3. **Gradual Migration:**
   - Phase 1: Populate `sessionType` for new ingestions only (no backfill)
   - Phase 2: Backfill existing races with high-confidence inferences
   - Phase 3: Enable session type filtering in UI (behind feature flag)
   - Phase 4: Make session types default behavior (remove feature flag)

4. **TypeScript Compatibility:**
   - Update Prisma schema to include `practiceday` in enum
   - Regenerate Prisma client (will update TypeScript types)
   - Update all TypeScript code that uses `SessionType` to handle new value
   - Add fallback logic in API serializers: `sessionType ?? 'race'` for backward compatibility
   - Update discriminated unions to handle `practiceday` case

Codex Comment: The label/URL heuristics here feel dangerously brittle—many LiveRC entries include sponsor copy like "Practice Makes Perfect" or heat names containing "Q" that would misclassify unrelated sessions, while night-practice events without the keyword stay undetected. Without parsing the structured session list (e.g., LiveRC's session_type column) or cross-checking event context, the ingestion pipeline will produce silent mislabeling that is hard to unwind later, especially once downstream analytics depend on it.

Codex Comment: Today every API consumer sees `sessionType = null` and implicitly treats the absence as "race". As soon as we start populating this field (and add a new `practiceday` enum), existing code paths—reports, filters, third-party exports—will suddenly see different values without a feature flag or versioned contract. We need to outline how to keep the legacy contract stable (e.g., dual-write+backfill, opt-in flag) so that rolling this out does not break search filters or analytics that still expect the old null semantics.

#### 2. Practice Day Discovery

Discover Practice Days from LiveRC track practice pages:

- Parse practice page month view to extract practice days by date
- For each practice day, parse overview page to get session summaries
- Return practice days with:
  - Date
  - Number of practice sessions
  - Practice stats (total laps, total track time, unique drivers, unique classes, time range)
  - Session summaries (driver, class, time, laps, fastest/average times)

**Rate Limiting and Caching Strategy:**

To prevent IP blocking and manage resource usage:

1. **Request Throttling:**
   - Implement per-track rate limits (e.g., max 10 requests per minute per track)
   - Use exponential backoff for failed requests
   - Respect HTTP 429 responses from LiveRC with retry-after headers
   - Queue discovery requests when rate limit is approached

2. **Caching Strategy:**
   - Cache practice day month views for 24 hours (practice days don't change frequently)
   - Cache practice day overview pages for 1 hour (sessions may be added throughout the day)
   - Cache individual session detail pages for 15 minutes (lap data may be updated)
   - Use cache keys: `practice:month:{track-slug}:{YYYY-MM}` and `practice:day:{track-slug}:{YYYY-MM-DD}`
   - Invalidate cache on successful ingestion (to reflect newly ingested sessions)

3. **Bounded Discovery:**
   - Limit date range queries to maximum 3 months at a time
   - Require explicit date range selection (no "all time" discovery)
   - Paginate results when practice day list exceeds 50 days
   - Show progress indicators for long-running discovery operations

4. **Error Handling and Fallbacks:**
   - Handle pagination gracefully (detect and follow "next page" links)
   - Retry failed requests up to 3 times with exponential backoff
   - Return partial results if some dates fail (don't fail entire discovery)
   - Log discovery failures for monitoring and debugging

5. **Resource Budget Management:**
   - Track discovery request counts per track per day
   - Enforce daily discovery limits per track (e.g., max 100 requests/day)
   - Provide user feedback when approaching limits
   - Consider implementing discovery quotas per user account

Codex Comment: This discovery plan assumes LiveRC's HTML endpoints are freely scrapable, but the feature omits any mention of throttling, caching, or fallbacks when the practice calendar spans multiple months or when the session list paginates. Without bounding the crawl or reusing results, a single search could fan out to dozens of requests per day/date and get our IP blocked or blow through per-track discovery budgets.

#### 3. Practice Day Ingestion

Ingest practice day sessions into the database:

- Create one Event per practice day (e.g., "Canberra Off Road - Practice Day - October 25, 2025")
- Each practice session becomes a Race record with `sessionType = "practiceday"`
- Store practice day stats in Event metadata
- Link sessions to practice day Event via `event_id`
- Ingest individual lap data from practice session detail pages

**Idempotency and Reconciliation Strategy:**

To handle re-ingestion and partial failures:

1. **Idempotent Upserts:**
   - Use `sourceEventId` (format: `{track-slug}-practice-{YYYY-MM-DD}`) as unique identifier
   - Use `sourceRaceId` from LiveRC session ID for race uniqueness
   - Implement upsert logic: update existing Event/Race if found, create if not
   - Preserve existing data when re-ingesting (don't overwrite with nulls)

2. **Incremental Updates:**
   - Track `lastIngestedAt` timestamp on Event record
   - On re-ingestion, compare LiveRC session list with existing Race records
   - Only fetch and ingest new sessions (those not in database)
   - Update Event metadata (stats, time range) to reflect all sessions

3. **Partial Failure Handling:**
   - Use database transactions to ensure atomicity per practice day
   - If ingestion fails partway through, rollback all changes for that day
   - Log failed sessions for retry (don't fail entire practice day)
   - Provide admin interface to retry failed sessions individually

4. **Drift Detection:**
   - Periodically re-fetch practice day overview to detect new sessions
   - Compare session count and session IDs between LiveRC and database
   - Flag practice days with drift for re-ingestion
   - Support manual "refresh" action from UI to trigger re-ingestion

5. **Deletion and Archival:**
   - Practice days are immutable once ingested (no deletion of sessions)
   - If LiveRC removes a session, mark it as "removed" in metadata (don't delete)
   - Support archival of old practice days (move to archive table after N months)
   - Provide admin interface to view and manage archived practice days

6. **Conflict Resolution:**
   - Handle race conditions when multiple users ingest same practice day simultaneously
   - Use advisory locks (per `sourceEventId`) during ingestion
   - Return existing Event if another process is already ingesting
   - Provide status endpoint to check ingestion progress

Codex Comment: Nothing here explains how re-ingestion or partial failures are reconciled. If we ingest half the sessions and LiveRC adds another driver later, how do we detect drift and update the existing Event without duplicating races? Treating the whole day as a single Event needs idempotent upserts and a plan for deletion/archival, or the database will end up with multiple "practice" copies of the same date.

#### 4. UI Updates

Add Practice Day search to the event search interface:

- Add toggle/button in `EventSearchForm` to switch between "Events" and "Practice Days" search
- When in Practice Days mode:
  - Show date picker (required, not optional)
  - Call practice day discovery/search endpoints (user-initiated, manual discovery)
  - Display practice days in similar format to events
- Practice days should show:
  - Date
  - Track name
  - Number of practice sessions
  - Practice day stats
  - Option to ingest/view sessions
- Practice day sessions should be displayed in event analysis views in the same manner as race type events

**API Design and Versioning:**

To avoid breaking existing consumers:

1. **Dedicated Endpoints:**
   - Create `/api/v1/practice-days/search` for practice day search (separate from events)
   - Create `/api/v1/practice-days/discover` for practice day discovery
   - Keep `/api/v1/events/search` and `/api/v1/events/discover` unchanged for race events
   - Use consistent response format but different DTOs (PracticeDaySummary vs EventSummary)

2. **Feature Flagging:**
   - Add feature flag `ENABLE_PRACTICE_DAYS` to control UI visibility
   - Hide practice day toggle when flag is disabled
   - Allow gradual rollout (enable for beta users first, then all users)

3. **Response Format:**
   - Practice day responses include `type: "practice_day"` field to distinguish from events
   - Event responses continue to work as before (no breaking changes)
   - Frontend can filter/display based on `type` field

4. **Backward Compatibility:**
   - Existing event search UI continues to work unchanged
   - Practice day search is additive (new feature, doesn't modify existing)
   - API consumers can opt-in to practice day endpoints when ready

5. **Shared Components:**
   - Extract common search form logic into shared hooks
   - Create separate display components for practice days vs events
   - Reuse layout and styling but keep data contracts separate

Codex Comment: Reusing the existing event search components without a separate data contract risks breaking the current Events UI—fields like heats/mains counts or import buttons assume race events with qualifying/race phases. Turning the form into a toggle and overloading the same list view means any downstream consumer of `/api/v1/events/search` suddenly receives practice-day payloads it does not understand. We should either introduce a dedicated endpoint/DTO or keep the new workflow feature-flagged so teams relying on the current search UX don't have to update in lockstep.

### Technical Considerations

#### Data Model

- **One Event per practice day** (e.g., "Canberra Off Road - Practice Day - October 25, 2025")
- Each practice session on that day becomes a `Race` record with `sessionType = "practiceday"`
- Practice sessions are linked to the practice day Event via `event_id`
- **Requires:** Add "practiceday" to `SessionType` enum in database schema

Codex Comment: Storing the rich practice day stats in opaque Event metadata means we cannot query/sort by them in SQL, nor ensure type safety when the UI needs "unique drivers" or "time range". If these fields are first-class to the feature, we likely need explicit columns (or at least typed JSON) plus timezone context; otherwise, downstream analysis will re-scrape LiveRC instead of using our data.

#### Practice Day Data Structure

Based on LiveRC HTML structure:

**Practice Day Overview Page** (`/practice/?p=session_list&d=YYYY-MM-DD`):
- Practice Stats panel: Total Laps, Total Track Time, Unique Drivers, Unique Classes, Time Range, Laps-by-Class chart
- Practice Leaderboard: Overall fastest, fastest by class
- Session table with columns:
  - Driver/Class: Driver name (link), class name, transponder number
  - Time: Session start time (hidden sortable datetime, display time)
  - Laps/Length: Number of laps, session duration
  - Fast/Avg: Fastest lap time, average lap time

**Individual Practice Session Page** (`/practice/?p=view_session&id=XXXXX`):
- Driver info: Name, Class, Transponder
- Session timing: Date, Start time, End time, Length
- Performance: Num Laps, Fastest Lap, Top 3 Consecutive, Averages (Avg, Top 5, Top 10, Top 15, Std Deviation, Consistency)
- Valid Lap Range
- Individual lap times list
- Lap-by-lap graph data

**Timezone Handling:**

To ensure accurate date/time storage and querying:

1. **Timezone Capture:**
   - Store timezone information with each practice day Event (e.g., `timezone: "Australia/Sydney"`)
   - Extract timezone from LiveRC track page or use track's known timezone
   - Store all timestamps in UTC in database (standard practice)
   - Include timezone offset in Event metadata for display purposes

2. **Date Boundary Resolution:**
   - Use practice day date from LiveRC (already in track's local timezone)
   - Convert session start/end times to UTC for storage
   - Handle DST transitions by storing timezone-aware timestamps
   - For cross-midnight sessions, use session start time to determine practice day date

3. **Display and Querying:**
   - Convert UTC timestamps back to track timezone for display
   - Use timezone-aware date comparisons in queries
   - Support filtering by local date (convert to UTC range for query)

4. **Migration Considerations:**
   - Add `timezone` field to Event model (nullable, defaults to track timezone if available)
   - Backfill timezone for existing events using track location or default
   - Update ingestion pipeline to capture and store timezone

Codex Comment: LiveRC renders these timestamps in the track's local timezone, yet the spec never describes how we capture that timezone or resolve ambiguous day boundaries (DST changes, cross-midnight sessions). Without a stored tz offset per practice day, the "Date" field can drift when normalizer machines run in UTC, and downstream analytics that align practice to race weekends will be unreliable.

#### Session Type Inference Logic

```python
# In normalizer.py
@staticmethod
def infer_session_type(race_label: str, race_url: str = "") -> Optional[str]:
    """Infer session type from race label and URL."""
    label_lower = race_label.lower()
    url_lower = race_url.lower()
    
    if "practice" in label_lower or "/practice/" in url_lower:
        return "practice"  # Practice sessions within race events
    if any(term in label_lower for term in ["qualifying", "qualify", "q1", "q2", "q3"]):
        return "qualifying"
    return "race"  # Default
```

Note: Practice day sessions will have `sessionType = "practiceday"` set explicitly during ingestion (not inferred).

#### Source Event ID Format

Practice day `source_event_id` format: `{track-slug}-practice-{YYYY-MM-DD}`

Example: `canberraoffroad-practice-2025-10-25`

- Includes track slug for uniqueness across tracks
- Uses "practice" prefix to distinguish from regular events
- Uses ISO date format for consistency

#### Practice Day Event Metadata

Store practice day stats in Event metadata:
- Total laps
- Total track time
- Unique drivers count
- Unique classes count
- Time range (first session start, last session end)

**Driver and Class Normalization:**

To ensure accurate statistics:

1. **Driver Counting:**
   - Use existing driver normalization logic (normalizedName field)
   - Count unique drivers based on normalized driver ID (not display name)
   - Match drivers across sessions using existing driver matching logic

2. **Class Normalization:**
   - Use existing class normalization (case-insensitive matching)
   - Count unique classes based on normalized class name
   - Handle variations: "1/10 Buggy", "1/10 buggy", "1-10 Buggy" should count as one class

3. **Statistics Calculation:**
   - Compute aggregates after normalization (not on raw data)
   - Use normalized counts for display and filtering

### Implementation Phases

#### Phase 1: Session Type Inference (Foundation)

- Add "practiceday" to SessionType enum in schema
- Create migration to add "practiceday" to SessionType enum
- Implement `infer_session_type()` method in normalizer with multi-signal approach
- Update pipeline to include `sessionType` in race data dictionaries (new ingestions only)
- Update repository to accept and store `sessionType`
- Add feature flag `ENABLE_SESSION_TYPE_INFERENCE` (disabled by default)
- Update TypeScript types and add backward compatibility fallbacks
- **Testing:** Unit tests for inference logic, edge cases, confidence scoring

#### Phase 2: Practice Day Discovery (Backend)

- Create parser for LiveRC practice pages (month view and day overview)
- Create parser for individual practice session detail pages
- Add models for PracticeDaySummary, PracticeSessionSummary, PracticeSessionDetail
- Implement rate limiting and caching for discovery requests
- Create API endpoints `/api/v1/practice-days/discover` and `/api/v1/practice-days/search`
- Implement core discovery logic with error handling and retries
- Add timezone capture and storage
- **Testing:** Integration tests with LiveRC fixtures, rate limiting tests, caching tests

#### Phase 3: Practice Day Ingestion (Backend)

- Extend ingestion pipeline to handle practice day sessions
- Add methods to fetch practice page, practice day overview, and session detail pages
- Implement practice day ingestion with proper session type assignment
- Implement idempotent upserts and reconciliation logic
- Store practice day stats in Event metadata (with normalization)
- Add advisory locks for concurrent ingestion prevention
- **Testing:** Idempotency tests, partial failure tests, drift detection tests

#### Phase 4: UI Updates (Frontend)

- Add feature flag `ENABLE_PRACTICE_DAYS` (disabled by default)
- Create practice day search components (separate from event search)
- Add toggle/button in EventSearchForm to switch between Events and Practice Days search
- Update EventSearchContainer to handle practice day search mode
- Display practice day results with practice-specific fields
- Support practice day ingestion from UI
- Add practice day detail view (similar to event analysis)
- **Testing:** E2E tests for practice day search and ingestion flow

#### Phase 5: Rollout and Migration (Operations)

- Enable `ENABLE_SESSION_TYPE_INFERENCE` for new ingestions only (no backfill)
- Monitor session type inference accuracy and adjust heuristics
- Enable `ENABLE_PRACTICE_DAYS` for beta users
- Gather feedback and iterate on UI/UX
- Backfill session types for existing races (high-confidence only)
- Enable practice days for all users
- Remove feature flags after stable period (3+ months)
- **Testing:** Production monitoring, error rate tracking, user feedback collection

**Feature Flag Strategy:**

- Use environment variables or database flags to control feature rollout
- Support per-user feature flags for gradual rollout
- Log feature flag usage for analytics
- Provide admin interface to toggle flags
- Document flag states in deployment guides

**API Versioning Strategy:**

- Keep existing `/api/v1/events/*` endpoints unchanged
- New practice day endpoints under `/api/v1/practice-days/*`
- Consider `/api/v2/events/*` for future breaking changes (if needed)
- Document API contracts and versioning policy

Codex Comment: None of the phases mention a rollout or feature-flag strategy. We need a dedicated phase (or cross-cutting plan) for shipping this functionality behind flags, backfilling data before flipping defaults, and versioning API responses so existing clients continue to behave. Without that, every other feature that reads events/races will see abrupt schema changes mid-release.

### Technical Decisions Made

1. **Data Model:** One Event per practice day, each practice session becomes a Race record with `sessionType="practiceday"`
2. **Session Type:** Add "practiceday" to SessionType enum (distinct from "practice" which is for practice sessions within race events)
3. **Practice Day Structure:** One Event per practice day date (contains all sessions from that day)
4. **Discovery Scope:** Manual discovery via UI (user selects track and date range)
5. **Session Type Default:** No backfilling - database will be cleared and tested fresh

**Production Migration Strategy:**

To handle existing production data:

1. **Gradual Backfill Approach:**
   - Phase 1: Populate `sessionType` for new ingestions only (no backfill of existing data)
   - Phase 2: Backfill high-confidence inferences (e.g., races with explicit "practice" in label + URL)
   - Phase 3: Backfill medium-confidence inferences (e.g., races with "practice" in label only)
   - Phase 4: Leave low-confidence races as `null` (defaults to "race" in queries)

2. **Backfill Script:**
   - Create migration script that processes races in batches (e.g., 1000 at a time)
   - Use same inference logic as ingestion pipeline
   - Store confidence score in metadata for review
   - Support dry-run mode to preview changes before applying
   - Provide progress tracking and resume capability

3. **Data Integrity:**
   - Validate backfill results (compare before/after counts)
   - Flag races with conflicting signals for manual review
   - Create audit log of all backfill changes
   - Support rollback of backfill (revert to `null` if needed)

4. **Query Compatibility:**
   - Update all queries to handle `sessionType = null` (treat as "race")
   - Use `COALESCE(sessionType, 'race')` in SQL queries
   - Update TypeScript code to handle `null` values gracefully
   - Add database views/functions for backward compatibility if needed

**TypeScript and Prisma Compatibility:**

To handle enum changes across the codebase:

1. **Prisma Schema Update:**
   - Add `practiceday` to `SessionType` enum
   - Regenerate Prisma client (updates TypeScript types automatically)
   - All TypeScript code using `SessionType` will see new value

2. **Type Updates Required:**
   - Update `src/core/search/types.ts` to include `practiceday`
   - Update API route validators to accept `practiceday`
   - Update UI components that filter/display session types
   - Update analytics/reporting code that uses session types

3. **Discriminated Unions:**
   - Update any discriminated unions that switch on `sessionType`
   - Add `practiceday` case to all switch statements
   - Use exhaustive checking (TypeScript `never` type) to catch missing cases

4. **Staged Deployment:**
   - Deploy schema migration first (adds enum value, doesn't break existing code)
   - Deploy backend code updates (handles new enum value)
   - Deploy frontend code updates (displays new enum value)
   - Use feature flags to control when new value is used

5. **Fallback Logic:**
   - Add `sessionType ?? 'race'` fallbacks in display code
   - Use default values in API responses for backward compatibility
   - Log warnings when encountering unexpected `null` values (for monitoring)

Codex Comment: Wiping the database to avoid backfilling is unrealistic for production tenants; we need a concrete plan to migrate millions of historic races to the new session types. Otherwise every longitudinal report will silently mix NULL/legacy data with the new enum values, and we will be unable to deploy this feature without a full data reload—something operations has repeatedly said we cannot do.

Codex Comment: Introducing a new `SessionType` value touches every Prisma client, API serializer, and analytics job that currently treats the enum as `race|practice|qualifying`. Without enumerating those dependencies and planning a compatibility window, the migration will break validation logic (e.g., TypeScript discriminated unions) the moment the schema is regenerated. Document how we will keep older services compiling—maybe via fallbacks or staged deploys—before committing to this change.
6. **Practice Day Naming:** Format: "{Track Name} - Practice Day - {Date}" (e.g., "Canberra Off Road - Practice Day - October 25, 2025")
7. **Source Event ID Format:** Format: "{track-slug}-practice-{YYYY-MM-DD}" (e.g., "canberraoffroad-practice-2025-10-25")
8. **Practice Day Event Metadata:** Store practice day stats in Event metadata (total laps, total track time, unique drivers, unique classes, time range)

### Open Questions

1. **Discovery Mode:** Should practice day discovery be automatic (like event discovery) or manual only?
   - **Answer:** Practice day discovery will be manual only (user-initiated via UI), consistent with event discovery which is also a manual process initiated by the user.

2. **Multi-Track Practice Days:** How should we handle practice days that span multiple tracks? (if applicable)
   - **Answer:** Practice days will not span multiple tracks. Each practice day is track-specific.

3. **Unified Search Integration:** Should practice day sessions be searchable through the unified search feature?
   - **Answer:** Yes, practice day sessions should be searchable through the unified search feature.

4. **Event Analysis Views:** How should we display practice day sessions in event analysis views?
   - **Answer:** Practice day sessions should be displayed in event analysis views in the same manner as race type events.

5. **Practice Day Analytics:** What analytics/metrics are most valuable for practice days?
   - **Consider:** Lap time trends, consistency metrics, setup change tracking, driver progression
   - **Consider:** Comparison between practice sessions (same driver, different sessions)
   - **Consider:** Class-wide practice statistics (fastest times, average times, participation)

6. **Retention Policy:** How long should practice day data be retained?
   - **Consider:** Practice days may be less valuable long-term than race events
   - **Consider:** Support archival after N months (e.g., 6-12 months)
   - **Consider:** Allow users to delete practice days they don't need

7. **Bulk Operations:** Should users be able to bulk-ingest multiple practice days?
   - **Recommendation:** Yes, similar to bulk event import
   - Support date range selection for bulk ingestion
   - Show progress and handle partial failures gracefully

### Testing Strategy

**Unit Tests:**
- Session type inference logic (all edge cases, confidence scoring)
- Practice day parser (month view, day overview, session detail)
- Normalization logic (driver names, class names)
- Timezone conversion and date boundary handling
- Idempotent upsert logic

**Integration Tests:**
- End-to-end practice day discovery flow (manual user-initiated)
- Practice day ingestion with real LiveRC fixtures
- Rate limiting and caching behavior
- Concurrent ingestion handling (advisory locks)
- Partial failure and retry scenarios

**E2E Tests:**
- Practice day search UI flow (manual discovery)
- Practice day ingestion from UI
- Practice day detail view (displayed like race events)
- Session type filtering in unified search (practice day sessions included)
- Practice day sessions in event analysis views

**Test Fixtures:**
- Create fixtures from LiveRC practice pages (similar to event fixtures)
- Include edge cases: cross-midnight sessions, DST transitions, pagination
- Store in `ingestion/tests/fixtures/liverc/practice/`

### Monitoring and Observability

**Metrics to Track:**
- Practice day discovery request rate and latency
- Practice day ingestion success/failure rates
- Session type inference accuracy (confidence scores)
- Cache hit rates for practice day pages
- Rate limit violations and retry counts
- Drift detection alerts (new sessions found on re-discovery)

**Logging:**
- Log all practice day discovery requests (track, date range, result count)
- Log practice day ingestion operations (event ID, session count, duration)
- Log session type inference decisions (race label, inferred type, confidence)
- Log normalization discrepancies (raw vs normalized counts)
- Log cache hits/misses for performance monitoring

**Alerts:**
- High failure rate for practice day discovery (>10% failures)
- High failure rate for practice day ingestion (>5% failures)
- Rate limit violations exceeding threshold
- Significant drift detected (new sessions found >24 hours after ingestion)
- Session type inference confidence below threshold

### Related Features

- Event search and discovery
- Session type filtering
- Lap data ingestion
- Driver performance analytics
- Unified search feature (for practice day session search)

### References

- Practice page example: `docs/reference_material/liverc/Canberra.Off.Road.Model.Car.Club.Practice.Session.Page.html`
- Practice day overview example: `docs/reference_material/liverc/Canberra Off Road Model Car Club - Practice Day - Overview page.html`
- Practice session detail example: `docs/reference_material/liverc/Practice Session (Daniel Quinton).html`
- Current data model: `docs/architecture/liverc-ingestion/04-data-model.md`
- Database schema: `prisma/schema.prisma`
- Ingestion architecture: `docs/architecture/liverc-ingestion/03-ingestion-pipeline.md`
- Testing strategy: `docs/architecture/liverc-ingestion/18-ingestion-testing-strategy.md`

---
