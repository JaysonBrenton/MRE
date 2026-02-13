# Lap Time Line Chart Improvements Implementation Plan

**Created**: 2026-02-01  
**Source**: Chart UX review — LapTimeLineChart / ChartContainer in My Laps tab  
**Related Components**: `LapTimeLineChart.tsx`, `ChartContainer.tsx`, `MyLapsContent.tsx`  
**Owner**: Frontend Engineering  
**Objective**: Improve the Lap Time Line Chart with enhanced interactivity, visual clarity,
accessibility, and alignment with chart design standards.

---

## 0. Guiding Goals

1. **User Experience** – Make it easier to compare drivers, read exact values, and
   focus on specific data without clutter.

2. **Consistency** – Align with `docs/design/chart-design-standards.md` and patterns
   used in `BestLapBarChart`, `UnifiedPerformanceChart`, and other chart components.

3. **Phased Delivery** – Prioritize high-impact, lower-effort items first; defer
   optional enhancements to later phases.

4. **Reuse Existing Infrastructure** – Extend `LapTimeLineChart`, `ChartContainer`,
   `ChartColorPicker`, and `useChartColors`; avoid duplicating logic.

---

## 1. Current State Summary

### 1.1 Chart Location & Usage

| Location | Component | Purpose |
| -------- | --------- | ------- |
| My Laps tab (SessionChartTabs) | `MyLapsContent` → `LapTimeLineChart` | Compare user-selected drivers' lap times across laps |
| Comparisons tab | `ComparisonsTab` → `LapTimeLineChart` | Compare lap times for selected drivers |

### 1.2 Current Features

- Line paths for each driver with `curveMonotoneX` smoothing
- Tooltip on hover (shows single closest driver)
- Legend with driver visibility toggle (click to show/hide)
- `useChartColors` for persistent per-driver colors
- `ParentSize` for responsive width
- Empty and loading states

### 1.3 Gaps Identified

| Gap | Impact | Effort |
| --- | ------ | ------ |
| No color customization UI | Users cannot personalize driver colors | Low |
| No data points on lines | Hard to see exact lap positions when lines overlap | Medium |
| Single-driver tooltip | Cannot compare all drivers at same lap at once | Medium |
| No driver emphasis on hover | Overlapping lines are hard to track | Low |
| Design standards deviations | Inconsistent with other charts | Low |
| No reference lines | No visual baseline (avg, best lap) | Medium |
| No multi-driver crosshair | No vertical alignment for lap comparison | Medium |

---

## 2. Phase 1: High-Impact Quick Wins

### 2.1 Per-Driver Color Customization

**Goal**: Allow users to change each driver's line color via legend click.

**Reference**: `BestLapBarChart.tsx` (legend click → `ChartColorPicker`), `UnifiedPerformanceChart.tsx` (bar click → color picker per metric).

**Implementation**:

1. Add state for color picker: `showColorPicker`, `colorPickerDriverId`, `colorPickerPosition`
2. On legend item click (when not toggling visibility), open `ChartColorPicker` positioned below the clicked legend item
3. Pass `currentColor={colors[colorPickerDriverId]}` and `onColorChange={(c) => setColor(colorPickerDriverId, c)}`
4. Only open color picker on click; keep existing click-to-toggle-visibility behavior. Use a small "color" affordance (e.g., swatch icon or secondary action) if needed to distinguish from visibility toggle.

**Alternative**: Add a small color-swatch button beside each legend item; clicking the swatch opens the picker, clicking the label toggles visibility.

**Files**: `LapTimeLineChart.tsx`

### 2.2 Data Points on Lines

**Goal**: Render a small circle at each lap data point to clarify exact positions.

**Implementation**:

1. Import `Circle` from `@visx/shape`
2. For each `visibleData` driver, after `LinePath`, map over `validLaps` and render `<Circle key={...} cx={xScale(d.lapNumber)} cy={yScale(d.lapTimeSeconds)} r={3} fill={color} stroke={color} strokeWidth={1} />`
3. Use radius 3–4px; ensure fill matches stroke for visibility on dark background
4. Consider reducing point radius when many laps (e.g. r=2 if laps > 30) to avoid clutter

**Files**: `LapTimeLineChart.tsx`

### 2.3 Driver Emphasis on Legend Hover

**Goal**: When hovering a legend item, highlight that driver's line (thicker, full opacity) and dim others.

**Implementation**:

1. Add state: `hoveredDriverId: string | null`
2. On legend item `onMouseEnter` → `setHoveredDriverId(driver.driverId)`; `onMouseLeave` → `setHoveredDriverId(null)`
3. When rendering `LinePath`: if `hoveredDriverId` is set, apply `strokeWidth={driver.driverId === hoveredDriverId ? 3 : 1.5}` and `strokeOpacity={driver.driverId === hoveredDriverId ? 1 : 0.4}`
4. Ensure transition is smooth (optional `transition` attribute on SVG if supported, or accept instant change)

**Files**: `LapTimeLineChart.tsx`

### 2.4 Design Standards Alignment

**Goal**: Align LapTimeLineChart with `docs/design/chart-design-standards.md`.

**Changes**:

| Item | Current | Target | File |
| ---- | ------- | ------ | ---- |
| Grid ticks | `yScale.ticks(8)` | `yScale.ticks(5)` | LapTimeLineChart.tsx |
| Color palette | `defaultDriverColors[0] = "#3a8eff"` | First color `var(--token-accent)` or equivalent hex per §3.2 | LapTimeLineChart.tsx |
| Bottom margin | `bottom: 60` | Keep 60 for numeric X-axis (lap numbers); §2.1 says 100 for rotated labels — lap numbers don't need rotation | No change (document rationale if questioned) |

**Files**: `LapTimeLineChart.tsx`

---

## 3. Phase 2: Multi-Driver Tooltip & Crosshair

### 3.1 Multi-Driver Tooltip at Same Lap

**Goal**: When hovering, show all drivers' lap times at the nearest lap number in a single tooltip.

**Implementation**:

1. On `handleTooltipHover`, instead of finding closest driver by 2D distance:
   - Map `mouseX` to nearest lap number: `lapNum = Math.round(xScale.invert(mouseX))`
   - Clamp `lapNum` to valid range (e.g. `originalXDomain[0]` to `originalXDomain[1]`)
2. For each `visibleData` driver, find `LapTimeDataPoint` where `lapNumber === lapNum`
3. Build tooltip data: `{ lapNumber, drivers: [{ driverName, lapTimeSeconds }] }`
4. Render tooltip with:
   - Lap number header
   - List of driver name + `formatLapTime(lapTimeSeconds)` for each
   - Sort by lap time (fastest first) for quick comparison

**Files**: `LapTimeLineChart.tsx`

### 3.2 Vertical Crosshair at Hover Lap

**Goal**: Draw a vertical line at the hovered lap number to align visually with the tooltip.

**Implementation**:

1. When tooltip is open, compute `xPos = xScale(tooltipLapNumber)` (or use `tooltipLeft` if snapped to cursor; prefer snapping to lap for consistency)
2. Render a `<line x1={xPos} x2={xPos} y1={0} y2={innerHeight} stroke={borderColor} strokeDasharray="4,4" opacity={0.6} />` inside the chart Group
3. Ensure crosshair does not interfere with tooltip positioning

**Files**: `LapTimeLineChart.tsx`

---

## 4. Phase 3: Reference Lines & Optional Enhancements

### 4.1 Reference Lines (Best Lap / Average)

**Goal**: Optional horizontal reference lines (e.g., driver average, personal best).

**Implementation**:

1. Add optional prop: `referenceLines?: { value: number; label?: string; stroke?: string }[]`
2. For each reference line, render `<line x1={0} x2={innerWidth} y1={yScale(value)} y2={yScale(value)} stroke={stroke ?? "var(--token-border-default)"} strokeDasharray="6,4" opacity={0.5} />`
3. Optionally add a text label at the end of the line (e.g., "Avg: 0:42.5")
4. `MyLapsContent` can compute user's average lap and pass `referenceLines={[{ value: avgLapTime, label: "Your average" }]}`

**Files**: `LapTimeLineChart.tsx`, `MyLapsContent.tsx` (optional usage)

### 4.2 Best Lap Markers (Optional)

**Goal**: Visually mark each driver's best lap on their line (e.g., star or different-colored point).

**Implementation**:

1. Add optional prop: `highlightBestLaps?: boolean` (default false)
2. For each driver, compute `bestLap = laps.reduce((best, l) => l.lapTimeSeconds < best.lapTimeSeconds ? l : best, laps[0])`
3. At that point, render a `<Circle r={5} fill="var(--token-accent)" stroke="white" strokeWidth={1} />` or similar
4. Consider adding to tooltip: "Best lap" badge when hovering that point

**Files**: `LapTimeLineChart.tsx`

### 4.3 ChartColorPicker for Title Click (Optional)

**Goal**: Mirror `BestLapBarChart` pattern where clicking the chart title opens a color customization UI.

**Implementation**:

1. For multi-driver charts, title click could open a small dropdown/modal listing drivers; selecting one opens `ChartColorPicker` for that driver
2. Simpler alternative: rely on legend-item color-picker only (Phase 1) and skip title click for LapTimeLineChart

**Files**: `LapTimeLineChart.tsx`, `ChartContainer.tsx` (already supports `onTitleClick`)

---

## 5. File Summary

### Phase 1

| Action | File |
| ------ | ---- |
| Modify | `src/components/organisms/event-analysis/LapTimeLineChart.tsx` |

### Phase 2

| Action | File |
| ------ | ---- |
| Modify | `src/components/organisms/event-analysis/LapTimeLineChart.tsx` |

### Phase 3

| Action | File |
| ------ | ---- |
| Modify | `src/components/organisms/event-analysis/LapTimeLineChart.tsx` |
| Modify | `src/components/organisms/event-analysis/MyLapsContent.tsx` (optional — pass reference lines) |

---

## 6. Implementation Order

### Phase 1 Tasks (Recommended Order)

1. **Design standards alignment** — Grid ticks, color palette
2. **Per-driver color customization** — Legend item → ChartColorPicker
3. **Data points on lines** — Circle at each LapTimeDataPoint
4. **Driver emphasis on legend hover** — Highlight line on legend hover

### Phase 2 Tasks

1. **Multi-driver tooltip** — Snap to lap, show all drivers at that lap
2. **Vertical crosshair** — Line at hovered lap number

### Phase 3 Tasks (As Needed)

1. **Reference lines** — Optional prop and rendering
2. **Best lap markers** — Optional prop and Circle at best lap
3. **Title click color picker** — Optional; evaluate after Phase 1 legend behavior

---

## 7. Verification Checklist

### Phase 1

- [ ] Grid uses 5 ticks per design standards
- [ ] First driver color uses token/accent-aligned palette
- [ ] Clicking legend color swatch (or secondary affordance) opens ChartColorPicker
- [ ] Color change persists via useChartColors / localStorage
- [ ] Circles render at each lap point; no overlap issues with many laps
- [ ] Hovering legend item highlights that driver's line and dims others
- [ ] Legend still toggles visibility on click (primary action unchanged)
- [ ] Chart design standards compliance per §16 validation checklist

### Phase 2

- [ ] Tooltip shows all visible drivers' times at the hovered lap
- [ ] Tooltip sorts drivers by lap time (fastest first)
- [ ] Vertical crosshair appears at hovered lap
- [ ] Tooltip and crosshair dismiss on mouse leave

### Phase 3

- [ ] Reference lines render when provided
- [ ] Best lap markers render when `highlightBestLaps` is true (if implemented)
- [ ] MyLapsContent can pass user average as reference line (if implemented)

---

## 8. Related Documentation

- `docs/design/chart-design-standards.md` — Chart styling and tokens
- `docs/implimentation_plans/my-laps-section-implementation-plan.md` — My Laps tab context
- `src/components/organisms/event-analysis/BestLapBarChart.tsx` — Color picker pattern
- `src/components/organisms/event-analysis/UnifiedPerformanceChart.tsx` — Multi-series color picker
- `src/components/organisms/event-analysis/ChartColorPicker.tsx` — Color picker component
- `src/hooks/useChartColors.ts` — Color state and persistence
