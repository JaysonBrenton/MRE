# My Laps Section Implementation Plan

**Created**: 2026-02-01  
**Source**: SessionChartTabs "My Laps" tab exploration  
**Related User Stories**: US14 (Compare My Laps Against Fastest Driver), US15 (Identify Where I Lost Time)  
**Owner**: Frontend Engineering  
**Objective**: Implement the My Laps tab content in SessionChartTabs with lap visualization,
starting with a line graph comparing the user's laps against the fastest driver, then
extending with gap analysis and slowest-lap highlighting.

---

## 0. Guiding Goals

1. **User-Centric** – My Laps is only shown when the logged-in user's driver name
   matches an entry in the event entry list (`userInEntryList`).

2. **Reuse Existing Infrastructure** – Leverage `LapTimeLineChart`, `/api/v1/events/{eventId}/laps`,
   `ChartContainer`, and `useChartColors`; avoid duplicating logic.

3. **Phased Delivery** – Phase 1 delivers immediate value (My vs Fastest line graph);
   Phase 2 adds analytical depth (gap analysis, slowest-lap highlighting).

4. **API-First** – Lap-by-lap data is not included in `EventAnalysisData` (payload size).
   My Laps must use the laps API for individual lap data.

5. **Class-Aware** – Race selector and data respect `selectedClass` filter from parent
   (consistent with SessionsTable and ComparisonTest).

---

## 1. Current State Summary

### 1.1 Available Data & APIs

| Data Source                         | What It Provides                                                | Used By                       |
| ----------------------------------- | --------------------------------------------------------------- | ----------------------------- |
| `EventAnalysisData`                 | Races, results, entry list, driver names; no individual laps     | Overview, Drivers, Sessions   |
| `/api/v1/events/{eventId}/laps`     | Per-driver lap-by-lap data per race (`lapNumber`, `lapTimeSeconds`) | ComparisonsTab               |
| `DriverLapTrend`                    | Session-level best/avg lap and position per race                | SessionsTable, OverviewChart  |

### 1.2 Existing Components

| Component            | Purpose                                             | Reusable For My Laps |
| -------------------- | --------------------------------------------------- | -------------------- |
| `LapTimeLineChart`   | Line graph of lap times per driver, zoom, tooltips  | Yes (same data shape)|
| `RaceSelector`       | Race dropdown for event                             | Yes                  |
| `ChartContainer`     | Themed chart wrapper                                | Yes                  |
| `useChartColors`     | Persistent driver colors                            | Yes                  |

### 1.3 SessionChartTabs Context

- **Location**: `src/components/organisms/event-analysis/sessions/SessionChartTabs.tsx`
- **My Laps tab**: Currently renders placeholder `"My Laps content goes here"` when
  `userInEntryList` is true (lines 198–205).
- **Props available**: `sessions`, `driverLapTrends`, `heatProgression`, `eventId`,
  `selectedClass`, `data` (EventAnalysisData), `userDriverName`.

---

## 2. Data Flow Requirements

### 2.1 User Driver Resolution

To show "my" laps, the user's driver must be resolved:

1. **Source**: `userDriverName` (session `user.name` or prop) + `data.entryList`
2. **Logic**: Match `entry.driverName.trim().toLowerCase()` === `userDriverName.trim().toLowerCase()`
3. **Output**: `driverId` for the user's entry (used to filter lap API response)

### 2.2 Fastest Driver Resolution

For "My vs Fastest" comparison:

1. **Source**: Lap API response `drivers[]` for selected race
2. **Logic**: Among drivers with lap data for that race, pick driver with lowest
   `fastLapTime` (or lowest min lap time from laps array if aggregates missing)
3. **Fallback**: If user is fastest, show only user's line (or user + second-fastest)

### 2.3 Lap API Contract

**Endpoint**: `GET /api/v1/events/{eventId}/laps?className={className}` (optional)

**Response shape** (assumed from ComparisonsTab usage):

```json
{
  "success": true,
  "data": {
    "drivers": [
      {
        "driverId": "...",
        "driverName": "...",
        "races": [
          {
            "raceId": "...",
            "laps": [
              { "lapNumber": 1, "lapTimeSeconds": 12.34 },
              { "lapNumber": 2, "lapTimeSeconds": 12.45 }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## 3. Phase 1: My Laps vs Fastest Driver Line Graph

### 3.1 Scope

- Race selector (filtered by `selectedClass`)
- Line chart with two series: user's laps + fastest driver's laps
- Reuse `LapTimeLineChart` and `/api/v1/events/{eventId}/laps`
- Loading and error states

### 3.2 New Component: MyLapsContent

**File**: `src/components/organisms/event-analysis/MyLapsContent.tsx`

**Responsibilities**:

- Accept props: `eventId`, `selectedClass`, `data` (EventAnalysisData), `userDriverName`
- Resolve user's `driverId` from `data.entryList` using `userDriverName`
- Fetch lap data when race is selected via `/api/v1/events/{eventId}/laps`
- From API response: extract user's laps + fastest driver's laps for selected race
- Build `DriverLapData[]` for `LapTimeLineChart` (user + fastest, or user only if no other data)
- Render `RaceSelector` + loading/error/empty states + `LapTimeLineChart`

**Props interface**:

```typescript
export interface MyLapsContentProps {
  eventId: string
  selectedClass: string | null
  data?: EventAnalysisData
  userDriverName: string | null
}
```

**Key logic**:

```typescript
// 1. Resolve user driverId
const userDriverId = useMemo(() => {
  if (!userDriverName || !data?.entryList) return null
  const normalized = userDriverName.trim().toLowerCase()
  const entry = data.entryList.find(
    (e) => e.driverName.trim().toLowerCase() === normalized
  )
  return entry?.driverId ?? null
}, [userDriverName, data?.entryList])

// 2. Fetch laps when race selected
useEffect(() => {
  if (!selectedRaceId || !eventId || !userDriverId) return
  // fetch /api/v1/events/${eventId}/laps
  // transform to DriverLapData[]: [user, fastest]
}, [selectedRaceId, eventId, userDriverId, selectedClass])

// 3. Identify fastest driver from API response
// Among drivers with laps for selectedRaceId, pick min(fastLap or min(lapTimeSeconds))
```

### 3.3 Integration into SessionChartTabs

**File**: `src/components/organisms/event-analysis/sessions/SessionChartTabs.tsx`

**Change**: Replace placeholder (lines 198–205) with:

```tsx
{activeTab === "my-laps" && (
  userInEntryList ? (
    <MyLapsContent
      eventId={eventId}
      selectedClass={selectedClass}
      data={data}
      userDriverName={userDriverName}
    />
  ) : (
    // existing "You did not compete" message
  )
)}
```

**Required**: Pass `data` prop to `SessionChartTabs` (verify it is already passed from
SessionsTab parent).

### 3.4 Races for RaceSelector

**Source**: `data?.races` filtered by `selectedClass` (same pattern as ComparisonsTab).

**Filtering**:

- If `selectedClass` is null/empty → all races
- Else → races where `race.className === selectedClass`

### 3.5 Edge Cases

| Case                          | Handling                                                    |
| ----------------------------- | ----------------------------------------------------------- |
| User has no laps in race      | Show fastest driver only, or empty state with message       |
| User is fastest driver        | Show user + second-fastest, or user only with note          |
| API returns no lap data       | Empty state: "No lap data available for the selected race"  |
| Lap API fails                 | Error state with retry option                               |
| Event has no races            | Empty state: "No races available for this event"            |

---

## 4. Phase 2: Gap Analysis & Slowest-Lap Highlighting

### 4.1 Gap-to-Fastest Line Graph (Optional View)

**Concept**: X = lap number, Y = gap (seconds) to fastest lap for that lap.

- **Data**: For each of user's laps, compute `lapTimeSeconds - min(allDriversLapTimes[lapNumber])`
- **Chart**: Single line; zero = matching fastest
- **Implementation**: New chart component or mode toggle in MyLapsContent

**Option A**: Second chart below main lap-time chart (stacked)

**Option B**: Toggle: "Lap Times" | "Gap to Fastest" — switch Y-axis data, keep same chart

### 4.2 Slowest-Lap Highlighting (User Story 15)

**Concept**: On the main lap-time line chart, visually highlight laps that are
significantly slower than the user's average.

**Logic**:

1. Compute user's average lap time from laps array
2. Flag laps where `lapTimeSeconds > avgLapTime + threshold` (e.g. threshold = 0.5s or 1σ)
3. In `LapTimeLineChart`: pass optional `highlightLapNumbers?: number[]` or extend
   `LapTimeDataPoint` with `isSlowLap?: boolean`
4. Render markers (e.g. circles, different color) on those points

**File changes**:

- `LapTimeLineChart.tsx`: Add optional prop for highlighted lap numbers; render
  `Circle` or marker at those points
- `MyLapsContent.tsx`: Compute slow laps, pass to chart

### 4.3 Consistency Reference Line (Optional)

- **Concept**: Horizontal line at user's average lap time
- **Implementation**: Add `referenceLines` prop to `LapTimeLineChart` or render
  a `LinePath` at y = avgLapTime

---

## 5. File Summary

### Phase 1

| Action    | File                                               |
| --------- | -------------------------------------------------- |
| Create    | `src/components/organisms/event-analysis/MyLapsContent.tsx` |
| Modify    | `src/components/organisms/event-analysis/sessions/SessionChartTabs.tsx` |

### Phase 2

| Action  | File                                                        |
| ------- | ----------------------------------------------------------- |
| Modify  | `src/components/organisms/event-analysis/MyLapsContent.tsx`  |
| Modify  | `src/components/organisms/event-analysis/LapTimeLineChart.tsx` (optional markers) |

---

## 6. Implementation Order

### Phase 1 Tasks

1. **Create MyLapsContent.tsx**
   - Implement user driver resolution from `entryList`
   - Implement race list from `data.races` filtered by `selectedClass`
   - Implement lap fetch from `/api/v1/events/{eventId}/laps`
   - Implement fastest driver resolution from API response
   - Build `DriverLapData[]` and render `LapTimeLineChart`
   - Add loading, error, and empty states
   - Follow `docs/development/FLEXBOX_LAYOUT_CHECKLIST.md` for content blocks

2. **Integrate into SessionChartTabs**
   - Import `MyLapsContent`
   - Replace placeholder with `MyLapsContent` when `userInEntryList`
   - Verify `data` prop is passed from parent

3. **Manual Testing**
   - User in entry list: verify My Laps tab shows chart
   - User not in entry list: verify "You did not compete" message
   - Race selector: verify filtering by class
   - Empty races, no lap data, API error: verify appropriate states

### Phase 2 Tasks (Future)

1. Add gap-to-fastest view (toggle or second chart)
2. Extend `LapTimeLineChart` with slow-lap markers
3. Add consistency/average reference line (optional)

---

## 7. Verification Checklist

### Phase 1

- [ ] My Laps tab visible only when `userInEntryList`
- [ ] Race selector shows races filtered by `selectedClass`
- [ ] Lap data fetches when race is selected
- [ ] Chart shows user's laps and fastest driver's laps (two lines)
- [ ] Loading state displays during fetch
- [ ] Error state displays on API failure (with clear message)
- [ ] Empty state displays when no lap data for race
- [ ] Chart uses `ChartContainer` and theme tokens
- [ ] Layout respects FLEXBOX_LAYOUT_CHECKLIST for scrollable containers
- [ ] Accessibility: chart has `aria-label`, legend/tooltips usable

### Phase 2

- [ ] Gap-to-fastest view available (if implemented)
- [ ] Slowest laps visually highlighted on chart (if implemented)
- [ ] Reference line for average lap (if implemented)

---

## 8. Related Documentation

- `docs/frontend/liverc/event-search-and-analysis-user-stories.md` — US14, US15
- `docs/development/FLEXBOX_LAYOUT_CHECKLIST.md` — Layout constraints
- `docs/design/chart-design-standards.md` — Chart styling
- `src/components/organisms/event-analysis/ComparisonsTab.tsx` — Lap fetch pattern
- `src/components/organisms/event-analysis/LapTimeLineChart.tsx` — Chart API
