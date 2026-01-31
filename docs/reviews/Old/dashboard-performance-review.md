# Dashboard Performance Review – February 2025

The review focused on the authenticated dashboard page
(`src/app/(authenticated)/dashboard/page.tsx`) and the two client components it
renders: `DashboardClient` (hero/KPI surface) and `EventAnalysisSection`
(analysis tabs). The goal was to surface performance risks that would be felt by
engineers using the dashboard with large LiveRC events.

## Priority Summary

| Priority     | Finding    | Impact                               |
| ------------ | ---------- | ------------------------------------ |
| **Critical** | #1, #6     | User-facing jank, blocks interaction |
| **High**     | #2, #4, #5 | Noticeable performance degradation   |
| **Medium**   | #3         | Wasted resources, race conditions    |

## Findings

### 1. Hero carousel reprocesses the full driver datasets every 5 seconds

**Priority:** Critical | **Severity:** High | **Estimated Impact:** 50-200ms per
render × 12 renders/min = 600-2400ms/min wasted

`DashboardHero` rebuilds class intersections and per-class driver groupings on
_every render_ (`src/components/dashboard/DashboardClient.tsx:296-387`). Because
the component also advances `currentSection` on a 5 s interval
(`src/components/dashboard/DashboardClient.tsx:427-505`), React re-renders the
hero even when the data is unchanged. Each render currently:

- Creates four `Set`s and computes their intersection (`getAllClasses`).
- Runs `groupDriversByClass` for every section, which in turn copies and sorts
  every driver in that section, even though the inputs never change while an
  event is selected.
- Re-slices the section data to "current class" for every driver card.

For larger events (dozens of classes × hundreds of drivers) this means thousands
of objects are reallocated every 5 s just to keep the carousel animating.

**Recommended Fix:** Cache the expensive pieces with `useMemo` keyed off the
section data (`topDrivers`, `mostConsistentDrivers`, …) and keep a memoized
`Map<className, Driver[]>` per section. That way the auto-scroll state updates
no longer force quadratic work.

**Code Example:**

```typescript
// Before: Computed on every render
const allClasses = getAllClasses()
const grouped = groupDriversByClass(section.data, section.type)

// After: Memoized per section data
const allClasses = useMemo(
  () => getAllClasses(),
  [topDrivers, mostConsistentDrivers, bestAvgLapDrivers, mostImprovedDrivers]
)
const groupedBySection = useMemo(() => {
  const grouped = {}
  sections.forEach((section) => {
    grouped[section.type] = groupDriversByClass(section.data, section.type)
  })
  return grouped
}, [topDrivers, mostConsistentDrivers, bestAvgLapDrivers, mostImprovedDrivers])
```

**Implementation Notes:**

- The `sections` array is defined in the component as:
  `[{ title: "Fastest Laps", data: topDrivers, type: "fastest" }, ...]` (see
  `DashboardClient.tsx:283-288`)
- `topDrivers`, `mostConsistentDrivers`, `bestAvgLapDrivers`, and
  `mostImprovedDrivers` are props passed to the component

### 2. Auto-scroll never pauses when the hero is off-screen or the tab is hidden

**Priority:** High | **Severity:** Medium | **Estimated Impact:** Continuous
CPU/battery drain in background

The same interval in `DashboardHero` keeps firing `scrollTo` +
`setCurrentSection` as long as the component is mounted
(`src/components/dashboard/DashboardClient.tsx:427-505`). There is no check for
`document.visibilityState`, no `IntersectionObserver`, and no
`prefers-reduced-motion` guard. The effect therefore continues to schedule work
(and re-render the heavy hero) while the user scrolls down to the analysis tabs,
switches browser tabs, or leaves the app idle, leading to wasted CPU/battery.

**Recommended Fix:**

- Tracking whether the hero is intersecting the viewport and skipping the
  interval while it is not.
- Pausing the interval when `document.visibilityState === "hidden"`.
- Short-circuiting the interval entirely when the user has disabled reduced
  motion.

These small guards keep the expensive carousel from running unattended in the
background.

**Code Example:**

```typescript
// Before: Interval always runs
useEffect(() => {
  const interval = setInterval(autoScroll, 5000)
  return () => clearInterval(interval)
}, [hasData, sections.length, currentSection, allClasses.length])

// After: Respects visibility and reduced motion
useEffect(() => {
  if (!hasData || sections.length === 0) return

  // Check reduced motion preference
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches
  if (prefersReducedMotion) return

  // IntersectionObserver for viewport visibility
  const observer = new IntersectionObserver(
    ([entry]) => {
      setIsVisible(entry.isIntersecting)
    },
    { threshold: 0.1 }
  )

  if (heroRef.current) observer.observe(heroRef.current)

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") setIsVisible(false)
  }
  document.addEventListener("visibilitychange", handleVisibilityChange)

  const interval = setInterval(() => {
    if (isVisible && document.visibilityState === "visible") {
      autoScroll()
    }
  }, 5000)

  return () => {
    clearInterval(interval)
    observer.disconnect()
    document.removeEventListener("visibilitychange", handleVisibilityChange)
  }
}, [hasData, sections.length, currentSection, allClasses.length, isVisible])
```

**Implementation Notes:**

- `heroRef` is a `useRef<HTMLDivElement>(null)` that references the root
  container element of the hero carousel (similar to the existing `carouselRef`
  in `DashboardClient.tsx:268`)
- `isVisible` and `setIsVisible` need to be added as state:
  `const [isVisible, setIsVisible] = useState(true)`
- The IntersectionObserver should observe the same element that `carouselRef`
  currently references (the scrollable carousel container)

### 3. Weather requests are uncontrolled and redo work for identical events

**Priority:** Medium | **Severity:** Medium | **Estimated Impact:** Unnecessary
network requests, potential race conditions

The weather fetch (`src/components/dashboard/DashboardClient.tsx:106-143`) fires
every time `selectedEvent?.id` changes, but the implementation never:

- Cancels the previous `fetch` when a new event is selected (no
  `AbortController`).
- Deduplicates requests for the same event (always forces `cache: "no-store"`).
- Guards against late responses writing over the state of a newer selection.

Selecting two events quickly therefore performs two network calls and whichever
response resolves last wins, even if it belongs to the older event.

**Recommended Fix:** Add an `AbortController` tied to the effect cleanup,
short-circuit when the same event ID is requested consecutively, and rely on
`revalidateTag`/`stale-while-revalidate` (or even a simple in-memory map) so
reselecting the same event reuses cached weather data instead of hitting the API
again.

**Security Note:** The in-memory cache persists for the component's lifetime. If
the component doesn't unmount on logout/session change, clear the cache
(`weatherCache.current.clear()`) in a cleanup effect tied to session changes to
prevent any potential data leakage between users.

**Code Example:**

```typescript
// Before: No cleanup, no caching
useEffect(() => {
  fetch(`/api/v1/events/${selectedEvent.id}/weather`, { cache: "no-store" })
    .then((response) => response.json())
    .then((result) => setWeather(result.data))
}, [selectedEvent?.id])

// After: AbortController + in-memory cache
const weatherCache = useRef<Map<string, WeatherData>>(new Map())

useEffect(() => {
  if (!selectedEvent?.id) return

  // Check cache first
  const cached = weatherCache.current.get(selectedEvent.id)
  if (cached) {
    setWeather(cached)
    return
  }

  const abortController = new AbortController()

  fetch(`/api/v1/events/${selectedEvent.id}/weather`, {
    signal: abortController.signal,
    cache: "no-store",
  })
    .then((response) => response.json())
    .then((result) => {
      if (!abortController.signal.aborted && result.data) {
        weatherCache.current.set(selectedEvent.id, result.data)
        setWeather(result.data)
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        setWeatherError("Failed to fetch weather data")
      }
    })

  return () => abortController.abort()
}, [selectedEvent?.id])
```

### 4. `getSessionsData` recalculates every session twice per render

**Priority:** High | **Severity:** Medium | **Estimated Impact:** 2× processing
time for session data calculations

When the Sessions tab asks for data, `getSessionsData` reconstructs
`SessionData` objects from the raw races and their results
(`src/core/events/get-sessions-data.ts:188-214`). Immediately afterwards it
repeats the _same_ `data.races.map(calculateSessionMetrics)` to build
`availableClasses`. Combined with the fact that every `calculateSessionMetrics`
call iterates over every result, a single filter change reprocesses every lap
twice.

**Recommended Fix:** Cache the per-event `SessionData[]` (e.g., `useMemo` keyed
by `data.event.id`) and derive `availableClasses`/filters off that cache instead
of remapping the races.

**Code Example:**

```typescript
// Before: calculateSessionMetrics called twice
export function getSessionsData(
  data: EventAnalysisData,
  selectedDriverIds: string[] = [],
  selectedClass: string | null = null
): SessionsData {
  let sessions = data.races.map(calculateSessionMetrics) // First call
  sessions = filterSessionsByDrivers(sessions, selectedDriverIds)
  sessions = filterSessionsByClass(sessions, selectedClass)
  sessions = sortSessionsByLabel(sessions)

  const allSessions = data.races.map(calculateSessionMetrics) // Second call (duplicate!)
  const availableClasses = getAvailableClasses(allSessions)
  // ...
}

// After: Cache sessions once, reuse for availableClasses
export function getSessionsData(
  data: EventAnalysisData,
  selectedDriverIds: string[] = [],
  selectedClass: string | null = null
): SessionsData {
  // Calculate once
  const allSessions = data.races.map(calculateSessionMetrics)
  const availableClasses = getAvailableClasses(allSessions)

  // Filter the cached sessions
  let sessions = filterSessionsByDrivers(allSessions, selectedDriverIds)
  sessions = filterSessionsByClass(sessions, selectedClass)
  sessions = sortSessionsByLabel(sessions)
  // ...
}
```

### 5. Driver membership checks stay O(n·m)

**Priority:** High | **Severity:** Medium | **Estimated Impact:** O(n·m) → O(n)
improvement, ~10-50ms per interaction for large selections

Both `filterSessionsByDrivers` and `getDriverLapTrends` continue to do
`selectedDriverIds.includes` inside nested loops
(`src/core/events/get-sessions-data.ts:135-139` and
`src/core/events/get-sessions-data.ts:257-268`). With, say, 50 selected drivers
and a few thousand race results, these linear scans dominate the render path for
the Sessions and Overview tabs.

**Recommended Fix:** Convert the driver ID arrays to `Set`s once per call so
membership is O(1), or better, store selection state in a
`Record<string, boolean>` that can be shared by all aggregations.

**Code Example:**

```typescript
// Before: O(n·m) linear scan in nested loop
function filterSessionsByDrivers(
  sessions: SessionData[],
  selectedDriverIds: string[]
): SessionData[] {
  return sessions.filter((session) =>
    session.results.some(
      (result) => selectedDriverIds.includes(result.driverId) // O(m) lookup
    )
  )
}

// After: O(n) with Set lookup
function filterSessionsByDrivers(
  sessions: SessionData[],
  selectedDriverIds: string[]
): SessionData[] {
  if (selectedDriverIds.length === 0) return sessions
  const driverIdSet = new Set(selectedDriverIds) // O(1) lookup
  return sessions.filter((session) =>
    session.results.some((result) => driverIdSet.has(result.driverId))
  )
}
```

### 6. Overview tab performs 5+ full passes over the race data per interaction

**Priority:** Critical | **Severity:** High | **Estimated Impact:** 50-150ms per
interaction (tens of ms per pass × 5+ passes)

Any change to the class filter or selection in `OverviewTab` triggers multiple
`useMemo`s that each iterate the entire `data.races` array: building
`allDriverStats`, building per-class stats, rebuilding the driver name lookup,
expanding selections via normalized names, and recomputing the "unselected
drivers in class" list (`src/components/event-analysis/OverviewTab.tsx:85-420`).
All of these loops call `normalizeDriverName` repeatedly and allocate
intermediate arrays. On big races the synchronous work is measurable (~tens of
ms) every time the engineer toggles a driver.

**Recommended Fix:** Consider lifting a single memoized preprocessing step per
event (e.g., `useMemo(() => buildDriverIndex(data.races), [data.event.id])`)
that returns the structures all of these features need (per-class maps,
normalized-name lookups, etc.). Then the per-interaction work becomes simple
filtering instead of whole-dataset reductions.

**Code Example:**

```typescript
// Before: Multiple full passes on every interaction
const allDriverStats = useMemo(() => {
  // Full pass 1: Build driver stats
  data.races.forEach((race) => {
    /* ... */
  })
}, [data.races])

const driverNameLookup = useMemo(() => {
  // Full pass 2: Build name lookup
  data.races.forEach((race) => {
    /* ... */
  })
}, [data.drivers, data.races])

const expandedSelectedDriverIds = useMemo(() => {
  // Full pass 3-4: Expand selections
  data.races.forEach((race) => {
    /* ... */
  })
}, [selectedDriverIds, data.races /* ... */])

// After: Single preprocessing step, then simple lookups
const driverIndex = useMemo(() => {
  const index = {
    driverStats: new Map(),
    nameLookup: new Map(),
    normalizedNameLookup: new Map(),
    driversByClass: new Map(),
  }
  // Single pass: Build all structures
  data.races.forEach((race) => {
    race.results.forEach((result) => {
      // Build all lookup structures in one pass
      index.driverStats.set(result.driverId, {
        /* ... */
      })
      index.nameLookup.set(result.driverId, result.driverName)
      index.normalizedNameLookup.set(
        normalizeDriverName(result.driverName),
        result.driverId
      )
      // ...
    })
  })
  return index
}, [data.event.id]) // Only recalculate when event changes

// Then use simple lookups
const allDriverStats = useMemo(
  () => Array.from(driverIndex.driverStats.values()),
  [driverIndex]
)
const driverNameLookup = driverIndex.nameLookup // No useMemo needed
```

## Next Steps

### Implementation Roadmap

#### Phase 1: Quick Wins (High Impact, Low Risk)

1. **Fix #4** - Eliminate duplicate `calculateSessionMetrics` calls in
   `getSessionsData`
   - **Effort:** Low (~1 hour)
   - **Risk:** Low (pure refactor, no behavior change)
   - **Dependencies:** None

2. **Fix #5** - Convert driver ID arrays to Sets in `filterSessionsByDrivers`
   and `getDriverLapTrends`
   - **Effort:** Low (~1-2 hours)
   - **Risk:** Low (algorithmic improvement, no behavior change)
   - **Dependencies:** None

#### Phase 2: Critical Performance Fixes (High Impact, Medium Risk)

3. **Fix #1** - Memoize hero carousel data processing
   - **Effort:** Medium (~3-4 hours)
   - **Risk:** Medium (requires careful dependency tracking)
   - **Dependencies:** None
   - **Testing:** Verify carousel still advances correctly, data doesn't stale

4. **Fix #2** - Add visibility/reduced-motion guards to auto-scroll
   - **Effort:** Medium (~2-3 hours)
   - **Risk:** Medium (new browser APIs, edge cases)
   - **Dependencies:** None (but pairs well with #1)
   - **Testing:** Test with hidden tab, scrolled viewport, reduced-motion
     enabled

#### Phase 3: Complex Refactoring (High Impact, Higher Risk)

5. **Fix #6** - Consolidate OverviewTab data processing into single
   preprocessing step
   - **Effort:** High (~6-8 hours)
   - **Risk:** Medium-High (significant refactor, many dependencies)
   - **Dependencies:** None (but benefits from #5)
   - **Testing:** Extensive testing of all OverviewTab interactions, ensure data
     consistency

#### Phase 4: Network Optimization (Lower Impact, Low Risk)

6. **Fix #3** - Add AbortController and caching to weather requests
   - **Effort:** Low-Medium (~2-3 hours)
   - **Risk:** Low (defensive improvements)
   - **Dependencies:** None
   - **Testing:** Test rapid event switching, verify cache works, verify abort
     works

### Recommended Implementation Order

1. Start with **Phase 1** (#4, #5) for immediate wins with minimal risk
2. Tackle **Phase 2** (#1, #2) to address the most visible performance issues
3. Proceed to **Phase 3** (#6) when ready for the larger refactor
4. Finish with **Phase 4** (#3) as a polish step

### Success Metrics

After implementing these fixes, measure:

- **Hero carousel render time:** Should drop from 50-200ms to <10ms per render
- **OverviewTab interaction latency:** Should drop from 50-150ms to <20ms per
  interaction
- **CPU usage:** Background intervals should stop consuming CPU when tab is
  hidden
- **Network requests:** Weather API should see fewer duplicate requests
- **Memory usage:** Reduced object allocations (measure with Chrome DevTools
  Memory profiler)

## Measurement & Validation

### Before Implementation

Use React DevTools Profiler to measure baseline performance:

1. Record a session with a large event (100+ drivers, multiple classes)
2. Interact with the dashboard (hero carousel, overview tab filters, session
   filters)
3. Note render times and commit durations
4. Use Chrome Performance tab to identify JavaScript execution hotspots

### After Implementation

Re-run the same test scenarios and compare:

- **React Profiler:** Render times, commit durations, component render counts
- **Chrome Performance:** Total JavaScript execution time, frame rates
- **Network tab:** Weather API request counts and timing
- **Memory profiler:** Object allocation counts and heap size

### Key Metrics to Track

| Metric                             | Baseline (Est.) | Target          | How to Measure     |
| ---------------------------------- | --------------- | --------------- | ------------------ |
| Hero carousel render time          | 50-200ms        | <10ms           | React Profiler     |
| OverviewTab interaction latency    | 50-150ms        | <20ms           | React Profiler     |
| Background CPU usage (hidden tab)  | Continuous      | Near-zero       | Chrome Performance |
| Weather API duplicate requests     | 100%            | <10%            | Network tab        |
| Memory allocations (5 min session) | High            | Reduced by 50%+ | Memory profiler    |

### Testing Checklist

- [ ] Hero carousel advances smoothly with memoized data
- [ ] Auto-scroll pauses when tab is hidden
- [ ] Auto-scroll pauses when hero scrolls out of viewport
- [ ] Reduced-motion preference disables auto-scroll
- [ ] Weather data caches correctly for repeated event selections
- [ ] Weather requests abort when switching events quickly
- [ ] Sessions tab filters work correctly with Set-based lookups
- [ ] OverviewTab interactions feel snappy with preprocessed data
- [ ] No regressions in data accuracy or display
- [ ] Performance improvements verified with profiling tools
