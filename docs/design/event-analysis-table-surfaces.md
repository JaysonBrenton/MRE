---
created: 2026-04-14
lastModified: 2026-05-19
owner: Frontend Delivery
purpose: Standardize Event Analysis table/panel surface treatments
relatedDocs:
  - docs/architecture/event-analysis-mains-ladder.md
---

## Canonical surface (Event Analysis)

**Goal**: all data-heavy tables in Event Analysis should look like a single
cohesive family (same panel surface, same table frame/clipping).

### Panel surface (outer)

- **Canonical**: glass **rounded-2xl** panel surface
- **Implementation**: `DataPanelSurface` in
  `src/components/organisms/event-analysis/DataPanelSurface.tsx`

Use `DataPanelSurface` for table panels that include a header row
(title/subtitle/controls) and content area.

### Table frame (inner)

- **Canonical**: bordered, clipped table frame that rounds corners consistently
  and prevents “floating table” visual noise
- **Implementation**: `DataTableFrame` (exported from `DataPanelSurface.tsx`)

Wrap `StandardTable` with `DataTableFrame` anywhere a table is displayed in
Event Analysis (including within modals).

## Event Overview / Event Level glass columns

Certain hero-scale panels (**Mains Ladder** under **Event Level Analysis**) keep
their glass shell via **`OVERVIEW_GLASS_SURFACE_*`** in
[`overview-glass-surface.ts`](../../src/components/organisms/event-analysis/overview-glass-surface.ts)
instead of **`DataPanelSurface`**, because parents already harmonize typography
tokens with Overview chrome. Embedded tables inside those shells (such as
**Drivers who progressed from earlier rounds** in
[`MainBracketLadderPanel.tsx`](../../src/components/organisms/event-analysis/MainBracketLadderPanel.tsx))
should **still wrap `StandardTable` with `DataTableFrame`** whenever you swap to
`<StandardTable>` for consistency—today’s progressed-driver rows are semantic
tables with bespoke borders; refactor toward `StandardTable`+`DataTableFrame` if
visuals drift.

Architecture cross-reference:
[`docs/architecture/event-analysis-mains-ladder.md`](../architecture/event-analysis-mains-ladder.md).

## Usage

### A full table panel

```tsx
import DataPanelSurface, {
  DataTableFrame,
} from "@/components/organisms/event-analysis/DataPanelSurface"
import {
  StandardTable,
  StandardTableHeader,
} from "@/components/molecules/StandardTable"

export function Example() {
  return (
    <DataPanelSurface
      title="Some table"
      subtitle="What this table shows."
      headerControls={<div>Controls</div>}
      contentClassName="px-4 py-3"
    >
      <DataTableFrame>
        <StandardTable>
          <StandardTableHeader>{/* ... */}</StandardTableHeader>
          <tbody>{/* ... */}</tbody>
        </StandardTable>
      </DataTableFrame>
    </DataPanelSurface>
  )
}
```

### A table inside a `ChartContainer`

If the surrounding component already provides the glass surface (e.g.
`ChartContainer`), **still use `DataTableFrame`** so table
borders/radius/clipping are consistent:

```tsx
import { DataTableFrame } from "@/components/organisms/event-analysis/DataPanelSurface"
;<DataTableFrame>
  <StandardTable>{/* ... */}</StandardTable>
</DataTableFrame>
```

## Do / don’t

- **Do**: use `DataPanelSurface` for new data-heavy panels in
  `src/components/organisms/event-analysis/`.
- **Do**: wrap `StandardTable` with `DataTableFrame` for consistent borders +
  clipping.
- **Don’t**: create ad-hoc wrappers like
  `rounded-lg ... bg-[var(--token-surface-elevated)]` around tables.
- **Don’t**: repeat inline “glass” styles (`backgroundColor: var(--glass-bg)`,
  `backdropFilter: var(--glass-blur)`) in components.
