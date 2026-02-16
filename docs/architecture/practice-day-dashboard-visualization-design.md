# Practice Day Dashboard Visualization — Design Document

**Status:** Implemented  
**Created:** 2026-02-15  
**Last updated:** 2026-02-15  
**Scope:** Dashboard visualization when a practice day is selected. Excludes Event Search features.  
**Related:** [Practice Day Full Ingestion Design](./practice-day-full-ingestion-design.md), [Practice Day Search Performance](./practice-day-search-performance-design.md)

---

## 1. Executive Summary

### 1.1 Purpose

When a user selects a **practice day** for analysis on the dashboard, the current UI applies event-centric logic. Event analysis is focused on overall event analysis, race comparisons, and driver comparisons. Practice day visualization must be fundamentally different: **driver-centric**. This design describes the implementation of practice-day-aware dashboard visualization with a driver-first focus.

### 1.2 Design Philosophy

| Aspect | Event Analysis | Practice Day Visualization |
|--------|----------------|----------------------------|
| **Primary focus** | Overall event, race comparisons, driver comparisons | Individual driver experience and progression |
| **Primary user** | Anyone analyzing the event | Driver themselves (sessions also viewable by team manager) |
| **Default view** | Event overview | Day overview with driver drill-down |
| **Key questions** | Who won? How did heats progress? How did drivers compare? | How did *my* lap times change? How does *my* best compare to class? How consistent was *I*? |
| **Driver selection** | Filter for comparison | Entry point for detailed analysis (drill-down) |

### 1.3 Scope

- **In scope:** Dashboard page (`/dashboard`), Event Analysis Section, practice-day-specific tabs and content, Driver Cards, API routes and core logic when a practice day is selected.
- **Out of scope:** Event Search, EventSearchContainer, EventSearchForm, EventTable, PracticeDayRow, search APIs. **No changes to Event Search features.**

### 1.4 Critical Constraint: No Regression of Event Visualization

**Existing event visualization features must not be broken.** When `isPracticeDay === false` (or when viewing a race event):

- All current tabs (Event Overview, Event Sessions, My Events, Drivers) must behave exactly as today.
- All current charts, tables, driver cards, heat progression, and comparisons must work unchanged.
- API responses for events must remain backward compatible; new fields (e.g. `isPracticeDay`) are additive only.
- Changes must be **additive and conditional**: practice-day logic is gated by `isPracticeDay`; event code paths remain the default and untouched where possible.

See [§18 Backward Compatibility and Non-Regression](#18-backward-compatibility-and-non-regression) for implementation rules and verification.

---

## 2. Design Decisions (User Requirements)

The following decisions were confirmed through requirements gathering:

| # | Decision | Detail |
|---|----------|--------|
| 1 | **Primary user** | Driver themselves; sessions also viewable by team manager |
| 2 | **Driver selection** | Default to "me" when linked; allow selecting other drivers (Option C) |
| 3 | **Entry flow** | Show overview first; driver selection = drill-down |
| 4 | **Class leaderboard & driver comparison** | Both important; secondary (after driver-centric views) |
| 5 | **Primary questions (priority order)** | 1) How did my lap times change across the day; 2) How does my best lap compare to others in my class; 3) How consistent was I session to session |
| 6 | **Unlinked users** | Combined view: all sessions + prominent "Link your driver" prompt |
| 7 | **Tab structure (practice days)** | My Day \| My Sessions \| Class Reference \| (other...) |
| 8 | **Header format** | "Practice – 25 Oct 2025 @ Canberra" with secondary line "Viewing: [Driver Name]" |
| 9 | **No event regression** | Existing event visualization features must not be broken. Additive, conditional changes only. |

---

## 3. Practice Day Types (Context)

### 3.1 Open Practice (e.g. Canberra Off Road)

- Drivers go out whenever they want, for as long as they want.
- Each "session" = one driver's run = one Race with `sessionType=practiceday`.
- One driver per session. No scheduled heats.
- **Implementation focus:** This design primarily addresses open practice.

### 3.2 Structured Practice (e.g. Raw Speed)

- Practice days broken into actual scheduled sessions (heats).
- Data structure same as race events; existing event UI applies.
- Minimal or no changes required.

### 3.3 Detection

An event is a **practice day** when `Event.sourceEventId` contains `-practice-`.

---

## 4. Practice Day Context Detection

### 4.1 API Contract: `isPracticeDay` Flag

**4.1.1 Event Summary API** (`GET /api/v1/events/[eventId]/summary`)

Add to response:

```json
{
  "success": true,
  "data": {
    "event": { "id": "...", "eventName": "...", "eventDate": "...", "trackName": "..." },
    "isPracticeDay": true,
    "summary": { ... },
    ...
  }
}
```

**4.1.2 Event Analysis API** (`GET /api/v1/events/[eventId]/analysis`)

Add to response:

```json
{
  "success": true,
  "data": {
    "event": { ... },
    "isPracticeDay": true,
    "races": [ ... ],
    ...
  }
}
```

**Computation:** `isPracticeDay = event.sourceEventId?.includes('-practice-') ?? false`

### 4.2 Backend and State

| File | Change |
|------|--------|
| `src/core/events/get-event-analysis-data.ts` | Return `isPracticeDay` in summary/analysis (requires `sourceEventId` from Event) |
| `src/app/api/v1/events/[eventId]/summary/route.ts` | Include `isPracticeDay` in response |
| `src/app/api/v1/events/[eventId]/analysis/route.ts` | Include `isPracticeDay` in response |
| `types/dashboard.ts` | Add `isPracticeDay?: boolean` to `EventAnalysisSummary` and related types |
| `src/store/slices/dashboardSlice.ts` | Persist `isPracticeDay` from API responses |

---

## 5. Class Derivation for Practice Days

### 5.1 Problem

`getValidClasses()` uses `data.entryList` (EventEntry). Practice days have no EventEntry; classes were incorrectly empty.

### 5.2 Data Source

LiveRC practice day pages include a **Driver Class** column (e.g. [Canberra Off Road, Oct 25 2025](https://canberraoffroad.liverc.com/practice/?p=session_list&d=2025-10-25)). Each row: driver name, class (e.g. "1/8 Nitro Buggy"), transponder in parentheses. The parser stores `Race.className` per session.

### 5.3 Solution

**File:** `src/core/events/class-validator.ts`

**Logic:**
1. If `data.entryList.length > 0` → use `entryList` (existing behaviour).
2. Else → derive from `data.races`: unique `race.className` (exclude empty), sorted.
3. Include "Unknown Class" if present.

```ts
export function getValidClasses(data: EventAnalysisData): string[] {
  const classes = new Set<string>()
  if (data.entryList.length > 0) {
    data.entryList.forEach((entry) => {
      if (entry.className?.trim()) classes.add(entry.className.trim())
    })
  } else {
    data.races.forEach((race) => {
      if (race.className?.trim()) classes.add(race.className.trim())
    })
  }
  return Array.from(classes).sort()
}
```

---

## 6. Tab Structure for Practice Days

### 6.1 Tab Configuration

When `isPracticeDay === true`, use practice-day tabs instead of event tabs:

| Tab ID | Label | Purpose |
|--------|-------|---------|
| `my-day` | My Day | Driver-centric overview: lap time progression, consistency, class comparison. Default tab. |
| `my-sessions` | My Sessions | List and detail of the selected driver's sessions (chronological). |
| `class-reference` | Class Reference | Class leaderboard and driver comparison (secondary). |
| `all-sessions` | All Sessions | (Optional) Full session list for reference; supports team manager view. |

**Event tabs (unchanged when `isPracticeDay === false`):**
- Event Overview | Event Sessions | My Events | Drivers

### 6.2 Tab Type System

**File:** `src/components/organisms/event-analysis/TabNavigation.tsx`

Extend `TabId`:

```ts
export type TabId =
  | "overview"
  | "sessions"
  | "my-events"
  | "drivers"
  // Practice day tabs
  | "my-day"
  | "my-sessions"
  | "class-reference"
  | "all-sessions"
```

**Conditional tab rendering:** In `EventAnalysisSection`, when `isPracticeDay`:

```ts
const practiceDayTabs: Tab[] = [
  { id: "my-day", label: "My Day" },
  { id: "my-sessions", label: "My Sessions" },
  { id: "class-reference", label: "Class Reference" },
  { id: "all-sessions", label: "All Sessions" },
]
const tabs = isPracticeDay ? practiceDayTabs : eventTabs
```

### 6.3 Default Tab

- **Practice day:** `my-day`
- **Event:** `overview`

---

## 7. Header and Context Ribbon

### 7.1 Header Format

**File:** `src/components/organisms/event-analysis/EventAnalysisHeader.tsx`

**Practice day:**
- Primary: `Practice – {date} @ {trackName}` (e.g. "Practice – 25 Oct 2025 @ Canberra")
- Secondary: `Viewing: [Driver Name]` (when a driver is selected)

**Event (unchanged):**
- Primary: `{eventName}`
- Right: track and date metadata

### 7.2 Props

Extend `EventAnalysisHeaderProps`:

```ts
export interface EventAnalysisHeaderProps {
  eventName: string
  eventDate: Date | string
  trackName: string
  isPracticeDay?: boolean
  viewingDriverName?: string | null
}
```

### 7.3 Layout

When `isPracticeDay`:
- Left: "Practice – {formattedDate} @ {trackName}"
- Right: Track icon, date, and "Viewing: {driverName}" or "Viewing: All sessions" when no driver selected

---

## 8. Driver Selection and Drill-Down Flow

### 8.1 Overview-First Entry

1. User selects practice day → dashboard loads.
2. **Default:** Show "My Day" tab with day-level overview.
3. If user has linked driver → pre-select that driver; show their metrics.
4. If user has NOT linked driver → show combined view (all sessions) with prominent **"Link your driver"** prompt.
5. Driver selector allows switching to another driver (for team manager or self).

### 8.2 Driver Selector Behaviour

- **Default:** "Me" when EventDriverLink exists for current user.
- **Fallback:** "All sessions" when no link; prompt to link.
- **Selection:** Dropdown or list to choose any driver in the practice day.
- **Persistence:** Selected driver persisted in URL or Redux for the session.

### 8.3 State

| State | Source | Purpose |
|-------|--------|---------|
| `selectedDriverId` | EventActionsContext / Redux | Currently viewed driver |
| `linkedDriverId` | EventDriverLink for current user | "Me" when present |
| `isPracticeDay` | API response | Branch UI logic |

### 8.4 "Link your driver" Prompt

**Placement:** Prominent in "My Day" and "My Sessions" when:
- `isPracticeDay === true`
- No EventDriverLink for current user and event
- User is authenticated

**Content:**
- Headline: "Link your driver to see your practice day"
- Short explanation: "Connect your driver profile to view your lap times, progression, and class comparison."
- CTA: Button to open driver linking flow (existing flow).
- Fallback: "Viewing all sessions" with session list; user can still browse.

---

## 9. Tab Content Specifications

### 9.1 My Day Tab

**Purpose:** Address the top driver questions in order.

**Primary question 1:** How did my lap times change across the day?

**Content:**
- **Lap Time Progression Chart:** X-axis = session order (chronological) or session start time; Y-axis = best lap time (or average lap) per session. Line chart. Only shown when a driver is selected (or "me" when linked).
- **Summary:** First session best, last session best, improvement (seconds), trend (improving/stable/regressing).
- When no driver selected: show prompt to select driver or link.

**Primary question 2:** How does my best lap compare to others in my class?

**Content:**
- **Class Leaderboard Card:** For selected driver's class, show: fastest in class, your best, your position, gap to fastest.
- Requires class filter or auto-detect from driver's sessions.
- When no driver selected: show "Select a driver to see class comparison."

**Primary question 3:** How consistent was I session to session?

**Content:**
- **Consistency Metric:** Std deviation of lap times, or consistency score across sessions.
- **Consistency Chart:** Per-session consistency (if available) or lap-time spread per session.
- When no driver selected: prompt to select.

**Layout:**
- Top: Driver selector (or "Link your driver" prompt).
- Below: Three sections in priority order.
- Optional: Day-level stats (total sessions, laps, time range) as context strip.

### 9.2 My Sessions Tab

**Purpose:** Detailed list of the selected driver's sessions.

**Content:**
- Table: Session start time, duration, laps, best lap, average lap, consistency (if available).
- Sort by time (default chronological).
- Expandable rows: lap-by-lap data when available.
- When no driver selected: show all sessions (read-only list) with "Select a driver to filter" hint.
- "Link your driver" prompt when unlinked.

### 9.3 Class Reference Tab

**Purpose:** Secondary view — class leaderboard and driver comparison.

**Content:**
- **Class leaderboard:** Per class, fastest lap, driver name, session. Sortable.
- **Driver comparison:** Select 2+ drivers to compare (best lap, avg lap, consistency, session count).
- Positioned as reference, not primary focus.

### 9.4 All Sessions Tab (Optional)

**Purpose:** Full session list for team manager or reference.

**Content:**
- Full session table: Driver, class, start time, duration, laps, best lap, avg lap.
- Sort by time, driver, class.
- Filter by class.
- No driver selection required.

---

## 10. Driver Cards (Practice Day Adaptation)

### 10.1 Visibility

**Current (event):** Show when `(selectedClass !== null) || selectedDriverIds.length > 1`.

**Practice day:** Show when `(selectedClass !== null) || selectedDriverIds.length >= 1` (allow single driver).

### 10.2 Content Emphasis

For practice days, driver cards should emphasise:
- **Fastest lap:** Driver's best lap across sessions.
- **Consistency:** Driver's best consistency score.
- **Class comparison:** Gap to fastest in class (when class selected).

**Most Improved:** Use lap-time-only improvement across sessions (no position). Show when driver has ≥2 sessions. Label: "Most Improved (Lap Time)".

### 10.3 Section Order

Consider reordering for practice: Fastest Lap first, then Class Comparison, then Consistency, then Most Improved.

---

## 11. Sessions Tab (Event) vs My Sessions / All Sessions (Practice)

### 11.1 Event Sessions (unchanged)

- "Sessions and Heats", heat progression, multi-driver sessions.
- Shown only when `isPracticeDay === false`.

### 11.2 Practice My Sessions

- "My Sessions" — selected driver's sessions only.
- Chronological order.
- Terminology: "Session" not "Heat".

### 11.3 Practice All Sessions

- Full list, team manager use case.
- Sort by `startTime` by default.

---

## 12. API and Data Requirements

### 12.1 New/Modified Response Fields

| API | Field | Type | Description |
|-----|-------|------|-------------|
| Summary | `isPracticeDay` | boolean | `sourceEventId` contains `-practice-` |
| Analysis | `isPracticeDay` | boolean | Same |

### 12.2 Practice-Day-Specific Aggregations

**Lap time progression (per driver):**
- Input: `eventId`, `driverId`
- Output: `{ sessions: [{ sessionId, startTime, bestLap, avgLap, lapCount }], ... }`
- Source: RaceResult + Lap data; can be computed client-side from analysis data.

**Class leaderboard:**
- Input: `eventId`, `className`
- Output: `[{ driverId, driverName, bestLap, sessionId, sessionLabel }]` sorted by bestLap
- Source: Existing analysis data; derive in `getSessionsData` or new helper.

**Driver improvement (lap-time only):**
- Input: `eventId`, `driverId`
- Output: `{ firstSessionBest, lastSessionBest, improvement, sessionsCount }`
- Source: Extend `calculateMostImprovedDrivers` with `isPracticeDay` branch.

### 12.3 Redux State

| Field | Type | Description |
|-------|------|-------------|
| `isPracticeDay` | boolean \| null | From API |
| `selectedDriverId` | string \| null | For practice drill-down (may already exist in EventActionsContext) |

---

## 13. Component Changes Summary

| Component | Change |
|-----------|--------|
| `EventAnalysisSection` | Branch on `isPracticeDay`; render practice tabs and content |
| `EventAnalysisHeader` | Add `isPracticeDay`, `viewingDriverName`; format per §7 |
| `TabNavigation` / `EventAnalysisToolbar` | Accept practice-day tab config |
| `EventAnalysisSection` (tabs) | New: `PracticeMyDayTab`, `PracticeMySessionsTab`, `PracticeClassReferenceTab`, `PracticeAllSessionsTab` |
| `DriverCardsAndWeatherGrid` | `isPracticeDay` prop; single-driver visibility; lap-time improvement |
| `class-validator` | `getValidClasses` fallback to races |
| `calculate-driver-improvement` | `isPracticeDay` branch for lap-time-only improvement |
| `get-sessions-data` | Sort practice sessions by `startTime`; support driver filter |
| New | `LinkYourDriverPrompt` component |
| New | `PracticeDriverSelector` component |

---

## 14. Terminology Matrix

| Concept | Event | Practice Day |
|---------|-------|--------------|
| Unit of track time | Race | Session |
| Primary tab | Event Overview | My Day |
| Driver selection | Filter for comparison | Drill-down for analysis |
| Header emphasis | Event name | Practice date + "Viewing: [Driver]" |
| Improvement | Position + lap time | Lap time only |

---

## 15. Implementation Phases

### Phase 1: Foundation (Must Have)

**Pre-requisite:** Baseline event regression tests passing.

1. Practice day detection: `isPracticeDay` in APIs and Redux.
2. Class derivation: `getValidClasses` fallback to races.
3. Tab branching: Practice-day tab config when `isPracticeDay`.
4. Header: Practice format + "Viewing: [Driver]".
5. Driver selector: Select "me" or other driver; persist selection.
6. Placeholder content for My Day, My Sessions, Class Reference (reuse/adapt existing where possible).
7. **Regression check:** Event flow unchanged; all event tests pass.

**Effort:** 3–4 days.

### Phase 2: My Day Content (Must Have)

1. Lap time progression chart (driver's sessions over time).
2. Class comparison card (best in class vs driver).
3. Consistency metric and chart.
4. "Link your driver" prompt when unlinked.
5. Combined view when no driver: day stats + prompt.
6. **Regression check:** Event flow unchanged.

**Effort:** 2–3 days.

### Phase 3: My Sessions and Class Reference (Should Have)

1. My Sessions table (driver's sessions, chronological).
2. Class Reference: leaderboard and driver comparison.
3. All Sessions table (full list).
4. Driver cards: practice-day visibility and lap-time improvement.
5. **Regression check:** Event flow unchanged.

**Effort:** 2 days.

### Phase 4: Polish (Nice to Have)

1. Session start time in cards.
2. Expandable lap-by-lap in My Sessions.
3. Team manager view optimisations.
4. Responsive layout for new components.
5. **Regression check:** Event flow unchanged.

**Effort:** 1–2 days.

---

## 16. Testing Strategy

### 16.1 Unit Tests

- `getValidClasses`: empty entryList → classes from races.
- `calculateMostImprovedDrivers`: `isPracticeDay` → lap-time-only improvement.
- Lap time progression: correct session order (by startTime).

### 16.2 Integration Tests

- Practice day → APIs return `isPracticeDay: true`.
- Practice day → practice tabs rendered.
- Driver selection → My Day shows that driver's data.
- Unlinked user → "Link your driver" visible.

### 16.3 Manual Testing

- Canberra 2025-10-25: driver-centric flow, tabs, class reference.
- **Race event regression:** Select a race event → verify Event Overview, Event Sessions, My Events, Drivers tabs; all charts, tables, driver cards, heat progression, class filter; no visual or behavioural regression.
- Unlinked user: combined view + prompt.
- Team manager: select other driver, view their sessions.

### 16.4 Event Regression Tests (Required)

Before any practice day work is merged:

- Existing event analysis tests must pass.
- Add or extend tests: select race event, assert Overview tab content, Sessions tab content, Drivers tab content.
- API tests: summary and analysis for race event return expected shape; `isPracticeDay` is `false` or absent.

---

## 17. Out of Scope (Explicit)

- Event Search UI and logic
- EventSearchContainer, EventSearchForm, EventTable
- PracticeDayRow, Analyse/Upload behaviour
- Search APIs (`/api/v1/events/search`, practice discover, etc.)

---

## 18. Backward Compatibility and Non-Regression

### 18.1 Principle

All changes for practice day visualization must be **additive and conditional**. When an event is a race event (`isPracticeDay === false`), the system must behave identically to the current implementation. No existing event features may be altered, removed, or degraded.

### 18.2 Implementation Rules

| Rule | Description |
|------|-------------|
| **Conditional branching** | Practice-day-specific UI and logic is gated by `if (isPracticeDay) { ... } else { /* existing behaviour */ }`. Event path is the `else` branch. |
| **Additive API fields** | New fields (`isPracticeDay`) are optional additions. Existing fields and response shape for events are unchanged. |
| **Additive component props** | New props (`isPracticeDay`, `viewingDriverName`) have defaults; when absent or `false`, components behave as today. |
| **No removal of event paths** | Event tabs, Overview tab, Sessions tab, Drivers tab, My Events tab, heat progression, and all event-specific content remain intact. |
| **Shared components** | Components used by both (e.g. `DriverCardsAndWeatherGrid`) must branch internally; event behaviour when `isPracticeDay === false` is unchanged. |
| **Class derivation** | `getValidClasses` fallback to races only when `entryList` is empty. Events with `entryList` use existing logic; no change to output for events. |
| **Improvement calculation** | `calculateMostImprovedDrivers` `isPracticeDay` branch is additive; when `false` or omitted, existing logic runs. |

### 18.3 Event Features Checklist (Must Remain Working)

- [ ] Event Overview tab: EventStats, charts, class filter, driver selection
- [ ] Event Sessions tab: Sessions and Heats, heat progression, driver lap trends, session table
- [ ] My Events tab: User's events list, navigation
- [ ] Drivers tab: Driver list, races participated, best/avg lap, consistency
- [ ] Driver Cards: Fastest laps, most consistent, best avg lap, most improved (event semantics)
- [ ] Weather grid
- [ ] Event header: Event name, track, date
- [ ] Event search modal: Find Events, select event for dashboard
- [ ] Class filter and pagination in Overview
- [ ] All existing API contracts for events

### 18.4 Verification

- **Regression tests:** Automated tests for event flow (select race event → verify all tabs and content).
- **Manual regression:** Before release, verify a representative race event end-to-end.
- **CI:** Event visualization tests must pass on every commit.

---

## 19. References

- [Canberra Off Road Practice, Oct 25 2025](https://canberraoffroad.liverc.com/practice/?p=session_list&d=2025-10-25)
- [Practice Day Full Ingestion Design](./practice-day-full-ingestion-design.md)
- `ingestion/connectors/liverc/parsers/practice_day_parser.py`
- `src/core/events/class-validator.ts`
- `src/core/events/get-event-analysis-data.ts`
- `src/core/events/calculate-driver-improvement.ts`
- `src/components/organisms/event-analysis/TabNavigation.tsx`
- `types/dashboard.ts`
