# Sessions Table: Duration and Driver Names Display Issues

**Report Date:** 2026-01-27  
**Component:** Sessions Table (`SessionsTable`, `SessionsTableRow`,
`SessionsTableResults`)  
**Severity:** High - Data visibility issues affecting user experience

---

## Executive Summary

Two critical data display issues have been identified in the Sessions Table
component:

1. **Race Duration Not Displaying**: The Duration column shows "—" (null
   indicator) even when race duration data should be available or calculable
   from race results.

2. **Missing Driver Names**: Some driver names are not displaying in the
   expanded race results table, showing "—" instead of actual driver names.

Both issues stem from data availability problems and insufficient fallback logic
in the data processing pipeline.

---

## Issue 1: Race Duration Not Displaying

### Problem Description

The Duration column in the main Sessions Table (`SessionsTable`) consistently
displays "—" (em dash), indicating that `durationSeconds` is `null` for all
races. This occurs even though:

1. A fallback calculation was recently implemented in
   `calculateDurationFromResults()` to compute duration from race results when
   the database field is missing.
2. Race results contain `totalTimeSeconds` data that could be used to calculate
   race duration.

### Root Cause Analysis

#### Current Implementation

**File:** `src/core/events/get-sessions-data.ts`

The `calculateSessionMetrics()` function attempts to calculate duration using a
fallback mechanism:

- First checks if `race.durationSeconds` exists in the database
- If null, calls `calculateDurationFromResults()` to compute from race results

The `calculateDurationFromResults()` function:

- Extracts all `totalTimeSeconds` values from race results
- Filters out null or invalid (non-positive) values
- Returns the maximum value (slowest finisher's time) as the race duration
- Returns null if no valid times are found

#### Why It's Failing

1. **All `totalTimeSeconds` Are Null**: The most likely scenario is that all
   race results have `totalTimeSeconds: null` in the database. This would cause
   `calculateDurationFromResults()` to return `null`, resulting in "—" being
   displayed.

2. **Data Flow Issue**: The calculation happens in `get-sessions-data.ts`, but
   the data originates from `get-event-analysis-data.ts` which passes
   `totalTimeSeconds` directly from the database (line 877). If this field is
   null in the database, the calculation has no data to work with.

3. **Insufficient Fallback Strategy**: The current implementation only has one
   fallback (max `totalTimeSeconds`). There are other potential sources:
   - Calculate from `startTime` and last lap timestamp (if available)
   - Use sum of all lap times for each driver, then take maximum
   - Use race metadata if available from ingestion

### Data Flow Investigation

**Data Path:**

1. Database (`Race.durationSeconds`) → `get-event-analysis-data.ts` (line 894)
2. `get-event-analysis-data.ts` → `get-sessions-data.ts` (via
   `EventAnalysisData` interface)
3. `get-sessions-data.ts` → `calculateSessionMetrics()` (line 107)
4. `calculateSessionMetrics()` → `calculateDurationFromResults()` fallback
   (line 123)
5. `SessionsTableRow` → `formatDuration()` → Display

**Key Observation:** If `race.durationSeconds` is null AND all
`result.totalTimeSeconds` are null, there is no valid duration to display.

### Proposed Solutions

#### Solution 1: Calculate Duration from Lap Times (Recommended)

**Approach:** When `totalTimeSeconds` is unavailable, calculate it by summing
individual lap times for each driver, then use the maximum.

**Implementation Location:** `src/core/events/get-event-analysis-data.ts`

**Changes Required:**

1. Modify the data fetching to conditionally include lap data when
   `totalTimeSeconds` is null
2. Add a function to calculate `totalTimeSeconds` from lap times by:
   - Validating lap data exists and contains valid lap times
   - Filtering out invalid or null lap times
   - Summing all valid lap times for each driver
   - Returning the sum as the driver's total time
3. Use this calculated value in the results mapping to populate
   `totalTimeSeconds` when the database value is missing
4. This ensures `calculateDurationFromResults()` will have valid data to work
   with

**Pros:**

- Most accurate calculation method
- Uses actual race data (lap times)
- Works for both timed races and lap-count races

**Cons:**

- Requires loading lap data (currently removed from response for performance)
- More computationally expensive
- May need to modify data loading strategy

#### Solution 2: Enhanced Fallback Chain

**Approach:** Implement a multi-tier fallback strategy with better logging.

**Implementation Location:** `src/core/events/get-sessions-data.ts`

**Changes Required:**

1. Enhance `calculateDurationFromResults()` to implement a multi-strategy
   approach:
   - **Strategy 1**: Use maximum `totalTimeSeconds` from results (current
     behavior)
   - **Strategy 2**: If `startTime` is available, calculate from last lap
     timestamp (requires additional lap data)
   - **Strategy 3**: Log warning with diagnostic information when unable to
     calculate, including result count and startTime availability
2. Return null only after all strategies are exhausted

**Pros:**

- Simple to implement
- Provides debugging information
- Non-breaking change

**Cons:**

- Still returns null if no data available
- Doesn't solve the root cause

#### Solution 3: Database-Level Fix (Long-term)

**Approach:** Ensure `durationSeconds` is populated during ingestion or via a
data migration.

**Implementation Location:** `ingestion/` directory

**Changes Required:**

1. Review ingestion pipeline to ensure `durationSeconds` is extracted from
   LiveRC data
2. If not available from source, calculate and store during ingestion
3. Create migration script to backfill existing races

**Pros:**

- Solves problem at the source
- Improves data quality
- Better performance (pre-calculated)

**Cons:**

- Requires ingestion pipeline changes
- May need to re-ingest existing events
- Longer implementation timeline

### Recommended Approach

**Immediate Fix:** Implement Solution 1 (Calculate from Lap Times) with
conditional data loading:

- Only load lap data when `totalTimeSeconds` is null
- Cache calculated values
- Add performance monitoring

**Long-term Fix:** Implement Solution 3 (Database-Level Fix) to ensure proper
data ingestion.

---

## Issue 2: Missing Driver Names in Expanded Results

### Problem Description

When expanding a race row in the Sessions Table, some driver names in the
`SessionsTableResults` component are displaying as "—" instead of actual driver
names. However, some names ARE displaying correctly (e.g., "PAYDEN BUDDEN",
"SIMON HAVERFIELD", "GREGORY ROSANDER"), indicating this is a partial data issue
rather than a complete failure.

### Root Cause Analysis

#### Current Implementation

**File:** `src/components/event-analysis/sessions/SessionsTableResults.tsx`

Line 247 displays the driver name using a fallback to "—" if the name is falsy:

- Uses conditional styling based on whether the driver is highlighted
- Displays `result.driverName` or "—" if the name is missing

**Data Source:** `src/core/events/get-event-analysis-data.ts`

Line 840 extracts the driver name directly from `raceDriver.displayName`:

- Uses the denormalized `displayName` field from the `RaceDriver` table
- Does not join to the `Driver` table to retrieve the authoritative name
- Line 874 maps this value to the `driverName` field in the results

#### Why It's Failing

1. **Empty String vs Null**: The schema shows `displayName` is a `String` (not
   nullable), but it could be an empty string `""`. The check
   `result.driverName || "—"` would treat empty strings as falsy and display
   "—".

2. **Database Data Quality**: Some `RaceDriver` records may have empty
   `displayName` values if:
   - The ingestion process didn't extract the driver name properly
   - The name field was empty in the source data (LiveRC)
   - There was a data transformation error during ingestion

3. **No Fallback to Driver Table**: The current implementation uses
   `raceDriver.displayName` directly without falling back to the `Driver`
   table's `displayName` if the race driver's name is missing.

### Data Flow Investigation

**Data Path:**

1. Database (`RaceDriver.displayName`) → Prisma query in
   `get-event-analysis-data.ts`
2. `get-event-analysis-data.ts` → `result.raceDriver.displayName` (line 840)
3. Mapped to `driverName` in results (line 874)
4. `get-sessions-data.ts` → Passed through to `SessionData.results[].driverName`
5. `SessionsTableResults` → Display with `result.driverName || "—"`

**Key Observation:** If `raceDriver.displayName` is an empty string, it will
display as "—" even though there might be a valid name in the `Driver` table.

### Proposed Solutions

#### Solution 1: Fallback to Driver Table (Recommended)

**Approach:** When `raceDriver.displayName` is empty or null, fall back to the
`Driver.displayName` from the related `Driver` record.

**Implementation Location:** `src/core/events/get-event-analysis-data.ts`

**Changes Required:**

1. Modify the Prisma query to include the related `Driver` record:
   - Extend the `raceDriver` include to also include the related `driver` record
   - Select only the `displayName` field from the `Driver` table to minimize
     data transfer
   - Maintain existing includes for other related data

2. Update the driver name assignment with a fallback chain:
   - First attempt: Use `raceDriver.displayName` after trimming whitespace
   - Second attempt: Fall back to `driver.displayName` from the related Driver
     record (after trimming)
   - Final fallback: Use "Unknown Driver" if both sources are empty or null

**Pros:**

- Uses authoritative source (Driver table)
- Handles both empty strings and null values
- Provides fallback for missing data

**Cons:**

- Requires additional database join
- Slightly more complex query
- May have performance impact (minimal with proper indexing)

#### Solution 2: Normalize Empty Strings

**Approach:** Treat empty strings as null during data processing.

**Implementation Location:** `src/core/events/get-event-analysis-data.ts`

**Changes Required:**

- Normalize empty strings by trimming whitespace and treating empty results as
  null
- Use nullish coalescing to provide "Unknown Driver" as the final fallback
- This handles the empty string case but doesn't retrieve names from the Driver
  table

**Pros:**

- Simple change
- Handles empty string case
- No database changes required

**Cons:**

- Doesn't solve root cause (missing data)
- Still shows "Unknown Driver" instead of actual name if available elsewhere

#### Solution 3: Data Quality Fix (Long-term)

**Approach:** Ensure `RaceDriver.displayName` is always populated during
ingestion.

**Implementation Location:** `ingestion/` directory

**Changes Required:**

1. Review ingestion pipeline to ensure driver names are always extracted
2. Add validation to prevent empty `displayName` values
3. Create migration to backfill missing names from `Driver` table

**Pros:**

- Solves problem at the source
- Improves overall data quality
- Prevents future occurrences

**Cons:**

- Requires ingestion pipeline review
- May need data migration
- Longer implementation timeline

### Recommended Approach

**Immediate Fix:** Implement Solution 1 (Fallback to Driver Table) to ensure
driver names are always displayed when available.

**Long-term Fix:** Implement Solution 3 (Data Quality Fix) to ensure proper data
ingestion.

---

## Additional Observations

### Data Quality Concerns

1. **Inconsistent Data Availability**: The fact that some driver names display
   correctly while others don't suggests inconsistent data quality in the
   database, possibly from different ingestion runs or source data variations.

2. **Missing Duration Data**: The widespread absence of `durationSeconds`
   suggests either:
   - LiveRC doesn't provide this data
   - The ingestion pipeline doesn't extract it
   - It was never calculated and stored

3. **Performance Considerations**: Loading lap data for duration calculation
   (Solution 1 for Issue 1) may impact performance. Consider:
   - Conditional loading (only when needed)
   - Caching calculated values
   - Database-level materialized views for common calculations

### Testing Recommendations

1. **Unit Tests**: Add tests for `calculateDurationFromResults()` with various
   data scenarios:
   - All null values
   - Mixed null and valid values
   - Empty array
   - Single value

2. **Integration Tests**: Test the full data flow from database to UI:
   - Races with null durationSeconds
   - Races with empty driver names
   - Races with complete data

3. **Data Quality Audit**: Run queries to identify:
   - Percentage of races with null `durationSeconds`
   - Percentage of race results with null `totalTimeSeconds`
   - Percentage of race drivers with empty `displayName`

---

## Implementation Priority

### High Priority (Immediate)

1. **Issue 2 - Driver Names**: Implement Solution 1 (Fallback to Driver Table)
   - Impact: High (affects user experience)
   - Effort: Medium (requires query modification)
   - Risk: Low (additive change)

### Medium Priority (Short-term)

2. **Issue 1 - Duration**: Implement Solution 1 (Calculate from Lap Times)
   - Impact: High (affects data visibility)
   - Effort: High (requires data loading strategy)
   - Risk: Medium (performance considerations)

### Low Priority (Long-term)

3. **Data Quality Improvements**: Database-level fixes for both issues
   - Impact: High (prevents future issues)
   - Effort: High (requires ingestion pipeline changes)
   - Risk: Low (data migration)

---

## Files Requiring Changes

### Issue 1: Duration

- `src/core/events/get-event-analysis-data.ts` - Add lap-based calculation
- `src/core/events/get-sessions-data.ts` - Enhance fallback logic (already
  modified)
- `src/components/event-analysis/sessions/SessionsTableRow.tsx` - No changes
  needed (already uses formatDuration)

### Issue 2: Driver Names

- `src/core/events/get-event-analysis-data.ts` - Add Driver table join and
  fallback logic
- `src/components/event-analysis/sessions/SessionsTableResults.tsx` - No changes
  needed (already handles null/empty)

### Testing

- `src/__tests__/core/events/get-sessions-data.test.ts` - Add test cases (if
  exists)
- `src/__tests__/core/events/get-event-analysis-data.test.ts` - Add test cases
  (if exists)

---

## Conclusion

Both issues stem from insufficient data availability and lack of robust fallback
mechanisms. The recommended solutions provide immediate fixes while establishing
a path for long-term data quality improvements. The driver names issue should be
addressed first as it has a simpler solution and higher user impact, followed by
the duration calculation enhancement.

---

**Report Prepared By:** AI Assistant  
**Review Status:** Pending  
**Next Steps:** Implement recommended solutions in priority order
