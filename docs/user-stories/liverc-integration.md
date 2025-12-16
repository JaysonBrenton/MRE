---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: User stories for LiveRC integration features (track selection, event discovery, ingestion, visualization)
purpose: Defines user stories for LiveRC data discovery, ingestion, and visualization functionality
         with detailed acceptance criteria, dependencies, and Definition of Done checklists.
relatedFiles:
  - docs/frontend/liverc/user-workflow.md
  - docs/architecture/liverc-ingestion/05-api-contracts.md
  - docs/architecture/liverc-ingestion/11-ingestion-error-handling.md
  - docs/specs/mre-alpha-feature-scope.md
---

# LiveRC Integration Epic

This epic contains user stories for LiveRC integration features: track selection, event discovery, on-demand ingestion, and data visualization.

---

## Track Selection

**As a** User  
**I want** to select a track from the catalogue  
**So that** I can discover events for that track

### Priority
High

### Dependencies
- User Login story (users must be authenticated to access LiveRC features)

### Acceptance Criteria

1. **Track List Display**
   - Track selection interface must display a list of tracks from the LiveRC track catalogue
   - Tracks must be displayed vertically in a single-column layout (mobile-first)
   - Each track item must show:
     - Track name prominently using `--token-text-primary`
     - Track location or additional metadata using `--token-text-secondary`
     - Active/followed status visually (if applicable)
   - Track list must use consistent spacing scale (4px, 8px, 12px, 16px, 20px, 24px)

2. **Touch Targets**
   - Each track item must be a minimum 44px height touch target per mobile UX guidelines
   - Each track item must be tappable/clickable to proceed to date selection
   - Visual feedback must be provided on tap/click (e.g., opacity change, background color change)

3. **API Integration**
   - Interface must call `GET /api/v1/tracks` to retrieve track list
   - Default behavior: fetch tracks where `is_followed = true` AND `is_active = true`
   - Query parameters must be supported: `followed` (boolean, optional) and `active` (boolean, optional)
   - API response must be parsed and displayed correctly
   - Track data must include: id, track_name, track_url, is_active, is_followed

4. **Empty State Handling**
   - When API returns empty array, must display: "No tracks available"
   - Empty state message must use `--token-text-secondary`
   - Empty state must be user-friendly and actionable

5. **Error Handling**
   - Network errors must display: "Unable to load tracks. Please try again." with retry option
   - API errors must display user-friendly error message based on error code
   - Error messages must use error token colors (`--token-error-text`)
   - Error messages must appear directly below relevant UI element per UX principles
   - Error messages must not expose technical details

6. **Search and Filtering (Optional for Alpha)**
   - If search is implemented, must use a single search input field above the track list
   - Search input must meet minimum 44px height requirement
   - Search must filter results in real-time as user types
   - "No tracks found" message must use error token colors when search yields no results

7. **Mobile-First UI Requirements**
   - Interface must use single-column layout (mobile-first)
   - Track list must be fully functional on mobile devices
   - No hover-only interactions
   - Layout must collapse gracefully on small screens
   - Consistent spacing must be maintained

8. **Accessibility Requirements**
   - All track items must be keyboard navigable
   - Screen reader support: track name and status must be announced
   - Focus indicators must be visible using `--token-interactive-focus-ring`
   - Keyboard navigation must allow selection of tracks
   - Focus management must be logical and predictable

9. **Architecture Compliance**
   - UI component must be thin (no business logic)
   - API calls must use versioned endpoints (`/api/v1/tracks`)
   - No direct database queries in UI component
   - Track data fetching logic must follow architecture guidelines

### Definition of Done

- [ ] Track selection interface implemented with track list display
- [ ] API endpoint `GET /api/v1/tracks` integrated
- [ ] Track items meet 44px minimum height requirement
- [ ] Single-column, mobile-first layout implemented
- [ ] Empty state handling implemented
- [ ] Error handling implemented for all error scenarios
- [ ] Touch targets verified on mobile devices
- [ ] Visual feedback on interaction implemented
- [ ] Dark theme tokens used throughout
- [ ] Accessibility requirements met (WCAG 2.1 AA)
- [ ] Keyboard navigation tested
- [ ] Screen reader compatibility verified
- [ ] Code reviewed
- [ ] Documentation updated

### Related Documentation

- [LiveRC User Workflow - Step 1: Track Selection](../frontend/liverc/user-workflow.md#step-1-track-selection)
- [LiveRC API Contracts - GET /tracks](../architecture/liverc-ingestion/05-api-contracts.md#21-get-tracks)
- [MRE Mobile UX Guidelines](../design/mre-mobile-ux-guidelines.md)
- [MRE UX Principles](../design/mre-ux-principles.md)

---

## Event Discovery

**As a** User  
**I want** to search for events by date range  
**So that** I can find races I'm interested in

### Priority
High

### Dependencies
- Track Selection story (users must select a track before searching for events)

### Acceptance Criteria

1. **Date Range Selection Form**
   - Form must include two date input fields:
     - Start Date (required)
     - End Date (required)
   - Labels must appear directly above each input field per UX principles
   - Inputs must fill container width on mobile
   - Inputs must use native date input type (`type="date"`) for mobile compatibility
   - Dates must be formatted as ISO date strings (YYYY-MM-DD) for API compatibility
   - Dates must be displayed in user-friendly format (e.g., "January 15, 2025")
   - Inputs must use semantic tokens: `--token-surface-elevated` background, `--token-border-default` border

2. **Form Validation**
   - Client-side validation must ensure `start_date <= end_date`
   - Validation errors must appear directly beneath the relevant field
   - Error messages must be concise and actionable:
     - "Start date must be before or equal to end date"
     - "Start date is required"
     - "End date is required"
   - Error messages must use error token colors
   - Form submission must be disabled until validation passes

3. **Form Submission**
   - Submit button must be full-width on mobile
   - Button must use standard outlined/secondary style per UX guidelines
   - Button text must be "Find Events" (action-oriented, not generic "Submit")
   - Loading state must be shown during API call
   - Button must be disabled during submission to prevent duplicate requests

4. **Event List Display**
   - Events must be displayed in a vertical list (single-column layout)
   - Each event item must display:
     - Event name (primary text, `--token-text-primary`)
     - Event date (formatted user-friendly, e.g., "November 16, 2025")
     - Event metadata:
       - Number of entries (e.g., "114 entries")
       - Number of drivers (e.g., "87 drivers")
     - Ingestion status indicator:
       - "Not ingested" (if `ingest_depth = "none"`)
       - "Fully ingested" (if `ingest_depth = "laps_full"`)
     - Last ingested timestamp (if available): "Ingested 2 days ago"
   - Metadata and status information must use `--token-text-secondary`
   - Events must be ordered chronologically (most recent first)

5. **Event Selection**
   - Each event item must be tappable/clickable to proceed to ingestion or event details
   - Visual feedback must be provided on tap/click
   - Selected event should be visually distinct (if selection state is maintained)

6. **API Integration**
   - Form submission must call `GET /api/v1/events/search?track_id={track_id}&start_date={start_date}&end_date={end_date}`
   - API must validate that track_id exists
   - API must validate that start_date <= end_date
   - API response must be parsed and displayed correctly
   - Event data must include: id, event_name, event_date, event_entries, event_drivers, ingest_depth, last_ingested_at

7. **Empty State Handling**
   - When no events found, must display: "No events found for this date range"
   - Empty state must provide option to adjust date range or select different track
   - Empty state message must use `--token-text-secondary`

8. **Loading State**
   - Loading indicator must be displayed while fetching events
   - Skeleton placeholders or spinner must be shown during API call
   - Layout structure must be maintained to prevent content shift

9. **Error Handling**
   - Network errors must display: "Unable to search events. Please check your connection and try again."
   - Validation errors must display field-level errors as specified above
   - API validation errors must display server-side validation messages if client-side validation passes but API rejects
   - API errors must display user-friendly message based on error code from API contracts
   - Track not found errors must display: "Selected track is no longer available" and allow track reselection
   - Error messages must use error token colors
   - Error messages must appear at top of event list

10. **Mobile-First UI Requirements**
    - Form must use single-column layout
    - All inputs must meet minimum 44px height requirement
    - Event list must be fully functional on mobile devices
    - No hover-only interactions
    - Layout must collapse gracefully on small screens

11. **Accessibility Requirements**
    - Date inputs must be keyboard navigable
    - Labels must be properly associated with inputs (use `htmlFor` and `id`)
    - Screen reader support: validation errors must be announced
    - Focus management: focus must move to first error field when validation fails
    - All event items must be keyboard navigable
    - Screen reader support: event name, date, and ingestion status must be announced
    - Focus indicators must be visible
    - Skip links must be provided if event list is long

12. **Architecture Compliance**
    - UI component must be thin (no business logic)
    - API calls must use versioned endpoints (`/api/v1/events/search`)
    - No direct database queries in UI component
    - Event data fetching logic must follow architecture guidelines

### Definition of Done

- [ ] Date range selection form implemented
- [ ] Client-side validation implemented (start_date <= end_date)
- [ ] API endpoint `GET /api/v1/events/search` integrated
- [ ] Event list display implemented with all required information
- [ ] Ingestion status indicators displayed correctly
- [ ] Empty state handling implemented
- [ ] Loading state implemented
- [ ] Error handling implemented for all error scenarios
- [ ] Event selection interaction implemented
- [ ] Single-column, mobile-first layout implemented
- [ ] Touch targets meet 44px minimum height requirement
- [ ] Dark theme tokens used throughout
- [ ] Accessibility requirements met (WCAG 2.1 AA)
- [ ] Keyboard navigation tested
- [ ] Screen reader compatibility verified
- [ ] Code reviewed
- [ ] Documentation updated

### Related Documentation

- [LiveRC User Workflow - Steps 2-3: Date Range Selection and Event Discovery](../frontend/liverc/user-workflow.md#step-2-date-range-selection)
- [LiveRC API Contracts - GET /events/search](../architecture/liverc-ingestion/05-api-contracts.md#31-get-eventssearch)
- [MRE Mobile UX Guidelines](../design/mre-mobile-ux-guidelines.md)
- [MRE UX Principles](../design/mre-ux-principles.md)

---

## On-Demand Ingestion

**As a** User  
**I want** to trigger event data ingestion  
**So that** I can access detailed race information

### Priority
High

### Dependencies
- Event Discovery story (users must discover events before ingesting them)

### Acceptance Criteria

1. **Ingestion Trigger**
   - Ingestion must begin automatically when user selects an event (or via explicit "Ingest Event" button)
   - Optional confirmation dialog may be shown: "This will download race data from LiveRC. Continue?"
   - Confirmation button text must be "Start Ingestion" (action-oriented)

2. **Progress Indicators**
   - Loading state must be displayed immediately upon ingestion trigger
   - Progress feedback must be shown using one of:
     - Indeterminate progress spinner (for synchronous ingestion in Alpha)
     - Progress bar with percentage (if async ingestion is implemented)
     - Status messages: "Connecting to LiveRC...", "Downloading event data...", "Processing races...", "Storing lap data..."
   - Loading indicators must use semantic tokens
   - User context must be maintained: show event name and selected track during ingestion

3. **Loading State Design**
   - Centered loading indicator or progress bar
   - Status text below indicator using `--token-text-secondary`
   - Interaction with event list must be disabled during ingestion
   - Optional: show warning if user attempts to navigate away during active ingestion

4. **API Integration**
   - Ingestion must call `POST /api/v1/events/{event_id}/ingest` with request body: `{ "depth": "laps_full" }`
   - API must validate that event exists
   - API must validate depth parameter
   - API must be idempotent (must not duplicate data if already fully ingested)
   - Response must include: event_id, ingest_depth, last_ingested_at, races_ingested, results_ingested, laps_ingested, status

5. **Success State**
   - Success message must be displayed: "Event data ingested successfully"
   - Summary information must be shown:
     - Number of races ingested
     - Number of results ingested
     - Number of laps ingested
     - Ingestion timestamp
   - Event status indicator must be updated to show "Fully ingested"
   - Clear next action must be provided: "View Event Details" or "View Race Results"

6. **Error Handling**
   - Handle errors per ingestion error handling documentation:
     - **INGESTION_IN_PROGRESS:** Display "Ingestion already in progress for this event. Please wait."
     - **INGESTION_FAILED:** Display "Unable to ingest event data. The LiveRC website may be temporarily unavailable." with retry option
     - **NOT_FOUND:** Display "Event not found. It may have been removed."
     - **VALIDATION_ERROR:** Display "Invalid event data. Please contact support if this persists."
     - **INTERNAL_ERROR:** Display "An error occurred during ingestion. Please try again later."
   - Error messages must appear prominently at top of screen
   - Error messages must use error token colors (`--token-error-text`)
   - Error messages must be concise and actionable per UX principles
   - Retry mechanism must be provided for recoverable errors
   - Technical details must be logged server-side only (not exposed to user)

7. **Idempotency Handling**
   - If event is already fully ingested, show message: "Event data is already available."
   - Allow re-ingestion if user explicitly requests it
   - Show confirmation: "Re-ingest this event? This will update existing data."

8. **Mobile-First UI Requirements**
   - Progress indicators must be fully functional on mobile devices
   - Loading states must be clearly visible on small screens
   - Error messages must be readable on mobile
   - No hover-only interactions

9. **Accessibility Requirements**
   - Loading states must be announced to screen readers
   - Success/error messages must be announced
   - Progress indicators must have accessible labels
   - Focus management: return focus to appropriate element after ingestion completes

10. **Architecture Compliance**
    - UI component must be thin (no business logic)
    - API calls must use versioned endpoints (`/api/v1/events/{event_id}/ingest`)
    - No direct database queries in UI component
    - Ingestion logic must follow architecture guidelines

### Definition of Done

- [ ] Ingestion trigger implemented (automatic or explicit button)
- [ ] Progress indicators implemented (spinner or progress bar)
- [ ] API endpoint `POST /api/v1/events/{event_id}/ingest` integrated
- [ ] Success state with summary information implemented
- [ ] Error handling implemented for all error scenarios per error handling docs
- [ ] Idempotency handling implemented
- [ ] Loading states clearly visible on mobile
- [ ] Dark theme tokens used throughout
- [ ] Accessibility requirements met (WCAG 2.1 AA)
- [ ] Screen reader announcements implemented
- [ ] Code reviewed
- [ ] Documentation updated

### Related Documentation

- [LiveRC User Workflow - Step 4: On-Demand Ingestion](../frontend/liverc/user-workflow.md#step-4-on-demand-ingestion)
- [LiveRC API Contracts - POST /events/{event_id}/ingest](../architecture/liverc-ingestion/05-api-contracts.md#41-post-eventsevent_idingest)
- [Ingestion Error Handling](../architecture/liverc-ingestion/11-ingestion-error-handling.md)
- [MRE UX Principles](../design/mre-ux-principles.md)

---

## Data Visualization

**As a** User  
**I want** to view race results and lap data  
**So that** I can analyze race performance

### Priority
Medium

### Dependencies
- On-Demand Ingestion story (events must be ingested before data can be visualized)

### Acceptance Criteria

1. **Race Results Display**
   - Race results must be displayed in a single-column list format (mobile-first)
   - Each result item must show:
     - Driver position (final position)
     - Driver name (display_name)
     - Laps completed
     - Total race time
     - Fast lap time
     - Average lap time
   - Semantic tokens must be used for text hierarchy
   - Results must be ordered by `position_final` (1st, 2nd, 3rd, etc.)

2. **Lap Data Display**
   - Lap data must be displayed as a vertical list of lap records
   - Each lap must show:
     - Lap number
     - Lap time (formatted as MM:SS.mmm)
     - Position on lap
     - Elapsed race time
   - Consistent spacing and typography must be maintained
   - Fastest lap may be highlighted visually (optional for Alpha)

3. **Table Format (Desktop Enhancement)**
   - On larger screens (900px+), data may be displayed in table format
   - Tables must degrade to list format on mobile per mobile UX guidelines
   - Tables must be accessible: proper headers, keyboard navigation

4. **API Integration**
   - Must call `GET /api/v1/events/{event_id}` to get event details and race summaries
   - Must call `GET /api/v1/races/{race_id}` to get race results
   - Must call `GET /api/v1/races/{race_id}/laps` to get lap data for all drivers
   - Must call `GET /api/v1/race-results/{race_result_id}/laps` to get lap data for single driver
   - API responses must be parsed and displayed correctly

5. **Empty States**
   - If no race data: "No race data available. Event may need to be ingested."
   - If no lap data: "No lap data available for this result."
   - Empty state messages must use `--token-text-secondary`

6. **Loading States**
   - Loading indicator must be displayed while fetching race/lap data
   - Skeleton placeholders must be shown to maintain layout

7. **Error Handling**
   - Network errors must display: "Unable to load race data. Please try again."
   - NOT_FOUND errors must display: "Race data not found. Event may need to be ingested."
   - Error messages must use error token colors
   - Retry option must be provided for recoverable errors

8. **Mobile-First UI Requirements**
   - Data must be displayed in single-column list format on mobile
   - Tables must degrade gracefully to lists on small screens
   - All data must be readable on mobile devices
   - No hover-only interactions

9. **Accessibility Requirements**
   - All data must be accessible via keyboard navigation
   - Screen reader support: data must be announced in logical order
   - Tables must have proper headers and captions
   - Color must not be the only indicator (use icons, text labels)

10. **Architecture Compliance**
    - UI component must be thin (no business logic)
    - API calls must use versioned endpoints (`/api/v1/...`)
    - No direct database queries in UI component
    - Data fetching logic must follow architecture guidelines

11. **Future Visualizations (Not in Alpha)**
    - The following visualizations are planned for future releases but are NOT implemented in Alpha:
      - Lap time graphs (line chart showing lap times over race duration)
      - Position-over-time graphs (line chart showing position changes throughout race)
      - Driver comparison overlays (overlay multiple drivers' lap times on same graph)
      - Consistency analytics (visual indicators for lap time consistency)
      - Drop-off analysis (highlight where lap times degrade)

### Definition of Done

- [ ] Race results display implemented (single-column list format)
- [ ] Lap data display implemented (vertical list)
- [ ] API endpoints integrated (`GET /api/v1/events/{event_id}`, `GET /api/v1/races/{race_id}`, etc.)
- [ ] Empty state handling implemented
- [ ] Loading state implemented
- [ ] Error handling implemented for all error scenarios
- [ ] Table format implemented for desktop (with mobile degradation)
- [ ] Mobile-first layout verified on multiple screen sizes
- [ ] Dark theme tokens used throughout
- [ ] Accessibility requirements met (WCAG 2.1 AA)
- [ ] Keyboard navigation tested
- [ ] Screen reader compatibility verified
- [ ] Code reviewed
- [ ] Documentation updated

### Related Documentation

- [LiveRC User Workflow - Step 5: Data Visualization](../frontend/liverc/user-workflow.md#step-5-data-visualization)
- [LiveRC API Contracts - Race and Result APIs](../architecture/liverc-ingestion/05-api-contracts.md#5-race-and-result-apis)
- [LiveRC API Contracts - Lap Data APIs](../architecture/liverc-ingestion/05-api-contracts.md#6-lap-data-apis)
- [MRE Mobile UX Guidelines](../design/mre-mobile-ux-guidelines.md)
- [MRE UX Principles](../design/mre-ux-principles.md)

