---
created: 2026-06-10
owner: Frontend Delivery / Event Analysis
lastModified: 2026-06-10
status: planned
purpose: Task tracker for lap trend pace heat line implementation.
relatedDocs:
  - docs/architecture/lap-trend-pace-heat-line.md
  - docs/implimentation_plans/lap-trend-pace-heat-line-2026-06.md
---

# Lap trend pace heat line — checklist

Normative spec:
[architecture/lap-trend-pace-heat-line.md](../architecture/lap-trend-pace-heat-line.md)

Implementation plan:
[lap-trend-pace-heat-line-2026-06.md](lap-trend-pace-heat-line-2026-06.md)

**Legend:** `[ ]` todo · `[x]` done · `[-]` skipped / N/A

---

## Phase 1 — Model layer

- [ ] Add `PACE_HEAT_THRESHOLDS` constants to `lap-by-lap-trend-chart-model.ts`
- [ ] Implement `driverBestLapTimeInScope`
- [ ] Implement `deltaToDriverBestSeconds`
- [ ] Implement `paceHeatBand` (five discrete bands) and `paceHeatStrokeColor`
      (fixed hex ramp, architecture §5.2; no CSS vars, no interpolation)
- [ ] Unit tests for band boundaries (0, 0.15, 0.35, 0.6+) and band → hex map
- [ ] Unit tests for null/empty driver edge cases
- [ ] `docker exec -it mre-app npm test -- lap-by-lap-trend-chart-model.test.ts`
      green

---

## Phase 2 — Display menu and state

- [ ] Add `showPaceHeatLine` state to `LapByLapTrendChart`
- [ ] Reset heat off when `drivers.length !== 1`
- [ ] Add **Pace heat line** `menuitemcheckbox` (non-compact only)
- [ ] Disable toggle when multiple drivers; `aria-disabled` correct
- [ ] Display footer copy (single-driver requirement + heat explanation)
- [ ] Component test: toggle disabled with 2 drivers
- [ ] Component test: toggle operable with 1 driver

---

## Phase 3 — Rendering

- [ ] Per-segment `LinePath` when heat on + one driver
- [ ] Single-lap edge case (dot or degenerate segment)
- [ ] Hide outlier amber dots when heat on
- [ ] Solid line path when heat off (unchanged)
- [ ] Transparent hover path unchanged
- [ ] Trend + smoothing lines unchanged
- [ ] Optional `data-testid="pace-heat-segments"` for tests
- [ ] Component test: legend or testid present when heat on

---

## Phase 4 — Legend and accessibility

- [ ] Pace scale legend (Personal best · Slower · Much slower)
- [ ] Update SVG `desc` when heat enabled
- [ ] Driver swatch behaviour documented / acceptable when heat on

---

## Phase 5 — Docs and ship

- [ ] Manual QA (implementation plan §6) on real event data
- [ ] `docker exec -it mre-app npm test` full suite for touched files
- [ ] Update `docs/user-guides/event-analysis.md`
- [ ] Set `lap-trend-pace-heat-line.md` status to **Active**
- [ ] Update `docs/implimentation_plans/README.md` → Implemented
- [ ] Update `docs/index/document-index.md`
- [ ] Update `docs/README.md` link if applicable

---

## Post-ship support

- [ ] Verify user guide matches shipped labels (Display menu spelling)
- [ ] Add troubleshooting row to architecture §9 if new issues found
