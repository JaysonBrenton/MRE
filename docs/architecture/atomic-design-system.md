---
created: 2026-01-31
creator: Implementation
lastModified: 2026-01-31
description: Atomic design system for MRE UI components
purpose:
  Defines the component tier structure, import rules, and folder map for the MRE
  UI. All contributors must follow these rules when adding or moving components.
relatedFiles:
  - docs/implimentation_plans/OLD/atomic-design-system-implementation-plan.md
  - docs/standards/typescript-react-style-guide.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/design/compact-label-value-card.md
---

# MRE Atomic Design System

**Status:** Implemented  
**Scope:** All components under `src/components/`  
**Applies to:** All contributors (human and LLM)

This document describes the atomic design tier structure used to organize MRE UI
components. The implementation was completed per
`docs/implimentation_plans/OLD/atomic-design-system-implementation-plan.md`.

---

## Tier Definitions

| Tier          | Path                                | Description                                                       | May Import From                                      |
| ------------- | ----------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| **Atoms**     | `@/components/atoms/`               | Smallest UI units: buttons, inputs, icons, badges, labels         | React, Next.js, libs, tokens—no other `@/components` |
| **Molecules** | `@/components/molecules/`           | Compositions of atoms: Modal, Tooltip, StandardTable, form fields | Atoms only                                           |
| **Organisms** | `@/components/organisms/<feature>/` | Sections of UI: tables, forms, sidebars, charts with controls     | Atoms, molecules, other organisms (acyclic)          |
| **Templates** | `@/components/templates/`           | Page-level layout shells: rail, status bar, main slot             | Organisms only                                       |
| **Pages**     | `src/app/.../page.tsx`              | Route components wiring templates + organisms + data              | Any tier                                             |

**Dependency rule:** Atoms ← Molecules ← Organisms ← Templates ← Pages. No tier
may import from a higher tier (e.g. no atom may import an organism).

---

## Folder Map

```
src/components/
  atoms/           Button, ListRow, LoadingState, StandardButton, StandardInput,
                   StatusBadge, ChartIcon, Breadcrumbs, Switch
  molecules/       Modal, Tooltip, StandardTable, EventStatusBadge, ErrorDisplay,
                   ContentWrapper, PageContainer, LabeledSwitch
  organisms/       event-analysis/, event-search/, admin/, dashboard/, practice-days/,
                   search/, track-maps/, events/, users/
  templates/       DashboardLayout
  (root)           AdminNav, ConditionalNav, ErrorBoundary, Footer, LogoutButton,
                   Providers, store/ReduxProvider
```

---

## Import Rules

1. **Use canonical paths:** `@/components/atoms/Breadcrumbs`,
   `@/components/molecules/Modal`,
   `@/components/organisms/event-analysis/ListPagination`
2. **No barrel files required:** Direct file imports are used; barrels are
   optional
3. **Cross-organism imports:** Allowed when acyclic (e.g. event-search may
   import from event-analysis)
4. **Types:** Re-export from the component that defines them (e.g. `EventStatus`
   from `@/components/molecules/EventStatusBadge`)

---

## Key Component Paths

| Component       | Path                                                   |
| --------------- | ------------------------------------------------------ |
| Modal           | `@/components/molecules/Modal`                         |
| Tooltip         | `@/components/molecules/Tooltip` (wraps long text; use for all tooltips) |
| StandardTable   | `@/components/molecules/StandardTable`                 |
| ListRow         | `@/components/atoms/ListRow`                           |
| Breadcrumbs     | `@/components/atoms/Breadcrumbs`                       |
| PageContainer   | `@/components/molecules/PageContainer`                 |
| ContentWrapper  | `@/components/molecules/ContentWrapper`                |
| ListPagination  | `@/components/organisms/event-analysis/ListPagination` |
| ChartContainer   | `@/components/organisms/event-analysis/ChartContainer`   |
| LapTimeLineChart | `@/components/organisms/event-analysis/LapTimeLineChart` |
| EventStats       | `@/components/organisms/event-analysis/EventStats`       |
| WeatherCard      | `@/components/organisms/event-analysis/WeatherCard`       |
| DashboardLayout  | `@/components/templates/DashboardLayout`                |

---

## Adding New Components

1. **Determine the correct tier** from the definitions above
2. **Place in the appropriate folder** (`atoms/`, `molecules/`, or
   `organisms/<feature>/`)
3. **Respect the dependency rule**—do not import from a higher tier
4. **Use `@/components/` paths** in imports, not relative paths when crossing
   tiers
5. **Charts (including line graphs):** New chart organisms in
   `organisms/event-analysis/` must follow `docs/design/chart-design-standards.md`
   and use `ChartContainer`. Future lap-time line graphs should follow the same
   pattern as `LapTimeLineChart` (ChartContainer, ParentSize, Visx, legend,
   wrapper `minHeight` when content is below the SVG).
5a. **Compact label–value cards:** Any new card that displays multiple "Label:
    value" rows in a single compact box must follow
    `docs/design/compact-label-value-card.md` (grid alignment, left-aligned labels,
    content-width card, table-style dates). Reference: `EventStats.tsx`.
5b. **Lookup/filter fields:** Lookup fields, filter inputs, and similar form
    controls (e.g. "Find driver") must use the standard width
    `w-[9rem] min-w-[9rem]` per `docs/design/standard-form-field-width.md` to
    match the Event Search form. Reference: `CombinedDriversTable.tsx`.
6. **Tooltips:** Use the shared `@/components/molecules/Tooltip` for all
   tooltips (not native `title` for long text). It wraps long content within its
   border and shows instantly; do not change it to `whitespace-nowrap` or the
   text will overflow.
7. **Icons:** Prefer `lucide-react` for new UI icons (tree-shaken named imports).
   Existing inline SVGs (e.g. in EventAnalysisHeader) remain valid; no need to
   migrate them.

---

**End of Atomic Design System**
