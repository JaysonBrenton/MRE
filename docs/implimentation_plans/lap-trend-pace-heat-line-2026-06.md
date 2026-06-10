---
created: 2026-06-10
owner: Frontend Delivery / Event Analysis
lastModified: 2026-06-10
status: planned
purpose:
  Phased implementation plan for pace heat line coloring on LapByLapTrendChart.
relatedDocs:
  - docs/architecture/lap-trend-pace-heat-line.md
  - docs/implimentation_plans/lap-trend-pace-heat-line-checklist.md
  - docs/design/mre-ux-principles.md
  - docs/AGENTS.md
relatedFiles:
  - src/components/organisms/event-analysis/LapByLapTrendChart.tsx
  - src/core/events/lap-by-lap-trend-chart-model.ts
  - src/components/organisms/event-analysis/OverviewTab.tsx
  - src/__tests__/core/events/lap-by-lap-trend-chart-model.test.ts
  - src/__tests__/components/event-analysis/lap-by-lap-trend-chart.test.tsx
---

# Lap trend pace heat line — implementation plan (June 2026)

Normative behaviour:
[lap-trend-pace-heat-line.md](../architecture/lap-trend-pace-heat-line.md).

Runtime verification is **Docker-only** per [AGENTS.md](../AGENTS.md):

```bash
docker exec -it mre-app npm test
```

---

## 1. Goals (locked)

1. Optional **Pace heat line** Display toggle on `LapByLapTrendChart`.
2. Active only when **exactly one** driver is in the chart series.
3. Lap trace stroke colored by **delta to that driver's best lap** in scope.
4. **Per-segment** SVG rendering (not horizontal gradient).
5. No API, ingestion, or Redux changes in v1.

### Non-goals

- Persisting toggle across sessions.
- Heat line on multi-driver compare mode.
- User-configurable color thresholds.
- Heat on `compact` mini-preview charts.

---

## 2. Current baseline

| Area               | Today                                                         |
| ------------------ | ------------------------------------------------------------- |
| Main trace         | Single `LinePath`, `stroke={color}` per driver                |
| Outliers           | Amber `circle` markers via `outlierLapKeysForDriver`          |
| Tooltip deltas     | `deltaToDriverBestSeconds` in `buildCrosshairTooltipPayload`  |
| Display menu       | Session overlay, trend, position, smoothing, closest-only     |
| Driver count       | Up to 4 on Event Level Driver Analysis                        |
| Gradient precedent | `TemperatureSparkline.tsx` uses `linearGradient` + `url(#id)` |

Relevant render block: `LapByLapTrendChart.tsx` (~lines 1299–1440, driver map +
`LinePath`).

---

## 3. Implementation phases

### Phase 1 — Pure model helpers (test-first)

**File:** `src/core/events/lap-by-lap-trend-chart-model.ts`

Add constants and exports:

```ts
/** Seconds thresholds for pace heat stroke (see architecture doc §5.2). */
export const PACE_HEAT_THRESHOLDS = {
  bestEpsilon: 0.0005,
  nearBestMax: 0.15,
  moderateMax: 0.35,
  slowMax: 0.6,
} as const

export function driverBestLapTimeInScope(
  driver: DriverLapTrendSeries
): number | null

export function deltaToDriverBestSeconds(
  lapTimeSeconds: number,
  driverBestLapSeconds: number | null
): number | null

export type PaceHeatBand =
  | "best"
  | "nearBest"
  | "moderate"
  | "slow"
  | "verySlow"

export function paceHeatBand(deltaSeconds: number): PaceHeatBand

export function paceHeatStrokeColor(deltaSeconds: number): string
```

**Colour implementation notes (locked, see architecture §5.2):**

- **Discrete buckets only; no color interpolation.** `paceHeatBand` assigns one
  of five bands; `paceHeatStrokeColor` maps the band to a **fixed hex** from the
  ramp `#4ade80` / `#a3e635` / `#fbbf24` / `#fb923c` / `#f87171` (Tailwind
  400-series, matching existing legend trend chips).
- Do not return `var(--token-…)` strings for the heat stroke; CSS variables
  cannot be interpolated in SVG and make tests environment-dependent. Fixed hex
  keeps unit tests deterministic.
- Import no React in the model file.
- Unit-test boundaries against the **band**; assert the band → hex map once.

**Tests:** `src/__tests__/core/events/lap-by-lap-trend-chart-model.test.ts`

| Case                                      | Expect                                                            |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `delta = 0`                               | `best`                                                            |
| `delta = 0.0004`                          | `best`                                                            |
| `delta = 0.1`                             | `nearBest`                                                        |
| `delta = 0.15` boundary                   | `nearBest` / `moderate` per chosen inclusivity (document in test) |
| `delta = 0.5`                             | `slow`                                                            |
| `delta = 0.61`                            | `verySlow`                                                        |
| Band → hex map                            | Matches architecture §5.2 ramp exactly                            |
| `driverBestLapTimeInScope` empty laps     | `null`                                                            |
| `deltaToDriverBestSeconds` with null best | `null`                                                            |

**Checklist item:** Phase 1 complete when model tests pass.

---

### Phase 2 — Chart state and Display menu

**File:** `src/components/organisms/event-analysis/LapByLapTrendChart.tsx`

1. Add `showPaceHeatLine` state (default `false`).
2. `useEffect`: when `drivers.length !== 1`, set `showPaceHeatLine` to `false`.
3. Add Display menu row **Pace heat line** (hidden when `compact`).
4. Disable row when `drivers.length !== 1` per architecture §4.1.
5. Extend Display menu footer copy (architecture §4.1).
6. Do not render heat segments yet (toggle may be No-op visually in Phase 2 if
   you prefer single PR; otherwise combine with Phase 3).

**Tests:** component test — toggle disabled with 2 drivers, enabled with 1.

---

### Phase 3 — Heat segment rendering

**File:** `src/components/organisms/event-analysis/LapByLapTrendChart.tsx`

Inside the per-driver render loop:

```ts
const usePaceHeat = showPaceHeatLine && !compact && drivers.length === 1
```

When `usePaceHeat` for the sole driver:

1. Compute `driverBest = driverBestLapTimeInScope(driver)`.
2. Replace solid main `LinePath` with segment `LinePath`s (architecture §6.4).
3. Skip outlier `circle` markers for that driver.
4. Keep transparent wide hover path, trend line, smoothing unchanged.

When not `usePaceHeat`, keep existing solid line + outliers.

**Edge cases:**

- Single lap: render one `circle` at the point with heat color (no segments).
- Duplicate X dedupe: use same `lapPointsSorted` as solid line path.

---

### Phase 4 — Legend and a11y

**File:** `src/components/organisms/event-analysis/LapByLapTrendChart.tsx`

1. Pace scale legend row when `showPaceHeatLine && !compact` (architecture
   §4.2).
2. Append heat note to chart `desc` when active.
3. Driver swatch: optional gradient strip or neutral fill when heat on.

---

### Phase 5 — Documentation and catalog truth

1. Set architecture doc `status: active` when merged.
2. Update [event-analysis user guide](../user-guides/event-analysis.md).
3. Mark checklist complete in
   [lap-trend-pace-heat-line-checklist.md](lap-trend-pace-heat-line-checklist.md).
4. Update [implimentation_plans/README.md](README.md) status to **Implemented**.
5. Regenerate component catalog if props change materially:
   `docker exec -it mre-app node scripts/generate-component-catalog-markdown.mjs`

**No changes required:**

- `OverviewTab.tsx` (unless a call site passes `compact` incorrectly).
- `/api/v1/events/[eventId]/lap-trend/route.ts`
- `get-lap-data.ts`

---

## 4. File change summary

| File                                                                      | Change                        |
| ------------------------------------------------------------------------- | ----------------------------- |
| `src/core/events/lap-by-lap-trend-chart-model.ts`                         | Pace heat helpers + constants |
| `src/__tests__/core/events/lap-by-lap-trend-chart-model.test.ts`          | Unit tests                    |
| `src/components/organisms/event-analysis/LapByLapTrendChart.tsx`          | Toggle, render, legend        |
| `src/__tests__/components/event-analysis/lap-by-lap-trend-chart.test.tsx` | UI tests                      |
| `docs/architecture/lap-trend-pace-heat-line.md`                           | Status → active on ship       |
| `docs/user-guides/event-analysis.md`                                      | User-facing description       |
| `docs/implimentation_plans/README.md`                                     | Plan status                   |
| `docs/index/document-index.md`                                            | Index entries                 |

---

## 5. Component API (optional props)

v1 needs **no new public props**. Internal state only.

Future optional props (not in v1):

```ts
/** Force pace heat on (e.g. embedded analytics). Still requires one driver. */
defaultPaceHeatLine?: boolean
/** Disable pace heat feature entirely on this instance. */
enablePaceHeatLineToggle?: boolean  // default true when not compact
```

Document in architecture if added later.

---

## 6. Manual QA checklist

Run app in Docker (`docker compose up -d`). Event with lap data required.

### Setup

1. Open Event Analysis → Event Level Analysis → **Driver Analysis** card.
2. Choose a class with lap data.
3. Select **one** driver in the Drivers picker.

### Pace heat on

- [ ] Display → **Pace heat line** → On.
- [ ] Trace shows varying green/amber/red along the line.
- [ ] Personal best lap(s) appear greenest.
- [ ] Known slow laps appear warmer/redder.
- [ ] Pace legend visible under driver name row.
- [ ] Amber outlier dots **not** shown.
- [ ] Hover crosshair tooltip still works; **vs driver's best** aligns with
      color.

### Multi-driver

- [ ] Add second driver → heat toggle disables; heat turns off automatically.
- [ ] Both lines return to solid palette colors.

### Display interactions

- [ ] Trend line still visible when enabled (neutral dashed).
- [ ] Smoothing dashed line still uses driver color (or document if changed).
- [ ] Session dividers / position lanes unchanged.

### Compact tile

- [ ] Collapse Driver Analysis card → mini preview has no heat, no toggle.

### Regression

- [ ] Empty state, loading state, no drivers selected unchanged.
- [ ] Driver color picker still opens; color applies when heat off.

---

## 7. Automated test specification

### 7.1 Model tests (`lap-by-lap-trend-chart-model.test.ts`)

```ts
describe("paceHeatStrokeColor", () => {
  it("maps zero delta to success band")
  it("maps large delta to error band")
  it("maps mid deltas to warning band")
})

describe("driverBestLapTimeInScope", () => {
  it("returns min plottable lap time")
  it("returns null when no plottable laps")
})

describe("deltaToDriverBestSeconds", () => {
  it("computes positive delta for slower lap")
  it("returns null when best is null")
})
```

### 7.2 Component tests (`lap-by-lap-trend-chart.test.tsx`)

```ts
describe("pace heat line", () => {
  it("shows Pace heat line in Display menu when not compact")
  it("disables pace heat toggle when two drivers are selected")
  it("renders pace legend when heat is enabled with one driver")
  it("does not render pace legend when heat is off")
})
```

Use `fireEvent.click` on Display → Pace heat line. Query by
`role="menuitemcheckbox"` and accessible name **Pace heat line**.

SVG segment assertions: optional `data-testid="pace-heat-segments"` on a
wrapping `Group` when heat is on (implementer convenience for tests).

---

## 8. Rollout and risk

| Risk                        | Mitigation                                                         |
| --------------------------- | ------------------------------------------------------------------ |
| SVG DOM size on huge events | Monitor; quantize colors to merge segments in follow-up            |
| Color mismatch vs tooltip   | Single source: `deltaToDriverBestSeconds` + shared best lap helper |
| Confusion with multi-driver | Disabled toggle + footer copy                                      |
| Accessibility               | Legend labels + tooltip numbers                                    |

**Feature flag:** None in v1. Low risk; opt-in toggle default Off.

---

## 9. Definition of done

- [ ] All phases in [checklist](lap-trend-pace-heat-line-checklist.md) checked.
- [ ] `docker exec -it mre-app npm test` passes for touched tests.
- [ ] Manual QA §6 completed on at least one multi-session event.
- [ ] Architecture doc status updated to **Active**.
- [ ] User guide updated.

---

## 10. Follow-up ideas (out of scope)

Recorded in detail in
[lap-trend-pace-analysis-follow-ons.md](../future-ideas/lap-trend-pace-analysis-follow-ons.md).
Highest-leverage candidates (each reuses the Phase 1 helpers):

- **Pace heatmap matrix** — laps × sessions grid colored by the same scale.
- **Session fade chips** — per-session regression slope rendered in each band.
- **Clean-pace trend** — exclude outlier laps from the regression input.
- **Annotation handoff** — click a red segment to open the lap annotation flow.

Smaller items:

- Persist pace heat preference per `chartInstanceId` in `localStorage`.
- Optional metric: delta to **chart best** (session/class fastest).
- Percentage-of-best thresholds instead of absolute seconds (architecture §5.2).
- Color-blind safe alternative ramp.
- Quantized segment merging for performance.
- Heat on smoothing line (3-lap average pace).
- PB progression markers (tick each new personal best in scope).
- Traffic-vs-clean slow-lap classification using `positionOnLap` changes.
- Theoretical-best summary chip (best 3 consecutive laps, consistency %).
