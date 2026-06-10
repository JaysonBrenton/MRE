---
created: 2026-06-10
owner: Frontend Delivery / Event Analysis
lastModified: 2026-06-10
status: planned
purpose:
  Normative design for pace-encoded (heat) lap line coloring on
  LapByLapTrendChart when a single driver is selected.
relatedDocs:
  - docs/implimentation_plans/lap-trend-pace-heat-line-2026-06.md
  - docs/implimentation_plans/lap-trend-pace-heat-line-checklist.md
  - docs/user-guides/event-analysis.md
  - docs/design/mre-ux-principles.md
  - docs/design/mre-dark-theme-guidelines.md
  - docs/architecture/atomic-design-system.md
  - docs/AGENTS.md
relatedFiles:
  - src/components/organisms/event-analysis/LapByLapTrendChart.tsx
  - src/core/events/lap-by-lap-trend-chart-model.ts
  - src/components/organisms/event-analysis/TemperatureSparkline.tsx
  - src/components/organisms/event-analysis/OverviewTab.tsx
  - src/__tests__/core/events/lap-by-lap-trend-chart-model.test.ts
  - src/__tests__/components/event-analysis/lap-by-lap-trend-chart.test.tsx
---

# Lap trend pace heat line

**Status:** Planned (not yet shipped). Behaviour in this document is normative
for implementation. Update status to **Active** when the feature merges.

## 1. Summary

When **exactly one driver** is visible on `LapByLapTrendChart`, users may enable
**Pace heat line** from the chart **Display** menu. The driver's lap trace
remains a single connected line, but **stroke color encodes lap pace** along the
trace: cool/green tones near the driver's personal best in scope, warming
through amber to red for unusually slow laps.

This makes pace variation visible at a glance without replacing the Y-axis (lap
time) or the crosshair tooltip. It complements existing **vs driver's best**
tooltip columns and amber **slow-lap outlier** markers.

## 2. Problem and intent

### 2.1 Problem

Today each driver line uses one solid palette color for the full trace. Slow
laps are only hinted by amber dots (outlier heuristic) and tooltip deltas. Users
comparing a single driver's event must mentally scan vertical position to see
where pace dropped.

### 2.2 Intent

Answer: _"Where along the event did this driver lose pace relative to their own
best?"_ in one view, especially for single-driver Driver Analysis sessions.

### 2.3 Non-goals

- No backend or API changes (`/api/v1/events/[eventId]/lap-trend` unchanged).
- No heat encoding when multiple drivers are overlaid (color is the primary
  differentiator between drivers).
- No heat on position lanes, smoothing lines, or trend (regression) lines.
- No heat in **compact** mini-preview tiles (`LapByLapTrendChart` `compact`
  mode).
- No new chart type or separate panel; this is a Display option on the existing
  chart.

## 3. Scope

### 3.1 Surfaces

All `LapByLapTrendChart` instances that expose the Display menu and allow
single-driver selection, including:

| Surface                       | Location                                        | Notes                                                          |
| ----------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| Event Level Driver Analysis   | `OverviewTab` · `variant="event-analysis-only"` | Primary target; class-scoped lap trace                         |
| Session Level lap trend cards | `OverviewTab` session analysis panels           | Same component, session-scoped X                               |
| Other consumers               | `LapTimeTrendCard`, dashboard tiles             | Enable only where Display menu is shown and `compact` is false |

Implementers must verify each call site; do not enable heat in `compact`
previews.

### 3.2 Activation rules (locked)

| Condition                  | Behaviour                                                                   |
| -------------------------- | --------------------------------------------------------------------------- |
| `drivers.length === 1`     | **Pace heat line** toggle visible and operable in Display menu              |
| `drivers.length !== 1`     | Toggle **disabled** with helper text: single driver required                |
| Toggle **On** + one driver | Lap trace uses pace heat stroke; solid driver color not used for main trace |
| Toggle **Off**             | Existing solid-color line (current behaviour)                               |
| `compact === true`         | Heat line not rendered; toggle not shown                                    |

Default: **Off** (opt-in). Display toggles are component-local state in v1 (not
persisted to Redux or `localStorage`), matching `showSmoothing` /
`showPositionOnLap`.

## 4. UX specification

### 4.1 Display menu

Add a menu item after **Smoothing (3-lap)** (when present) or after **Trend
line**:

| Label          | `role`             | Default |
| -------------- | ------------------ | ------- |
| Pace heat line | `menuitemcheckbox` | Off     |

When disabled (`drivers.length !== 1`), the row stays visible but
non-interactive (`aria-disabled="true"`, `pointer-events-none` or equivalent)
with muted On/Off label and a one-line note in the Display menu footer:

> Pace heat line colors each lap by delta to that driver's best lap. Select a
> single driver to enable.

When enabled, append to the footer note block:

> Pace heat line: green = personal best in scope; amber/red = slower laps. Slow
> lap dots are hidden while heat is on.

**Copy rules:** No em dashes (U+2014). Use middle dot (`·`) for inline joins per
`docs/design/mre-ux-principles.md`.

### 4.2 Legend

When pace heat is **On**, show a compact **pace scale** below the chart legend
row (same area as driver swatches), only in non-compact mode:

```
[green swatch] Personal best  ·  [amber] Slower  ·  [red] Much slower
```

Legend swatches use the **same fixed hex ramp** as the stroke buckets (§5.2):
`#4ade80` for best, `#fbbf24` for the mid band, `#f87171` for much slower. The
three-swatch legend intentionally summarizes the five buckets; do not introduce
a second color source.

The legend is decorative; exact numeric thresholds are in the tooltip.

### 4.3 Driver color picker

When heat is on, the driver legend swatch may show a **mini gradient** or a
neutral icon instead of the solid line color, since stroke is no longer a single
hue. The color picker button remains available but applies when the user turns
heat off again (store preference unchanged in `useDriverLineColors`).

### 4.4 Outlier markers

When pace heat is **On**, **do not render** amber slow-lap outlier circles for
that driver (heat subsumes the signal). When heat is **Off**, retain current
outlier behaviour.

### 4.5 Tooltip

No tooltip redesign required. Existing **vs driver's best** column is the
numeric source of truth for the color encoding.

### 4.6 Accessibility

- Chart `desc` / `aria-label` when heat is on: append
  `Pace heat line enabled; stroke color indicates delta to driver personal best.`
- Do not rely on color alone: tooltip still exposes deltas; legend labels the
  scale in words.
- Disabled toggle must be reachable by keyboard but not toggleable when
  `drivers.length !== 1`.

## 5. Color encoding (normative)

### 5.1 Metric

**Delta to driver's personal best** in the **current chart scope** (same laps
plotted on the trace):

```
deltaSeconds = lapTimeSeconds - driverBestLapSeconds
```

Where `driverBestLapSeconds` is the minimum plottable `lapTimeSeconds` across
that driver's laps in the chart's filtered `drivers[0]` series (identical to
tooltip `deltaToDriverBestSeconds` when best lap is 0).

### 5.2 Scale (discrete buckets, fixed hex ramp)

**Normative choice (v1): five discrete buckets with fixed hex colors. No color
interpolation.**

Rationale: SVG strokes cannot lerp between `var(--token-…)` strings without
resolving computed styles at runtime, interpolated ramps are harder to test
deterministically, and discrete buckets read more clearly on the dark glass
background. The hex values below are the Tailwind 400-series hues already used
in this chart's legend (`text-green-400` improving, `text-amber-400` degrading),
so the ramp stays consistent with existing UI.

| Band       | Delta (s)         | Meaning                                   | Hex                    |
| ---------- | ----------------- | ----------------------------------------- | ---------------------- |
| `best`     | `<= 0.0005`       | Personal best (treat floating noise as 0) | `#4ade80` (green-400)  |
| `nearBest` | `0.0005` – `0.15` | Near best                                 | `#a3e635` (lime-400)   |
| `moderate` | `0.15` – `0.35`   | Moderately off pace                       | `#fbbf24` (amber-400)  |
| `slow`     | `0.35` – `0.60`   | Slow                                      | `#fb923c` (orange-400) |
| `verySlow` | `> 0.60`          | Much slower / outlier band                | `#f87171` (red-400)    |

Implement as two helpers in `lap-by-lap-trend-chart-model.ts`:

```ts
export type PaceHeatBand =
  | "best"
  | "nearBest"
  | "moderate"
  | "slow"
  | "verySlow"

export function paceHeatBand(deltaSeconds: number): PaceHeatBand
export function paceHeatStrokeColor(deltaSeconds: number): string // bucket hex
```

Unit-test boundary values against the **band**, with the hex map asserted once.

**v1 does not** expose a user-facing scale picker. Thresholds are constants
documented here and in tests.

**v2 consideration (recorded, not in scope):** absolute-seconds thresholds suit
~30s laps (1:8 nitro) but may be too coarse or too tight for other formats. A
future revision may express thresholds as a **percentage of the driver's best
lap** (e.g. +0.5% / +1.5% / +3%) so the scale adapts across classes. A
color-blind safe alternative ramp (blue → yellow) is a related follow-up; see
[follow-ons](../future-ideas/lap-trend-pace-analysis-follow-ons.md).

### 5.3 Per-segment vs gradient stroke

**Normative choice (v1): per-segment stroke.**

Draw one short `LinePath` (or `<line>`) per consecutive lap pair. Color each
segment from the **starting lap's** `deltaSeconds` (or average of endpoints;
pick one and test consistently — **starting lap** is recommended so the color at
a lap index matches the tooltip at that lap).

**Rationale:** Horizontal SVG `linearGradient` (as in
`TemperatureSparkline.tsx`) maps color to X position, not path geometry. On
steep lap-to-lap vertical segments, gradient color can misalign with the lap
being inspected. Per-segment rendering keeps color aligned with crosshair snap.

Preserve `curveMonotoneX` by using two-point `LinePath` segments; joints are
acceptable at lap granularity.

## 6. Technical design

### 6.1 Data flow

```
DriverLapTrendSeries[] (unchanged API)
  → LapByLapTrendChart filters/sorts lapPointsSorted (existing)
  → driverBestLapSeconds (existing logic in model / tooltip builder)
  → paceHeatStrokeColor(delta) per lap
  → SVG segment LinePaths when showPaceHeatLine && drivers.length === 1
```

No new props on `OverviewTab` required unless a call site needs to force-disable
heat (none in v1).

### 6.2 New state

Inside `LapByLapTrendChart`:

```ts
const [showPaceHeatLine, setShowPaceHeatLine] = useState(false)
```

Reset to `false` when `drivers.length` changes from `1` to any other value
(`useEffect` guard).

### 6.3 New pure helpers (`lap-by-lap-trend-chart-model.ts`)

| Function                                        | Responsibility                         |
| ----------------------------------------------- | -------------------------------------- |
| `driverBestLapTimeInScope(driver)`              | Export or reuse min plottable lap time |
| `deltaToDriverBestSeconds(lapTime, driverBest)` | Nullable-safe delta                    |
| `paceHeatBand(deltaSeconds)`                    | Threshold → `PaceHeatBand` bucket      |
| `paceHeatStrokeColor(deltaSeconds)`             | Bucket → fixed hex string (§5.2 ramp)  |
| `paceHeatSegmentColors(laps, driverBest)`       | Ordered colors for segments            |

Keep heuristics out of the React component; test helpers in
`lap-by-lap-trend-chart-model.test.ts`.

### 6.4 Rendering sketch

When `showPaceHeatLine && drivers.length === 1`:

1. Render invisible wide `LinePath` for hover (unchanged).
2. Replace single solid `LinePath` with:

```tsx
{lapPointsSorted.slice(0, -1).map((lap, i) => {
  const next = lapPointsSorted[i + 1]
  const delta = deltaToDriverBestSeconds(lap.lapTimeSeconds, driverBest)
  const stroke = paceHeatStrokeColor(delta ?? 0)
  return (
    <LinePath
      key={`heat-seg-${lap.lapIndex}-${lap.raceId}`}
      data={[lap, next]}
      x={...}
      y={...}
      stroke={stroke}
      strokeWidth={2.5}
      curve={curveMonotoneX}
      pointerEvents="none"
    />
  )
})}
```

3. Skip solid-color main line and outlier dots for that driver.
4. Trend and smoothing lines unchanged.

### 6.5 Performance

Typical single-driver event traces are hundreds of segments, not thousands. SVG
segment count is acceptable for v1. If profiling shows jank on 4-digit lap
events, batch adjacent segments with the same quantized color (optional
optimization; not required for initial ship).

### 6.6 Precedent

`TemperatureSparkline.tsx` demonstrates gradient stroke on a sparkline. Pace
heat **intentionally differs** by using per-segment colors for accuracy on the
main lap chart.

## 7. Acceptance criteria

- [ ] With **one** driver selected, user can turn **Pace heat line** On from
      Display menu; lap trace shows green-to-red encoding along the line.
- [ ] With **two or more** drivers, toggle is visible but disabled; traces
      remain solid colors.
- [ ] Turning heat **On** hides amber outlier dots for the heated driver.
- [ ] Crosshair tooltip **vs driver's best** matches the qualitative color at
      the snapped lap (best lap ≈ green).
- [ ] **Trend line**, **smoothing**, session bands/dividers, and position lanes
      behave as before.
- [ ] **Compact** mini chart does not show heat or the toggle.
- [ ] Unit tests cover `paceHeatStrokeColor` boundaries and segment color
      helper.
- [ ] Component test covers toggle enabled/disabled by driver count and legend
      visibility when heat is on.
- [ ] `docs/user-guides/event-analysis.md` updated for end-user support.

## 8. Testing strategy

See
[implementation plan §7](../implimentation_plans/lap-trend-pace-heat-line-2026-06.md)
for file-level test cases and manual QA.

Run in Docker:

```bash
docker exec -it mre-app npm test -- src/__tests__/core/events/lap-by-lap-trend-chart-model.test.ts
docker exec -it mre-app npm test -- src/__tests__/components/event-analysis/lap-by-lap-trend-chart.test.tsx
```

## 9. Support and troubleshooting

| Symptom                        | Likely cause                         | Action                             |
| ------------------------------ | ------------------------------------ | ---------------------------------- |
| Toggle greyed out              | More than one driver in chart        | Deselect until one remains         |
| All red / all green            | Very tight or very loose pace spread | Expected; check tooltip deltas     |
| Heat missing in collapsed tile | `compact` mode                       | Expand card; heat is expanded-only |
| Colors differ from tooltip     | Segment uses wrong lap for delta     | Verify starting-lap rule in code   |

## 10. Related documentation

- [Implementation plan (Jun 2026)](../implimentation_plans/lap-trend-pace-heat-line-2026-06.md)
- [Task checklist](../implimentation_plans/lap-trend-pace-heat-line-checklist.md)
- [Event Analysis user guide](../user-guides/event-analysis.md)
- [Collapsible analysis cards plan](../implimentation_plans/analysis-card-collapse-mini-chart-2026-05.md)
  (compact mode interaction)
- [Pace analysis follow-ons (future ideas)](../future-ideas/lap-trend-pace-analysis-follow-ons.md)
  — heatmap matrix, session fade chips, clean-pace trend, annotation handoff,
  and other candidates that build on the Phase 1 helpers
