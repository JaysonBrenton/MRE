---
created: 2026-05-19
owner: Frontend Delivery
purpose:
  Describe shipped Event Level Analysis mains bracket UI versus the Program
  overview schedule-phase panel, Bump-Up complements, and related tests.
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
- The first shipped **Event Level Analysis** panel is titled **Mains Ladder**
  (`h3` with id `event-level-analysis-col-1-heading`). The **Program overview**
  panel (`h3` with id `event-level-analysis-col-2-heading`) is a separate glass
  section for **schedule phases** (`ProgramOverviewPanel`). Both use an
  `OverviewTab` variant shell.

Selecting **Analysis** activates that primary tab; **`#tabpanel-analysis`** is
not mounted until **Event Level Analysis** or **Session Level Analysis** is
chosen from the Analysis menu, so mains ladder content does not render in that
idle state.

## What the user sees

**Mains Ladder** (`#event-level-analysis-col-1-heading`) renders
`MainBracketLadderPanel`:

1. **Class scope** — Same style of class picker as related ladder views: user
   can filter by ingested race class (`getRaceClassNamesFromRaces` /
   `OverviewTab`).
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

PNG export uses the themed palette inside `MainBracketLadderPanel`; that path
does not substitute for live inspection of CSS token surfaces on the dash.

**Program overview** (`#event-level-analysis-col-2-heading`) renders
**`ProgramOverviewPanel`** (SVG):

- Practice / seeding / qualifying / heats / miscellaneous non-main buckets
  become **collapsed phase nodes** (`sessionTypeFilterKeyForRace` grouping;
  **`isEventMainSession`** pulls mains aside).
- **One rectangle per main** (parallel mains **fan out** from the prior phase).
  Connectors are **schedule flow**, not bump-through advancement labels.
- Public helper **`shortenProgramOverviewRaceTitle`** trims LiveRC heat-sheet
  boilerplate (`Length:`, `Timed`, `Status:`) without losing `A1-Main`-style
  prefixes.

## Relationship to Bump-Up / Driver Progression subtabs

These are separate surfaces under **Event Analysis** when ladder subtabs apply:

| Surface                                     | Purpose                                                                                     | Primary implementation                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Mains Ladder** (Event Level column 1)     | Event-wide bracket picture + drivers **who advanced to the next main** **per modeled node** | `MainBracketLadderPanel`, `main-bracket-ladder-model.ts`, `main-bracket-ladder-layout.ts`                       |
| **Program overview** (Event Level column 2) | Practice→mains timeline + parallel mains; **schedule semantics**                            | `ProgramOverviewPanel`, `program-overview-model.ts`                                                             |
| **Bump-Up** subtab                          | Inferred tier-to-tier promotions for a scoped class (`inferBumpUpsFromSessions`)            | `DriverBumpUpsTable`, `infer-bump-ups.ts`, session selection UX in `OverviewTab`                                |
| **Driver Progression** subtab               | Per-driver finish trajectory across mains-ladder rounds (matrix + charts)                   | `DriverMainLadderProgressionPanel`, `driver-main-event-progression.ts`, `buildDriverMainEventProgressionMatrix` |

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

- Column 1 is labeled by **`#event-level-analysis-col-1-heading`** (“Mains
  Ladder”).
- Column 2 uses **`#event-level-analysis-col-2-heading`** (“Program overview”).
- Advanced-driver tables expose a **caption** (“Drivers who advanced to …” plus
  the next round label) and column headers on each table instance.

## Engineering touchpoints (change list)

Core files to read before modifying behaviour:

| Layer                             | File                                                                                                                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard routing / tabpanels     | `src/components/organisms/dashboard/EventAnalysisSection.tsx`                                                                                                                                                                                                |
| Event Analysis layout / variants  | `src/components/organisms/event-analysis/OverviewTab.tsx`                                                                                                                                                                                                    |
| Panels                            | `src/components/organisms/event-analysis/MainBracketLadderPanel.tsx`, `src/components/organisms/event-analysis/ProgramOverviewPanel.tsx`                                                                                                                     |
| Related progression UI            | `src/components/organisms/event-analysis/DriverMainLadderProgressionPanel.tsx`                                                                                                                                                                               |
| Domain: ladder + program timeline | `src/core/events/main-bracket-ladder-model.ts`, `src/core/events/main-bracket-ladder-layout.ts`, `src/core/events/program-overview-model.ts`                                                                                                                 |
| Domain: matrices & bump-ups       | `src/core/events/driver-main-event-progression.ts`, `infer-bump-ups.ts`, `get-sessions-data.ts`                                                                                                                                                              |
| Automated tests                   | `src/__tests__/core/events/main-bracket-ladder-model.test.ts`, `src/__tests__/core/events/main-bracket-ladder-layout.test.ts`, `src/__tests__/core/events/driver-main-event-progression.test.ts`, `src/__tests__/core/events/program-overview-model.test.ts` |

## Visual surface note

Overview-scale panels use **`OVERVIEW_GLASS_SURFACE_*`** helpers
(`overview-glass-surface.ts`). That differs from **`DataPanelSurface`** used for
most table-heavy Analysis panels; see
[`docs/design/event-analysis-table-surfaces.md`](../design/event-analysis-table-surfaces.md).
