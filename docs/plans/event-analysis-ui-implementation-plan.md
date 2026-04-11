# Event analysis UI — implementation plan

**Status:** Ready for phased delivery  
**Scope:** Embedded dashboard event analysis (`EventAnalysisSection`,
`OverviewTab`, chart stack)  
**Process:** One task per LLM session; small diffs; manual verification in
Docker (`mre-app`) after each task.

This plan supersedes an earlier draft that overweighted
`EventAnalysisToolbar.tsx`. The toolbar stays **minimal** (tabs + actions menu);
**control density and chart UX** live in **`OverviewTab`**, **`ChartControls`**,
**`ChartSection`**, and **`LapByLapTrendChart`**.

---

## Working rules (every task)

**Before coding**

- Inspect the listed files and understand layout, props, and state.
- Keep changes small, reversible, and production-safe.
- Do not redesign unrelated UI.
- Do not change business logic unless the task says so.
- Preserve behaviour, dark-theme tokens, and existing patterns.
- Prefer editing existing components over new abstractions unless clearly
  necessary.
- For new layout in scrollable flex areas, follow
  `docs/development/FLEXBOX_LAYOUT_CHECKLIST.md` (e.g. content `minWidth` where
  required).

**After coding**

Explain: what changed; why it helps; manual test cases; regressions to watch.

**Testing (every task)**

Run UI checks in the **Docker app (`mre-app`)** per `docs/AGENTS.md`, not an ad
hoc local dev server.

**After any fixed-header or layout change**

Verify: spacer alignment vs fixed block; no content jump on load or scroll; no
overlap with main content; tablet and desktop.

---

## Phase 1 — Reduce chrome in the fixed header stack

### Task 1 — Compress fixed header height

|             |                                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**    | More analysis content visible without scrolling.                                                                                                     |
| **Inspect** | `EventAnalysisSection.tsx`, `EventAnalysisHeader.tsx`, `EventAnalysisToolbar.tsx`                                                                    |
| **Scope**   | UI only: wrapper padding, gaps, title/toolbar vertical rhythm. **Do not** change fixed/spacer _mechanism_ (ResizeObserver, spacer div, `headerRef`). |
| **Risk**    | Spacer uses measured height and a constant offset (`headerHeight - 32`); visual tweaks must not desync perceived layout.                             |

**Manual tests:** Fixed header aligned; spacer matches; no jump; no overlap;
tabs/actions still work.

---

## Phase 2 — Grouping and overflow where density is real

### Task 2 — Subtle tab vs actions polish (`EventAnalysisToolbar` only)

|                 |                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------- |
| **Goal**        | Slightly clearer separation between tab list and actions menu.                                  |
| **Inspect**     | `EventAnalysisToolbar.tsx` (and `TabNavigation` if needed for alignment only).                  |
| **Scope**       | Spacing, divider/separation, balance. **Not** a major UX project—toolbar is already two-column. |
| **Expectation** | Modest gain; satisfies scanability without pretending this is the main control surface.         |

**Manual tests:** Tab scroll if needed; actions menu; no bad wrapping at common
widths.

### Task 3 — Group overview/chart controls by purpose

|             |                                                                                      |
| ----------- | ------------------------------------------------------------------------------------ |
| **Goal**    | Clusters for: scope selection, chart/view selection, display options.                |
| **Inspect** | `OverviewTab.tsx`, `ChartControls.tsx`, `ChartSection.tsx`, `LapByLapTrendChart.tsx` |
| **Scope**   | Layout/grouping only; no control removal; no logic changes.                          |

**Manual tests:** Easier scan; behaviour unchanged; desktop wrapping acceptable.

### Task 4 — Overflow for one or two secondary chart display controls

|             |                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**    | Less noise; secondary toggles behind menu/popover.                                                                                |
| **Inspect** | `LapByLapTrendChart.tsx`, `ChartSection.tsx`, `ChartControls.tsx`                                                                 |
| **Scope**   | Move **1–2** low-frequency **display** controls; keep core scope/navigation visible. Reuse existing menu/modal/dropdown patterns. |

**Manual tests:** Overflow opens/closes; toggles work; primary row feels
cleaner.

---

## Phase 3 — Analytical hierarchy (copy + summary)

### Task 5 — Compact summary strip above primary chart

|             |                                                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**    | Quick “first read” before the graph.                                                                                                                |
| **Inspect** | `OverviewTab.tsx`, `EventStats.tsx`, data already fed to charts.                                                                                    |
| **Scope**   | 3–4 values: e.g. best lap, average lap, lap count. **Trend/degrading** only if already in data or **trivially** derivable client-side—do not force. |
| **Risk**    | Strip must stay subordinate to the chart visually.                                                                                                  |

### Task 6 — Section titles and helper text

|             |                                                                                     |
| ----------- | ----------------------------------------------------------------------------------- |
| **Goal**    | Clearer at-a-glance section meaning.                                                |
| **Inspect** | `OverviewTab.tsx`, `SessionChartTabs.tsx`, nearby headings in event-analysis views. |
| **Scope**   | Copy only; do not rename routes or domain concepts in code/data.                    |

**Manual tests:** Clearer headings; concise; no text overflow.

---

## Phase 4 — Chart readability and interpretation

### Task 7 — Reduce session overlay visual dominance

|             |                                                                          |
| ----------- | ------------------------------------------------------------------------ |
| **Goal**    | Lap trace reads as primary; overlays supportive.                         |
| **Inspect** | `LapByLapTrendChart.tsx`                                                 |
| **Scope**   | Styling only (opacity/weight); **no** logic change to overlay semantics. |

### Task 8 — Chart control wording (stable labels)

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| **Goal**    | Labels clear in both on/off states; avoid flip-flop “Hide X” where confusing. |
| **Inspect** | `LapByLapTrendChart.tsx`, `ChartControls.tsx`                                 |
| **Scope**   | Copy/accessibility labels only; behaviour unchanged.                          |

### Task 9 — Explain what the trend line represents

|             |                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------- |
| **Goal**    | User knows the calculation (e.g. rolling average vs regression)—without changing the calculation. |
| **Inspect** | `LapByLapTrendChart.tsx`                                                                          |
| **Scope**   | Short legend note, subtitle, or helper near controls.                                             |

### Task 10 — Conservative outlier lap markers

|             |                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------- |
| **Goal**    | Obvious spikes easier to spot; normal laps uncluttered.                                             |
| **Inspect** | `LapByLapTrendChart.tsx`                                                                            |
| **Scope**   | One **documented** client-side heuristic (e.g. vs median/best); conservative threshold; no new API. |

### Task 11 — Richer tooltip

|             |                                                                                    |
| ----------- | ---------------------------------------------------------------------------------- |
| **Goal**    | More analytical hover content from data already in the component.                  |
| **Inspect** | `LapByLapTrendChart.tsx`                                                           |
| **Scope**   | E.g. lap number, time, delta to best if derivable; compact layout; no new backend. |

---

## Phase 5 — Overview overload (safe order)

### Task 12 — Visually de-emphasise lower-priority sections

|             |                                                                                        |
| ----------- | -------------------------------------------------------------------------------------- |
| **Goal**    | Less “everything is equally loud”; **avoid** big reorder first.                        |
| **Inspect** | `OverviewTab.tsx`                                                                      |
| **Scope**   | Typography, borders, spacing, section chrome—**preserve anchors, IDs, keyboard flow**. |

### Task 13 — Restyle one section as quieter secondary details

|             |                                                                      |
| ----------- | -------------------------------------------------------------------- |
| **Goal**    | Less accordion fatigue; clearer hierarchy.                           |
| **Inspect** | `OverviewTab.tsx`                                                    |
| **Scope**   | One lower-value block; same content and behaviour; subtle treatment. |

### Task 14 — Optional small reorder (only if still needed)

|             |                                                                                |
| ----------- | ------------------------------------------------------------------------------ |
| **Goal**    | Higher-value content slightly earlier.                                         |
| **Inspect** | `OverviewTab.tsx`; **grep** for `id=`, `headingId`, deep links, tests.         |
| **Scope**   | **Minimal** move; document anchor/test impact; skip if Tasks 12–13 are enough. |

---

## Phase 6 — Terminology and empty state

### Task 15 — Terminology consistency (small pass)

|             |                                                                             |
| ----------- | --------------------------------------------------------------------------- |
| **Goal**    | Obvious naming alignment across navigation, headings, chart labels.         |
| **Inspect** | Embedded analysis workflow strings (nav, event analysis, sessions, charts). |
| **Scope**   | Copy only; no routes, models, or component renames.                         |

### Task 16 — Pre-selection empty state

|             |                                                           |
| ----------- | --------------------------------------------------------- |
| **Goal**    | Clearer preview of what unlocks after selecting an event. |
| **Inspect** | `DashboardClient.tsx` (inline `DashboardEmptyState`).     |
| **Scope**   | Copy + light layout; CTA remains obvious.                 |

**Manual tests:** Informative; not bloated; flex/scroll rules if layout grows.

---

## Phase 7 — Final consistency

### Task 17 — Scope vs display distinction (cross-cutting)

|             |                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| **Goal**    | “What data am I looking at?” vs “how is it displayed?” reads consistently.                               |
| **Inspect** | Fixed header stack, overview controls, chart controls.                                                   |
| **Scope**   | **Last**—light grouping/labels only; **no** full redesign; aligns Tasks 3–4 without another churn cycle. |

---

## Recommended execution order (checklist)

Use this sequence; do not parallelise tasks that touch the same files in the
same session.

1. Task 1 — Compress fixed header height
2. Task 2 — Toolbar tab vs actions polish
3. Task 3 — Group overview/chart controls
4. Task 4 — Chart display overflow (1–2 controls)
5. Task 5 — Summary strip
6. Task 6 — Section titles / helper text
7. Task 7 — Overlay dominance
8. Task 8 — Chart control wording
9. Task 9 — Trend line explanation
10. Task 10 — Outlier markers
11. Task 11 — Tooltip
12. Task 12 — De-emphasise overview sections
13. Task 13 — One quieter secondary section
14. Task 14 — Optional minimal reorder
15. Task 15 — Terminology pass
16. Task 16 — Empty state
17. Task 17 — Scope vs display consistency

---

## What changed vs the original plan (summary)

| Original issue                       | Resolution                                                            |
| ------------------------------------ | --------------------------------------------------------------------- |
| Heavy work on `EventAnalysisToolbar` | Toolbar: Tasks **1–2** only (compression context + light polish).     |
| Grouping/overflow in wrong layer     | Tasks **3–4** target **Overview + chart** files.                      |
| Overview reorder too early           | Tasks **12 → 13 → 14** de-emphasise first; reorder last and optional. |
| Scope/display pass too early         | **Task 17** at end, after layout/copy settle.                         |
| Testing                              | Docker + spacer/header checks codified for every task.                |

---

## References

- `docs/AGENTS.md` — Docker-only workflow
- `docs/development/FLEXBOX_LAYOUT_CHECKLIST.md` — scrollable flex content
- `docs/design/mre-dark-theme-guidelines.md` — theme consistency
