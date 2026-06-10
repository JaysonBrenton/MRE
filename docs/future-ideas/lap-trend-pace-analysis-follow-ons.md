---
created: 2026-06-10
creator: Documentation
lastModified: 2026-06-10
description:
  Candidate follow-on features building on the lap trend pace heat line helpers
purpose:
  Record pace-analysis ideas that reuse the pace heat line model layer
  (paceHeatBand, deltaToDriverBestSeconds, per-session regression) so they can
  be revisited after the heat line ships without losing design context.
relatedFiles:
  - docs/architecture/lap-trend-pace-heat-line.md
  - docs/implimentation_plans/lap-trend-pace-heat-line-2026-06.md
  - docs/architecture/lap-annotations.md
  - src/components/organisms/event-analysis/LapByLapTrendChart.tsx
  - src/core/events/lap-by-lap-trend-chart-model.ts
---

# Ideas: Lap trend pace analysis follow-ons

These are **not planned or scoped**. Each idea deliberately reuses data and
helpers introduced (or already present) for the
[pace heat line](../architecture/lap-trend-pace-heat-line.md): `lapTimeSeconds`,
`positionOnLap`, `raceId`, session layout, the outlier heuristic
(`outlierLapKeysForDriver`), the per-driver linear regression, and the Phase 1
pace helpers (`paceHeatBand`, `paceHeatStrokeColor`,
`deltaToDriverBestSeconds`). None require API or ingestion changes.

## Highest-leverage candidates

### 1. Pace heatmap matrix (laps × sessions grid)

The heat line shows _where in time_ pace dropped; a matrix shows _patterns
across sessions_. Rows = sessions in chronological order (Q1, Q2, A-Main …),
columns = lap-in-session number, cells colored by the same `paceHeatStrokeColor`
scale. Answers questions the concatenated line cannot, e.g. _"do I always fade
after lap 8?"_ or _"was my first lap consistently slow?"_

- **Reuses:** pace band helpers, `computeSessionLayout`, lap-in-session numbers.
- **New work:** a grid organism (likely a sibling card, not a chart mode).

### 2. Session fade chips (per-session regression slope)

`LapByLapTrendChart` already computes a least-squares regression per driver over
the whole scope. Computing it **per session band** instead enables a small chip
in each band: `↘ -0.04s/lap` (improving) or `↗ +0.12s/lap` (fading). Turns the
trend line into a per-run tire/battery/driver fade diagnostic.

- **Reuses:** `linearRegression`, session layout, trend chip styling (green-400
  / amber-400) from the legend.
- **New work:** session-scoped regression inputs + band-anchored chip layout.

### 3. Clean-pace trend (outlier-excluded regression)

The dashed trend line currently regresses over **all** laps, so a single crash
lap drags the slope. The outlier heuristic already flags those laps. A Display
option ("Trend excludes slow outliers") would feed only non-outlier laps to the
regression, showing true pace evolution.

- **Reuses:** `outlierLapKeysForDriver`, existing trend rendering.
- **New work:** one Display toggle + filtered regression input. Smallest item
  here; arguably a quality fix.

### 4. Heat line → lap annotation handoff

[Lap annotations](../architecture/lap-annotations.md) already exist as a design.
Synergy: clicking a red (slow) segment on the heat line opens the annotation
flow pre-filled with that lap (crash, traffic, pit). Later, annotated laps can
render with a distinct marker so explained slow laps stop drawing attention.

- **Reuses:** pace bands for affordance, annotation design.
- **New work:** segment click target + annotation entry point wiring.

## Smaller candidates

| Idea                          | Summary                                                                                                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PB progression markers        | Tick/star each lap that set a new personal best in scope; shows when in the event pace was found (setup validation).                                                                            |
| Field-relative heat scale     | Alternative metric: delta to the fastest lap in class at the same lap index (`deltaToChartBestSeconds` already exists). Distinguishes "I was slow" from "everyone was slow" (track conditions). |
| Theoretical-best summary chip | RC-standard stats beside the legend: best 3 consecutive laps, consistency %. One reduce over data already in the chart.                                                                         |
| Traffic-vs-clean slow laps    | A slow lap where `positionOnLap` also dropped is likely traffic/incident; stable position suggests genuine pace loss. Could refine outlier markers and heat coloring (e.g. hatched segment).    |
| Percentage-of-best thresholds | Express heat thresholds as % of best lap (e.g. +0.5% / +1.5% / +3%) so the scale adapts across lap lengths; recorded in architecture §5.2 as a v2 consideration.                                |
| Color-blind safe ramp         | Alternative blue → yellow ramp selectable at Display or profile level; cheap once `paceHeatStrokeColor` is the single color source.                                                             |
| Persisted heat preference     | Persist the toggle per `chartInstanceId` in `localStorage`, like driver line colors.                                                                                                            |
| Quantized segment merging     | Merge adjacent same-band segments to cut SVG node count on 4-digit-lap events.                                                                                                                  |

## Promotion path

When an idea matures, promote it per repo convention: a plan under
`docs/implimentation_plans/` (or `docs/plans/`), an ADR if architectural, and an
update to the
[pace heat line architecture doc](../architecture/lap-trend-pace-heat-line.md)
if it changes that feature's behaviour.
