# Event details section — review (Event Overview)

**Scope:** The **Event details** block on the **Event Overview** page only
(`activeTab === "event-overview"` → `OverviewTab` with
`variant="event-overview-only"`). No code was modified for this review.

---

## 1. Implementation map

### 1.1 Composition (top → bottom)

| Layer                                 | Responsibility                                                                                                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`EventAnalysisSection`**            | Renders fixed header + toolbar; when the dashboard tab is `event-overview`, mounts **`OverviewTab`** with `variant="event-overview-only"` and passes `EventAnalysisData` + driver/class callbacks. |
| **`OverviewTab`**                     | Owns all Event Overview UI, including the **Event details** `<h3>` and its bordered shell. Venue/weather/mix logic is **inline** (large `useMemo` blocks and JSX), not a separate organism.        |
| **`EventOverviewVenueHostTabList`**   | Renders the horizontal **Event Host / Host Track / Event Weather / Event Mix** `role="tablist"` when the overview shows the sub-tab strip.                                                         |
| **`venueHostStatsHeadlineRow`**       | Pairs a contextual headline (Host or Host club) with the **five-metric stats grid** on larger layouts; used when tabs are visible for certain sub-tabs.                                            |
| **`eventOverviewStatsGrid`**          | The **event stats block** (Races, Drivers, Entries, Total Laps, Total Classes) — implemented as JSX inside `OverviewTab`, not via `EventStats.tsx`.                                                |
| **`WeatherCard`**                     | Per-day weather cards; data from **`useEventWeather`** → `/api/v1/events/{id}/weather?perDay=true`.                                                                                                |
| **`EventHighlightsMixFilteredChart`** | **Event mix** charts and metric toggles; inputs from **`buildEventHighlights(data)`** (`EventHighlightsModel`).                                                                                    |

### 1.2 Where the sub-tabs are rendered

- **Component:** `EventOverviewVenueHostTabList`  
  **File:** `src/components/organisms/event-analysis/EventOverviewVenueHostTabList.tsx`  
  **Mount
  point:** Inside `OverviewTab`, under the **Event details** heading, only when
  **`venueHostShowsTabStrip`** is true
  (`visibleVenueHostWeatherTabs.length >= 2`).

- **Tab keys (type `VenueHostSubTab`):** `eventHost` | `hostTrack` |
  `eventWeather` | `eventMix` — labels are defined in `TAB_META` in the same
  file.

- **Visibility flags passed from `OverviewTab`:**
  - `showEventHostTab` → `!!venueHostSection?.hasVenueInfo`
  - `showHostTrackTab` → `!!venueHostSection?.hasHostBlock`
  - `showEventWeatherTab` → always `true` when the strip is shown
  - `showEventMixTab` → always `true` when the strip is shown

- **State:** `venueHostTab` / `setVenueHostTab` in `OverviewTab`;
  **`resolvedVenueHostTab`** clamps the selection if the current tab is not in
  `visibleVenueHostWeatherTabs`.

- **Conditional visibility note:** When there is **no** venue host block and
  **no** host track block (`venueHostSection` is null), the tab strip does
  **not** render (`venueHostShowsTabStrip` is false): only
  **`eventOverviewStatsGrid`** is shown in that branch.

### 1.3 Where the event stats block is rendered

The **production** Event Overview path does **not** use `EventStats.tsx`. Stats
are the **`eventOverviewStatsGrid`** `useMemo` in `OverviewTab`:

| Metric        | Source                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------- |
| Races         | `data.summary.totalRaces`                                                                 |
| Drivers       | `data.summary.totalDrivers`                                                               |
| Entries       | `data.entryList.length`                                                                   |
| Total Laps    | `data.summary.totalLaps`                                                                  |
| Total Classes | `totalClassesCount` (registration class names, valid classes, or `data.raceClasses.size`) |

**Presentation:**

- Wrapped with headlines in **`venueHostStatsHeadlineRow`** (`flex` column on
  small screens, `Host` / `Host club` headline + stats grid; includes an
  **`lg:hidden`** horizontal rule).
- Shown **next to** sub-tab context via **`venueHostTabHeadlineBesideStats`**
  when the tab strip is visible and the active sub-tab is **Event Host**, **Host
  Track**, **Event Weather**, or **Event Mix** (implemented as separate
  conditions in JSX — Weather/Mix show `venueHostStatsHeadlineRow` above panels;
  Host/Host Track embed it inside their panels when the strip is on).

**`EventStats.tsx`** (`src/components/organisms/event-analysis/EventStats.tsx`)
provides a **similar** label/value grid (plus optional track name and date
range) but is **not imported** by `OverviewTab`; it appears only in **testing**
(`EventStatsTesting` / `OverviewTabTesting`).

### 1.4 Data structures and props

**`OverviewTab` props** (`OverviewTabProps` in `OverviewTab.tsx`):

| Prop                                           | Type / role                                                                                                                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`                                         | **`EventAnalysisData`** from `src/core/events/get-event-analysis-data.ts` — event metadata, `summary`, `races`, `drivers`, `entryList`, `userHostTrack`, `registrationClassNames`, etc. |
| `selectedDriverIds`, `onDriverSelectionChange` | Dashboard driver selection (also used elsewhere in `OverviewTab`).                                                                                                                      |
| `selectedClass`, `onClassChange`               | Class scope.                                                                                                                                                                            |
| `variant`                                      | For Event Overview page: **`"event-overview-only"`** (hides inner “Event Overview / Session / Event Analysis” subsection strip).                                                        |
| `analysisSubTab`, `onAnalysisSubTabChange`     | Not used for `event-overview-only`.                                                                                                                                                     |

**Venue aggregation:** `venueHostSection` — derived `useMemo` from `data.event`
and `data.userHostTrack` with `hasVenueInfo`, `hasHostBlock`, nested `venue` /
`host` payloads.

**Highlights / mix:** `eventHighlightsModel = buildEventHighlights(data)` —
**`EventHighlightsModel`** exported from
`src/core/events/build-event-highlights.ts`; consumed by
**`EventHighlightsMixFilteredChart`**.

**Weather:**
`useEventWeather(data.event.id, data.userHostTrack?.trackId ?? null)` →
`weatherByDay`, `weatherLoading`, `weatherError`; types **`WeatherDayRow`** /
**`EventWeatherData`**.

**Surface tokens:** `OVERVIEW_SECTION_SURFACE_CLASS`,
`OVERVIEW_INNER_WELL_SURFACE_CLASS` from
`src/components/organisms/event-analysis/overview-glass-surface.ts`.

**Typography:** `typography` from `src/lib/typography.ts` — especially
`overviewMetricLabel`, `overviewMetricValue`, `h3`, `bodySecondary`.

---

## 2. Files likely to change in a UI/UX refactor

**High impact (current implementation lives here):**

- `src/components/organisms/event-analysis/OverviewTab.tsx` — bulk of Event
  details JSX and state.
- `src/components/organisms/event-analysis/EventOverviewVenueHostTabList.tsx` —
  tab strip UX and a11y.

**Often co-changed with overview chrome:**

- `src/components/organisms/event-analysis/overview-glass-surface.ts` —
  section/well surface classes.
- `src/lib/typography.ts` — overview metric tokens.

**Child UI for Event details panels:**

- `src/components/organisms/event-analysis/WeatherCard.tsx`
- `src/components/organisms/event-analysis/EventHighlightsMixCharts.tsx`
  (exports `EventHighlightsMixFilteredChart`)
- `src/components/molecules/MapSearchAddressLink.tsx` — address → maps search
  links.

**Data / hooks (if behavior or fields change):**

- `src/core/events/get-event-analysis-data.ts` — `EventAnalysisData` shape.
- `src/core/events/build-event-highlights.ts` — mix model.
- `src/hooks/useEventWeather.ts` — weather fetching/caching.

**Parent wiring (props into Overview only if section boundaries move):**

- `src/components/organisms/dashboard/EventAnalysisSection.tsx`

**Consolidation candidates:**

- `src/components/organisms/event-analysis/EventStats.tsx` — align or replace
  duplicate stats presentation vs `eventOverviewStatsGrid`.

**Tests / sandboxes:**

- `src/components/organisms/event-analysis/overview-testing/OverviewTabTesting.tsx`
- `src/components/organisms/event-analysis/overview-testing/EventStatsTesting.tsx`

---

## 3. Reusable UI already in the codebase (prefer reuse)

| Asset                                                                      | Use for Event details                                                                                                                                                                        |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`typography`** (`overviewMetricLabel`, `overviewMetricValue`, `h3`, …)   | Section titles and KPI rows — already used throughout this section.                                                                                                                          |
| **`OVERVIEW_SECTION_SURFACE_CLASS` / `OVERVIEW_INNER_WELL_SURFACE_CLASS`** | Outer “Event details” shell and inner wells (tab strip uses inner well).                                                                                                                     |
| **`EventOverviewVenueHostTabList`**                                        | Dedicated sub-tab control with focus/scroll behavior; do not duplicate unless replacing wholesale.                                                                                           |
| **`WeatherCard`**                                                          | All weather loading/error/success states; document in `docs/design/` references in file header.                                                                                              |
| **`EventHighlightsMixFilteredChart`**                                      | Event mix visualization; inner metric toggles are local to that file.                                                                                                                        |
| **`MapSearchAddressLink`**                                                 | Venue/host address affordance.                                                                                                                                                               |
| **`EventStats`**                                                           | Not wired to production overview — consider **extracting** the stats grid into a shared component **or** adopting `EventStats` props if date range / track line should match other surfaces. |
| **`TabNavigation.tsx` / `EventAnalysisToolbar`**                           | **Dashboard-level** tabs only — different pattern from venue sub-tabs; reuse only if you generalize a shared “pill tablist” primitive deliberately.                                          |

---

## 4. Safe step-by-step refactor plan

1. **Freeze behavior and add regression checks**  
   Document current rules: when the tab strip shows, which sub-tab shows
   `venueHostStatsHeadlineRow`, and when Host-only mode shows the duplicate
   “Host:” row in non-strip layout. Capture screenshots or checklist for **two**
   data shapes: with `venueHostSection` populated vs null.

2. **Extract presentational slices (no logic moves first)**  
   Move **dumb** fragments into colocated components under `event-analysis/`
   (e.g. `EventDetailsStatsGrid`, `EventDetailsHostPanel`) with props mirroring
   current data — **one extraction at a time**, keep `OverviewTab` as
   orchestrator until stable.

3. **Unify stats presentation**  
   Decide whether **`eventOverviewStatsGrid`** should become **`EventStats`**
   (extend `EventStats` with the five Overview metrics) or a new small component
   — avoid two competing grid implementations.

4. **Centralize tab-panel visibility**  
   Replace the long conditional blocks (`resolvedVenueHostTab === …`) with a
   small map or config array **only after** extraction stabilizes, to reduce
   divergence between strip vs no-strip layouts.

5. **Accessibility pass**  
   Re-verify `aria-labelledby` / `aria-controls` pairings between
   `EventOverviewVenueHostTabList` and panel `id`s after any DOM restructuring.

6. **Tighten data boundaries**  
   If panels move out, pass **narrow props** (e.g. `venue: VenueViewModel`)
   instead of full `EventAnalysisData` where possible.

7. **Update tests**  
   Adjust `OverviewTabTesting` / add component tests for extracted pieces; keep
   `EventStatsTesting` in sync if `EventStats` becomes canonical.

---

## 5. Quick reference — line anchors (OverviewTab)

Inspect **`OverviewTab.tsx`** for:

- `eventOverviewStatsGrid` — stats block definition
- `venueHostSection`, `visibleVenueHostWeatherTabs`, `resolvedVenueHostTab`,
  `venueHostShowsTabStrip` — tab logic
- `venueHostTabHeadlineBesideStats`, `venueHostStatsHeadlineRow` — headline +
  stats row
- Section with **`id="event-overview-event-details-heading"`** and
  **`Event details`** — start of the scoped UI
- **`EventOverviewVenueHostTabList`** — sub-tab strip
- Panels for **event host**, **host track**, **event weather**, **event mix** —
  large conditional JSX blocks following the tab strip

---

_Generated for planning only; implementation should follow `docs/AGENTS.md` and
Docker-only workflow._
