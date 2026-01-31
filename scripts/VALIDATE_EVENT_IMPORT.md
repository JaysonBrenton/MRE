# Event Import Process Validation

## Summary

The event import process has been validated through code review. The following
components are correctly implemented:

### ✅ API Endpoints

- `/api/v1/events/ingest` - For importing LiveRC events by `source_event_id` and
  `track_id`
- `/api/v1/events/[eventId]/ingest` - For re-importing existing events by
  `event_id`

### ✅ Import Flow

1. **Event Discovery**: Events are discovered from LiveRC and shown in the UI
2. **Import Initiation**: User clicks import button, which calls the appropriate
   API endpoint
3. **Ingestion**: The API delegates to the ingestion service (Python) to fetch
   and store data
4. **Status Updates**: Import progress is polled and displayed in the UI
5. **Completion**: Event status updates to "imported" when `ingestDepth` becomes
   `laps_full`

### ✅ Code Components Verified

- `src/app/api/v1/events/ingest/route.ts` - Correctly handles source_event_id
  imports
- `src/app/api/v1/events/[eventId]/ingest/route.ts` - Correctly handles event_id
  imports
- `src/components/event-search/EventSearchContainer.tsx` - Correctly calls
  import APIs
- `src/components/event-search/EventRow.tsx` - Correctly displays import status
- `src/lib/ingestion-client.ts` - Correctly communicates with ingestion service

## Testing the Import Process

### For "Kings Cup 2025 Re-Rerun 06-12-2025"

Since this event shows as "Not imported" in the UI, you can test the import
directly:

1. **In the UI**:
   - Navigate to the event search page
   - Find "Kings Cup 2025 Re-Rerun 06-12-2025"
   - Click the import button/checkbox for this event
   - Monitor the import progress in the UI
   - Verify the status changes from "Not imported" → "Importing..." → "Imported"

2. **Verify Import Success**:
   - Check that the event status badge shows "Imported"
   - Verify that the "Analyse event" button becomes available
   - Check that race, result, and lap counts are displayed
   - Verify `ingestDepth` is set to `laps_full` in the database

### Using the Test Script

If you have the `source_event_id` and `track_id` for the event, you can test
programmatically:

```bash
# First, get the source_event_id and track_id from the UI or database
# Then run:
docker exec mre-app npx tsx scripts/test-event-import.ts "Kings Cup 2025 Re-Rerun 06-12-2025" <source_event_id> <track_id>
```

**Note**: The script requires authentication, so it's best to test through the
UI where you're already authenticated.

## Validation Checklist

- [x] API endpoints are correctly configured
- [x] Import logic handles both new and existing events
- [x] Error handling is in place for failed imports
- [x] Status polling is implemented for progress updates
- [x] UI components correctly display import status
- [ ] **Manual Test**: Import "Kings Cup 2025 Re-Rerun 06-12-2025" through UI
- [ ] **Verify**: Event status changes to "Imported"
- [ ] **Verify**: Data (races, results, laps) is stored correctly
- [ ] **Verify**: Event can be analyzed after import

## Expected Behavior

When importing "Kings Cup 2025 Re-Rerun 06-12-2025":

1. **Initial State**: Event shows as "Not imported" (status: "new")
2. **During Import**:
   - Status changes to "Importing..."
   - Progress indicator shows import stage/counts
   - Event row shows import progress
3. **After Import**:
   - Status changes to "Imported" (status: "imported")
   - `ingestDepth` is set to `laps_full`
   - `lastIngestedAt` is set to current timestamp
   - Race, result, and lap counts are populated
   - "Analyse event" button becomes available

## Troubleshooting

If the import fails:

1. **Check Ingestion Service**: Verify the Python ingestion service is running

   ```bash
   docker ps | grep liverc-ingestion-service
   ```

2. **Check Logs**: Review application logs for errors

   ```bash
   docker logs mre-app --tail 100
   docker logs mre-liverc-ingestion-service --tail 100
   ```

3. **Verify Event Data**: Check if the event exists in LiveRC
   - The event may have been removed or changed
   - The source_event_id may be incorrect

4. **Check Database**: Verify the event record exists
   ```bash
   docker exec mre-app npx tsx scripts/find-event.ts "Kings Cup"
   ```

## Conclusion

The event import process code is correctly implemented and ready for testing.
The best way to validate it is through the UI, where you can:

1. See the event as "Not imported"
2. Click to import it
3. Monitor the import progress
4. Verify it completes successfully
