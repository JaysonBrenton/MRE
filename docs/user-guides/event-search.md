---
created: 2026-01-27
creator: Jayson Brenton
lastModified: 2026-01-27
description: Complete guide to searching for race events in My Race Engineer
purpose:
  Provides comprehensive instructions for using the Event Search feature to
  find, discover, and import race events from LiveRC.
relatedFiles:
  - docs/frontend/liverc/user-workflow.md
  - docs/user-stories/liverc-integration.md
  - docs/user-stories/user-journeys.md
---

# Event Search Guide

Learn how to search for race events, select tracks, import events from LiveRC,
and understand event status indicators in My Race Engineer.

## Introduction

The Event Search feature allows you to discover and import race events from
LiveRC. You can search for events by track and date range, then import them into
MRE for detailed analysis.

## Prerequisites

- You must be logged into MRE
- You need to know the track where the event occurred
- You should know the approximate date range of the event

## Accessing Event Search

1. Log into your MRE account
2. Navigate to **Event Search** from the main navigation menu
3. You'll see the Event Search form with track selection and date range fields

## Selecting a Track

### Using the Track Selection Modal

1. Click on the **Track** field to open the track selection modal
2. The modal displays a searchable list of all available tracks (approximately
   1,100 tracks)
3. Use the search box at the top to filter tracks by name
4. Search is case-insensitive and matches anywhere in the track name

### Favourite Tracks

**Adding Favourites:**

- Click the star icon (⭐) next to any track to add it to your favourites
- Favourite tracks appear at the top of the modal in a "Favourite Tracks"
  section

**Using Favourite Chips:**

- Your favourite tracks appear as quick-select chips above the Event Search form
- Click a chip to automatically select that track and trigger a search
- Click the X icon on a chip to remove it from favourites

**Selecting a Track:**

- Click on any track name in the modal to select it
- The modal closes and the selected track name appears in the Track field

### Track Selection Tips

- Start typing to quickly filter the track list
- Use favourites for tracks you frequently search
- Track names match how they appear on LiveRC

## Setting Date Ranges

### Date Range Presets

Event Search uses **preset** buttons for the "When" date range (Events mode):

1. **No filter** — Search all events for the track (no date limit).
2. **Last 3 months** — From 3 months ago through today.
3. **Last 6 months** — From 6 months ago through today.
4. **Last 12 months** — From 12 months ago through today (default).
5. **This year** — From 1 January of the current year through today.
6. **Custom** — You choose the start and end dates; two date fields appear.

For **Custom** only:

- Click the **Start date** and **End date** fields to pick dates.
- Dates are interpreted in your **local timezone** (e.g. "This year" is Jan 1–today where you are).

### Date Range Rules

**Maximum range:**

- **Presets** (e.g. "Last 12 months", "This year") can span up to **12 months** (366 days). The API accepts this range.
- **Custom** range is limited to **90 days** in the UI. If you pick a range longer than 90 days, you'll see a validation error and must shorten it.

**No future dates:**

- You cannot select future dates. Only past and today are allowed.
- If you try to select a future date, you'll see a validation error.

**Start date before end date:**

- The start date must be before or equal to the end date.
- If the range is invalid, you'll see a validation error.

### Date Range Tips

- Use **Last 12 months** or **This year** for a broad search, then narrow with Custom if needed.
- Your last selected **preset** and date range are saved and restored on your next visit.

## Performing a Search

### Step-by-Step Search Process

1. **Select a track** — Choose the track from the track selection modal.
2. **Set date range (optional)** — Use a preset (e.g. "Last 12 months", "This year") or choose **Custom** and pick start and end dates.
3. **Click Search** — Click the **Search** button to run the search.

### What Happens During Search

1. **Database Search**: MRE first searches its database for events matching your
   criteria
2. **LiveRC Discovery**: If no events are found in the database, MRE
   automatically queries LiveRC
3. **Results Display**: Events are displayed in the results table below the
   search form

### Search Results

The search results table shows:

- **Event Name**: The name of the race event
- **Event Date**: When the event occurred (formatted as a readable date)
- **Status**: Current status of the event (see Status Indicators below)

## Understanding Event Status Indicators

Events in the search results have different status indicators:

### Stored / Imported

- **Visual**: Green tag/badge with checkmark icon
- **Meaning**: Event exists in MRE database with full data
- **Action**: Click "Analyse event" to view detailed analysis

### New (LiveRC only)

- **Visual**: Blue tag/badge with info icon
- **Meaning**: Discovered on LiveRC, not yet imported into MRE
- **Action**: Select the checkbox to import the event

### Importing

- **Visual**: Yellow/amber tag/badge with spinner/loading icon
- **Meaning**: Currently being imported via async job
- **Action**: Wait for import to complete

### Failed import

- **Visual**: Red tag/badge with error icon
- **Meaning**: Last import attempt failed
- **Action**: You can retry the import

## Importing Events

### Single Event Import

1. Find an event with status **"New (LiveRC only)"**
2. Click the checkbox next to the event
3. Click **"Import selected events"** button
4. Wait for the import to complete (status will change to "Importing" then
   "Stored")

### Bulk Event Import

1. Select multiple events by checking their checkboxes
2. Use **"Select All Importable"** to select all new events at once
3. Click **"Import X selected events"** button
4. Events are imported sequentially (one at a time)
5. Watch the progress indicator: "Importing X of Y..."

### Import Process

- Imports run **asynchronously** - you don't need to wait on the page
- Each event's status updates individually as import progresses
- If one event fails, the others continue importing
- Failed events can be retried individually

### After Import

Once an event is successfully imported:

- Status changes to **"Stored"** or **"Imported"**
- The **"Analyse event"** button becomes available
- Click it to view detailed event analysis

## Understanding Search Results

### Event List Display

**Desktop View:**

- Events displayed in a table format with columns
- Sortable by Event Date or Event Name
- Click column headers to sort

**Mobile View:**

- Events displayed as cards or list items
- Touch-friendly interface
- Scrollable list

### Sorting Events

- **By Event Date**: Click the "Event Date" column header (default: most recent
  first)
- **By Event Name**: Click the "Event Name" column header (alphabetical)
- Click again to reverse sort order

### Empty Search Results

If no events are found:

- You'll see a message: "No events found for this track and date range. Try
  changing your dates or selecting a different track."
- Try:
  - Expanding your date range
  - Selecting a different track
  - Checking that the event date is in the past

## Form Persistence

MRE remembers your last search:

- **Last selected track** — Restored on next visit.
- **Last date range** — Preset (e.g. "Last 12 months") and start/end dates are saved and restored.
- **Reset** — Click "Reset" to clear saved values; date range returns to "Last 12 months" and a fresh range.

## Troubleshooting Search Issues

### No Events Found

**Possible Causes:**

- Track doesn't have events in the selected date range
- Date range is too narrow
- Event hasn't been posted to LiveRC yet

**Solutions:**

- Try expanding your date range
- Verify the track name is correct
- Check if the event date is correct

### LiveRC Unavailable

**Error Message**: "LiveRC is temporarily unavailable. Please try again later."

**Solutions:**

- Wait a few minutes and try again
- Check your internet connection
- If the problem persists, contact support

### Import Failures

**Status Shows "Failed import"**

**Possible Causes:**

- LiveRC data temporarily unavailable
- Event data structure changed on LiveRC
- Network issues during import

**Solutions:**

- Click the checkbox and try importing again
- Wait a few minutes and retry
- If it continues to fail, the event may need administrator attention

## Tips and Best Practices

1. **Use Favourites**: Add frequently searched tracks to favourites for quick
   access
2. **Use presets first**: Try "Last 12 months" or "This year"; use Custom to narrow if needed
3. **Check Status**: Pay attention to event status indicators to understand what
   actions are available
4. **Bulk Import**: Import multiple events at once to save time
5. **Save Searches**: Your last search is automatically saved for convenience

## Related Guides

- **[Event Analysis Guide](event-analysis.md)**: Learn how to analyze imported
  events
- **[Navigation Guide](navigation.md)**: Master navigation patterns
- **[Troubleshooting Guide](troubleshooting.md)**: Common issues and solutions

## Next Steps

After importing events, you can:

1. View event analysis with detailed charts and comparisons
2. Compare your performance with other drivers
3. Export data to CSV for further analysis
4. Track your progress over time

---

**Ready to analyze your events?** Check out the
[Event Analysis Guide](event-analysis.md) to learn how to get the most from your
race data.
