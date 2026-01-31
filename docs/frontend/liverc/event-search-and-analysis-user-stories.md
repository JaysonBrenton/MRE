---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-28
description:
  User stories and acceptance criteria for Event Search and Event Analysis
  features
purpose:
  Defines user stories written from the Driver perspective, with detailed
  acceptance criteria for Event Search, LiveRC discovery/import, Event Analysis,
  and related functionality. These stories serve as implementation guidance and
  testing requirements.
relatedFiles:
  - docs/frontend/liverc/user-workflow.md
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/05-api-contracts.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# Event Search and Event Analysis User Stories

**Status:** Complete  
**Note:** These user stories define the Driver experience for Event Search and
Event Analysis features in the MRE Alpha release.

## Purpose

This document provides user stories and acceptance criteria for the Event Search
and Event Analysis features. Stories are written from the Driver/racer
perspective and define the expected behavior and outcomes for each feature.

---

## User Story 1: Access Event Search

**As a** Driver  
**I want to** access Event Search from the main navigation  
**So that** I can search for race events

### Acceptance Criteria

- [ ] Event Search appears as a top-level navigation item for authenticated
      users
- [ ] Navigation label is "Event Search" (clear and action-oriented)
- [ ] Unauthenticated users are redirected to login when accessing Event Search
- [ ] Event Search page loads successfully for authenticated users
- [ ] Page follows mobile-first layout principles

---

## User Story 2: Select Track via Searchable Modal

**As a** Driver  
**I want to** select a track from a searchable list with favourites  
**So that** I can quickly find and select tracks I race at frequently

### Acceptance Criteria

- [ ] Clicking track input field opens searchable track modal
- [ ] Modal displays all available tracks (~1100 tracks)
- [ ] Search input filters tracks in real-time as user types (typeahead)
- [ ] Favourite tracks appear in "Favourite Tracks" section at top of modal
- [ ] Each track row has star icon that toggles favourite status
- [ ] Toggling star adds/removes track from favourites (persisted in
      localStorage)
- [ ] Selecting a track closes modal and populates track field
- [ ] Favourite tracks displayed as chips above Event Search form
- [ ] Each favourite chip has a remove button (X icon) on the right side
- [ ] Clicking favourite chip name selects track and automatically triggers
      search
- [ ] Clicking X icon removes track from favourites (does not trigger search)
- [ ] Remove button meets 44px touch target requirement
- [ ] Modal is keyboard accessible (Escape closes, focus trapped)
- [ ] Modal is mobile-friendly (full-screen on mobile, centered on desktop)
- [ ] Track selection persists across page reloads (localStorage)

---

## User Story 3: Select Date Range with Validation

**As a** Driver  
**I want to** select a date range for event search with validation  
**So that** I can find events within a specific time period

### Acceptance Criteria

- [ ] Date range picker has Start Date and End Date inputs
- [ ] Labels appear directly above each input field
- [ ] Date inputs use native date picker on mobile for best UX
- [ ] Maximum date range is 3 months (90 days) - validation error if exceeded
- [ ] Future dates are not allowed - validation error if selected
- [ ] Start date must be before or equal to end date - validation error if
      invalid
- [ ] Validation errors appear beneath relevant field
- [ ] Error messages are concise and actionable
- [ ] Form submission disabled until validation passes
- [ ] Date range persists across page reloads (localStorage)
- [ ] Default date range is last 30 days (if no persisted value)

---

## User Story 4: Search for Events

**As a** Driver  
**I want to** search for events by track and date range  
**So that** I can find race events I want to analyze

### Acceptance Criteria

- [ ] Search button triggers event search
- [ ] Clicking a favourite track chip automatically triggers search after
      selecting the track
- [ ] Form validation occurs before search (track selected, valid dates)
- [ ] System queries MRE database for matching events
- [ ] Event table displays matching events with Event Name, Event Date, Status
      columns
- [ ] Events are sorted by Event Date (most recent first) by default
- [ ] If no events found in DB, system automatically queries LiveRC
- [ ] Loading state shown during search
- [ ] Empty state message shown if no events found
- [ ] Search results persist until user modifies search or clicks Reset

---

## User Story 5: Handle No Results

**As a** Driver  
**I want to** see a helpful message when no events are found  
**So that** I know what to do next

### Acceptance Criteria

- [ ] Friendly empty-state message displayed: "No events found for this track
      and date range. Try changing your dates or selecting a different track."
- [ ] Empty state includes action: "Reset Search" button or link
- [ ] Message uses secondary text color (`--token-text-secondary`)
- [ ] No empty table shown (only message)
- [ ] Message is accessible (screen reader support)

---

## User Story 6: Import Discovered Events

**As a** Driver  
**I want to** import newly discovered events from LiveRC  
**So that** I can analyze event data in MRE

### Acceptance Criteria

- [ ] User can select one or more events for import using checkboxes
- [ ] Checkboxes appear only for importable events (status "New (LiveRC only)")
- [ ] Checkboxes are disabled for already imported events
- [ ] Bulk import action bar appears when events are selected, showing "Import X
      selected events"
- [ ] "Select All Importable" button selects all importable events at once
- [ ] "Clear Selection" button clears all selections
- [ ] Import runs sequentially for selected events (one at a time)
- [ ] Status column shows real-time progress (importing → imported/failed) for
      each event
- [ ] Events show status "Importing" during import
- [ ] Importing status badge displays progress percentage (e.g., "Importing
      45%")
- [ ] Importing status badge shows visual progress bar that fills from left to
      right
- [ ] Badge color transitions from yellow/orange to green as import progresses
- [ ] Import runs asynchronously (does not block UI)
- [ ] Status updates when import completes or fails for each event
- [ ] Each event's final status is displayed in the table (imported/failed)
- [ ] Failed events show status "Failed import" with red tag
- [ ] Selection persists in sessionStorage across page refreshes
- [ ] Selection clears automatically after successful bulk import

---

## User Story 8: View Event Statuses

**As a** Driver  
**I want to** see the status of each event in the search results  
**So that** I know which events are ready for analysis

### Acceptance Criteria

- [ ] Event table displays status column with status tags
- [ ] Status values: "Stored"/"Imported", "New (LiveRC only)", "Importing",
      "Failed import"
- [ ] Status tags are visually distinct (colors, icons optional)
- [ ] "Stored"/"Imported" events show green tag (ready for analysis)
- [ ] "New (LiveRC only)" events show blue tag (available for import)
- [ ] "Importing" events show yellow/amber tag with spinner (in progress)
- [ ] "Importing" badge displays progress percentage and visual progress bar
      fill
- [ ] Progress bar fills from left to right showing completion percentage
- [ ] Badge color transitions from warning (yellow/orange) to success (green) as
      progress increases
- [ ] "Failed import" events show red tag (failed, can retry)
- [ ] Status updates automatically during import (polling or WebSocket)
- [ ] Status tags meet accessibility requirements (not color-only indicators)

---

## User Story 9: Navigate to Event Analysis

**As a** Driver  
**I want to** navigate to Event Analysis for a selected event  
**So that** I can analyze race data

### Acceptance Criteria

- [ ] Each event row has "Analyse event" button
- [ ] Button is clearly visible and meets 44px touch target requirement
- [ ] Clicking button navigates to Event Analysis page
- [ ] Button disabled for "Importing" events (with tooltip)
- [ ] Button disabled for "Failed import" events (with tooltip)
- [ ] Button enabled for "Stored"/"Imported" events
- [ ] Navigation preserves event context (event accessible via URL)
- [ ] URL does not expose raw internal IDs to user
- [ ] Back button returns to Event Search with search preserved

---

## User Story 10: View Event Analysis Overview

**As a** Driver  
**I want to** view an overview of event data with highlights chart  
**So that** I can quickly understand event performance

### Acceptance Criteria

- [ ] Event Analysis page loads with Overview tab active (default)
- [ ] Page header shows event name, date, and track name
- [ ] Overview tab displays primary highlights chart
- [ ] Chart is interactive (not static screenshot)
- [ ] Chart shows meaningful summary (e.g., best lap per driver)
- [ ] Chart allows selecting/unselecting drivers
- [ ] Chart allows switching metrics (lap time vs gap)
- [ ] Chart is responsive (scales to mobile width)
- [ ] Chart is accessible (screen reader support, keyboard navigation)
- [ ] Overview tab shows event summary statistics (total races, drivers, laps)

---

## User Story 11: View Drivers Tab

**As a** Driver  
**I want to** view all drivers who participated in the event  
**So that** I can see driver performance data

### Acceptance Criteria

- [ ] Drivers tab displays list of all drivers
- [ ] Driver list shows: Driver name, races participated, best lap, average lap,
      consistency
- [ ] List format on mobile, table format on desktop
- [ ] Drivers can be selected (multi-select checkboxes)
- [ ] Selected drivers can be compared in Comparisons tab
- [ ] Clicking driver shows driver details (race results, lap times, etc.)
- [ ] Driver list is sortable (by name, best lap, etc.)

---

## User Story 12: View Sessions / Heats Tab

**As a** Driver  
**I want to** view all races/sessions for the event  
**So that** I can navigate to specific race sessions

### Acceptance Criteria

- [ ] Sessions tab displays all races/sessions/heats
- [ ] Sessions grouped by class (e.g., "1/8 Nitro Buggy")
- [ ] Each session shows: Session name, class, date/time, drivers, duration
- [ ] Sessions can be filtered by class (dropdown)
- [ ] Sessions can be filtered by type (Mains, Qualifying, Heats)
- [ ] Clicking session shows race results for that session
- [ ] Race results displayed in table (mobile: list format)
- [ ] Results show: Position, Driver, Laps, Total Time, Fast Lap, Average Lap

---

## User Story 13: Compare Drivers

**As a** Driver  
**I want to** compare my performance against other drivers  
**So that** I can identify areas for improvement

### Acceptance Criteria

- [ ] Comparisons tab allows selecting multiple drivers
- [ ] Driver selection from Drivers tab or inline in Comparisons tab
- [ ] Comparison charts display:
  - Lap time comparison (overlay multiple drivers on same graph)
  - Position over time (position changes throughout race)
  - Gap analysis (time gap to leader)
- [ ] Charts are interactive (hover/tap shows details, zoom/pan if supported)
- [ ] Chart controls allow switching metrics
- [ ] Comparison table shows side-by-side metrics (optional)
- [ ] Charts are accessible (screen reader support, data table alternative)

---

## User Story 14: Compare My Laps Against Fastest Driver

**As a** Driver  
**I want to** compare my lap times against the fastest driver in the main  
**So that** I can see where I'm losing time

### Acceptance Criteria

- [ ] Can select "My Driver" from driver list
- [ ] Can select "Fastest Driver" from driver list (or "Select Fastest" quick
      action)
- [ ] Lap time comparison chart shows both drivers' lap times overlaid
- [ ] Chart highlights gaps between my laps and fastest driver's laps
- [ ] Gap analysis chart shows time gap to fastest driver over race duration
- [ ] Can identify specific laps where gap is largest
- [ ] Chart tooltips show detailed lap information on hover/tap

---

## User Story 15: Identify Where I Lost Time

**As a** Driver  
**I want to** quickly see where I lost the most time  
**So that** I can focus on improving those areas

### Acceptance Criteria

- [ ] Lap time graph shows spikes (slowest laps) highlighted visually
- [ ] Slowest laps identified with visual indicators (color, markers)
- [ ] Consistency score displayed (shows lap time variance)
- [ ] Drop-off points identified (where lap times degrade)
- [ ] Can zoom into specific race segments to analyze slow laps
- [ ] Chart shows average lap vs fastest lap comparison
- [ ] Clear visual distinction between consistent and inconsistent laps

---

## User Story 16: Filter Event Analysis Data

**As a** Driver  
**I want to** filter event analysis data by class, session, or date  
**So that** I can focus on specific races or time periods

### Acceptance Criteria

- [ ] Can filter by class (dropdown: "All Classes" or specific class)
- [ ] Can filter by session type ("All Sessions", "Mains Only", "Qualifying
      Only")
- [ ] Can filter by date range (if event spans multiple days)
- [ ] Filters apply to all charts and data views
- [ ] Filter state persists during session
- [ ] "Clear Filters" button resets all filters
- [ ] Filter controls meet 44px touch target requirement

---

## User Story 17: Export Event Data to CSV

**As a** Driver  
**I want to** export event data to CSV  
**So that** I can analyze data in external tools

### Acceptance Criteria

- [ ] Export button available in page header ("Export All Data")
- [ ] Export buttons available per tab ("Export Overview Data", etc.)
- [ ] Export buttons available per chart ("Export Chart Data")
- [ ] Clicking export triggers CSV download
- [ ] CSV file named: `{event-name}_{data-type}_{timestamp}.csv`
- [ ] CSV includes headers and data
- [ ] Export respects current filters and selections (only exports visible data)
- [ ] Exportable data types:
  - Lap times table (all lap times for selected drivers/sessions)
  - Driver comparison dataset (side-by-side metrics)
  - Race results (complete results for selected sessions)
  - Session summary (summary statistics)
- [ ] Export button uses standard outlined/secondary style
- [ ] Export button meets 44px touch target requirement

---

## User Story 18: Reset Event Search

**As a** Driver  
**I want to** reset my search criteria  
**So that** I can start a new search

### Acceptance Criteria

- [ ] "Reset" button is prominent and accessible
- [ ] Clicking Reset clears track selection
- [ ] Clicking Reset clears date range (back to default: last 30 days)
- [ ] Clicking Reset clears cached LiveRC results
- [ ] Clicking Reset clears event table/results
- [ ] Form returns to initial state after Reset
- [ ] Reset button uses standard outlined/secondary style
- [ ] Optional: Confirmation dialog before reset

---

## User Story 19: Use Event Search on Mobile

**As a** Driver  
**I want to** use Event Search on my mobile device  
**So that** I can search for events on the go

### Acceptance Criteria

- [ ] Event Search form uses single-column layout on mobile
- [ ] Track modal is full-screen on mobile (not centered modal)
- [ ] Date inputs use native date picker (best mobile UX)
- [ ] Event table uses list format on mobile (not table format)
- [ ] All touch targets meet 44px minimum height
- [ ] No horizontal scrolling on any mobile viewport
- [ ] Forms are keyboard-friendly (mobile keyboard doesn't obstruct inputs)
- [ ] Navigation is touch-friendly (no hover-only interactions)

---

## User Story 20: Access Event Analysis on Mobile

**As a** Driver  
**I want to** analyze events on my mobile device  
**So that** I can review race data anywhere

### Acceptance Criteria

- [ ] Event Analysis page is mobile-responsive
- [ ] Tabs are scrollable horizontal list on mobile if needed
- [ ] Charts scale to mobile width (responsive)
- [ ] Charts remain interactive on mobile (tap instead of hover)
- [ ] Driver lists use card format on mobile (not table)
- [ ] All controls meet 44px touch target requirement
- [ ] Export functionality works on mobile (downloads CSV)
- [ ] Page loads quickly on mobile (< 2 seconds)

---

## User Story 21: Use Event Search with Screen Reader

**As a** Driver with visual impairment  
**I want to** use Event Search with a screen reader  
**So that** I can access event data

### Acceptance Criteria

- [ ] All form fields have proper labels (associated with inputs)
- [ ] Track modal announces when opened/closed
- [ ] Track names announced when navigating list
- [ ] Favourite status announced ("Favourite" or "Not favourite")
- [ ] Validation errors announced to screen reader
- [ ] Event table has proper table headers (`<th>` elements)
- [ ] Status tags have accessible labels
- [ ] Loading states announced ("Searching for events...")
- [ ] Success/error messages announced
- [ ] Keyboard navigation works throughout (Tab, Enter, Escape)

---

## User Story 22: Use Event Analysis with Screen Reader

**As a** Driver with visual impairment  
**I want to** use Event Analysis with a screen reader  
**So that** I can analyze race data

### Acceptance Criteria

- [ ] Charts have text alternatives (data tables or descriptions)
- [ ] Chart data accessible via keyboard navigation
- [ ] Tab navigation announced ("Overview tab", "Drivers tab", etc.)
- [ ] Driver names announced when navigating lists
- [ ] Comparison data accessible in table format
- [ ] Export functionality accessible (button labels clear)
- [ ] Filter controls have proper labels
- [ ] Interactive elements have ARIA labels
- [ ] Status updates announced ("Import completed", etc.)

---

## User Story 23: Analyze Performance Trends Across Events at a Track

**As a** Driver  
**I want to** analyze my lap times and performance trends across all events at a
selected track  
**So that** I can track my improvement over time and identify patterns in my
performance

### Acceptance Criteria

1. **Track Selection for Trend Analysis**
   - [ ] Track selector available in Event Analysis section (dashboard or event
         analysis page)
   - [ ] Track selector displays track name for currently selected event (if
         available)
   - [ ] User can change track selection to view trends for different tracks
   - [ ] Track selector uses same searchable modal pattern as Event Search (User
         Story 2)
   - [ ] Track selection persists during session (localStorage or
         sessionStorage)

2. **Performance Trends Display**
   - [ ] When a track is selected, "Track Performance Trends" section appears in
         Event Analysis
   - [ ] Section displays summary statistics:
     - Total number of events at this track
     - Best lap time across all events
     - Improvement (time difference between first and most recent event)
     - Best position achieved at this track
   - [ ] Summary statistics are clearly labeled and formatted

3. **Lap Time Trend Visualization**
   - [ ] Best lap time trend chart displays lap times across all events
         chronologically
   - [ ] Chart shows event dates on X-axis and lap times on Y-axis
   - [ ] Each event is represented as a data point on the chart
   - [ ] Chart visually indicates improvement trend (line connecting data
         points)
   - [ ] Chart is interactive (hover/tap shows event name, date, and lap time)
   - [ ] Chart is responsive (scales to mobile width)
   - [ ] Chart uses accessible color scheme and meets WCAG 2.1 AA standards

4. **Event History List**
   - [ ] Event history table/list displays all events at selected track
   - [ ] Each event row shows:
     - Event name
     - Event date (formatted)
     - Best lap time for that event
     - Position in event (if available)
     - Number of races participated
     - Classes raced (if multiple)
   - [ ] Events are sorted by date (earliest to most recent) by default
   - [ ] Table/list format on desktop, card format on mobile
   - [ ] Each event row is clickable and navigates to that event's analysis page

5. **Performance Metrics**
   - [ ] Average lap time trend displayed (optional secondary chart or metric)
   - [ ] Consistency scores displayed per event (if available)
   - [ ] Improvement percentage calculated and displayed (time improvement from
         first to last event)
   - [ ] Metrics clearly indicate if data is missing (N/A display)

6. **Data Filtering and Sorting**
   - [ ] Events can be sorted by date (ascending/descending)
   - [ ] Events can be sorted by best lap time (fastest/slowest)
   - [ ] Events can be filtered by date range (optional)
   - [ ] Filter and sort controls meet 44px touch target requirement

7. **Empty States**
   - [ ] If no events found for selected track, friendly message displayed: "No
         performance data available for this track yet. Race at this track and
         import events to see your trends."
   - [ ] If user has no confirmed driver link, message displayed: "Link your
         driver profile to view performance trends."
   - [ ] Empty states use secondary text color and are accessible

8. **Loading States**
   - [ ] Loading indicator shown while fetching track performance data
   - [ ] Loading state announced to screen readers ("Loading track performance
         trends...")
   - [ ] Skeleton loader or spinner used during data fetch

9. **Error Handling**
   - [ ] Error message displayed if API request fails
   - [ ] Error message is user-friendly and actionable
   - [ ] Retry button available on error state
   - [ ] Error states are accessible (announced to screen readers)

10. **API Integration**
    - [ ] API endpoint: `GET /api/v1/tracks/[trackId]/performance-trends`
    - [ ] Endpoint requires authentication (user must be logged in)
    - [ ] Endpoint returns performance data for logged-in user's confirmed
          driver link
    - [ ] API response includes all events at track where user participated
    - [ ] API response includes best lap time, average lap time, consistency,
          position for each event
    - [ ] API follows standard response format (success/error structure)

11. **Mobile Responsiveness**
    - [ ] Track selector works on mobile (full-screen modal)
    - [ ] Trend chart scales to mobile width
    - [ ] Event history uses card format on mobile (not table)
    - [ ] All touch targets meet 44px minimum height
    - [ ] No horizontal scrolling required

12. **Accessibility**
    - [ ] Chart has text alternative (data table or description)
    - [ ] Chart data accessible via keyboard navigation
    - [ ] Track selector modal is keyboard accessible
    - [ ] Event history table has proper table headers (`<th>` elements on
          desktop)
    - [ ] All interactive elements have ARIA labels
    - [ ] Loading and error states announced to screen readers
    - [ ] Color is not the only indicator (icons, text labels used)

13. **Integration with Event Analysis**
    - [ ] Track Performance Trends section appears in Event Analysis section on
          dashboard
    - [ ] Section can be collapsed/expanded (optional)
    - [ ] Section appears below or alongside standard event analysis tabs
    - [ ] Track selection can be derived from currently selected event (if event
          is selected)
    - [ ] Clicking event in history navigates to that event's analysis page

### Dependencies

- User Story 2: Select Track via Searchable Modal (for track selection UI
  pattern)
- User Story 10: View Event Analysis Overview (for integration with event
  analysis)
- User driver link must be confirmed (UserDriverLink status = "confirmed")
- Events must be ingested and stored in database

### Definition of Done

- [ ] Track selector integrated into Event Analysis section
- [ ] API endpoint created: `GET /api/v1/tracks/[trackId]/performance-trends`
- [ ] Core function created: `getTrackPerformanceTrends(trackId, userId)`
- [ ] Track Performance Trends component created and integrated
- [ ] Best lap time trend chart displays correctly
- [ ] Event history list/table displays all events with performance data
- [ ] Summary statistics calculate and display correctly
- [ ] Empty states handled gracefully
- [ ] Loading and error states implemented
- [ ] Mobile layout verified on multiple screen sizes
- [ ] Accessibility requirements met (WCAG 2.1 AA)
- [ ] Screen reader compatibility verified
- [ ] API endpoint tested and documented
- [ ] Code reviewed
- [ ] Documentation updated

### Related Documentation

- [Event Search and Event Analysis User Stories](./event-search-and-analysis-user-stories.md)
- [Mobile-Safe Architecture Guidelines](../../architecture/mobile-safe-architecture-guidelines.md)
- [MRE UX Principles](../../design/mre-ux-principles.md)
- [MRE Dark Theme Guidelines](../../design/mre-dark-theme-guidelines.md)
- [Chart Design Standards](../../design/chart-design-standards.md)

---

## Summary

These user stories define the complete Driver experience for Event Search and
Event Analysis features. Each story includes detailed acceptance criteria that
serve as:

- **Implementation guidance** for developers
- **Testing requirements** for QA
- **UX validation** for design review
- **Accessibility requirements** for compliance

All stories must be implemented in compliance with:

- [MRE UX Principles](../../design/mre-ux-principles.md)
- [MRE Mobile UX Guidelines](../../design/mre-mobile-ux-guidelines.md)
- [MRE Dark Theme Guidelines](../../design/mre-dark-theme-guidelines.md)
- [Mobile-Safe Architecture Guidelines](../../architecture/mobile-safe-architecture-guidelines.md)

---

End of event-search-and-analysis-user-stories.md
