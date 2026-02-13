---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Authoritative design standards for all chart components in MRE
purpose:
  Locks in consistent chart design patterns to prevent visual inconsistencies.
  All charts MUST follow these standards exactly. These rules are binding, not
  advisory.
relatedFiles:
  - src/components/event-analysis/ChartContainer.tsx
  - src/components/event-analysis/BestLapBarChart.tsx
  - src/components/event-analysis/AvgVsFastestChart.tsx
  - src/components/event-analysis/sessions/DriverPerformanceChart.tsx
  - docs/design/mre-dark-theme-guidelines.md
---

# Chart Design Standards

**Version:** 0.1.1  
**Status:** Authoritative Design Standard  
**Scope:** Governs all chart components in the MRE application  
**Applicability:** ALL contributors, including Cursor, Copilot, and ChatGPT
Coding Mode

This document defines the **mandatory design standards** for all chart
components in My Race Engineer (MRE). These rules ensure visual consistency
across all charts and prevent design regressions.

**These rules are binding, not advisory.** All chart implementations must follow
these standards exactly.

---

## 1. Chart Container Requirements

### 1.1 Mandatory Wrapper

**ALL charts MUST use `ChartContainer` component:**

```tsx
import ChartContainer from "./ChartContainer"
;<ChartContainer
  title="Chart Title"
  height={400}
  className=""
  aria-label="Descriptive chart label"
>
  {/* Chart content */}
</ChartContainer>
```

**Reference:** `src/components/event-analysis/ChartContainer.tsx`

### 1.2 Default Height

- **Standard height:** `400px` (default)
- **Taller charts:** `500px` (for multi-line or complex charts)
- **Height must be consistent** across similar chart types

---

## 2. Margins and Spacing

### 2.1 Standard Margins

**ALL charts MUST use this exact margin configuration:**

```tsx
const defaultMargin = { top: 20, right: 20, bottom: 100, left: 80 }
```

**Critical:** The `bottom: 100` margin is **mandatory** to accommodate rotated
X-axis labels. Never reduce this value.

**Rationale:** X-axis labels are rotated at -45 degrees and require extra
vertical space. Using `bottom: 60` or less causes label overlap and visual
inconsistency.

### 2.2 Inner Dimensions

Calculate inner dimensions using:

```tsx
const innerWidth = width - margin.left - margin.right
const innerHeight = height - margin.top - margin.bottom
```

---

## 3. Color Tokens

### 3.1 Mandatory Color Variables

**ALL charts MUST use these exact color token variables:**

```tsx
const textColor = "var(--token-text-primary)"
const textSecondaryColor = "var(--token-text-secondary)"
const borderColor = "var(--token-border-default)"
const accentColor = "var(--token-accent)"
```

**Forbidden:**

- Hardcoded color values (except for specific data series colors)
- Direct hex/rgb values for text, borders, or backgrounds
- CSS color names (e.g., `"red"`, `"blue"`)

**Allowed:**

- Specific data series colors (e.g., `"#5aa2ff"` for average lap bars)
- Multi-driver color palettes for line charts

### 3.2 Chart-Specific Colors

**Bar Charts (Single Series):**

- Primary bars: `var(--token-accent)`

**Bar Charts (Multiple Series):**

- Fastest lap: `var(--token-accent)`
- Average lap: `"#5aa2ff"` (specific blue for comparison)

**Line Charts (Multi-Driver):**

- Use color palette:
  `["var(--token-accent)", "#4ecdc4", "#ff6b6b", "#ffe66d", "#a8e6cf", "#ff8b94"]`
- Cycle through palette using modulo:
  `driverColors[index % driverColors.length]`

---

## 4. Axis Configuration

### 4.1 Y-Axis (Left Axis) - MANDATORY

**ALL charts with Y-axis MUST use this exact configuration:**

```tsx
<AxisLeft
  scale={yScale}
  tickFormat={(value) => formatLapTime(Number(value))}
  stroke={borderColor}
  tickStroke={borderColor}
  tickLabelProps={() => ({
    fill: textSecondaryColor,
    fontSize: 12,
    textAnchor: "end",
    dx: -8,
  })}
/>
```

**Key Requirements:**

- `fontSize: 12` (exact value)
- `textAnchor: "end"` (right-aligned)
- `dx: -8` (exact offset)
- `fill: textSecondaryColor` (use token)
- `stroke` and `tickStroke: borderColor` (use token)

**Optional Y-Axis Label:**

- Only add `label` prop if chart needs axis label
- Label props:
  `{ fill: textSecondaryColor, fontSize: 12, textAnchor: "middle", dy: -50 }`

### 4.2 X-Axis (Bottom Axis) - MANDATORY

**ALL charts with X-axis labels (driver names, session labels, etc.) MUST use
this exact configuration:**

```tsx
<AxisBottom
  top={innerHeight}
  scale={xScale}
  stroke={borderColor}
  tickStroke={borderColor}
  tickLabelProps={() => ({
    fill: textSecondaryColor,
    fontSize: 11,
    textAnchor: "end",
    angle: -45,
    dx: -5,
    dy: 8,
  })}
/>
```

**Critical Requirements:**

- `fontSize: 11` (exact value, NOT 12)
- `textAnchor: "end"` (NOT "middle")
- `angle: -45` (MANDATORY - labels must be rotated)
- `dx: -5, dy: 8` (exact offsets)
- `fill: textSecondaryColor` (use token)
- `stroke` and `tickStroke: borderColor` (use token)

**Why This Matters:**

- Rotated labels prevent overlap and ensure readability
- Horizontal labels (`textAnchor: "middle"`, no `angle`) cause names to overlap
  and appear as one long string
- This was a critical bug that caused driver names to display incorrectly

**Forbidden X-Axis Configurations:**

```tsx
// ❌ FORBIDDEN - causes label overlap
tickLabelProps={() => ({
  textAnchor: "middle",  // WRONG
  // missing angle        // WRONG
  fontSize: 12,           // WRONG (should be 11)
})}

// ❌ FORBIDDEN - inconsistent styling
tickLabelProps={() => ({
  fontSize: 10,          // WRONG (must be 11)
  angle: -30,            // WRONG (must be -45)
})}
```

---

## 5. Grid Lines

### 5.1 Standard Grid Configuration

**ALL charts with Y-axis MUST include grid lines:**

```tsx
{
  yScale
    .ticks(5)
    .map((tick) => (
      <line
        key={tick}
        x1={0}
        x2={innerWidth}
        y1={yScale(tick)}
        y2={yScale(tick)}
        stroke={borderColor}
        strokeWidth={1}
        strokeDasharray="2,2"
        opacity={0.3}
      />
    ))
}
```

**Requirements:**

- `stroke: borderColor` (use token)
- `strokeWidth: 1` (exact value)
- `strokeDasharray="2,2"` (dashed pattern)
- `opacity: 0.3` (exact value)
- Use `yScale.ticks(5)` for standard tick count

---

## 6. Typography

### 6.1 Font Sizes

**Mandatory font sizes:**

- Y-axis labels: `12px`
- X-axis labels: `11px`
- Tooltip titles: `font-semibold` (default size)
- Tooltip content: `text-sm` (14px)

### 6.2 Text Colors

**Mandatory text colors:**

- Primary text: `var(--token-text-primary)`
- Secondary text (axes, tooltips): `var(--token-text-secondary)`
- Chart titles: `var(--token-text-primary)` with `font-semibold`

---

## 7. Tooltip Styling

### 7.1 Standard Tooltip Configuration

**ALL charts with tooltips MUST use this exact styling:**

```tsx
<TooltipWithBounds
  top={tooltipTop}
  left={tooltipLeft}
  style={{
    ...defaultStyles,
    backgroundColor: "var(--token-surface-elevated)",
    border: `1px solid ${borderColor}`,
    color: textColor,
    padding: "8px 12px",
    borderRadius: "4px",
  }}
>
  <div className="space-y-1">
    <div className="font-semibold text-[var(--token-text-primary)]">
      {tooltipData.driverName}
    </div>
    <div className="text-sm text-[var(--token-text-secondary)]">
      {/* Tooltip content */}
    </div>
  </div>
</TooltipWithBounds>
```

**Requirements:**

- Background: `var(--token-surface-elevated)`
- Border: `1px solid ${borderColor}`
- Padding: `"8px 12px"` (exact values)
- Border radius: `"4px"` (exact value)
- Title: `font-semibold text-[var(--token-text-primary)]`
- Content: `text-sm text-[var(--token-text-secondary)]`

---

## 8. Data Formatting

### 8.1 Lap Time Formatting

**ALL lap time values MUST use this exact formatting function:**

```tsx
/**
 * Format lap time in seconds to MM:SS.mmm format
 */
function formatLapTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  const wholeSecs = Math.floor(secs)
  const millis = Math.floor((secs - wholeSecs) * 1000)
  return `${minutes}:${wholeSecs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`
}
```

**Format:** `MM:SS.mmm` (e.g., `0:35.500`, `1:23.456`)

**Usage:**

- Y-axis tick labels: `tickFormat={(value) => formatLapTime(Number(value))}`
- Tooltips: `formatLapTime(tooltipData.lapTime)`
- Aria labels: `formatLapTime(d.lapTime)`

---

## 9. Accessibility Requirements

### 9.1 ARIA Labels

**ALL charts MUST include:**

```tsx
<ChartContainer
  aria-label="Descriptive chart label"
  // ...
>
```

**Chart SVG:**

```tsx
<svg width={width} height={height} aria-labelledby={chartDescId} role="img">
  <desc id={chartDescId}>
    Detailed description of chart content and purpose.
  </desc>
</svg>
```

### 9.2 Interactive Elements

**ALL interactive chart elements (bars, points) MUST include:**

```tsx
aria-label={`${d.driverName}: ${formatLapTime(d.lapTime)}`}
role="button"
tabIndex={0}
onKeyDown={(e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault()
    handleClick()
  }
}}
```

**Focus styling (mandatory):** Any focusable chart element (`role="button"`, `tabIndex={0}`) MUST include `className="focus:outline-none"` (or equivalent) so the browser default focus outline (e.g. white/yellow rectangle) is not shown when the element receives focus (e.g. after opening a color picker). Without this, users see an unwanted rectangular focus ring. Use the same pattern for any new focusable chart elements (bars, line series groups, etc.).

---

## 10. Responsive Behavior

### 10.1 ParentSize Wrapper

**ALL charts MUST use ParentSize for responsive width:**

```tsx
<ParentSize>
  {({ width: parentWidth }) => {
    const width = parentWidth || 800

    if (width === 0) {
      return null
    }

    // Chart rendering
  }}
</ParentSize>
```

**Requirements:**

- Fallback width: `800px` (for SSR)
- Return `null` if width is `0` (during initial SSR)
- Use `parentWidth` when available

### 10.2 Chart Wrapper When Content Is Below the SVG (e.g. Legend)

**Charts that render content below the SVG (legend, pagination, etc.) MUST use `minHeight` on the wrapper, not a fixed `height`.** Otherwise the wrapper clips the content and `ChartContainer`'s `overflow: hidden` will hide the legend.

```tsx
// ✅ Correct: wrapper grows to include legend
<div className="relative w-full" style={{ minHeight: `${height}px` }}>
  <ParentSize>{/* SVG with height={height} */}</ParentSize>
  <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">{/* Legend */}</div>
</div>

// ❌ Wrong: fixed height clips legend
<div className="relative w-full" style={{ height: `${height}px` }}>
```

**Reference:** `LapTimeLineChart.tsx` — lap-time line graphs with a below-chart legend use this pattern.

---

## 11. Empty State Handling

### 11.1 No Data States

**ALL charts MUST handle empty data:**

```tsx
if (displayData.length === 0) {
  return (
    <ChartContainer
      title="Chart Title"
      height={height}
      className={className}
      aria-label="Chart title - no data available"
    >
      <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
        No data available
      </div>
    </ChartContainer>
  )
}
```

**Requirements:**

- Show ChartContainer (maintains layout)
- Center message: `flex items-center justify-center h-full`
- Text color: `text-[var(--token-text-secondary)]`
- Descriptive message based on context

---

## 12. Pagination

### 12.1 Chart Pagination Component

**Charts with pagination MUST use:**

```tsx
import ChartPagination from "./ChartPagination"

{
  onPageChange && totalPages > 1 && (
    <ChartPagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      itemsPerPage={driversPerPage}
      totalItems={sortedData.length}
      itemLabel="drivers"
    />
  )
}
```

**Requirements:**

- Only show if `totalPages > 1`
- Use `itemLabel="drivers"` for driver-based charts
- Use appropriate label for other chart types

---

## 13. Legend Styling

### 13.1 Standard Legend

**Charts with legends MUST use:**

```tsx
<div className="flex items-center gap-4 mt-4 text-sm">
  <div className="flex items-center gap-2">
    <div className="w-4 h-4" style={{ backgroundColor: color }} />
    <span className="text-[var(--token-text-secondary)]">Label</span>
  </div>
</div>
```

**Requirements:**

- Container: `flex items-center gap-4 mt-4 text-sm`
- Color indicator: `w-4 h-4` (exact size)
- Text: `text-[var(--token-text-secondary)]`
- Gap between items: `gap-2`

---

## 14. Scale Configuration

### 14.1 Y-Scale (Lap Times)

**Standard Y-scale for lap time charts:**

```tsx
const maxLapTime = Math.max(...paginatedData.map((d) => d.lapTime))
const minLapTime = Math.min(...paginatedData.map((d) => d.lapTime))
const padding = (maxLapTime - minLapTime) * 0.1
const yScale = scaleLinear({
  range: [innerHeight, 0],
  domain: [
    Math.max(0, minLapTime - padding), // Clamp to 0
    maxLapTime + padding,
  ],
  nice: true,
})
```

**Requirements:**

- Padding: `10%` of range (`0.1`)
- Clamp minimum to `0` (prevent negative values)
- Use `nice: true` for clean tick values

### 14.2 X-Scale (Categorical)

**Standard X-scale for categorical data (driver names, sessions):**

```tsx
const xScale = scaleBand({
  range: [0, innerWidth],
  domain: paginatedData.map((d) => d.driverName),
  padding: 0.3, // or 0.2 for line charts
})
```

**Requirements:**

- Bar charts: `padding: 0.3`
- Line charts: `padding: 0.2`
- Domain: array of categorical values

---

## 15. Common Patterns

### 15.1 Bar Chart Pattern

**Standard bar chart structure:**

1. Filter and sort data
2. Calculate pagination
3. Set up scales (band X, linear Y)
4. Render grid lines
5. Render bars with interaction handlers
6. Render axes
7. Render tooltip
8. Render legend (if multi-series)
9. Render pagination (if needed)

### 15.2 Line Chart Pattern

**Standard line chart structure:**

1. Filter and validate data
2. Calculate scales (band X for categories, linear Y)
3. Render grid lines
4. Render line paths
5. Render data points
6. Render axes
7. Render tooltip
8. Render legend
9. Render pagination (if needed)

---

## 16. Validation Checklist

**Before submitting any chart component, verify:**

- [ ] Uses `ChartContainer` wrapper
- [ ] Margins: `{ top: 20, right: 20, bottom: 100, left: 80 }`
- [ ] Y-axis: `fontSize: 12`, `textAnchor: "end"`, `dx: -8`
- [ ] X-axis: `fontSize: 11`, `textAnchor: "end"`, `angle: -45`, `dx: -5`,
      `dy: 8`
- [ ] Colors use token variables (no hardcoded values for text/borders)
- [ ] Grid lines: `strokeDasharray="2,2"`, `opacity: 0.3`
- [ ] Tooltip uses standard styling
- [ ] `formatLapTime()` function matches standard
- [ ] ARIA labels included
- [ ] Empty state handled
- [ ] Responsive with `ParentSize`
- [ ] Accessibility: `role`, `tabIndex`, `onKeyDown` on interactive elements

---

## 17. Examples

### 17.1 Reference Implementations

**These charts are the authoritative reference implementations:**

1. **BestLapBarChart.tsx** - Single-series bar chart
2. **AvgVsFastestChart.tsx** - Multi-series bar chart
3. **LapTimeLineChart.tsx** - Lap-time line graph (multi-driver lap times over laps; zoom, tooltips, below-chart legend)
4. **DriverPerformanceChart.tsx** - Multi-line chart (sessions)

**All new charts MUST follow the patterns in these files exactly.** Future line-graph charts (e.g. lap times vs lap number) should be built the same way as LapTimeLineChart: ChartContainer, ParentSize, Visx (LinePath, scales, axes, tooltip), `useChartColors`, and a below-chart legend with wrapper `minHeight` per §10.2.

---

## 18. Breaking Changes

**These standards are locked in for version 0.1.1. Changes require:**

1. Update this document
2. Update all existing chart components
3. Update this document's `lastModified` date
4. Document rationale for change

**Common mistakes that cause inconsistencies:**

1. ❌ Using `bottom: 60` instead of `bottom: 100` → causes X-axis label overlap
2. ❌ Using `textAnchor: "middle"` on X-axis → causes horizontal label overlap
3. ❌ Omitting `angle: -45` on X-axis → causes horizontal label overlap
4. ❌ Using `fontSize: 12` on X-axis → inconsistent with standard `11`
5. ❌ Hardcoding colors instead of tokens → breaks theme consistency

---

## 19. Related Documentation

- `docs/design/mre-dark-theme-guidelines.md` - Token system reference
- `docs/design/mre-ux-principles.md` - General UX principles
- `src/components/event-analysis/ChartContainer.tsx` - Container component

---

**Last Updated:** 2025-01-27  
**Version:** 0.1.1  
**Status:** Authoritative Standard
