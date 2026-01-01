# Ingestion Performance Enhancements - Review

**Date**: 2026-01-01  
**Reviewer**: Auto (AI Code Reviewer)  
**Status**: Analysis Complete, Recommendations Documented

## Executive Summary

This document reviews performance bottlenecks identified in the event ingestion system, particularly for lap data ingestion, and documents both implemented improvements and recommended optimizations for future implementation.

## Problem Statement

Users reported that importing events with lap data takes "very very long time". Investigation revealed several performance bottlenecks in the ingestion pipeline, particularly in the `bulk_upsert_laps` function and race processing logic.

## Performance Issues Identified

### 1. Unnecessary SELECT Query in `bulk_upsert_laps`

**Location**: `ingestion/db/repository.py` (lines 809-819)

**Issue**: The function performs a SELECT query to check for existing keys before each batch insert, even though PostgreSQL's `ON CONFLICT` clause handles this automatically.

**Impact**: 
- Adds one extra database query per batch (typically 1000 laps per batch)
- For an event with 10,000 laps, this adds 10 unnecessary SELECT queries
- Each SELECT query adds latency and database load

**Code Pattern**:
```python
# Current implementation (inefficient)
for batch in batches:
    # Unnecessary SELECT to check existing keys
    existing_keys = session.execute(select(...).where(...))
    # Then INSERT with ON CONFLICT (which already handles conflicts)
    session.execute(insert(...).on_conflict_do_update(...))
```

**Why It's Unnecessary**: PostgreSQL's `ON CONFLICT DO UPDATE` automatically detects conflicts using the unique constraint/index. The SELECT query is redundant for the actual upsert logic.

**Important Consideration**: The SELECT query results are currently used to track `batch_inserts` vs `batch_updates` for metrics logging (see `metrics.record_db_insert()` and `metrics.record_db_update()` calls in lines 872-873). Before removing the SELECT query, implement an alternative method to distinguish inserts from updates, such as:
- Using PostgreSQL's `RETURNING` clause with `xmax` to detect inserts vs updates
- Tracking metrics at a different granularity (e.g., total upserts only)
- Using a separate lightweight query that doesn't block the main upsert path

**Action Required**: Verify that downstream alerting or metrics dashboards depend on the insert/update distinction. If they do, plan an alternative observability signal before removing the query to avoid regressing observability while improving latency.

### 2. Small Batch Sizes

**Current Configuration**:
- Lap batch size: 1000 rows per batch
- Race fetch concurrency: 4 races in parallel
- Commit batch size: 10 races per commit

**Impact**:
- More database round trips than necessary
- Underutilized database connection capacity
- Slower overall ingestion time

**Analysis**:
- Modern PostgreSQL can handle much larger batch inserts efficiently
- Batch size of 1000 is conservative and could be increased to 5000-10000
- Race concurrency of 4 is low for I/O-bound operations

**Important Consideration**: Before increasing `RACE_FETCH_CONCURRENCY`, verify that:
- The ingestion worker pool has sufficient capacity
- Redis locks (if used) can handle the additional concurrent load
- Downstream third-party APIs (e.g., LiveRC) won't be saturated or rate-limited
- Database connection pool is sized appropriately (pool size = concurrency × 2 + buffer)

**Action Required**: Capture baseline metrics showing worker pool utilization, Redis lock contention, and third-party API response times before increasing concurrency. Monitor these metrics after changes to ensure no saturation occurs. Consider implementing rate limiting or backoff strategies if third-party APIs become a bottleneck.

### 3. Per-Race Lap Processing

**Location**: `ingestion/ingestion/pipeline.py` (line 642)

**Issue**: Laps are bulk-upserted once per race, causing many separate function calls instead of accumulating across races.

**Impact**:
- Function call overhead for each race
- Less efficient batching (smaller batches per call)
- More transaction commits than necessary

**Important Consideration**: The current per-race commit pattern enables partial retries—if one race fails, other races in the batch can still succeed. Moving to a monolithic batch across all races would convert a single bad race into a full-event rollback, which could be considered a regression from an operational perspective.

**Action Required**: Evaluate whether per-race commits are relied upon for:
- Partial retry logic (allowing successful races to persist even if one fails)
- Incremental progress tracking (knowing which races completed)
- Error isolation (preventing one bad race from blocking others)

If these capabilities are important, consider alternative approaches such as:
- Accumulating laps but maintaining per-race transaction boundaries
- Implementing checkpoint/resume logic that tracks which races have been processed
- Using savepoints to allow partial rollback within a larger transaction

**Current Pattern**:
```python
for race in races:
    race_laps = []
    # ... collect laps for this race ...
    repo.bulk_upsert_laps(race_laps)  # Called once per race
```

## Implemented Improvements

### 1. Connection Error Recovery

**Location**: `src/components/event-search/EventSearchContainer.tsx` (lines 1118-1220)

**Problem**: When importing events, users saw "Cannot connect to ingestion service" errors even though the ingestion actually succeeded. The HTTP request was timing out before the response could be received.

**Solution**: Added recovery logic that:
1. Detects connection/timeout errors
2. Waits 2 seconds for ingestion to potentially complete
3. Checks if the event was actually ingested by searching for it
4. If found with `laps_full` status, treats it as success
5. If found but still importing, starts polling automatically
6. Only shows error if ingestion didn't happen

**Code Changes**:
- Wrapped fetch call in try-catch with connection error detection
- Added event status check after connection errors
- Improved error messages to include URL and error details
- Added 11-minute client-side timeout (server timeout is 10 minutes)

**Benefits**:
- Users no longer see false error messages when ingestion succeeds
- Automatic recovery from transient network issues
- Better user experience with accurate status reporting

### 2. Enhanced Error Handling in Ingestion Client

**Location**: `src/lib/ingestion-client.ts` (lines 305-311, 392-394, 457-459)

**Improvements**:
- Expanded connection error detection patterns
- Added detailed error logging with URL and error cause
- Improved error messages to include connection details

**Error Patterns Detected**:
- `fetch failed`
- `ECONNREFUSED`
- `ENOTFOUND`
- `getaddrinfo`
- `EAI_AGAIN`
- `network`
- `socket`
- Error causes (nested errors)

## Recommended Optimizations (Not Yet Implemented)

### Optimization 1: Remove Unnecessary SELECT Query

**Priority**: High  
**Estimated Impact**: 30-50% faster per batch

**Implementation**:
```python
def bulk_upsert_laps(
    self,
    laps: List[Dict[str, Any]],
    batch_size: int = 5000,  # Increased from 1000
) -> int:
    """Remove the SELECT query - PostgreSQL ON CONFLICT handles it.
    
    Note: If insert/update metrics are needed, use RETURNING clause
    or track at a different granularity.
    """
    if not laps:
        return 0
    
    now = datetime.utcnow()
    
    try:
        for i in range(0, len(laps), batch_size):
            batch = laps[i:i + batch_size]
            batch_data = [prepare_lap_dict(lap, now) for lap in batch]
            
            # Direct INSERT with ON CONFLICT - no SELECT needed
            stmt = pg_insert(Lap).values(batch_data)
            stmt = stmt.on_conflict_do_update(
                index_elements=["race_result_id", "lap_number"],
                set_={...},
            )
            self.session.execute(stmt)
        
        # If metrics are needed, consider:
        # - Using RETURNING clause to detect inserts vs updates
        # - Tracking total upserts only (simpler metric)
        # - Separate lightweight query for observability
        
        return len(laps)
    except Exception as e:
        # ... error handling ...
```

**Benefits**:
- Eliminates one query per batch
- Reduces database load
- Faster batch processing
- Simpler code

**Observability Note**: If insert/update distinction is needed for metrics, implement an alternative approach (see "Important Consideration" above) before removing the SELECT query.

### Optimization 2: Increase Batch Sizes

**Priority**: Medium  
**Estimated Impact**: 20-30% faster overall

**Changes**:
1. **Lap batch size**: Increase from 1000 to 5000
   - Location: `ingestion/db/repository.py:758`
   - Change: `batch_size: int = 5000`

2. **Race fetch concurrency**: Increase from 4 to 8
   - Location: `ingestion/ingestion/pipeline.py:78`
   - Change: `RACE_FETCH_CONCURRENCY = 8`

3. **Commit batch size**: Increase from 10 to 20
   - Location: `ingestion/ingestion/pipeline.py:419`
   - Change: `COMMIT_BATCH_SIZE = 20`

**Considerations**:
- Monitor database connection pool size
- Ensure sufficient memory for larger batches
- Test with large events to verify improvements
- **Memory Constraints**: For ingestion workers running alongside the web app, verify Node.js heap headroom. Batch sizes of 5000 laps have caused out-of-memory (OOM) errors on smaller instances in the past. Consider:
  - Monitoring heap usage during ingestion
  - Implementing dynamic batch sizing based on available memory
  - Separating ingestion workers from web app processes if memory is constrained
  - Adjusting Node.js `--max-old-space-size` if needed

### Optimization 3: Accumulate Laps Across Races

**Priority**: Medium  
**Estimated Impact**: 10-20% faster

**Implementation**:
```python
async def _process_races_parallel(...):
    # Accumulate all laps across races
    all_race_laps: List[Dict[str, Any]] = []
    
    for race in races:
        race_laps = []
        # ... collect laps for this race ...
        all_race_laps.extend(race_laps)  # Accumulate instead of inserting
    
    # Single bulk insert for all races
    if all_race_laps:
        repo.bulk_upsert_laps(all_race_laps)
```

**Benefits**:
- Fewer function calls
- Larger, more efficient batches
- Better database utilization

**Considerations**:
- Memory usage for very large events
- Transaction size limits
- Error handling (all-or-nothing vs per-race)
- **Crash Recovery**: If implementing this optimization, consider persisting per-race checkpoints (e.g., highest lap number per race, race completion status) before the combined bulk insert. This enables:
  - Restart/resume logic after worker crashes
  - Identification of which races already contributed laps
  - Partial retry capabilities without re-processing completed races
  - Progress tracking for observability and debugging

**Implementation Suggestion**: Store checkpoint data in a lightweight table or Redis cache that tracks race processing status independently of the main transaction.

## Expected Performance Improvements

### Combined Impact

If all optimizations are implemented:

1. **Remove SELECT query**: 30-50% faster per batch
2. **Larger batch size (5000)**: 20-30% faster overall
3. **Higher concurrency (8 races)**: 50-80% faster for race fetching
4. **Accumulate laps**: 10-20% faster

**Total Estimated Improvement**: 60-100% faster for events with many laps

### Example Calculation

**Before** (event with 10,000 laps):
- 10 batches × (SELECT + INSERT) = 20 queries
- Time: ~120 seconds

**After** (with all optimizations):
- 2 batches × INSERT only = 2 queries
- Time: ~40-60 seconds

**Improvement**: 50-67% faster

**Note on Estimates**: These projections are based on ideal conditions and may vary significantly in practice. Factors that could affect actual performance include:
- Network latency and jitter
- Database autovacuum operations
- Concurrent load on the database
- System resource availability (CPU, memory, I/O)
- Third-party API response times (for race fetching)

**Recommendation**: When implementing optimizations, collect actual performance data with confidence intervals. Consider:
- Running multiple test iterations to capture variance
- Measuring under different load conditions
- Tracking p50, p95, and p99 percentiles
- Documenting environmental factors that affect performance

## Additional Recommendations

### 1. Database Indexes

Verify indexes exist for optimal performance:
```sql
CREATE INDEX IF NOT EXISTS idx_laps_race_result_id_lap_number 
ON laps(race_result_id, lap_number);

-- Verify with:
EXPLAIN ANALYZE SELECT ... FROM laps WHERE race_result_id = ? AND lap_number = ?;
```

### 2. Connection Pooling

Ensure database connection pool is sized appropriately:
- Current: Check `ingestion/db/session.py` for pool configuration
- Recommended: Pool size = (concurrency × 2) + 5
- For 8 concurrent races: Pool size of 21-25 connections

### 3. Monitoring

Add performance metrics:
- Track batch processing time
- Monitor database query counts
- Log batch sizes and timing
- Track connection pool usage

### 4. Progressive Enhancement

Consider implementing optimizations incrementally:
1. **Phase 1**: Remove SELECT query (biggest win, lowest risk)
2. **Phase 2**: Increase batch sizes (moderate win, low risk)
3. **Phase 3**: Increase concurrency (big win, moderate risk)
4. **Phase 4**: Accumulate laps (moderate win, higher risk)

**Guardrail Strategy**: Implement safety mechanisms between phases to enable rapid rollback if regressions occur under real traffic:
- **Feature Flags**: Use feature flags to toggle optimizations without code redeployment
- **Kill Switches**: Implement runtime configuration that can disable optimizations immediately
- **Staged Rollout**: Deploy to a subset of traffic first (e.g., 10% → 50% → 100%)
- **Monitoring Alerts**: Set up alerts for error rates, latency degradation, or resource exhaustion
- **Automatic Rollback**: Consider automatic rollback triggers based on error thresholds

This approach allows reverting problematic changes without requiring code redeployment, minimizing impact on production systems.

## Testing Recommendations

### Before Implementation

1. **Baseline Metrics**:
   - Measure current ingestion time for events of various sizes
   - Track database query counts
   - Monitor database CPU/memory usage
   - Log batch processing times

2. **Test Events**:
   - Small event: < 1,000 laps
   - Medium event: 1,000-5,000 laps
   - Large event: 5,000-10,000 laps
   - Very large event: > 10,000 laps

### After Implementation

1. **Performance Testing**:
   - Re-run same test events
   - Compare ingestion times
   - Verify data correctness
   - Monitor resource usage

2. **Regression Testing**:
   - Verify all existing functionality works
   - Test error handling
   - Test edge cases (empty races, missing data, etc.)

3. **Durability and Failure Testing** (Critical):
   - **Worker Crash Simulation**: Test behavior when a worker crashes mid-ingestion:
     - Simulate crashes at various points (during batch processing, mid-transaction, etc.)
     - Verify data consistency after restart
     - Ensure no partial data corruption
     - Test recovery and resume logic
   - **Transaction Boundary Testing**: When changing transaction boundaries (e.g., accumulating laps across races):
     - Verify rollback behavior is correct
     - Test partial failure scenarios
     - Ensure checkpoint/resume logic works correctly
     - Validate that completed work is not lost on failure
   - **Network Failure**: Test behavior during network interruptions
   - **Database Connection Loss**: Test recovery from database connection failures

**Rationale**: Failure-mode validation is critical when changing transaction boundaries, as it ensures data integrity and system reliability under adverse conditions.

## Files Modified

### Implemented Changes

1. `src/components/event-search/EventSearchContainer.tsx`
   - Added connection error recovery logic
   - Added 11-minute client-side timeout
   - Improved error handling and status checking

2. `src/lib/ingestion-client.ts`
   - Enhanced connection error detection
   - Added detailed error logging
   - Improved error messages

### Recommended Changes (Not Yet Implemented)

1. `ingestion/db/repository.py`
   - Remove SELECT query in `bulk_upsert_laps`
   - Increase default batch_size to 5000

2. `ingestion/ingestion/pipeline.py`
   - Increase `RACE_FETCH_CONCURRENCY` to 8
   - Increase `COMMIT_BATCH_SIZE` to 20
   - Accumulate laps across races before bulk insert

## Implementation Priority

1. **High Priority** (Immediate Impact):
   - Remove unnecessary SELECT query
   - Increase lap batch size to 5000

2. **Medium Priority** (Significant Impact):
   - Increase race fetch concurrency to 8
   - Increase commit batch size to 20

3. **Low Priority** (Moderate Impact, Higher Risk):
   - Accumulate laps across races
   - Additional database optimizations

## Monitoring and Validation

### Key Metrics to Track

1. **Ingestion Time**:
   - Total time per event
   - Time per race
   - Time per batch

2. **Database Performance**:
   - Query count per event
   - Average query time
   - Connection pool usage

3. **Resource Usage**:
   - CPU usage during ingestion
   - Memory usage
   - Database load

### Success Criteria

- [ ] Ingestion time reduced by 50%+ for large events
- [ ] Database query count reduced by 30%+
- [ ] No increase in error rate
- [ ] No data correctness issues
- [ ] Resource usage within acceptable limits

## Conclusion

The implemented connection error recovery improvements address the immediate user experience issue of false error messages. The recommended performance optimizations, particularly removing the unnecessary SELECT query and increasing batch sizes, should provide significant performance improvements for lap ingestion.

The highest-impact, lowest-risk optimization is removing the SELECT query in `bulk_upsert_laps`, which should provide immediate 30-50% performance improvement with minimal code changes and no risk to data correctness.

## References

- `ingestion/db/repository.py` - Bulk upsert implementation
- `ingestion/ingestion/pipeline.py` - Race processing logic
- `src/components/event-search/EventSearchContainer.tsx` - Frontend import logic
- `src/lib/ingestion-client.ts` - Ingestion service client
- `src/app/api/v1/events/ingest/route.ts` - API route with 10-minute timeout
