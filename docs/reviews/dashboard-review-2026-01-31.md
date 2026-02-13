# Dashboard Review

**Review date:** 2026-01-31  
**Scope:** Authenticated dashboard (overview page, event selection, event analysis section, shell, state, and APIs).  
**Purpose:** Complete review of dashboard behaviour, architecture, UX, performance, and maintainability, with concrete improvement suggestions.

---

## 1. What Was Reviewed

| Area | Paths / Notes |
|------|----------------|
| Dashboard page | `src/app/(authenticated)/dashboard/page.tsx` |
| Dashboard client | `src/components/organisms/dashboard/DashboardClient.tsx` |
| Event analysis section | `src/components/organisms/dashboard/EventAnalysisSection.tsx` |
| Dashboard shell | `DashboardLayout`, `TopStatusBar`, `AdaptiveNavigationRail`, `ContextRibbon`, `CommandPalette`, `EventSearchModal` |
| State & data | `src/store/slices/dashboardSlice.ts`, `types/dashboard.ts` |
| Core logic | `src/core/events/get-sessions-data.ts`, `get-event-analysis-data.ts` |
| APIs | `/api/v1/events/[eventId]/summary`, `/api/v1/events/[eventId]/analysis`, `/api/v1/events/[eventId]/weather` |
| Related review | `docs/reviews/Old/dashboard-performance-review.md` (Feb 2025) |

---

## 2. Executive Summary

The dashboard is **event-centric**: the user selects an event, then sees analysis (tabs: Overview, Sessions, Comparisons, Entry List, Drivers). The main problems are **structural and UX**, not missing features:

1. **Empty main surface:** When an event is selected, `DashboardClient` renders an **empty flex container**. All meaningful content (driver cards, weather, tabs) lives in `EventAnalysisSection`, and the hero/KPI surface is effectively removed (DashboardHero returns `null`). The user lands on a blank strip above the analysis section.
2. **Dual fetch and split responsibility:** Summary (`/summary`) and full analysis (`/analysis`) are fetched separately. Summary drives “at a glance” data; analysis drives tabs. Weather is fetched in **two places** (DashboardClient and EventAnalysisSection) with different robustness (only DashboardClient uses AbortController).
3. **Driver cards and weather are tab-scoped:** The driver carousel and weather grid live only inside the **Overview** tab. Users who open Sessions or Drivers first never see that at-a-glance surface unless they switch tabs.
4. **Performance debt** from the Feb 2025 review is partly addressed (weather abort, request ID dedup) but **getSessionsData** still does duplicate work (two full `calculateSessionMetrics` passes), and **DriverCardsAndWeatherGrid** still has heavy per-render work and no visibility/reduced-motion guards for the carousel.
5. **Dead and oversized code:** `DashboardClient` contains a large block of unused UI (DashboardHero returning null, KpiCard, Sparkline, TelemetrySnapshot, AlertStack, ActivityTimeline, etc.) and a 900+ line exported `DriverCardsAndWeatherGrid` in the same file, which hurts readability and reuse.

If you fix only a few things, focus on: **(A)** restoring a visible “at a glance” surface when an event is selected (hero/summary + driver cards + weather above the fold), **(B)** a single source of truth for weather and consistent fetch behaviour, **(C)** removing duplicate work in `getSessionsData`, and **(D)** cleaning up DashboardClient (remove dead code, extract DriverCardsAndWeatherGrid).

---

## 3. Architecture and Structure

### 3.1 Page composition

- **Dashboard page** (server): Renders `DashboardEventSelector` (syncs `eventId` query → Redux), `DashboardEventSearchProvider`, `DashboardClient`, and `EventAnalysisSection` in a single column.
- **DashboardClient**: Handles rehydration, loading, and empty/error states. When an event **is** selected and loaded, it returns only `<div className="flex flex-col gap-[var(--dashboard-gap)]">` with **no children**. So the “dashboard” above the analysis section is blank.
- **EventAnalysisSection**: Renders only when `selectedEventId` is set. It fetches analysis data and weather, then shows header, tab nav, and tab content. **DriverCardsAndWeatherGrid** and weather are rendered only when `activeTab === "overview"`.

Result: The “dashboard” is really “event selector + analysis section.” There is no dedicated at-a-glance hero/KPI strip; any such UI that existed is now dead (DashboardHero returns null) or hidden inside the Overview tab.

### 3.2 Data flow

- **Event selection:** `DashboardEventSelector` or shell (e.g. event search) dispatches `selectEvent(id)`. Slice clears previous `eventData`/`analysisData` and sets `isEventLoading`.
- **Summary:** `DashboardClient` runs `fetchEventData(selectedEventId)` (async thunk → `/api/v1/events/[id]/summary`). Result is stored in `eventData` (EventAnalysisSummary: event meta, topDrivers, mostConsistentDrivers, etc., and userBestLap/userBestConsistency/userBestAvgLap/userBestImprovement).
- **Analysis:** `EventAnalysisSection` runs `fetchEventAnalysisData(selectedEventId)` (→ `/api/v1/events/[id]/analysis`). Result is stored in `analysisData` (races, drivers, entryList, raceClasses, summary). A 50ms timeout is used before dispatching to avoid races.
- **Weather:** Fetched in **DashboardClient** (with AbortController and event-id check) and again in **EventAnalysisSection** (plain fetch, no abort, no cache). Only EventAnalysisSection’s weather is passed into `DriverCardsAndWeatherGrid`, so DashboardClient’s weather is unused when an event is selected.

So: two API calls for event data (summary + analysis), and two independent weather fetches, with only one of them used by the visible UI.

### 3.3 Shell and context

- **DashboardLayout:** Wraps content with `AdaptiveNavigationRail`, `TopStatusBar`, and `CommandPalette`. Density and nav collapse come from `uiSlice`.
- **TopStatusBar:** Command palette trigger, user profile. No event context in the bar itself.
- **ContextRibbon:** Opens event search modal and dispatches `selectEvent`; it does not display the current event name in the ribbon (button is generic).
- **Event selector:** `DashboardEventSelector` is the only component that syncs `?eventId=` into Redux; it then removes the query param so the URL does not reflect the selected event.

Implication: The current event is not visible in the shell (e.g. “Event: X at Y”). Users infer context from the analysis header and tabs only.

---

## 4. UX and Information Architecture

### 4.1 First impression when an event is selected

- User selects an event (search or link with `?eventId=`).
- They see: loading → then **empty space** (DashboardClient’s empty div) → then `EventAnalysisSection`: header (event name, date, track), tab bar, and **by default** Overview tab content.
- On Overview they see driver cards carousel + user metric card + weather. So the “dashboard” feel (glanceable summary) exists only after opening the Overview tab.

**Suggestion:** When an event is selected, show an at-a-glance strip **above** the tab bar: event context (name, date, track), a compact summary (e.g. total races/drivers/laps from summary), driver cards carousel, and weather. Then the tab bar and tab content follow. That strip can be implemented by having DashboardClient render a compact hero + DriverCardsAndWeatherGrid (or a slim variant) using `eventData` and shared weather, so the same content is not hidden behind the Overview tab only.

### 4.2 Driver cards and weather placement

- Driver cards and weather live only in **Overview**.
- Users who land on Sessions, Drivers, or Entry List first do not see driver cards or weather unless they switch to Overview.

**Suggestion:** Either (1) move driver cards + weather **above** the tab bar so they are always visible when analysis is loaded, or (2) keep them in Overview but add a small “Summary” or “At a glance” block in the shell or above the tabs that at least shows event + weather + link “See overview for driver highlights.”

### 4.3 Event context in the shell

- The shell does not show “Current event: …”.
- ContextRibbon opens event search but does not display the selected event name.

**Suggestion:** When an event is selected, show the event name (and optionally track/date) in the top bar or in the ContextRibbon (e.g. “Event: X at Y” with a button to change). That supports quick confirmation and deep-linking expectations.

### 4.4 URL and deep linking

- `eventId` is applied from `?eventId=` then **removed** from the URL. Reload or sharing the dashboard URL does not preserve the selected event.

**Suggestion:** Consider keeping `?eventId=` in the URL (or using a path like `/dashboard/[eventId]`) when an event is selected, so refresh and shared links restore the same event. If you keep removing it for “clean” URLs, document that as a product choice and ensure the shell or a toast makes “current event” obvious.

### 4.5 Tab order and naming

- Tabs: Event Overview, Event Sessions, Comparisons, Comparison Test, Entry List, Drivers.
- “Comparison Test” reads like a dev/debug tab.

**Suggestion:** If Comparison Test is for production, rename to something user-facing (e.g. “Compare drivers” or “Comparison tool”). If it is temporary, move it to a dev-only route or remove it from the main tab list.

---

## 5. Data and API

### 5.1 Summary vs analysis

- **Summary** (`/api/v1/events/[eventId]/summary`): Returns EventAnalysisSummary (event, summary stats, topDrivers, mostConsistentDrivers, bestAvgLapDrivers, mostImprovedDrivers, userBestLap, etc.). Used by DashboardClient and passed into EventAnalysisSection for DriverCardsAndWeatherGrid.
- **Analysis** (`/api/v1/events/[eventId]/analysis`): Returns full EventAnalysisData (event, races, drivers, entryList, raceClasses, summary). Used for all tabs.

Both are fetched when an event is selected; summary is typically smaller and faster. Having two endpoints is reasonable for progressive loading, but the UI does not currently use summary for an above-the-fold hero (DashboardClient renders nothing). So the only consumer of summary for visible UI is EventAnalysisSection’s DriverCardsAndWeatherGrid.

**Suggestion:** If you restore a hero/summary strip in DashboardClient, you can show summary-based KPIs and driver highlights as soon as `eventData` is ready, before or while analysis loads. That would justify the dual fetch and improve perceived performance.

### 5.2 Weather

- **DashboardClient:** Fetches weather when `selectedEvent?.id` is set; uses AbortController; checks `eventId` before updating state; no in-memory cache.
- **EventAnalysisSection:** Fetches weather when `selectedEventId` is set; no AbortController; no cache; no late-response guard.

Only EventAnalysisSection’s weather is passed to `DriverCardsAndWeatherGrid`, so DashboardClient’s fetch is redundant and less robust.

**Suggestion:** Fetch weather in **one place** (e.g. DashboardClient or a small `useEventWeather(selectedEventId)` hook used by the dashboard layout or EventAnalysisSection). Pass weather down as props or via shared state (e.g. Redux or context). Add AbortController and optional short-lived cache (e.g. per eventId in a ref) so rapid event switching does not cause duplicate requests or wrong-event state.

### 5.3 Types

- `types/dashboard.ts`: EventAnalysisSummary, ImportedEventSummary, DensityPreference. Clear and sufficient for the dashboard surface.
- Slice and API response types (e.g. EventAnalysisDataApiResponse with ISO date strings) are defined in the slice file; transformation to Date happens in EventAnalysisSection. Consider centralising API response types (e.g. in `types/` or `api/`) if more consumers need them.

---

## 6. Performance

### 6.1 Already improved (since Feb 2025 review)

- **Weather:** DashboardClient uses AbortController and event-id checks. EventAnalysisSection still does not.
- **Stale responses:** dashboardSlice uses `currentFetchRequestId` so only the latest fetchEventData response updates state.
- **Rehydration:** Both DashboardClient and EventAnalysisSection wait for `_persist.rehydrated` before showing empty/loading, reducing flicker.

### 6.2 Duplicate work in getSessionsData

In `src/core/events/get-sessions-data.ts`, `getSessionsData` does:

```ts
let sessions = data.races.map((race) => calculateSessionMetrics(race, driverNameLookup))
// ... filter/sort sessions ...
const allSessions = data.races.map((race) => calculateSessionMetrics(race, driverNameLookup))
const availableClasses = getAvailableClasses(allSessions)
```

So `calculateSessionMetrics` runs twice over the same races. For large events this doubles CPU for that path.

**Suggestion:** Compute `allSessions` once, derive `availableClasses` from it, then filter/sort a copy (or the same array if mutating is acceptable) for `sessions`. Same pattern as in the Feb 2025 dashboard-performance-review (Phase 1).

### 6.3 DriverCardsAndWeatherGrid

- **Memoization:** `getAllClasses()` and per-section grouping (e.g. `groupDriversByClass`) run on every render. The Feb 2025 review suggested memoizing these keyed by section data (topDrivers, mostConsistentDrivers, etc.) so the 5s carousel tick does not recompute everything.
- **Auto-scroll:** The 5s interval still runs regardless of visibility (tab hidden, hero scrolled out of view) and does not respect `prefers-reduced-motion`. The old review suggested IntersectionObserver + visibilitychange + reduced-motion check.

**Suggestion:** Implement the memoization and visibility/reduced-motion behaviour as in the Feb 2025 review so the carousel does not burn CPU when not visible and so each tick is cheap.

### 6.4 OverviewTab and SessionsTab

- The Feb 2025 review called out multiple full passes over race data in OverviewTab and O(n·m) driver ID checks in SessionsTab (e.g. `selectedDriverIds.includes` in loops). Converting driver ID lists to `Set` and consolidating OverviewTab into a single preprocessing step would reduce work on large events. Worth re-profiling and applying if those tabs are still hot.

---

## 7. Accessibility and Responsiveness

- **Carousel:** Section indicators and prev/next buttons have aria-labels; snap scrolling is used. Missing: `prefers-reduced-motion` (stop or slow auto-scroll), and optional live region for “Section N of M” when the section changes.
- **Loading and errors:** Loading and error states are visible and have retry where applicable. Ensure error messages are announced (e.g. role="alert" or aria-live).
- **Density:** UI slice has density (compact/comfortable/spacious); DashboardLayout applies `data-density`. Confirm that dashboard cards and typography actually respond to density tokens so the setting has visible effect.

---

## 8. Code Quality and Maintainability

### 8.1 Dead and unused code in DashboardClient

- **DashboardHero:** Returns `null`. All caller comments say hero/analysis were moved to EventAnalysisSection; the component is effectively dead.
- **Unused components/functions in the same file:** KpiCard, Sparkline, TelemetrySnapshot, TelemetryPath, AlertStack, ActivityTimeline, DataQualityHeatmap, SessionSchedule, WeatherPanel, WeatherStat, WeatherLoadingState, WeatherErrorState, and generators (generateKpiData, generateTelemetrySnapshot, generateAlerts, generateActivityStream, generateSessionSchedule, generateDataQualityMatrix) are never rendered in the main DashboardClient return path. They appear to be remnants of an older dashboard design.

**Suggestion:** Remove DashboardHero and all unused widgets/generators from DashboardClient, or move them to a separate file (e.g. `dashboard-widgets.tsx`) if you plan to reuse them for a future “at a glance” surface. That will shrink the file and make the real behaviour obvious.

### 8.2 DriverCardsAndWeatherGrid size and location

- **DriverCardsAndWeatherGrid** is a large export (~900+ lines) in `DashboardClient.tsx`, with substantial state (carousel index, class index, refs, auto-scroll, scroll sync), computed metrics (filteredUserMetrics, calculateTopDriversForClass, etc.), and JSX (cards, weather panel). It makes DashboardClient.tsx very long and mixes “page client” with “analysis widget.”

**Suggestion:** Move `DriverCardsAndWeatherGrid` (and its subcomponents like DriverCard, WeatherPanel, etc.) into a dedicated file under `src/components/organisms/dashboard/`, e.g. `DriverCardsAndWeatherGrid.tsx`. Import it from DashboardClient and EventAnalysisSection. That will improve readability, testing, and reuse.

### 8.3 Duplicate weather logic

- Two components fetch weather with different robustness (AbortController only in DashboardClient). Consolidating to one fetch and one state (or hook) will remove duplication and avoid inconsistent behaviour.

---

## 9. Suggestions for Improvement (Prioritised)

### P0 – High impact, clarify product and UX

1. **Restore at-a-glance surface when an event is selected**  
   In DashboardClient, when `eventData` is present, render a compact strip above EventAnalysisSection: event name/date/track, optional summary KPIs (from `eventData.summary`), and the driver cards + weather (or a slim variant). Reuse or share the same data and weather with EventAnalysisSection so driver cards and weather are not only inside the Overview tab. This addresses the “empty dashboard” and makes the dual fetch (summary + analysis) clearly useful.

2. **Single source of truth for weather**  
   Fetch weather in one place (e.g. DashboardClient or a shared hook). Use AbortController and optional per-eventId cache. Pass weather into EventAnalysisSection and DriverCardsAndWeatherGrid via props or context. Remove the second fetch from EventAnalysisSection.

3. **Show current event in the shell**  
   When an event is selected, display its name (and optionally track/date) in TopStatusBar or ContextRibbon so users always see “where they are.” Optionally keep `eventId` in the URL for reload/share.

### P1 – Performance and correctness

4. **Remove duplicate work in getSessionsData**  
   Compute `allSessions` once with `data.races.map(calculateSessionMetrics(...))`, derive `availableClasses` from it, then derive filtered `sessions` by filtering/sorting that list. Eliminates the second full pass.

5. **Memoize DriverCardsAndWeatherGrid heavy work**  
   Memoize `allClasses` and per-section grouping (e.g. `groupDriversByClass` results) keyed by topDrivers, mostConsistentDrivers, bestAvgLapDrivers, mostImprovedDrivers (and races if used). Prevents expensive recomputation on every carousel tick.

6. **Respect visibility and reduced motion for carousel**  
   In DriverCardsAndWeatherGrid, pause the 5s auto-scroll when the carousel is not in view (IntersectionObserver) or when the document is hidden (visibilitychange), and disable or slow auto-scroll when `prefers-reduced-motion: reduce`. Reduces CPU/battery when the tab is in the background or the user prefers less motion.

### P2 – Code health

7. **Remove dead code from DashboardClient**  
   Delete or relocate DashboardHero and all unused widgets/generators (KpiCard, Sparkline, TelemetrySnapshot, AlertStack, ActivityTimeline, etc.) so DashboardClient only contains logic that is used for the current dashboard behaviour.

8. **Extract DriverCardsAndWeatherGrid**  
   Move DriverCardsAndWeatherGrid (and its subcomponents) to `src/components/organisms/dashboard/DriverCardsAndWeatherGrid.tsx`. Update imports in DashboardClient and EventAnalysisSection. Optionally split out WeatherPanel and DriverCard into smaller files if the new file is still large.

9. **Add AbortController and optional cache to EventAnalysisSection weather**  
   If weather is not yet centralised (see P0.2), at least make EventAnalysisSection’s fetch robust: AbortController on cleanup, and optionally a short-lived cache keyed by eventId so reselecting the same event does not refetch.

### P3 – Polish

10. **Tab naming and placement**  
    Rename or relocate “Comparison Test” if it is user-facing; consider moving it out of the main tab list if it is for development only.

11. **Accessibility**  
    Add `prefers-reduced-motion` for the carousel; optional live region for section changes; ensure error/loading messages are announced (e.g. role="alert" or aria-live).

12. **Density**  
    Verify that dashboard cards and spacing respond to the density setting in the UI slice so the compact/comfortable/spacious options have a visible effect.

---

## 10. Summary Table

| Priority | Item | Impact |
|----------|------|--------|
| P0 | At-a-glance surface when event selected | UX, product clarity |
| P0 | Single weather fetch + shared state | Correctness, consistency |
| P0 | Current event in shell (and optional URL) | Context, deep linking |
| P1 | getSessionsData single pass | Performance |
| P1 | Memoize DriverCardsAndWeatherGrid | Performance |
| P1 | Carousel visibility + reduced-motion | Performance, a11y |
| P2 | Remove dead code in DashboardClient | Maintainability |
| P2 | Extract DriverCardsAndWeatherGrid | Maintainability |
| P2 | EventAnalysisSection weather robustness | Correctness |
| P3 | Tab naming, a11y, density | Polish |

---

## 11. References

- **Previous performance review:** `docs/reviews/Old/dashboard-performance-review.md` (Feb 2025) – hero memoization, auto-scroll visibility, weather cache/abort, getSessionsData duplicate call, OverviewTab passes, driver ID Sets.
- **Architecture:** `docs/architecture/atomic-design-system.md` (organism/template structure).
- **Agents and Docker:** `docs/AGENTS.md` (Docker-only environment, commands).

This review should be updated when major dashboard changes ship (e.g. restored hero, single weather source, or refactors above). Moving the Feb 2025 performance review’s “Next Steps” into this document or archiving it with a pointer here will avoid duplicate tracking.
