---
created: 2026-05-30
owner: Frontend Delivery / Event Analysis
lastModified: 2026-05-30
purpose:
  Phased implementation plan for collapsible Event/Session Level Analysis glass
  cards with an in-tile "mini" chart preview, inline dense-grid reflow on
  expand, and a jank-free height animation that swaps chart render size only
  once (after the transition completes).
relatedDocs:
  - docs/architecture/atomic-design-system.md
  - docs/design/mre-ux-principles.md
  - docs/design/mre-dark-theme-guidelines.md
  - docs/architecture/event-analysis-mains-ladder.md
  - docs/AGENTS.md
relatedFiles:
  - src/components/organisms/event-analysis/OverviewCollapsibleGlassCard.tsx
  - src/components/organisms/event-analysis/event-analysis-ui-state.tsx
  - src/components/organisms/event-analysis/OverviewTab.tsx
  - src/components/organisms/event-analysis/LapByLapTrendChart.tsx
  - src/components/organisms/event-analysis/UnifiedPerformanceChart.tsx
  - src/components/organisms/event-analysis/ChartContainer.tsx
---

# Collapsible analysis cards + mini chart preview — implementation plan (May 2026)

Runtime verification is **Docker-only** per [AGENTS.md](../AGENTS.md)
(`docker exec -it mre-app …`). This plan builds on work already shipped:
`EventAnalysisUiStateProvider` (persisted analysis UI state),
`OverviewCollapsibleGlassCard`, and the `OverviewTab` refactor that routes the
seven Event Level and two Session Level panels through that card.

---

## 1. Goals (locked)

1. **Collapsed cards = compact, uniform tiles.** All Event/Session Level cards
   collapse to a single shared tile height and participate in a 2-up grid.
2. **Mini chart preview when collapsed.** Chart cards (Driver Analysis, Compare
   driver performance) render the **real chart**, shrunk into the tile with
   chrome (toolbars, legends, Display menu, pickers) hidden. Decision recorded:
   user explicitly chose the real chart over a synthetic sparkline.
3. **Inline dense reflow ("bounce") on expand.** Expanding a card makes it span
   the full width; the remaining collapsed tiles reflow/backfill so the expanded
   card is fully visible. Interaction model: **C1 — inline dense grid**.
4. **Jank-free height animation (mandatory, not optional).** During the
   expand/collapse transition the chart must **not** continuously re-measure.
   The visible height animates on a wrapper while the chart keeps its current
   render size; the chart re-renders at its new size **exactly once**, after the
   transition ends. See [§5](#5-the-height-transition-engine-mandatory).

### Non-goals

- No change to data fetching, lap-trend API, or selection semantics.
- No overlay/modal expansion (explicitly rejected in favour of C1).
- Placeholder cards (Pace trends, Strategy, Weather, Incidents, Session
  metrics/scope) gain collapse only — they have no chart to preview.

---

## 2. Current state (baseline)

- `OverviewCollapsibleGlassCard` collapses by animating the body
  `max-height → 0` (body is **hidden** when collapsed). This is incompatible
  with goal 2 (mini preview) and must change to a **visible-when-collapsed**
  model.
- Event Level cards live in **separate single-column grids** (one `grid` per
  card for panels 1/3/4, then two `md:grid-cols-2` rows for 5/6 and 7/8). This
  prevents true reflow and must be unified into **one dense grid**.
- `LapByLapTrendChart` already supports `displayChartHeightPreset`
  (`collapsedHeight`/`expandedHeight`/`expanded`/`onExpandedChange`) and renders
  its toolbar only when `headerControls`/`chartTitle` are present
  (`ChartContainer.tsx` gates the header block on `(title || headerControls)`).
- `ChartContainer` enforces `minHeight: ${height}px` — so the mini height must
  be threaded through the `height` prop, not just CSS.
- `UnifiedPerformanceChart` exposes a `height` prop and a large set of header
  controls (class scope, driver picker, view toggle, Display menu).
- Persisted state already exists per event in `event-analysis-ui-state.tsx`
  (driver/class/session selections, chart-view, per-panel `expanded`).
  Expand/collapse layout therefore survives primary tab navigation already.

---

## 3. Target architecture

### 3.1 Layout

A single grid per analysis section:

```
grid grid-cols-1 md:grid-cols-2 gap-4 [grid-auto-flow:dense]
```

- **Collapsed tile:** `md:col-span-1`.
- **Expanded card:** `md:col-span-2` (full row width).
- `grid-auto-flow: dense` backfills the freed cell with the next collapsed tile
  → the "bounce". Neighbour movement is **instant** (grid reflow is not
  animated); only the expanding tile animates its own height.

A uniform collapsed tile height keeps rows even so the bounce looks clean
(decision [D1](#d1--uniform-collapsed-tile-height-not-per-type)). Introduce one
token/constant:

```ts
// overview-glass-surface.ts (or a small analysis-layout.ts)
export const ANALYSIS_TILE_COLLAPSED_HEIGHT_PX = 180
```

### 3.2 Card component contract

`OverviewCollapsibleGlassCard` is reworked from "hide body" to "resize body".
New/changed props:

```ts
export interface OverviewCollapsibleGlassCardProps {
  panelId: string
  headingId: string
  title: ReactNode
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  layout?: "stretch" | "center"
  /** When true, the card is a chart tile and uses the height-transition engine. */
  animatedHeight?: boolean
  /** Collapsed tile height (px). Default ANALYSIS_TILE_COLLAPSED_HEIGHT_PX. */
  collapsedHeightPx?: number
  /** Expanded height (px) for chart tiles; omit for natural-height content. */
  expandedHeightPx?: number
  /**
   * Render-prop body. `tier` tells chart children whether to render compact
   * (mini) or full so the chart mounts ONCE and only re-sizes on tier change.
   */
  children: (ctx: { tier: "mini" | "full"; expanded: boolean }) => ReactNode
  className?: string
}
```

The card no longer sets `max-height: 0`. Instead it owns the **height-transition
engine** ([§5](#5-the-height-transition-engine-mandatory)) and passes a `tier`
("mini" | "full") to its children via render-prop. The chart renders at the tier
size; collapse/expand changes the tier, but only after the animation finishes.

### 3.3 Chart `compact` mode

Add a `compact?: boolean` prop to both chart components:

- `LapByLapTrendChart` — when `compact`:
  - Do not render `headerControls`, `footerSummary`, Display menu, legend, or
    color/axis pickers.
  - Use a reduced chart margin and the mini height.
  - Render is non-interactive (pointer-events off on the canvas is optional;
    simplest is to just omit interactive chrome).
- `UnifiedPerformanceChart` — when `compact`: same idea (hide class scope row,
  driver picker, view toggle, Display menu; reduced margin; mini height).

`OverviewTab` passes `compact={tier === "mini"}` and the appropriate `height`.

---

## 4. The mini/full render model (single mount)

Chart cards render **one** chart instance (no duplicate mini + full copies —
that would collide on `chartInstanceId`-keyed persisted color state). The card
body render-prop returns the chart with:

```tsx
<LapByLapTrendChart
  chartInstanceId={`event-level-driver-laps-${data.event.id}`}  // unchanged, unique
  compact={tier === "mini"}
  height={tier === "mini" ? MINI_PX : EVENT_LEVEL_DRIVER_LAP_HEIGHT_EXPANDED}
  headerControls={tier === "full" ? (<…>) : undefined}
  footerSummary={tier === "full" ? (<…>) : undefined}
  …
/>
```

Because `tier` only flips **after** the height animation completes (§5), the
chart re-renders at its new size exactly once per toggle.

---

## 5. The height-transition engine (mandatory)

**Problem:** Recharts `ResponsiveContainer` re-measures on every size change. A
naïve CSS `height`/`max-height` transition fires dozens of resize callbacks
mid-animation → re-render storm and stutter.

**Solution — animate a wrapper, swap chart size once at the end** (a FLIP-style
two-phase transition with a crossfade to mask the single swap):

State held in the card (or a dedicated `useCardHeightTransition` hook):

```ts
const [renderTier, setRenderTier] = useState<"mini" | "full">(
  expanded ? "full" : "mini"
)
const [phase, setPhase] = useState<"idle" | "animating">("idle")
const wrapperRef = useRef<HTMLDivElement>(null)
const tokenRef = useRef(0) // cancels stale transitions on rapid toggles
```

Algorithm when `expanded` changes:

1. **Measure FROM.**
   `const fromH = wrapperRef.current.getBoundingClientRect().height`.
2. **Compute TO.**
   `const toH = expanded ? expandedHeightPx : collapsedHeightPx`.
3. **Pin start height.** Set wrapper inline `height = fromH`; keep `renderTier`
   unchanged (chart stays at current size → no re-measure yet). Add
   `overflow: hidden` for the duration.
4. **Force reflow** (`void wrapperRef.current.offsetHeight`) so the browser
   commits `fromH` before transitioning.
5. **Start animation.** `setPhase("animating")`; set wrapper `height = toH`. CSS
   `transition: height 280ms ease`. Optionally fade body `opacity` to ~0.6 to
   mask the upcoming swap.
6. **On `transitionend` (property === "height"), if token still valid:**
   - `setRenderTier(expanded ? "full" : "mini")` → **single** chart re-render at
     the final size.
   - If expanding: set wrapper `height = "auto"` (let content size naturally)
     and clear `overflow`. If collapsing: keep `height = collapsedHeightPx`.
   - Restore opacity; `setPhase("idle")`.
7. **Cancel safety.** Each `expanded` change increments `tokenRef`; the
   `transitionend` handler bails if the token changed (rapid toggles).

`prefers-reduced-motion`: skip phases 1–6 entirely — set `renderTier` and the
final wrapper height synchronously.

`ResizeObserver` (existing) stays **disabled during `phase === "animating"`**
and is only used while expanded + idle to keep `height: auto` correct if inner
content reflows (e.g. driver picker wraps).

### 5.1 Why the chart looks right mid-animation

- **Expand:** wrapper grows from mini→full while the chart is still mini,
  clipped inside the growing wrapper (extra space appears below the mini chart).
  On end, swap to full → one re-render fills the space. The optional opacity
  fade hides the pop.
- **Collapse:** wrapper shrinks full→mini while the chart is still full, clipped
  (overflow hidden trims the bottom). On end, swap to mini → one re-render.

The crossfade (step 5/6) makes the single swap read as a smooth settle rather
than a jump. This is the explicit mitigation the user required.

---

## 6. File-by-file changes

### 6.1 `overview-glass-surface.ts` (or new `analysis-layout.ts`)

- Export `ANALYSIS_TILE_COLLAPSED_HEIGHT_PX = 180` and
  `ANALYSIS_MINI_CHART_HEIGHT_PX = 112` (decisions
  [D1](#d1--uniform-collapsed-tile-height-not-per-type)/[D2](#d2--mini-chart-height-and-expanded-targets)).

### 6.2 `OverviewCollapsibleGlassCard.tsx`

- Replace `max-height: 0` collapse with the §5 engine.
- Change `children` to a render-prop receiving `{ tier, expanded }`.
- Add `animatedHeight`, `collapsedHeightPx`, `expandedHeightPx` props.
- Keep header button, `aria-expanded`, `aria-controls`, chevron, reduced-motion.
- Collapsed body remains **in the DOM and visible** (clipped), not `hidden`.

### 6.3 `LapByLapTrendChart.tsx`

- Add `compact?: boolean`.
- When `compact`: suppress header/toolbar/legend/Display/pickers/footer; reduce
  margins; rely on `height` for the mini size.

### 6.4 `UnifiedPerformanceChart.tsx`

- Add `compact?: boolean` with the same suppression behaviour.

### 6.5 `OverviewTab.tsx`

- Replace the three separate single-column grids + two 2-up grids for Event
  Level with **one** `grid-cols-1 md:grid-cols-2 [grid-auto-flow:dense]`.
- Each `OverviewCollapsibleGlassCard`:
  - Gets `className={expanded ? "md:col-span-2" : "md:col-span-1"}`.
  - Chart cards: `animatedHeight`, `expandedHeightPx`, and render-prop children
    that pass `compact={tier === "mini"}` + tier-based
    `height`/`headerControls`.
  - Mains Ladder: `animatedHeight` optional (no Recharts; can use natural height
    with a clamped mini preview, or keep simple instant collapse). Recommend
    treating it as a **non-chart** card: mini = summary counts, full = bracket.
- Do the same unification for the Session Level section (two placeholder tiles).

### 6.6 `event-analysis-ui-state.tsx`

- No new fields required (per-panel `expanded` already persisted).
- Per decision [D3](#d3--default-expandedcollapsed-set):
  `defaultPanelExpanded()` returns `false` for **all** panel ids (every card
  starts collapsed/mini).

---

## 7. Phasing & acceptance criteria

### Phase 0 — Decisions (LOCKED)

These are the chosen, committed answers. They are tunable during build but are
the default of record; any change must update this section.

#### D1 — Uniform collapsed tile height (not per-type)

**Decision:** One shared collapsed height for **every** Event/Session Level
card. Even rows keep the dense-grid bounce clean and the section reads as a tidy
tile dashboard.

```ts
export const ANALYSIS_TILE_COLLAPSED_HEIGHT_PX = 180
```

Vertical budget at 180px: `p-4` (32) + header row (~28) + `gap-3` (12) ≈ 72px of
chrome, leaving ~108px for the body. This comfortably holds the mini chart
([D2](#d2--mini-chart-height-and-expanded-targets)) and is close enough to the
~118px placeholder reference while staying readable. Placeholder cards simply
carry extra whitespace — acceptable, and visually consistent.

> Rejected: per-type heights (chart tiles taller than placeholders). It produces
> uneven rows and a jittery backfill when cards reflow.

#### D2 — Mini chart height and expanded targets

**Decision:**

```ts
export const ANALYSIS_MINI_CHART_HEIGHT_PX = 112 // collapsed canvas
```

- **Driver Analysis (LapByLapTrendChart):** expanded target reuses the existing
  `EVENT_LEVEL_DRIVER_LAP_HEIGHT_EXPANDED` (**450**).
- **Compare (UnifiedPerformanceChart):** expanded target **420**.
- For both, the height-transition engine animates to the fixed expanded target,
  then sets the wrapper to `height: auto` on `transitionend` so the restored
  controls/legend size naturally without a second visible jump.

#### D3 — Default expanded/collapsed set

**Decision:** **All cards default to collapsed (mini) on first visit** for a
given event. First impression is the full tile dashboard; the user expands only
what they want, and per-event persistence
([`event-analysis-ui-state.tsx`](../../src/components/organisms/event-analysis/event-analysis-ui-state.tsx))
remembers their choice thereafter. Ship an **"Expand all / Collapse all"**
control on the section `h2` row so power users can flip everything at once.

`defaultPanelExpanded()` therefore returns `false` for every panel id.

> Rejected: defaulting data cards to expanded. It defeats the dashboard-of-tiles
> first impression and forces immediate scrolling; mini previews already prove
> "there is data here".

#### D4 — Mains Ladder treatment (non-chart card)

**Decision:** Treat Mains Ladder as a **non-chart** card, not a Recharts tile.

- **Mini (collapsed):** a one-line summary derived cheaply from the resolved
  class — `"{className} · {n} ladder rounds"` (e.g.
  `Pro Nitro Buggy · 3 mains`), falling back to `"Tap to view mains ladder"`
  when no model is available. Compound metrics use middle dot only (e.g. fastest
  lap line: `"{lapTime} · {driverName}"`); never an em dash (see
  `docs/design/mre-ux-principles.md` §1.1).
- **Full (expanded):** the existing `MainBracketLadderPanel` bracket.
- Uses `animatedHeight` with the **same collapsed tile height** (D1) but an
  **auto** expanded height (bracket content drives it) — the engine animates to
  a measured target then settles to `auto`.

> Rejected: forcing the bracket through the chart `compact` path — the bracket
> is SVG/DOM layout, not a `ResponsiveContainer`, so it does not suffer the
> re-measure problem and does not need the mini-chart treatment.

**Acceptance:** decisions D1–D4 recorded here and reflected in the constants,
`defaultPanelExpanded()`, and the Mains Ladder card wiring during build.

### Phase 1 — Height-transition engine

- Implement §5 in `OverviewCollapsibleGlassCard` behind `animatedHeight`.
- Temporary harness: a non-chart tall block to validate animation + cancel +
  reduced-motion before wiring charts.

**Acceptance:** expand/collapse animates smoothly; no layout error; reduced
motion is instant; rapid toggles never leave a stuck height.

### Phase 2 — Chart `compact` mode

- Add `compact` to both charts; verify a chart renders cleanly at mini height
  with no toolbar/legend overflow.

**Acceptance:** mini chart fits the tile; no console warnings; one chart mount
(verify `chartInstanceId` not duplicated).

### Phase 3 — Single-swap wiring

- Connect `renderTier` → chart `compact`/`height`; confirm the chart re-renders
  **once** per toggle (instrument with a temporary render counter / React
  Profiler in Docker).

**Acceptance:** ≤1 chart re-render attributable to the size swap per toggle
(excluding data-driven renders); no re-measure storm during the animation.

### Phase 4 — Dense grid reflow

- Unify Event Level (and Session Level) into one dense grid; span-on-expand.

**Acceptance:** expanding any card makes it full width and the remaining
collapsed tiles backfill; collapsed tiles are uniform height; matches the
"bounce" requirement.

### Phase 5 — Persistence & polish

- Verify layout + selections survive Event Overview ↔ Analysis navigation.
- Optional "Expand all / Collapse all" affordance on the section `h2` row.

**Acceptance:** returning to Analysis restores the same expanded/collapsed
layout and chart selections.

---

## 8. Testing (Docker-only)

- **Unit/interaction (jsdom):** `src/__tests__/` — collapse toggling updates
  `aria-expanded`; reduced-motion path sets final state synchronously; rapid
  toggle resolves to the last `expanded` value. (Animation timing itself is not
  asserted; assert end-state via mocked `transitionend`.)
  - `docker exec -it mre-app npm test`
- **Type/lint:** `docker exec -it mre-app npx tsc --noEmit` (scoped) and
  `docker exec -it mre-app npx eslint <changed files> --max-warnings 0`.
- **Manual matrix:** desktop ≥md and <md (single column, no span change); expand
  each chart card; toggle quickly; throttle CPU 6× to confirm no stutter;
  `prefers-reduced-motion` on.

---

## 9. Risks & mitigations

| Risk                                                          | Mitigation                                                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Re-measure storm during animation                             | §5 engine: chart size fixed during transition, swap once on `transitionend`; ResizeObserver disabled while animating. |
| Stuck height on rapid toggles                                 | `tokenRef` cancels stale `transitionend`; reduced-motion path is synchronous.                                         |
| `chartInstanceId` collisions                                  | Single chart mount per card; mini/full is one instance resized — never two copies.                                    |
| Uneven grid rows / ugly bounce                                | Uniform collapsed tile height token.                                                                                  |
| `ChartContainer` `minHeight` floor fights mini size           | Pass mini height through the `height` prop, not just CSS.                                                             |
| Clipped chart looks odd mid-collapse                          | Opacity crossfade (step 5/6) masks the swap.                                                                          |
| `transitionend` never fires (height unchanged / display none) | Fallback `setTimeout` slightly > transition duration to force the swap.                                               |

---

## 10. Rollback

All changes are additive/contained to the listed components. Rollback = revert
`OverviewCollapsibleGlassCard` to the `max-height` body model, remove `compact`
props, and restore the separate grids in `OverviewTab`. Persisted state shape is
unchanged, so no migration is needed.

---

## 11. Follow-ups / housekeeping

- Regenerate the component catalog after adding/altering components:
  `docker exec -it mre-app npm run docs:component-catalog` (updates
  [`docs/frontend/component-catalog.md`](../frontend/component-catalog.md)).
- If the height-transition engine proves reusable, extract
  `useCardHeightTransition` into a shared hook for other dashboard tiles.
