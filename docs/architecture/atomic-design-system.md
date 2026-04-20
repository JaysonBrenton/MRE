---
created: 2026-01-31
creator: Implementation
lastModified: 2026-04-19
description: Atomic design system for MRE UI components
purpose:
  Defines the component tier structure, import rules, and folder map for the MRE
  UI. All contributors must follow these rules when adding or moving components.
relatedFiles:
  - docs/implimentation_plans/OLD/atomic-design-system-implementation-plan.md
  - docs/standards/typescript-react-style-guide.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/design/compact-label-value-card.md
  - docs/frontend/component-catalog.md (full file list)
  - src/components/organisms/event-analysis/EventOverviewTopQualifiers.tsx
    (contextual info pattern)
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

Machine-generated inventory with one line per file:
[`docs/frontend/component-catalog.md`](../frontend/component-catalog.md)
(regenerate: `npm run docs:component-catalog` inside the app container).

```
src/components/
  atoms/           Breadcrumbs, Button, ChartIcon, ListRow, LoadingState,
                   StandardButton, StandardInput, StatusBadge, Switch
  molecules/       ContentWrapper, ErrorDisplay, EventStatusBadge, LabeledSwitch,
                   Modal, PageContainer, StandardTable, Stepper, Tooltip
  organisms/       admin/, dashboard/, event-analysis/, event-search/, events/,
                   practice-days/, search/, track-maps/, users/
  templates/       DashboardLayout
  (root)           AdminNav, AuthenticatedNav, AuthenticatedNavLinks,
                   ConditionalNav, ErrorBoundary, Footer, GlobalErrorHandler,
                   Hero, LogoutButton, NavBar, Providers, store/ReduxProvider
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

| Component        | Path                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| Modal            | `@/components/molecules/Modal`                                           |
| Tooltip          | `@/components/molecules/Tooltip` (wraps long text; use for all tooltips) |
| StandardTable    | `@/components/molecules/StandardTable`                                   |
| ListRow          | `@/components/atoms/ListRow`                                             |
| Breadcrumbs      | `@/components/atoms/Breadcrumbs`                                         |
| PageContainer    | `@/components/molecules/PageContainer`                                   |
| ContentWrapper   | `@/components/molecules/ContentWrapper`                                  |
| ListPagination   | `@/components/organisms/event-analysis/ListPagination`                   |
| ChartContainer   | `@/components/organisms/event-analysis/ChartContainer`                   |
| LapTimeLineChart | `@/components/organisms/event-analysis/LapTimeLineChart`                 |
| EventStats       | `@/components/organisms/event-analysis/EventStats`                       |
| WeatherCard      | `@/components/organisms/event-analysis/WeatherCard`                      |
| DashboardLayout  | `@/components/templates/DashboardLayout`                                 |

---

## Adding New Components

1. **Determine the correct tier** from the definitions above
2. **Place in the appropriate folder** (`atoms/`, `molecules/`, or
   `organisms/<feature>/`)
3. **Respect the dependency rule**—do not import from a higher tier
4. **Use `@/components/` paths** in imports, not relative paths when crossing
   tiers
5. **Charts (including line graphs):** New chart organisms in
   `organisms/event-analysis/` must follow
   `docs/design/chart-design-standards.md` and use `ChartContainer`. Future
   lap-time line graphs should follow the same pattern as `LapTimeLineChart`
   (ChartContainer, ParentSize, Visx, legend, wrapper `minHeight` when content
   is below the SVG). 5a. **Compact label–value cards:** Any new card that
   displays multiple "Label: value" rows in a single compact box must follow
   `docs/design/compact-label-value-card.md` (grid alignment, left-aligned
   labels, content-width card, table-style dates). Reference: `EventStats.tsx`.
   5b. **Lookup/filter fields:** Lookup fields, filter inputs, and similar form
   controls (e.g. "Find driver") must use the standard width
   `w-[9rem] min-w-[9rem]` per `docs/design/standard-form-field-width.md` to
   match the Event Search form. Reference: `CombinedDriversTable.tsx`.
6. **Tooltips:** Use the shared `@/components/molecules/Tooltip` for all
   tooltips (not native `title` for long text). It wraps long content within its
   border and shows instantly; do not change it to `whitespace-nowrap` or the
   text will overflow.
7. **Icons:** Use `lucide-react` for UI icons wherever possible (tree-shaken
   named imports). New components must not introduce custom inline SVG icons
   when an equivalent Lucide icon exists. Existing inline SVGs should be
   migrated opportunistically to Lucide as files are touched.
8. **Contextual info callouts:** Bordered “what this section shows” blurbs must
   follow
   [Contextual info callouts (design rule)](#contextual-info-callouts-design-rule)
   (plain language, no em dashes, single `<p>`, one typography path,
   `aria-label` matches visible copy). Reference:
   `EventOverviewTopQualifiers.tsx`.

### Icon Mapping (Dashboard + Event Analysis)

Use the following canonical icon mappings in dashboard/event-analysis scope:

- **Search / find**: `Search` (e.g. command palette, find events)
- **Close / dismiss**: `X` (e.g. modal close buttons, clear search)
- **Calendar / date range**: `CalendarRange` or `CalendarDays` (e.g. event
  context ribbon)
- **Refresh / reload data**: `RefreshCcw` (e.g. refresh event data)
- **User / profile**: `User` (e.g. top status bar profile trigger)
- **People / drivers/classes**: `Users` (e.g. driver/class selection)
- **Success / “You participated”**: `CheckCircle2`
- **Warning / attention**: `AlertTriangle`
- **Delete / destructive**: `Trash2`
- **External link**: `ExternalLink`

Icons should generally use `w-4 h-4` for inline controls and `w-5 h-5` for
primary buttons, with `strokeWidth` left at the Lucide default unless a specific
design call requires otherwise.

---

## Contextual info callouts (design rule)

**Applies to:** Bordered hint / education boxes in **organisms** (dashboard,
event analysis, and similar) that explain _what a section actually shows_ (e.g.
tab footnotes, “Class winners” disclaimers, scope notes). Not a new component
tier: a **content and markup pattern** every contributor must follow when adding
or editing this UI.

1. **Audience:** Write for mixed literacy (novice drivers, parents, casual
   viewers). Prefer plain language over insider or data-pipeline jargon.
2. **Jargon:** Do not expose unexplained race-admin or ingestion terms in
   user-visible copy (e.g. “P1”, “featured main”, “multi-main”, “per-main
   split”). Rephrase in everyday terms and, when helpful, point to **where** in
   the app to find the other concept (tab names, navigation path).
3. **Punctuation:** Do **not** use the em dash (—). Use periods, commas, or
   colons to join or break sentences.
4. **Markup:** One contiguous explanation uses a **single** `<p>`. Do not use
   multiple `<p>` elements for copy that reads as one continuous note (reduces
   visual noise and duplicate typography).
5. **Typography:** Use **one** font-size path. For secondary explanatory text,
   prefer `leading-relaxed` plus `typography.bodySecondary` (or another single
   typography token). Do **not** combine `text-xs` with
   `typography.bodySecondary` when `bodySecondary` already applies `text-sm`,
   which produces conflicting sizes in the DOM.
6. **Accessibility:** When the wrapper has `aria-label`, reuse the **same string
   constant** as the visible paragraph so the accessible name matches what
   sighted users read.
7. **Reference:** `EventOverviewTopQualifiers.tsx` (container
   `event-overview-class-winners-info`, constant `CLASS_WINNERS_INFO_TEXT`).

---

**End of Atomic Design System**
