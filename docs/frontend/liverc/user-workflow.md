---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Complete end-to-end user workflow for Event Search and Event Analysis features
purpose: Defines the complete Driver workflow from login → Event Search → search/filter → LiveRC discovery/import → select event → Event Analysis. This document serves as the authoritative UX specification for the Event Search and Event Analysis features in the MRE version 0.1.1 release.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
  - docs/architecture/liverc-ingestion/05-api-contracts.md
  - docs/specs/mre-v0.1-feature-scope.md
  - docs/design/mre-ux-principles.md
  - docs/design/mre-mobile-ux-guidelines.md
  - docs/design/mre-dark-theme-guidelines.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
---

# LiveRC Event Search and Event Analysis User Workflow

**Status:** Complete  
**Note:** This feature is in scope for version 0.1.1 release. See [MRE Version 0.1.1 Feature Scope](../specs/mre-v0.1-feature-scope.md) for version 0.1.1 feature specifications.

## Purpose

This document defines the complete end-to-end user experience for Drivers using My Race Engineer (MRE) to search for race events and analyze race data. It covers the full workflow from accessing Event Search through analyzing event data, including track selection, date filtering, LiveRC discovery and import, event selection, and comprehensive event analysis.

## High-Level User Journey

The complete Driver workflow follows this sequence:

1. **Driver logs into MRE** (authentication required)
2. **Driver navigates to Event Search** (top-level navigation item)
3. **Driver selects a track** via searchable track modal with favourites support
4. **Driver selects a date range** (max 3 months, no future dates)
5. **Driver clicks Search** → System queries MRE database for matching events
6. **If no DB results** → System automatically queries LiveRC for events
7. **Driver views event list** with status indicators (Stored, New, Importing, Failed)
8. **Driver clicks "Check LiveRC"** (optional) → System discovers new events
9. **Driver imports discovered events** → Async ingestion pipeline runs
10. **Driver selects an event** → Navigates to Event Analysis page
11. **Driver analyzes event data** → Views interactive charts, comparisons, and exports CSV

For detailed technical implementation, see [LiveRC Ingestion Overview](../../architecture/liverc-ingestion/01-overview.md).

---

## 1. Event Search Container

### 1.1 Navigation and Access

**Top-Level Navigation:**
- Event Search is exposed as a **top-level navigation item** for all authenticated users
- Navigation label: "Event Search" (clear, action-oriented)
- Accessible from any authenticated page via main navigation
- Navigation must follow [Mobile UX Guidelines](../../design/mre-mobile-ux-guidelines.md) Section 6

**Authentication Requirement:**
- Only **authenticated users** can access Event Search
- Unauthenticated users attempting to access Event Search are redirected to login
- Authentication state must be checked on page load and navigation

**User Type:**
- End-user for this feature is **Driver / racer only**
- No special club admin behavior in Event Search (admin features are separate)

### 1.2 Page Layout and Structure

**Container Structure:**
- Event Search is rendered as a dedicated page/screen
- Main container: **Event Search container**
- Follows standard MRE page structure per [UX Principles](../../design/mre-ux-principles.md) Section 3.2:
  ```
  <header />
  <main class="page-container">
    <section class="content-wrapper">
      <EventSearchContainer />
    </section>
  </main>
  ```

**Form Layout:**
- **Desktop (900px+):** Two-column layout
  - Left column: Track selector
  - Right column: Date range selector
  - Columns must maintain consistent spacing (16px gap minimum)
- **Mobile (0-899px):** Single-column layout
  - Track selector stacked above date range selector
  - Full-width form elements
  - Consistent vertical spacing (24px between form sections)

**Responsive Behavior:**
- Layout must collapse gracefully per [Mobile UX Guidelines](../../design/mre-mobile-ux-guidelines.md) Section 10
- No horizontal scrolling on any viewport size
- Touch targets remain 44px minimum height on all devices

### 1.3 Track Selection

**Track Selection Method:**
- Users search **by track only**, not by club
- Track list size: approximately **1100 tracks**
- Track selection must be via a **searchable modal** (not inline dropdown)

**Searchable Track Modal:**
- **Trigger:** Click/tap on track input field opens modal
- **Modal Structure:**
  - Full-screen overlay on mobile, centered modal on desktop (max-width: 600px)
  - Modal header: "Select Track" with close button (X icon, 44px touch target)
  - Search input at top (typeahead, filters as user types)
  - Track list below search input
  - Modal footer: "Cancel" button (secondary style)

**Typeahead Search:**
- Search input supports real-time filtering over track names
- Search is case-insensitive
- Search matches anywhere in track name (not just prefix)
- Minimum 2 characters before filtering (or show all tracks)
- Display "No tracks found" message when search yields no results
- Search input must meet 44px height requirement

**Favourite Tracks:**
- **Favourite Tracks Section:** Pinned at top of modal track list
  - Section header: "Favourite Tracks" (if user has favourites)
  - Each track row has a **star icon** (unfilled = not favourite, filled = favourite)
  - Star icon is tappable/clickable (44px touch target including padding)
  - Toggling star adds/removes track from favourites
  - Favourite tracks appear above all other tracks in modal
- **Quick Chips (Optional):** Surface favourites as quick-select chips above Event Search form
  - Chips displayed horizontally (wrap to multiple lines on mobile)
  - Each chip shows track name (truncated if too long)
  - Clicking chip selects that track and closes modal
  - Chips use `--token-surface-elevated` background
  - Chips have 44px minimum height

**Track Row Display:**
- Each track row in modal:
  - Track name (primary text, `--token-text-primary`)
  - Optional: Track location/metadata (secondary text, `--token-text-secondary`)
  - Star icon (right-aligned, 44px touch target)
  - Minimum 44px height for entire row
  - Hover/tap feedback (subtle background color change)

**Favourite Persistence:**
- **Phase 1 (Alpha):** localStorage
  - Key: `mre_favourite_tracks` (array of track IDs or slugs)
  - Persist immediately on star toggle
  - Load favourites on page load
- **Future Phase:** Server-side user preferences
  - Store in user preferences table (do not design DB schema yet)
  - Sync with localStorage for offline support
  - Note: This is documented for future planning only

**Track Selection Behavior:**
- Selecting a track (clicking row or chip) closes modal and populates track field
- Selected track displayed in track input field
- If track has alias information (future feature), display subtle note: "Also raced as [Old Name]"
- Track input field is read-only after selection (shows selected track name)
- "Change Track" button/action allows reopening modal

**Empty State:**
- If no tracks available: Display "No tracks available. Tracks may need to be refreshed by an administrator."
- Use `--token-text-secondary` for empty state message

**API Integration:**
- Call `GET /api/v1/tracks` to retrieve track list
- Default: fetch all active tracks (`active=true`, `followed` parameter optional)
- Handle empty results gracefully
- Cache track list in memory for modal performance (refresh on page reload)

**Error Handling:**
- Network errors: Display "Unable to load tracks. Please try again." with retry option
- API errors: Display user-friendly error message based on error code
- Use error token colors (`--token-error-text`) for error messages
- Error messages appear at top of modal or form

**Accessibility:**
- Modal must trap focus (keyboard navigation stays within modal)
- Close button must be keyboard accessible (Escape key closes modal)
- Search input must be auto-focused when modal opens
- Screen reader support: Announce "Track selection modal opened", track names, favourite status
- Focus indicators visible using `--token-interactive-focus-ring`

**Reference:** [API Contracts](../../architecture/liverc-ingestion/05-api-contracts.md#21-get-tracks)

### 1.4 Date Range Selection

**Date Range Picker:**
- Use a **calendar-based date range picker**
- Two date inputs: "Start Date" and "End Date"
- Labels appear directly above each input per [UX Principles](../../design/mre-ux-principles.md) Section 4.1

**Date Input Design:**
- **Mobile:** Native date input (`type="date"`) for best mobile compatibility
- **Desktop:** May use enhanced calendar picker (but must degrade to native input)
- Format dates as ISO date strings (YYYY-MM-DD) for API compatibility
- Display dates in user-friendly format in UI (e.g., "January 15, 2025")
- Use semantic tokens: `--token-surface-elevated` background, `--token-border-default` border
- Minimum 44px height for all inputs

**Date Range Validation:**
- **Maximum Range:** Enforce maximum range of **3 months** (90 days) per search
  - If user selects range > 3 months: Show validation error
  - Error message: "Date range cannot exceed 3 months. Please select a shorter range."
  - Error appears beneath end date field
- **No Future Dates:** Do not allow selecting a **future date**
  - If user attempts to select future date: Validate and show clear error message
  - Error message: "Cannot select future dates. Please select today or earlier."
  - Error appears beneath the relevant date field
  - Disable future dates in calendar picker (gray out or hide)
- **Start Date <= End Date:** Ensure start date is before or equal to end date
  - Error message: "Start date must be before or equal to end date."
  - Error appears beneath start date field

**Validation Display:**
- All validation errors appear directly beneath relevant field per [UX Principles](../../design/mre-ux-principles.md) Section 4.2
- Error messages use error token colors (`--token-error-text`)
- Error messages are concise and actionable
- Form submission disabled until all validation passes
- Real-time validation on blur (not on every keystroke)

**Default Date Range:**
- **Initial Load:** Last 30 days (if no persisted values)
  - Start date: 30 days ago
  - End date: Today
- **After Reset:** Same default (last 30 days)

**Date Range Persistence:**
- Persist **last selected date range** per user
- **Phase 1 (Alpha):** localStorage
  - Key: `mre_last_date_range` (object with `startDate` and `endDate` ISO strings)
  - Persist on form submission
  - Load on page load
- **Future Phase:** Server-side user preferences (do not design DB schema yet)

### 1.5 Form Persistence and Reset

**Persisted Form Values:**
- Persist **last selected track** and **last selected date range** per user
- **Storage:** localStorage (Alpha phase)
- **Load on Page Load:** Restore last selected track and date range
- **Save on Search:** Persist values when user clicks Search button

**Reset Button:**
- Prominent **"Reset"** button located below form (or in form footer)
- Button uses standard outlined/secondary style per [UX Principles](../../design/mre-ux-principles.md) Section 4.3
- **Reset Behavior:**
  - Clears track selection (back to empty/unselected state)
  - Clears date range (back to default: last 30 days)
  - Clears any cached LiveRC results for that search
  - Clears event list/results table
  - Resets form to initial state
- **Confirmation (Optional):** May show confirmation: "Reset search? This will clear your current selections."
- Button text: "Reset" (clear and action-oriented)

**Form Submission:**
- **Search Button:**
  - Full-width on mobile, auto-width on desktop
  - Button text: "Search" (action-oriented)
  - Uses standard outlined/secondary style
  - Shows loading state during API call
  - Disabled during submission to prevent duplicate requests
- **Search Behavior:** See Section 2.1

---

## 2. Event Search Behavior

### 2.1 Search Flow

**On Clicking Search:**

1. **Validate Form:**
   - Track must be selected
   - Start date and end date must be valid
   - Date range must be <= 3 months
   - No future dates
   - If validation fails: Show field-level errors, do not proceed

2. **Query MRE Database:**
   - Call `GET /api/v1/events/search?track_id={track_id}&start_date={start_date}&end_date={end_date}`
   - Display any matching events in event table (see Section 3)
   - Show loading state during API call

3. **If No Events Found in DB:**
   - System should **automatically query LiveRC** for events for that track and date range
   - Show message: "No events found in database. Checking LiveRC..."
   - Call LiveRC discovery endpoint(s) (per architecture docs)
   - Display discovered events in event table with status "New (LiveRC only)"
   - See Section 2.2 for LiveRC discovery details

4. **If Events Found in DB:**
   - Display events in event table with status "Stored" or "Imported"
   - User can still click "Check LiveRC" to discover additional events

**Search Results Display:**
- Event table appears below search form
- See Section 3 for event table specification

### 2.2 LiveRC Discovery

**Discovery vs Import:**
- **Discovery** = asking LiveRC "what events exist for this track and date range?"
- **Import** = persisting a specific event's data into MRE's DB via ingestion pipeline
- Discovery does not import data; it only identifies available events

**LiveRC Retention:**
- For design purposes, assume LiveRC retains only a limited window of historical events per track
- MRE does **not** attempt to import events older than what LiveRC exposes
- MRE does **not** attempt to import events outside the selected date range

**"Check LiveRC" Button:**
- **Location:** Prominent button above or within event table
- **Label:** "Check LiveRC" (clear action)
- **Behavior:**
  - Allows user to manually request a LiveRC check even if DB results exist
  - Triggers discovery of new events from LiveRC for given track and date range
  - Shows loading state: "Checking LiveRC for events..."
  - Calls relevant LiveRC discovery endpoint(s) (per architecture docs)

**Discovery Process:**
- System calls LiveRC discovery endpoint(s)
- New events that are **NOT** already in MRE DB are identified
- Discovered events are displayed in event table with status "New (LiveRC only)"
- Events already in DB are not duplicated in discovery results

**When New Events Are Discovered:**
- New events are displayed in event table with status "New (LiveRC only)"
- User can select one or more events for import using checkboxes
- Checkboxes appear only for importable events (not for already imported events)

**Discovery Error Handling:**
- Network errors: Display "Unable to check LiveRC. Please try again later."
- LiveRC unavailable: Display "LiveRC is temporarily unavailable. Please try again later."
- No new events: Display "No new events found on LiveRC for this search."
- Use error token colors for error messages

**Reference:** [Ingestion Pipeline](../../architecture/liverc-ingestion/03-ingestion-pipeline.md#2-event-catalogue-sync-per-track)

### 2.3 Import Behavior and Statuses

#### 2.3.1 Multi-Select Import

**Selection Mechanism:**
- Checkboxes appear on the right side of each event row (before action buttons)
- Checkboxes are visible only for importable events (status "New (LiveRC only)")
- Already imported events do not show checkboxes
- Checkboxes meet 44px minimum touch target requirement for mobile

**Visual Selection Indicators:**
- Selected events show:
  - Row highlight: `bg-[var(--token-surface-elevated)]` background
  - Border: `border-2 border-[var(--token-accent)]` accent border
  - Smooth transitions for selection state changes

**Bulk Import Action Bar:**
- Appears above event table when events are selected
- Shows count: "X events selected"
- Includes "Select All Importable" button (selects all importable events)
- Includes "Clear Selection" button
- Includes "Import X selected events" button (primary action)
- Action bar is mobile-friendly (full-width on mobile, auto-width on desktop)
- Action bar shows import progress during bulk operations: "Importing X of Y..."

**Selection Persistence:**
- Selected event IDs persist in sessionStorage
- Selection survives page refreshes
- Selection clears automatically after successful bulk import
- Persisted IDs that no longer exist in current results are filtered out

**Import Trigger:**
- Import triggered when user clicks "Import X selected events" button
- Import runs **sequentially** (one event at a time) for selected events
- Import runs **asynchronously** using existing ingestion job pipeline
- See [Ingestion Pipeline](../../architecture/liverc-ingestion/03-ingestion-pipeline.md#3-deep-event-ingestion-on-demand) for technical details

**Sequential Import Behavior:**
- Events are imported one at a time in the order they appear in the list
- Each event's status updates individually as import progresses
- If one event fails, import continues with remaining events
- Failed events can be retried individually

#### 2.3.2 Import Status Flow

**Atomic Unit of Import:**
- For UX purposes, treat the **entire event** as the atomic unit
- Either the whole event is successfully imported or it is considered a failure
- No partial import states visible to end-user

**Per-Event Status Updates:**

1. **Import Started (per event):**
   - Status column shows: `Importing` for the event being imported
   - Status tag uses loading/spinner indicator (optional)
   - Other selected events remain in "New" status until their turn

2. **Import Success (per event):**
   - Status in table updates to: `Stored` or `Imported`
   - Event becomes available for analysis
   - "Analyse event" button becomes enabled

3. **Import Failure (per event):**
   - Status in table: `Failed import` (with red tag/indicator)
   - Failed events remain in table with failed status
   - User can retry import for failed events individually

**Bulk Import Completion:**
- After all selected events complete (success or failure):
  - Event list refreshes to show updated statuses
  - Each event's status is visible in the table (imported/failed)
  - Selection clears automatically
  - Failed events remain visible for retry

**Status Updates:**
- Status updates occur in real-time during sequential import
- Each event's status updates individually as its import completes
- Status changes are visible without page reload
- Final refresh after bulk import completes shows all updated statuses

**Partial Imports:**
- UX and docs assume **atomicity** (no partial state visible to end-user)
- Internally partial states may exist, but driver sees only "imported" or "failed import"
- If event is partially imported, treat as "failed import" from user perspective

**Re-Import Behavior:**
- If system already has stored data for an event:
  - Always prefer to use that data rather than trying to re-import
  - Show status: `Stored` or `Imported`
  - Future: "Force Refresh" option may be designed (not in Alpha)

**Import Error Details:**
- Do **NOT** design a complex log viewer in Alpha
- Keep error messaging simple:
  - "Import failed" with event name
  - Optional: Brief reason if helpful (e.g., "LiveRC data unavailable")
  - Technical details logged server-side only

**Reference:** [Ingestion Pipeline](../../architecture/liverc-ingestion/03-ingestion-pipeline.md#3-deep-event-ingestion-on-demand)

### 2.4 Caching and Quotas

**Default Behavior:**
- **Rely on DB results** for a given track + date range
- Only call LiveRC when:
  - User explicitly presses "Check LiveRC" **OR**
  - No DB results exist (automatic LiveRC check)

**Caching Strategy:**
- Cache DB search results in memory (cleared on page reload)
- Do not cache LiveRC discovery results (always fetch fresh)
- Clear cache when user clicks Reset button

**Global Import/Discovery Quota:**
- Design should mention the idea of a **global import / discovery quota**
- Purpose: Prevent abuse and unnecessary load on LiveRC
- **Note:** Do NOT fully design the quota system or storage in this task
- Quota system is a future consideration for production

**Import Scope:**
- MRE does not attempt to import events outside both:
  - The selected date range
  - The range of events actually exposed by LiveRC for that track

**User Contribution:**
- Any logged-in Driver can contribute to populating the MRE database by using Event Search and triggering LiveRC discovery/import
- This is an intentional design: users help build the database through normal usage

---

## 3. Event List / Table UX

### 3.1 Table Structure

**Layout:**
- Event table appears below Event Search form
- **Mobile:** Single-column list format (cards or stacked rows)
- **Desktop (900px+):** Table format with columns
- Table must degrade to list format on mobile per [Mobile UX Guidelines](../../design/mre-mobile-ux-guidelines.md) Section 10

**Columns:**
1. **Checkbox** (for importable events only, desktop: leftmost column, mobile: inline with row)
2. **Event Name** (primary column, left-aligned)
3. **Event Date** (formatted user-friendly, e.g., "November 16, 2025")
4. **Status** (status tag/badge, right-aligned)

**Table Headers:**
- Headers visible on desktop only
- Headers use `--token-text-secondary`
- Headers are keyboard accessible
- Screen reader support: Proper `<th>` elements with scope
- Checkbox column header includes "Select All Importable" checkbox (only selects importable events)

**Row Display:**
- Each row represents one event
- Minimum 44px height for touch targets
- Hover/tap feedback (subtle background color change)
- Consistent spacing between rows (16px)

**Event Name Column:**
- Display full event name (truncate with ellipsis if too long)
- Use `--token-text-primary` for event name
- Event name is primary identifier

**Event Date Column:**
- Format: User-friendly (e.g., "November 16, 2025")
- Use `--token-text-secondary` for date
- Sortable (see Section 3.2)

**Status Column:**
- Status displayed as tag/badge
- Visual distinction using colors and icons
- See Section 3.3 for status values and styling

### 3.2 Sorting

**Sortable Columns:**
- Allow sorting by **Event Date** (default: most recent first)
- Allow sorting by **Event Name** (alphabetical)
- Sorting controls: Click column header to sort (desktop) or dropdown (mobile)

**Sort Indicators:**
- Show sort direction (ascending/descending) with arrow icon
- Active sort column highlighted subtly
- Default sort: Event Date (descending - most recent first)

**Sort Behavior:**
- Click once: Sort ascending
- Click again: Sort descending
- Click third time: Return to default (most recent first)
- Maintain sort state during session (cleared on Reset)

**Mobile Sorting:**
- On mobile, use dropdown: "Sort by: Event Date" or "Sort by: Event Name"
- Dropdown meets 44px height requirement
- Sort direction toggle within dropdown

### 3.3 Status Values and Visual Distinction

**Status Values:**

1. **`Stored` / `Imported`**
   - Event exists in MRE DB with full data
   - Visual: Green tag/badge with checkmark icon (optional)
   - Text color: `--token-text-primary` on green background
   - Meaning: Event is ready for analysis

2. **`New (LiveRC only)`**
   - Discovered on LiveRC, not yet imported
   - Visual: Blue tag/badge with info icon (optional)
   - Text color: `--token-text-primary` on blue background
   - Meaning: Event available for import

3. **`Importing`**
   - Currently being imported via async job
   - Visual: Yellow/amber tag/badge with spinner/loading icon
   - Text color: `--token-text-primary` on yellow background
   - Meaning: Import in progress

4. **`Failed import`**
   - Last import attempt failed
   - Visual: Red tag/badge with error icon (optional)
   - Text color: `--token-text-primary` on red background
   - Meaning: Import failed, can retry

5. **`LiveRC discovery only`** (Optional label)
   - Used if you want explicit label showing "not in MRE yet, only discovered"
   - Alternative to "New (LiveRC only)" if more clarity needed

**Visual Distinction:**
- Events already in DB vs newly discovered vs failed imports must be visually distinct
- Use status tags with consistent styling
- Status tags use semantic colors aligned with dark theme
- Icons (optional) enhance clarity but are not required (text-only is acceptable)

**Status Tag Design:**
- Rounded corners (4px radius)
- Padding: 4px horizontal, 2px vertical (minimum)
- Font size: 12-13px (readable on mobile)
- Consistent height across all status tags

### 3.4 Selecting an Event

**Two Types of Selection:**

1. **Checkbox Selection (for Import):**
   - Checkboxes appear on importable events (status "New (LiveRC only)")
   - Used to select multiple events for bulk import
   - Checkboxes are disabled during bulk import operations
   - See Section 2.3.1 for multi-select import workflow

2. **"Analyse event" Button (for Navigation):**
   - Button appears on imported events (status "Stored" or "Imported")
   - Used to navigate to Event Analysis page for a single event
   - Button located in rightmost column (or bottom of card on mobile)

**"Analyse event" Button:**
- Button text: "Analyse event" (action-oriented, British spelling per project conventions)
- Button uses standard outlined/secondary style
- Minimum 44px height
- Full-width on mobile (within card), auto-width on desktop
- Button disabled for events with status "Importing" or "Failed import" (until import completes/retries)

**Navigation:**
- Clicking "Analyse event" navigates to **Event Analysis page** for that event
- Do **NOT** rely on row-click to navigate (keep explicit button for clarity)
- Navigation preserves event context (event ID in URL, not exposed as raw ID to user)

**Button States:**
- **Enabled:** Events with status "Stored" or "Imported"
- **Disabled:** Events with status "Importing" (show tooltip: "Import in progress")
- **Disabled:** Events with status "Failed import" (show tooltip: "Import failed. Please retry import.")
- **Not Shown:** Events with status "New (LiveRC only)" (use checkbox to import first)

**No Internal IDs:**
- Table must **never display internal MRE IDs or raw LiveRC IDs** to the user
- URLs may contain IDs but should use slugs or encoded identifiers (not raw numeric IDs)
- User-facing text shows only event names and dates

### 3.5 Empty States

**No Results:**
- If there are NO events in DB and LiveRC check finds nothing:
  - Show friendly empty-state message:
    - **"No events found for this track and date range. Try changing your dates or selecting a different track."**
  - Do not show empty table with no explanation
  - Provide action: "Reset Search" button or link to modify search

**Empty State Design:**
- Centered message (on desktop) or top-aligned (on mobile)
- Use `--token-text-secondary` for message text
- Icon (optional): Calendar or search icon
- Action button: "Reset Search" or "Modify Search"

**Loading State:**
- Show loading indicator while fetching events
- Skeleton placeholders maintain layout structure
- Loading state: "Searching for events..."

---

## 4. Event Analysis Page UX

### 4.1 General

**Access:**
- Event Analysis page is only accessible for authenticated users
- Accessed via "Analyse event" button from Event Search results
- URL structure: `/events/analyse/{event-slug}` or `/events/analyse/{event-id}` (implementation detail)
- URL does not expose raw IDs or slugs to user (use encoded identifiers)

**Deep Links (Future):**
- You do NOT need to design sharable deep links as a hard requirement in this phase
- Future: Deep links may allow sharing specific event analysis views

**Page Requirements:**
- Must follow [MRE UX Principles](../../design/mre-ux-principles.md)
- Must follow [MRE Mobile UX Guidelines](../../design/mre-mobile-ux-guidelines.md)
- Must follow [MRE Dark Theme Guidelines](../../design/mre-dark-theme-guidelines.md)
- Use semantic theme tokens (dark theme is default, but theme system supports experimentation)

**Page Header:**
- Display event name prominently (h1)
- Display event date (formatted user-friendly)
- Display track name (secondary text)
- Back button/link: "← Back to Event Search"

### 4.2 Page Structure

**Tab Navigation:**
- Page uses **tab-based navigation** (exception to Alpha "no tabs" rule, as this is core Event Analysis functionality)
- Tabs:
  1. **Overview** (default tab)
  2. **Drivers**
  3. **Sessions / Heats**
  4. **Comparisons**

**Tab Design:**
- Tabs displayed horizontally (desktop) or scrollable horizontal list (mobile)
- Active tab highlighted with accent color (`--token-accent`)
- Inactive tabs use `--token-text-secondary`
- Tab labels meet 44px height requirement
- Tabs are keyboard navigable (arrow keys switch tabs)

**Tab Content:**
- Each tab shows different view of event data
- Tab content loads on demand (lazy load if needed)
- Maintain tab state during session (remember last viewed tab)

### 4.3 Overview Tab

**Main Highlights Graph:**
- On Overview tab, include a **primary highlights chart** that gives a quick "at a glance" summary
- Chart must be **interactive** (not static screenshot)
- Chart examples:
  - **Best lap per driver:** Bar chart or list showing fastest lap time per driver
  - **Average lap vs fastest lap:** Comparison chart showing consistency

**Chart Interactivity:**
- **Driver Selection:** Allow selecting/unselecting drivers
  - Checkboxes or toggle buttons for each driver
  - Selected drivers highlighted in chart
  - Unselected drivers grayed out or hidden
- **Metric Switching:** Allow switching metric (e.g., lap time vs gap)
  - Dropdown or toggle: "Show: Lap Time" or "Show: Gap to Leader"
  - Chart updates dynamically

**Chart Design:**
- Chart uses dark theme colors
- Chart is responsive (scales to container width)
- Chart has proper labels and legends
- Chart is accessible (screen reader support, keyboard navigation)

**Other Overview Content:**
- Event summary statistics:
  - Total races/sessions
  - Total drivers
  - Total laps recorded
  - Date range of races
- Quick links to key races/sessions
- Recent activity (if applicable)

### 4.4 Drivers Tab

**Driver List:**
- Display all drivers who participated in event
- List format (mobile) or table format (desktop)
- Columns/fields:
  - Driver name
  - Number of races participated
  - Best lap time
  - Average lap time
  - Consistency score (if available)

**Driver Selection:**
- Allow selecting drivers for comparison
- Multi-select checkboxes or toggle buttons
- Selected drivers can be compared in Comparisons tab

**Driver Details:**
- Clicking driver (or "View Details" button) shows:
  - Driver's race results summary
  - Lap time distribution
  - Position changes over races
  - Individual race performances

### 4.5 Sessions / Heats Tab

**Session List:**
- Display all races/sessions/heats for the event
- Grouped by class (e.g., "1/8 Nitro Buggy", "1/8 Electric Buggy")
- Each session shows:
  - Session name (e.g., "A-Main", "B-Main", "Qualifying Round 1")
  - Class name
  - Date/time
  - Number of drivers
  - Duration

**Session Selection:**
- Allow filtering by class or session type
- Filter dropdowns: "All Classes" or specific class
- Filter by session type: "All Sessions", "Mains Only", "Qualifying Only"

**Session Details:**
- Clicking session shows race results for that session
- Results displayed in table format (mobile: list format)
- Results show: Position, Driver, Laps, Total Time, Fast Lap, Average Lap

### 4.6 Comparisons Tab

**Comparison Interface:**
- Compare selected drivers side-by-side
- Driver selection from Drivers tab or inline selection in Comparisons tab

**Comparison Charts:**
- **Lap Time Comparison:** Overlay multiple drivers' lap times on same graph
  - X-axis: Lap number
  - Y-axis: Lap time (seconds)
  - Multiple lines (one per driver) with different colors
  - Legend shows driver names and colors
- **Position Over Time:** Show position changes for selected drivers
  - X-axis: Race time (elapsed)
  - Y-axis: Position (1, 2, 3, etc.)
  - Lines show position changes over race
- **Gap Analysis:** Show time gap to leader for selected drivers
  - X-axis: Lap number or race time
  - Y-axis: Gap (seconds)

**Chart Controls:**
- **Driver Selection:** Multi-select drivers to compare
- **Metric Selection:** Choose what to compare (lap time, position, gap)
- **Zoom/Pan:** Allow zooming into specific race segments (if chart library supports)
- **Export:** Export comparison data to CSV (see Section 4.8)

**Comparison Table:**
- Optional: Side-by-side table comparing key metrics
- Columns: Driver Name, Best Lap, Average Lap, Consistency, Total Laps, etc.
- Table scrollable horizontally on mobile

### 4.7 Interactivity and Filters

**Driver Selection:**
- **Multi-Select Drivers:** Allow selecting multiple drivers for visualization
  - Checkboxes or toggle buttons
  - Selected drivers highlighted
  - Selection persists across chart views
- **Quick Select:** "Select All", "Select Top 3", "Select Top 5" buttons
- **Clear Selection:** "Clear Selection" button

**Filtering:**
- **Filter by Class:** Dropdown to filter by race class
  - "All Classes" or specific class (e.g., "1/8 Nitro Buggy")
- **Filter by Session:** Filter by heat/main/qualifying
  - "All Sessions", "Mains Only", "Qualifying Only", "Heats Only"
- **Filter by Date Range:** If event spans multiple days, filter by date
  - Date range picker (same as Event Search)

**Chart Interactions:**
- **Hover/Tooltip:** Show detailed data on hover (desktop) or tap (mobile)
  - Tooltip shows: Lap number, Lap time, Driver name, Position
- **Click Data Point:** Clicking data point may show detailed lap information
- **Zoom/Pan:** Allow zooming into specific time ranges (if supported by chart library)
- **Reset Zoom:** "Reset View" button to return to full race view

**UX for Driver Analysis:**
- Design explicitly supports driver who wants to:
  - **Compare their laps against fastest driver in main:**
    - Select "My Driver" and "Fastest Driver" from driver list
    - View lap time comparison chart
    - See gap analysis
  - **Quickly see where they lost the most time:**
    - View lap time graph with spikes highlighted
    - Identify slowest laps (visual indicators)
    - See consistency score and drop-off points

### 4.8 Exports

**Export Functionality:**
- Event Analysis supports **export to CSV only** in Alpha
- Export action appears in multiple locations:
  - **Page-level export:** Button in page header ("Export All Data")
  - **Per-tab export:** Tab-specific export buttons ("Export Overview Data", "Export Driver Data", etc.)
  - **Per-chart export:** Export button within chart controls ("Export Chart Data")

**Exportable Data:**
- **Lap Times Table:** All lap times for selected drivers/sessions
  - Columns: Driver Name, Lap Number, Lap Time, Position, Elapsed Time
- **Driver Comparison Dataset:** Side-by-side driver metrics
  - Columns: Driver Name, Best Lap, Average Lap, Consistency, Total Laps, etc.
- **Race Results:** Complete race results for selected sessions
  - Columns: Position, Driver, Laps, Total Time, Fast Lap, Average Lap
- **Session Summary:** Summary statistics for all sessions
  - Columns: Session Name, Class, Date, Drivers, Duration, etc.

**Export Behavior:**
- Clicking export button triggers CSV download
- File naming: `{event-name}_{data-type}_{timestamp}.csv`
- CSV format: Standard CSV with headers
- Export includes only visible/filtered data (respects current filters and selections)

**Export Button Design:**
- Button uses standard outlined/secondary style
- Button text: "Export to CSV" or "Download CSV"
- Button icon: Download icon (optional)
- Minimum 44px height

**Export Limitations (Alpha):**
- CSV export only (no PDF, Excel, JSON in Alpha)
- Export includes basic data (no advanced aggregations)
- Export may be limited to current view (not full event data)

---

## 5. Mobile and Accessibility

### 5.1 Mobile-First Design

**All Event Search and Event Analysis behavior must be mobile-first:**
- Single-column layouts on mobile (0-899px)
- Two-column layouts only on desktop (900px+)
- Touch targets minimum 44px height
- No hover-only interactions
- Responsive breakpoints: 0-599px (mobile), 600-899px (tablet), 900px+ (desktop)

**Mobile-Specific Considerations:**
- **Track Modal:** Full-screen on mobile, centered modal on desktop
- **Date Picker:** Native date input on mobile for best UX
- **Event Table:** List format on mobile, table format on desktop
- **Charts:** Responsive charts that scale to mobile width
- **Tabs:** Scrollable horizontal tabs on mobile if needed

### 5.2 Touch Target Requirements

**All interactive elements:**
- Minimum 44px height (Apple HIG standard)
- Minimum 8-12px spacing between touch targets
- Clear visual feedback on tap (opacity change, background color change)
- No tiny buttons or links

**Applies to:**
- Track selection buttons
- Date inputs
- Search/Reset buttons
- Event table rows
- "Analyse event" buttons
- Tab navigation
- Chart controls
- Export buttons

### 5.3 Accessibility (WCAG AA)

**Keyboard Navigation:**
- All interactive elements keyboard accessible
- Tab order logical and predictable
- Focus indicators visible (`--token-interactive-focus-ring`)
- Modal traps focus (keyboard navigation stays within modal)
- Escape key closes modals

**Screen Reader Support:**
- Semantic HTML (proper headings, lists, tables)
- ARIA labels for interactive elements
- Status announcements (loading, success, errors)
- Chart data described in text (or data table alternative)
- Form labels properly associated with inputs

**Color Contrast:**
- Text meets WCAG AA contrast ratios
- Status tags have sufficient contrast
- Chart colors distinguishable (not color-only indicators)
- Error messages high contrast

**Focus Management:**
- Focus moves logically through form
- Focus returns to appropriate element after modal close
- Focus management during async operations (import, search)

**Error Handling:**
- Errors announced to screen readers
- Error messages clear and actionable
- Validation errors associated with form fields

---

## 6. Track Renames / Relationships (Concept Only)

**Track Name Changes:**
- It is common for a track to change name over time
- For this task, do **NOT** design a full aliasing system

**Future Consideration:**
- Add a section noting that **MRE may later support track aliases**
- Multiple LiveRC track names may map to a single canonical internal track
- Event Search UI could display subtle note: "Also raced as [Old Name]" when alias information exists

**Implementation Note:**
- Do not change schemas or implement this now
- Just document it as a future consideration
- Track aliasing is a Beta+ feature

---

## 7. Error and Empty States

### 7.1 Error States

**Network Errors:**
- Display: "Unable to load data. Please check your connection and try again."
- Provide retry button
- Use error token colors

**API Errors:**
- Display user-friendly message based on error code
- Avoid technical jargon
- Provide actionable next steps

**Validation Errors:**
- Field-level errors beneath relevant fields
- Concise, actionable messages
- Real-time validation on blur

**Import Errors:**
- "Import failed for [Event Name]. Please try again later."
- Status tag shows "Failed import"
- Retry option (future feature)

### 7.2 Empty States

**No Tracks:**
- "No tracks available. Tracks may need to be refreshed by an administrator."

**No Events:**
- "No events found for this track and date range. Try changing your dates or selecting a different track."

**No Race Data:**
- "No race data available. Event may need to be ingested."

**No Lap Data:**
- "No lap data available for this result."

**Empty State Design:**
- Centered or top-aligned message
- Icon (optional)
- Action button or link
- Use `--token-text-secondary` for message text

---

## Related Documentation

- **[LiveRC Ingestion Overview](../../architecture/liverc-ingestion/01-overview.md)** - Technical architecture and system overview
- **[Ingestion Pipeline](../../architecture/liverc-ingestion/03-ingestion-pipeline.md)** - Backend ingestion logic and flow
- **[API Contracts](../../architecture/liverc-ingestion/05-api-contracts.md)** - API endpoints used by frontend
- **[MRE Version 0.1.1 Feature Scope](../../specs/mre-v0.1-feature-scope.md)** - version 0.1.1 feature specifications and constraints
- **[MRE UX Principles](../../design/mre-ux-principles.md)** - Core UX principles and patterns
- **[MRE Mobile UX Guidelines](../../design/mre-mobile-ux-guidelines.md)** - Mobile-first design requirements
- **[MRE Dark Theme Guidelines](../../design/mre-dark-theme-guidelines.md)** - Visual design standards
- **[Mobile-Safe Architecture Guidelines](../../architecture/mobile-safe-architecture-guidelines.md)** - API-first architecture and separation of concerns

---

## Design Guidelines Compliance

All UI/UX specifications in this document must comply with:

- **[MRE UX Principles](../../design/mre-ux-principles.md)** - Single-column layouts (mobile), mobile-first design, clear error handling, consistency
- **[MRE Mobile UX Guidelines](../../design/mre-mobile-ux-guidelines.md)** - Touch targets (44px minimum), spacing scale, responsive behavior, keyboard-friendly
- **[MRE Dark Theme Guidelines](../../design/mre-dark-theme-guidelines.md)** - Semantic tokens (`--token-*`), dark theme, typography rules, spacing scale
- **[Mobile-Safe Architecture Guidelines](../../architecture/mobile-safe-architecture-guidelines.md)** - API-first design, separation of concerns, business logic in `src/core/`

## Implementation Notes

- All API calls must use versioned endpoints: `/api/v1/...`
- Business logic must reside in `src/core/` directories, not in UI components
- Error handling must follow standard API error format
- All UI components must be mobile-first and accessible (WCAG AA)
- Form persistence uses localStorage in Alpha (future: server-side preferences)
- Event Analysis charts are interactive (not static) - use appropriate charting library
- Export functionality limited to CSV in Alpha
- Status updates via polling or WebSocket (implementation detail)

---

## Version 0.1.1 Scope Considerations

**Note on Tables and Charts:**
Version 0.1.1 explicitly includes tables and charts as in-scope features. Event Search and Event Analysis are core features of the LiveRC ingestion subsystem, which is fully in version 0.1.1 scope. Therefore:

- **Event Search table** is required for displaying search results with full sorting, filtering, and pagination support
- **Event Analysis charts** are required for core functionality with interactive visualizations
- Tables and charts are fully implemented features in version 0.1.1 (see [MRE Version 0.1.1 Feature Scope](../../specs/mre-v0.1-feature-scope.md) Sections 2.8 and 2.10)

This document defines the complete experience for version 0.1.1, including all table and chart functionality.

---

End of user-workflow.md
