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
                   StatusBadge, ChartIcon, Breadcrumbs
  molecules/       Modal, Tooltip, StandardTable, EventStatusBadge, ErrorDisplay,
                   ContentWrapper, PageContainer
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
| Tooltip         | `@/components/molecules/Tooltip`                       |
| StandardTable   | `@/components/molecules/StandardTable`                 |
| ListRow         | `@/components/atoms/ListRow`                           |
| Breadcrumbs     | `@/components/atoms/Breadcrumbs`                       |
| PageContainer   | `@/components/molecules/PageContainer`                 |
| ContentWrapper  | `@/components/molecules/ContentWrapper`                |
| ListPagination  | `@/components/organisms/event-analysis/ListPagination` |
| ChartContainer  | `@/components/organisms/event-analysis/ChartContainer` |
| DashboardLayout | `@/components/templates/DashboardLayout`               |

---

## Adding New Components

1. **Determine the correct tier** from the definitions above
2. **Place in the appropriate folder** (`atoms/`, `molecules/`, or
   `organisms/<feature>/`)
3. **Respect the dependency rule**—do not import from a higher tier
4. **Use `@/components/` paths** in imports, not relative paths when crossing
   tiers

---

**End of Atomic Design System**
