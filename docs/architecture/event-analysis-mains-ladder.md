---
created: 2026-05-19
owner: Frontend Delivery
purpose:
  Describe shipped Event Level Analysis mains bracket UI, Bump-Up complements,
  and related tests. References `ProgramOverviewPanel` domain code retained for
  reuse.
relatedDocs:
  - docs/domain/bump-ups-inference.md
  - docs/user-guides/event-analysis.md
  - docs/design/event-analysis-table-surfaces.md
  - docs/frontend/component-catalog.md
---

# Event Analysis — mains ladder (bracket + advanced drivers)

## Where this appears

On **My Event Analysis** (`/eventAnalysis`), when **Analysis** is the primary
pill and **Event Level Analysis** is chosen from the Analysis menu:

- The scroll region is `#tabpanel-analysis` (wired as the Analysis tabpanel in
  `EventAnalysisSection`).
- The shipped **Event Level Analysis** ladder panel is titled **Mains Ladder**
  (`h3` with id `event-level-analysis-col-1-heading`) inside the
  `variant="event-analysis-only"` `OverviewTab` shell. The
  **`ProgramOverviewPanel`** schedule-phase organism and
  `program-overview-model` remain in code for reuse but are **not mounted** on
  this scaffold after the overview row was removed.

Selecting **Analysis** activates that primary tab; **`#tabpanel-analysis`** is
not mounted until **Event Level Analysis** or **Session Level Analysis** is
chosen from the Analysis menu, so mains ladder content does not render in that
idle state.

## What the user sees

**Mains Ladder** (`#event-level-analysis-col-1-heading`) renders
`MainBracketLadderPanel`:

1. **Class scope** — Class picker lists only **`Race.className` values where at
   least one driver appears across strictly increasing mains tiers** (observed
   progression edges from `filterRaceClassesWithObservedMainBracketProgression`
   / `OverviewTab`). Parallel letter mains without cross-tier overlap are
   omitted. Other surfaces (e.g. Program overview) still use the full ingest
   class list.
2. **Bracket canvas** — SVG diagram of mains-ladder tiers (sessions as nodes,
   advancement edges with counts / LCQ paths). Geometry comes from the layout
   pass in `assignCenterYBySessionId`; graph data comes from
   `buildMainBracketLadderModel` (`main-bracket-ladder-model.ts`).
3. **“Drivers who advanced to …”** — Accessible HTML tables (caption includes
   the **destination** round label, e.g. “Drivers who advanced to 1/8 Odd”)
   listing drivers who **appear in both** the current node’s session and the
   **next** hop on the ladder graph (`driversAdvancedToNextRoundSorted` /
   `resolveNextRoundTargetNode` in `main-bracket-ladder-model.ts`). Columns are
   **Driver** and **Finish** (position in the **source** main). This is
   **observed** advancement from session results and modeled edges only (no
   bump-up inference). Tables appear in-context under applicable nodes and may
   duplicate in auxiliary UI (e.g. anchored floaters).
4. **Round details modal** — Clicking a node opens a table with **Prior main /
   Qual**: previous mains-ladder round label when that driver had an earlier
   main in the model; otherwise **Qualified: N** (LiveRC **#** / rank for this
   class) from ingested `qualPointsTopQualifiers` when available; otherwise
   **N/A**. Helper copy in the modal ties the column to the qual-points snapshot
   label.

PNG export uses the themed palette inside `MainBracketLadderPanel`; that path
does not substitute for live inspection of CSS token surfaces on the dash.

**`ProgramOverviewPanel`** (not currently mounted on Event Level Analysis):

- Implements an SVG practice→mains **schedule-phase** timeline (distinct from
  mains advancement edges on the ladder). Practice / seeding / qualifying /
  heats / miscellaneous non-main buckets become **collapsed phase nodes**
  (`sessionTypeFilterKeyForRace`; **`isEventMainSession`** pulls mains aside).
- **One rectangle per main** (parallel mains fan out); connectors are schedule
  order, not bump-through labels.
- **`shortenProgramOverviewRaceTitle`** trims LiveRC boilerplate (`Length:`,
  etc.) without dropping `A1-Main`-style prefixes.

See `program-overview-model.test.ts` for model behaviour.

## Relationship to Bump-Up / Driver Progression subtabs

These are separate surfaces under **Event Analysis** when ladder subtabs apply:

| Surface                                      | Purpose                                                                                     | Primary implementation                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Mains Ladder** (Event Level)               | Event-wide bracket picture + drivers **who advanced to the next main** **per modeled node** | `MainBracketLadderPanel`, `main-bracket-ladder-model.ts`, `main-bracket-ladder-layout.ts`                       |
| **Program overview panel** (unmounted reuse) | Practice→mains timeline + parallel mains; **schedule semantics** (organism retained)        | `ProgramOverviewPanel.tsx`, `program-overview-model.ts`                                                         |
| **Bump-Up** subtab                           | Inferred tier-to-tier promotions for a scoped class (`inferBumpUpsFromSessions`)            | `DriverBumpUpsTable`, `infer-bump-ups.ts`, session selection UX in `OverviewTab`                                |
| **Driver Progression** subtab                | Per-driver finish trajectory across mains-ladder rounds (matrix + charts)                   | `DriverMainLadderProgressionPanel`, `driver-main-event-progression.ts`, `buildDriverMainEventProgressionMatrix` |

Cross-cutting rules (nitro mains scope, LCQ handling, honesty about inference)
are spelled out under **Bump-ups** domain and ADRs; mains ladder consumes the
same class/session vocabulary but optimizes for **diagram + node-level advanced
tables**, not bump-up rows or longitudinal charts.

User-facing wording for **Driver Progression** is already embedded in Overview
tooling (class chips aligned with bump-up inference scope, ladder-only rounds,
minimum session count messaging).

## Implementation note (`OverviewTab` variants)

Bump-Up / Driver Progression markup lives inside the reusable Event Analysis
band that `OverviewTab` **omits while `variant="event-analysis-only"`**. The
dashboard loads that variant whenever **Analysis → Event Level Analysis** is
active (`EventAnalysisSection`). Inspect that guard
(`showEventAnalysisSectionBlock && variant !== "event-analysis-only"`) before
assuming ingestion bugs if toolbar Bump-Up selections look inert beside the
Event Level scaffold.

## Accessibility and headings

- The ladder shell is labeled by **`#event-level-analysis-col-1-heading`**
  (“Mains Ladder”).
- Advanced-driver tables expose a **caption** (“Drivers who advanced to …” plus
  the next round label) and column headers on each table instance.

## Engineering touchpoints (change list)

Core files to read before modifying behaviour:

| Layer                             | File                                                                                                                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard routing / tabpanels     | `src/components/organisms/dashboard/EventAnalysisSection.tsx`                                                                                                                                                                                                |
| Event Analysis layout / variants  | `src/components/organisms/event-analysis/OverviewTab.tsx`                                                                                                                                                                                                    |
| Panels (Event Level scaffold)     | `src/components/organisms/event-analysis/MainBracketLadderPanel.tsx` (reuse: `ProgramOverviewPanel.tsx`)                                                                                                                                                     |
| Related progression UI            | `src/components/organisms/event-analysis/DriverMainLadderProgressionPanel.tsx`                                                                                                                                                                               |
| Domain: ladder + program timeline | `src/core/events/main-bracket-ladder-model.ts`, `src/core/events/main-bracket-ladder-layout.ts`, `src/core/events/program-overview-model.ts`                                                                                                                 |
| Domain: matrices & bump-ups       | `src/core/events/driver-main-event-progression.ts`, `infer-bump-ups.ts`, `get-sessions-data.ts`                                                                                                                                                              |
| Automated tests                   | `src/__tests__/core/events/main-bracket-ladder-model.test.ts`, `src/__tests__/core/events/main-bracket-ladder-layout.test.ts`, `src/__tests__/core/events/driver-main-event-progression.test.ts`, `src/__tests__/core/events/program-overview-model.test.ts` |

## Visual surface note

Overview-scale panels use **`OVERVIEW_GLASS_SURFACE_*`** helpers
(`overview-glass-surface.ts`). That differs from **`DataPanelSurface`** used for
most table-heavy Analysis panels; see
[`docs/design/event-analysis-table-surfaces.md`](../design/event-analysis-table-surfaces.md).
