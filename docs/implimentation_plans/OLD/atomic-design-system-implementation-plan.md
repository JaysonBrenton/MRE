# Atomic Design System Implementation Plan

**Created:** 2026-01-31  
**Owner:** Frontend / Architecture  
**Objective:** Implement a fully atomic design system for MRE UI components with
no guesswork—all assertions in this plan are verified against the current
codebase (as of the plan date).  
**Scope:** Component folder structure, import paths, dependency rules, and
documentation. No new features; refactor only.

---

## 0. Guiding Goals

1. **Atomic design tiers** – Introduce and enforce atoms → molecules → organisms
   → templates → pages.
2. **Single source of truth** – One canonical location per component; clear
   dependency direction (no atom importing an organism).
3. **Existing design preserved** – Token system (`--token-*` in
   `src/app/globals.css`), Modal/ListRow/StandardTable usage, and flexbox/layout
   rules remain; only structure and paths change.
4. **Verified baseline** – Every path, import, and “current state” claim in this
   plan is confirmed from the repo (see Section 1). No assumptions.

---

## 1. Current State (Verified from Code)

All of the following was confirmed by searching and reading the codebase. Docs
may be out of date; **code is the authority** for “what exists” and “who imports
whom.”

### 1.1 Path Alias and Component Roots

- **Path alias:** `@/*` → `./src/*` (from `tsconfig.json`).
- **Component root:** `src/components/`. No barrel files
  (`index.ts`/`index.tsx`) exist under `src/components/`; all imports use full
  file paths (e.g. `@/components/ui/Modal`).

> **Reviewer validation (2026-01-31 / Codex):** Verified `@/*` → `./src/*`
> directly in `tsconfig.json` and ran `rg --files -g 'index.ts*' src/components`
> (no results), so the “no barrel files under `src/components`” statement is
> still accurate.

### 1.2 Design System (Code)

- **Tokens:** Defined in `src/app/globals.css`:
  - `:root` – dark theme (default): `--token-surface`, `--token-text-primary`,
    `--token-text-secondary`, `--token-border-default`, `--token-accent`,
    `--token-accent-hover`, status tokens, spacing, typography, glass/chart
    tokens.
  - `.light` – light theme overrides.
- **Modal constraints:** `src/lib/modal-styles.ts` exports
  `getModalContainerStyles`, `MODAL_MAX_WIDTHS`, and related helpers.
  `src/components/ui/Modal.tsx` uses them; file header and docs (e.g.
  FLEXBOX_LAYOUT_CHECKLIST) reference this.
- **Docs referenced by code/file headers:**
  `docs/design/mre-dark-theme-guidelines.md`,
  `docs/design/mre-ux-principles.md`,
  `docs/architecture/mobile-safe-architecture-guidelines.md`,
  `docs/development/FLEXBOX_LAYOUT_CHECKLIST.md`,
  `docs/development/PAGINATION_SPACING_GUIDELINES.md`,
  `docs/design/table-component-specification.md`.

### 1.3 Imports from `@/components/ui/` (Exact List)

Only these three UI primitives are imported elsewhere in the app:

| Import path                     | Used in (file path)                                                                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@/components/ui/Modal`         | SessionLapDataModal, ChartControlsTesting, EventAnalysisSidebar, ClassDetailsModal, ChartControls, EventActionsProvider, UsersTable, EventsTable, EditUserModal, DeleteConfirmationDialog, UserProfileModal |
| `@/components/ui/Tooltip`       | SidebarAction, AdaptiveNavigationRail, DriverCardsAndWeatherGridTesting, TopStatusBar                                                                                                                       |
| `@/components/ui/StandardTable` | SearchResultsTable (StandardTable, StandardTableHeader, StandardTableRow, StandardTableCell)                                                                                                                |

**Not imported anywhere in app or components:**  
`Button`, `ListRow`, `LoadingState`, `StandardButton`, `StandardInput`,
`StatusBadge` (all under `src/components/ui/`). They exist but have no external
consumers in the codebase.

### 1.4 Cross-Feature / Shared Component Usage (Verified)

- **ListPagination** (`src/components/event-analysis/ListPagination.tsx`):  
  Imported by `EventSearchContainer`, `PracticeDaySearchContainer`,
  `UsersTable`, `TracksTable`, `EventsTable`, `AuditLogTable`, and by
  `src/app/(authenticated)/search/page.tsx`. So it is a shared component used by
  admin, event-search, practice-days, and search.
- **ChartContainer** (`src/components/event-analysis/ChartContainer.tsx`):  
  Imported by many event-analysis components (SessionsTable, LapDataTable,
  UnifiedPerformanceChart, LapTimeLineChart, EntryList, etc.), by `UsersTable`,
  `TracksTable`, `EventsTable`, `AuditLogTable`, `EventsPageClient`, and
  `DashboardClient`. Shared across event-analysis, admin, events, and dashboard.
- **Modal** (see 1.3): Used by event-analysis, admin, dashboard/shell.
- **ErrorDisplay:** Only `src/components/event-search/ErrorDisplay.tsx` is
  imported (by `EventSearchContainer` and `PracticeDaySearchContainer`).
  `src/components/shared/ErrorDisplay.tsx` is **not imported anywhere**
  (different props API; effectively dead code).
- **PageContainer / ContentWrapper** (`src/components/layout/`):  
  Referenced in `docs/development/FLEXBOX_LAYOUT_CHECKLIST.md` and
  `docs/architecture/mobile-safe-architecture-guidelines.md` as components to
  use. **Neither is imported in any `src` file**; they are documented but
  unused.
- **ChartIcon** (`src/components/icons/ChartIcon.tsx`): **Not imported
  anywhere** in the codebase.

> **Reviewer comment (2026-01-31 / Codex):** `ListPagination` and
> `ChartContainer` are also consumed by the self-serve dashboard results page at
> `src/app/(authenticated)/dashboard/my-event/page.tsx`. Consider adding that
> page to the consumer list in Section 1.4 so the dashboard dependency surface
> stays visible during the refactor.

### 1.5 Complete Component Inventory (File-Level)

Every `.tsx` under `src/components/` is listed below. Test files (e.g.
`*.test.tsx`) are excluded from move mapping but noted where present.

| Current path                                               | Notes (verified)                                                                                                                                                                         |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ui/**                                                    |                                                                                                                                                                                          |
| `ui/Button.tsx`                                            | No external imports                                                                                                                                                                      |
| `ui/ListRow.tsx`                                           | No external imports (referenced in Modal.tsx relatedFiles only)                                                                                                                          |
| `ui/LoadingState.tsx`                                      | No external imports                                                                                                                                                                      |
| `ui/Modal.tsx`                                             | Imported by 10+ components (see 1.3)                                                                                                                                                     |
| `ui/StandardButton.tsx`                                    | No external imports                                                                                                                                                                      |
| `ui/StandardInput.tsx`                                     | No external imports                                                                                                                                                                      |
| `ui/StandardTable.tsx`                                     | Imported by SearchResultsTable only                                                                                                                                                      |
| `ui/StatusBadge.tsx`                                       | No external imports                                                                                                                                                                      |
| `ui/Tooltip.tsx`                                           | Imported by 4 components (see 1.3)                                                                                                                                                       |
| **layout/**                                                |                                                                                                                                                                                          |
| `layout/ContentWrapper.tsx`                                | Not imported anywhere                                                                                                                                                                    |
| `layout/PageContainer.tsx`                                 | Not imported anywhere                                                                                                                                                                    |
| **icons/**                                                 |                                                                                                                                                                                          |
| `icons/ChartIcon.tsx`                                      | Not imported anywhere                                                                                                                                                                    |
| **shared/**                                                |                                                                                                                                                                                          |
| `shared/ErrorDisplay.tsx`                                  | Not imported anywhere; event-search/ErrorDisplay used instead                                                                                                                            |
| **admin/**                                                 |                                                                                                                                                                                          |
| `admin/AdminDashboardStats.tsx`                            | Used by admin/page.tsx                                                                                                                                                                   |
| `admin/AuditLogTable.tsx`                                  | Used by admin/audit/page.tsx; uses ListPagination, ChartContainer                                                                                                                        |
| `admin/DeleteConfirmationDialog.tsx`                       | Uses Modal                                                                                                                                                                               |
| `admin/EditUserModal.tsx`                                  | Uses Modal                                                                                                                                                                               |
| `admin/EventsTable.tsx`                                    | Uses Modal, ListPagination, ChartContainer, DeleteConfirmationDialog                                                                                                                     |
| `admin/HealthStatus.tsx`                                   | Used by admin/health/page.tsx                                                                                                                                                            |
| `admin/IngestionControls.tsx`                              | Used by admin/ingestion/page.tsx                                                                                                                                                         |
| `admin/LogViewer.tsx`                                      | Used by admin/logs/page.tsx                                                                                                                                                              |
| `admin/TracksTable.tsx`                                    | Uses ListPagination, ChartContainer                                                                                                                                                      |
| `admin/UsersTable.tsx`                                     | Uses Modal, ListPagination, ChartContainer, EditUserModal, DeleteConfirmationDialog                                                                                                      |
| **dashboard/**                                             |                                                                                                                                                                                          |
| `dashboard/DashboardClient.tsx`                            | Uses ChartContainer, useDashboardEventSearch; defines WeatherLoadingState inline                                                                                                         |
| `dashboard/DashboardEventSearchProvider.tsx`               | Uses EventSearchModal                                                                                                                                                                    |
| `dashboard/DashboardEventSelector.tsx`                     | —                                                                                                                                                                                        |
| `dashboard/DashboardLayout.tsx`                            | Uses AdaptiveNavigationRail, TopStatusBar, CommandPalette                                                                                                                                |
| `dashboard/DriverCardsAndWeatherGridTesting.tsx`           | Uses ImprovementDriverCard, Tooltip                                                                                                                                                      |
| `dashboard/EventActionsContext.tsx`                        | Context only                                                                                                                                                                             |
| `dashboard/EventActionsProvider.tsx`                       | Uses useDashboardEventSearch, Modal, ClassDetailsModal, EventActionsContext                                                                                                              |
| `dashboard/EventAnalysisHeaderWrapper.tsx`                 | Used by (authenticated)/layout.tsx                                                                                                                                                       |
| `dashboard/EventAnalysisSection.tsx`                       | Uses TabNavigation, OverviewTab, DriversTab, EntryListTab, SessionsTab, ComparisonsTab, ComparisonTest, EventAnalysisHeader, useEventActions, DriverCardsAndWeatherGrid, DashboardClient |
| `dashboard/ImprovementDriverCard.tsx`                      | Used by DashboardClient, DriverCardsAndWeatherGridTesting                                                                                                                                |
| **dashboard/shell/**                                       |                                                                                                                                                                                          |
| `dashboard/shell/AdaptiveNavigationRail.tsx`               | Uses Tooltip, useEventActionsOptional, DashboardActionsPopover                                                                                                                           |
| `dashboard/shell/CommandPalette.tsx`                       | Redux only, no @/components                                                                                                                                                              |
| `dashboard/shell/ContextRibbon.tsx`                        | Not imported anywhere in codebase                                                                                                                                                        |
| `dashboard/shell/DashboardActionsPopover.tsx`              | Uses useEventActionsOptional                                                                                                                                                             |
| `dashboard/shell/EventSearchModal.tsx`                     | Uses EventSearchContainer, getModalContainerStyles                                                                                                                                       |
| `dashboard/shell/TopStatusBar.tsx`                         | Uses UserProfileModal, Tooltip                                                                                                                                                           |
| `dashboard/shell/UserProfileModal.tsx`                     | Uses Modal, LogoutButton                                                                                                                                                                 |
| **event-analysis/**                                        |                                                                                                                                                                                          |
| `event-analysis/AvgVsFastestChart.tsx`                     | Uses ChartContainer (and Visx)                                                                                                                                                           |
| `event-analysis/BestLapBarChart.tsx`                       | Uses ChartContainer                                                                                                                                                                      |
| `event-analysis/ChartColorPicker.tsx`                      | —                                                                                                                                                                                        |
| `event-analysis/ChartContainer.tsx`                        | No @/components; wrapper with tokens                                                                                                                                                     |
| `event-analysis/ChartControls.tsx`                         | Uses Modal, ClassDetailsModal                                                                                                                                                            |
| `event-analysis/ChartDataNotice.tsx`                       | —                                                                                                                                                                                        |
| `event-analysis/ChartPagination.tsx`                       | —                                                                                                                                                                                        |
| `event-analysis/ChartSection.tsx`                          | —                                                                                                                                                                                        |
| `event-analysis/ChartTypeSelector.tsx`                     | —                                                                                                                                                                                        |
| `event-analysis/ClassDetailsModal.tsx`                     | Uses Modal                                                                                                                                                                               |
| `event-analysis/ClassFilter.tsx`                           | —                                                                                                                                                                                        |
| `event-analysis/CollapsibleDriverPanel.tsx`                | —                                                                                                                                                                                        |
| `event-analysis/ComparisonsTab.tsx`                        | Uses RaceSelector, LapTimeLineChart                                                                                                                                                      |
| `event-analysis/ComparisonTest.tsx`                        | Uses RaceSelector                                                                                                                                                                        |
| `event-analysis/DriverCard.tsx`                            | —                                                                                                                                                                                        |
| `event-analysis/DriverList.tsx`                            | —                                                                                                                                                                                        |
| `event-analysis/DriverSelectionHeader.tsx`                 | —                                                                                                                                                                                        |
| `event-analysis/DriversTab.tsx`                            | —                                                                                                                                                                                        |
| `event-analysis/EntryList.tsx`                             | Uses ListPagination, ClassFilter, ChartContainer, ClassDetailsModal                                                                                                                      |
| `event-analysis/EntryListTab.tsx`                          | —                                                                                                                                                                                        |
| `event-analysis/EventAnalysisHeader.tsx`                   | —                                                                                                                                                                                        |
| `event-analysis/EventAnalysisSidebar.tsx`                  | Uses Modal, ClassDetailsModal, SidebarAction, useDashboardEventSearch, Redux, ChartControls types                                                                                        |
| `event-analysis/EventStats.tsx`                            | —                                                                                                                                                                                        |
| `event-analysis/LapTimeLineChart.tsx`                      | Uses ChartContainer, useChartColors                                                                                                                                                      |
| `event-analysis/ListPagination.tsx`                        | No @/components (shared by many)                                                                                                                                                         |
| `event-analysis/OverviewTab.tsx`                           | Uses EventStats, ChartControls, UnifiedPerformanceChart, ChartSection, ChartDataNotice                                                                                                   |
| `event-analysis/RaceSelector.tsx`                          | —                                                                                                                                                                                        |
| `event-analysis/SessionsTab.tsx`                           | Uses SessionChartTabs                                                                                                                                                                    |
| `event-analysis/SidebarAction.tsx`                         | Uses Tooltip                                                                                                                                                                             |
| `event-analysis/TabNavigation.tsx`                         | —                                                                                                                                                                                        |
| `event-analysis/UnifiedPerformanceChart.tsx`               | Uses ChartContainer, ChartPagination, ChartColorPicker                                                                                                                                   |
| **event-analysis/sessions/**                               |                                                                                                                                                                                          |
| `event-analysis/sessions/DriverNameFilter.tsx`             | —                                                                                                                                                                                        |
| `event-analysis/sessions/DriverPerformanceChart.tsx`       | —                                                                                                                                                                                        |
| `event-analysis/sessions/HeatProgressionChart.tsx`         | —                                                                                                                                                                                        |
| `event-analysis/sessions/LapDataTable.tsx`                 | Uses ChartContainer, DriverNameFilter, ViewModeToggle, ListPagination                                                                                                                    |
| `event-analysis/sessions/OverviewChart.tsx`                | —                                                                                                                                                                                        |
| `event-analysis/sessions/SessionChartTabs.tsx`             | Uses SessionsTable                                                                                                                                                                       |
| `event-analysis/sessions/SessionControls.tsx`              | —                                                                                                                                                                                        |
| `event-analysis/sessions/SessionLapDataModal.tsx`          | Uses Modal                                                                                                                                                                               |
| `event-analysis/sessions/SessionsTable.tsx`                | Uses ChartContainer, SessionsTableRow, ListPagination, SessionLapDataModal                                                                                                               |
| `event-analysis/sessions/SessionsTableResults.tsx`         | —                                                                                                                                                                                        |
| `event-analysis/sessions/SessionsTableRow.tsx`             | Uses SessionsTableResults                                                                                                                                                                |
| `event-analysis/sessions/ViewModeToggle.tsx`               | —                                                                                                                                                                                        |
| **event-analysis/overview-testing/**                       |                                                                                                                                                                                          |
| `event-analysis/overview-testing/ChartControlsTesting.tsx` | Uses Modal, ClassDetailsModal                                                                                                                                                            |
| `event-analysis/overview-testing/ContextBar.tsx`           | —                                                                                                                                                                                        |
| `event-analysis/overview-testing/EventStatsTesting.tsx`    | —                                                                                                                                                                                        |
| `event-analysis/overview-testing/OverviewTabTesting.tsx`   | Uses EventStatsTesting, ChartControlsTesting, ContextBar, UnifiedPerformanceChart, ChartSection, ChartDataNotice                                                                         |
| **event-search/**                                          |                                                                                                                                                                                          |
| `event-search/CheckLiveRCButton.tsx`                       | —                                                                                                                                                                                        |
| `event-search/DateRangePicker.tsx`                         | —                                                                                                                                                                                        |
| `event-search/ErrorDisplay.tsx`                            | Used by EventSearchContainer, PracticeDaySearchContainer                                                                                                                                 |
| `event-search/EventRow.tsx`                                | Uses EventStatusBadge                                                                                                                                                                    |
| `event-search/EventSearchContainer.tsx`                    | Uses EventSearchForm, TrackRow type, EventTable, Event type, EventStatusBadge, ErrorDisplay, ListPagination, PracticeDaySearchContainer                                                  |
| `event-search/EventSearchForm.tsx`                         | Uses TrackSelectionModal, TrackRow type, DateRangePicker, MonthYearPicker                                                                                                                |
| `event-search/EventStatusBadge.tsx`                        | Used by EventRow; types used by EventTable, EventSearchContainer                                                                                                                         |
| `event-search/EventTable.tsx`                              | Uses EventRow, EventStatus type                                                                                                                                                          |
| `event-search/ImportPrompt.tsx`                            | —                                                                                                                                                                                        |
| `event-search/TrackRow.tsx`                                | Type Track exported; used by EventSearchForm, PracticeDaySearchContainer, EventSearchContainer                                                                                           |
| `event-search/TrackSelectionModal.tsx`                     | —                                                                                                                                                                                        |
| **events/**                                                |                                                                                                                                                                                          |
| `events/EventsPageClient.tsx`                              | Uses ChartContainer                                                                                                                                                                      |
| **practice-days/**                                         |                                                                                                                                                                                          |
| `practice-days/MonthYearPicker.tsx`                        | Used by EventSearchForm                                                                                                                                                                  |
| `practice-days/PracticeDayRow.tsx`                         | —                                                                                                                                                                                        |
| `practice-days/PracticeDaySearchContainer.tsx`             | Uses Track type (TrackRow), PracticeDayRow, ListPagination, ErrorDisplay (event-search)                                                                                                  |
| **search/**                                                |                                                                                                                                                                                          |
| `search/SearchForm.tsx`                                    | —                                                                                                                                                                                        |
| `search/SearchResultsTable.tsx`                            | Uses StandardTable\*, useAppSelector                                                                                                                                                     |
| **track-maps/**                                            |                                                                                                                                                                                          |
| `track-maps/ShapePropertiesPanel.tsx`                      | —                                                                                                                                                                                        |
| `track-maps/ShareMapDialog.tsx`                            | —                                                                                                                                                                                        |
| `track-maps/ShapeToolbar.tsx`                              | —                                                                                                                                                                                        |
| `track-maps/TrackMapCanvas.tsx`                            | —                                                                                                                                                                                        |
| `track-maps/TrackMapEditor.tsx`                            | Uses TrackMapCanvas, ShapeToolbar, ShapePropertiesPanel, ShareMapDialog                                                                                                                  |
| **users/**                                                 |                                                                                                                                                                                          |
| `users/DriverLinkCard.tsx`                                 | —                                                                                                                                                                                        |
| `users/DriverLinksView.tsx`                                | —                                                                                                                                                                                        |
| **store/**                                                 |                                                                                                                                                                                          |
| `store/ReduxProvider.tsx`                                  | Used by (authenticated)/layout.tsx                                                                                                                                                       |
| **Root (no subfolder)**                                    |                                                                                                                                                                                          |
| `AdminNav.tsx`                                             | Used by admin/layout.tsx, ConditionalNav                                                                                                                                                 |
| `AuthenticatedNav.tsx`                                     | Uses LogoutButton; used by ConditionalNav                                                                                                                                                |
| `AuthenticatedNavLinks.tsx`                                | Not imported anywhere in codebase                                                                                                                                                        |
| `Breadcrumbs.tsx`                                          | Used by many app pages (under-development, search, guides, events, dashboard/_, admin/_)                                                                                                 |
| `ConditionalNav.tsx`                                       | Uses AuthenticatedNav, AdminNav                                                                                                                                                          |
| `ErrorBoundary.tsx`                                        | Used by app/layout.tsx                                                                                                                                                                   |
| `Footer.tsx`                                               | Used by register, login, AppShell                                                                                                                                                        |
| `GlobalErrorHandler.tsx`                                   | Used by Providers.tsx only                                                                                                                                                               |
| `Hero.tsx`                                                 | Not imported anywhere; app/page.tsx uses inline content                                                                                                                                  |
| `LogoutButton.tsx`                                         | Used by AuthenticatedNav, UserProfileModal, AppShell                                                                                                                                     |
| `NavBar.tsx`                                               | Not imported anywhere in codebase                                                                                                                                                        |
| `Providers.tsx`                                            | Used by app/layout.tsx                                                                                                                                                                   |

(Any “verify usage” can be confirmed with a repo grep before implementation.)

### 1.6 App Entry Points for Components

- **Layout:** `src/app/(authenticated)/layout.tsx` imports DashboardLayout,
  ReduxProvider, DashboardEventSearchProvider, EventActionsProvider, Footer,
  EventAnalysisHeaderWrapper.
- **Pages:** Each `src/app/(authenticated)/**/page.tsx` (and login, register,
  etc.) imports specific components; see grep results in Section 1.4 and 1.5 for
  exact lists (Breadcrumbs, DashboardClient, EventAnalysisSection, UsersTable,
  TracksTable, etc.).

### 1.7 Documentation vs Code Gaps (Verified)

- **PageContainer / ContentWrapper:** Documented in FLEXBOX_LAYOUT_CHECKLIST and
  mobile-safe-architecture-guidelines as components to use. **Not imported
  anywhere in `src/`.** Either adopt in atomic layout tier or update docs to
  match reality.
- **shared/ErrorDisplay:** Exists with different API than
  event-search/ErrorDisplay. **Never imported.** Decision: remove or consolidate
  in atomic refactor.
- **ChartIcon:** Exists, **never imported.** Decision: move to atoms and use
  later, or remove.
- **Root components with no imports (verified):** `AuthenticatedNavLinks.tsx`,
  `ContextRibbon.tsx`, `NavBar.tsx`, `Hero.tsx` are not imported anywhere in the
  codebase. `Hero` is only mentioned in `app/page.tsx` relatedFiles; the home
  page uses inline content. Decision in Phase 6: move to atoms/organisms or
  remove.
- **ui/ Button, ListRow, LoadingState, StandardButton, StandardInput,
  StatusBadge:** Documented or referenced in relatedFiles but **not imported by
  any other component.** They are primitives; atomic design will place them in
  atoms and make them the only allowed building blocks for molecules.

---

## 2. Atomic Design Tier Definitions (MRE-Specific)

- **Atoms:** Smallest UI units. No imports from `@/components` except other
  atoms (or none). Examples: buttons, inputs, labels, icons, single HTML-like
  elements styled with `--token-*`. No business logic; presentational only.
- **Molecules:** Compositions of one or more atoms (and optionally other
  molecules) that form one UI “concept” (e.g. form field = label + input, modal
  = overlay + panel). May import only from atoms (and molecules if dependency is
  acyclic). Domain-agnostic where possible (e.g. “StatusBadge” molecule can be
  specialized later).
- **Organisms:** Sections of UI: tables, forms, sidebars, charts with controls,
  nav rails. May import atoms and molecules and other organisms only where no
  cycle is introduced. Often feature-specific (e.g. EventTable, SessionsTable).
- **Templates:** Page-level layout shells: placeholders/slots for header,
  sidebar, main, footer. No app-specific data fetching; may receive components
  as props. Example: DashboardLayout (rail + status bar + main slot).
- **Pages:** Compositions that wire templates + organisms + data (e.g. Redux,
  server). In Next.js App Router, many “pages” are already in
  `src/app/.../page.tsx`; the plan can either (a) keep pages only in `app/` and
  treat “pages” tier as those route components, or (b) add `components/pages/`
  that export page components used by `app/` (current codebase does not use
  (b)).

**Dependency rule:** Atoms ← Molecules ← Organisms ← Templates ← Pages. No tier
may import from a higher tier (e.g. no atom may import an organism).

---

## 3. Component-to-Tier Mapping (Verified and Rationale)

Every component is assigned a tier so that moves and import updates are
unambiguous. Rationale is one line per component.

| Tier                                       | Component (current path)                                                    | Rationale                                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Atoms**                                  |                                                                             |                                                                                                       |
|                                            | `ui/Button.tsx`                                                             | Single interactive control; no @/components.                                                          |
|                                            | `ui/ListRow.tsx`                                                            | Single row layout primitive; no @/components.                                                         |
|                                            | `ui/LoadingState.tsx`                                                       | Single message/UI block; no @/components.                                                             |
|                                            | `ui/StandardButton.tsx`                                                     | Single button variant; no @/components.                                                               |
|                                            | `ui/StandardInput.tsx`                                                      | Single input; no @/components.                                                                        |
|                                            | `ui/StatusBadge.tsx`                                                        | Single badge primitive; no @/components.                                                              |
|                                            | `icons/ChartIcon.tsx`                                                       | Single icon; no @/components.                                                                         |
|                                            | `Breadcrumbs.tsx`                                                           | Could be molecule (Link + text); treated as atom (single nav concept, no other MRE components).       |
| **Molecules**                              |                                                                             |                                                                                                       |
|                                            | `ui/Modal.tsx`                                                              | Backdrop + panel + title; uses modal-styles; no other @/components.                                   |
|                                            | `ui/Tooltip.tsx`                                                            | Trigger + popover; uses createPortal; no other @/components.                                          |
|                                            | `ui/StandardTable.tsx`                                                      | Table + Header + Row + Cell subcomponents; single “table” concept; no other @/components.             |
|                                            | `event-search/EventStatusBadge.tsx`                                         | Status badge + optional progress UI; domain-specific molecule.                                        |
|                                            | `event-search/ErrorDisplay.tsx`                                             | Message + retry + expandable details; used by event-search and practice-days.                         |
|                                            | `layout/ContentWrapper.tsx`                                                 | Wrapper div; no @/components.                                                                         |
|                                            | `layout/PageContainer.tsx`                                                  | Wrapper div; no @/components.                                                                         |
| **Organisms**                              |                                                                             |                                                                                                       |
|                                            | `event-analysis/ChartContainer.tsx`                                         | Chart wrapper with title/description; used by many.                                                   |
|                                            | `event-analysis/ListPagination.tsx`                                         | Pagination controls; shared across features.                                                          |
|                                            | `event-analysis/ChartPagination.tsx`                                        | Chart-specific pagination.                                                                            |
|                                            | `event-analysis/ChartColorPicker.tsx`                                       | Color picker UI.                                                                                      |
|                                            | `event-analysis/ChartSection.tsx`                                           | Section wrapper for charts.                                                                           |
|                                            | `event-analysis/ChartDataNotice.tsx`                                        | Notice block.                                                                                         |
|                                            | `event-analysis/ChartTypeSelector.tsx`                                      | Selector control.                                                                                     |
|                                            | `event-analysis/ChartControls.tsx`                                          | Driver/race controls + Modal + ClassDetailsModal.                                                     |
|                                            | `event-analysis/ClassDetailsModal.tsx`                                      | Modal + form content.                                                                                 |
|                                            | `event-analysis/ClassFilter.tsx`                                            | Filter UI.                                                                                            |
|                                            | `event-analysis/EventStats.tsx`                                             | Stats display.                                                                                        |
|                                            | `event-analysis/TabNavigation.tsx`                                          | Tab list.                                                                                             |
|                                            | `event-analysis/RaceSelector.tsx`                                           | Race dropdown/selector.                                                                               |
|                                            | `event-analysis/SidebarAction.tsx`                                          | Icon + Tooltip.                                                                                       |
|                                            | `event-analysis/DriverCard.tsx`                                             | Card for driver.                                                                                      |
|                                            | `event-analysis/DriverList.tsx`                                             | List of drivers.                                                                                      |
|                                            | `event-analysis/DriverSelectionHeader.tsx`                                  | Header for driver selection.                                                                          |
|                                            | `event-analysis/CollapsibleDriverPanel.tsx`                                 | Collapsible panel.                                                                                    |
|                                            | `event-analysis/EntryList.tsx`                                              | Table + filters + modals.                                                                             |
|                                            | `event-analysis/EntryListTab.tsx`                                           | Tab content.                                                                                          |
|                                            | `event-analysis/EventAnalysisHeader.tsx`                                    | Header block.                                                                                         |
|                                            | `event-analysis/EventAnalysisSidebar.tsx`                                   | Sidebar with list + modals.                                                                           |
|                                            | `event-analysis/ComparisonsTab.tsx`                                         | Tab with RaceSelector + chart.                                                                        |
|                                            | `event-analysis/ComparisonTest.tsx`                                         | Test view with RaceSelector.                                                                          |
|                                            | `event-analysis/OverviewTab.tsx`                                            | Tab with stats + charts + controls.                                                                   |
|                                            | `event-analysis/SessionsTab.tsx`                                            | Tab with SessionChartTabs.                                                                            |
|                                            | `event-analysis/DriversTab.tsx`                                             | Tab content.                                                                                          |
|                                            | `event-analysis/UnifiedPerformanceChart.tsx`                                | Chart + ChartContainer + pagination + color picker.                                                   |
|                                            | `event-analysis/AvgVsFastestChart.tsx`                                      | Chart + ChartContainer.                                                                               |
|                                            | `event-analysis/BestLapBarChart.tsx`                                        | Chart + ChartContainer.                                                                               |
|                                            | `event-analysis/LapTimeLineChart.tsx`                                       | Chart + ChartContainer.                                                                               |
|                                            | `event-analysis/sessions/*` (all 12)                                        | Session tables, modals, filters, charts—all organisms.                                                |
|                                            | `event-analysis/overview-testing/*` (all 4)                                 | Testing variants of overview organisms.                                                               |
|                                            | `event-search/DateRangePicker.tsx`                                          | Date range UI.                                                                                        |
|                                            | `event-search/EventRow.tsx`                                                 | Row with EventStatusBadge.                                                                            |
|                                            | `event-search/EventTable.tsx`                                               | Table of EventRows.                                                                                   |
|                                            | `event-search/EventSearchForm.tsx`                                          | Form with modals, pickers.                                                                            |
|                                            | `event-search/TrackSelectionModal.tsx`                                      | Modal with track list.                                                                                |
|                                            | `event-search/TrackRow.tsx`                                                 | Row for track (type used elsewhere).                                                                  |
|                                            | `event-search/CheckLiveRCButton.tsx`                                        | Button + logic.                                                                                       |
|                                            | `event-search/ImportPrompt.tsx`                                             | Prompt block.                                                                                         |
|                                            | `event-search/EventSearchContainer.tsx`                                     | Full search form + table + pagination + ErrorDisplay + PracticeDaySearchContainer.                    |
|                                            | `practice-days/MonthYearPicker.tsx`                                         | Picker UI.                                                                                            |
|                                            | `practice-days/PracticeDayRow.tsx`                                          | Row for practice day.                                                                                 |
|                                            | `practice-days/PracticeDaySearchContainer.tsx`                              | Container with rows + pagination + ErrorDisplay.                                                      |
|                                            | `search/SearchForm.tsx`                                                     | Search form.                                                                                          |
|                                            | `search/SearchResultsTable.tsx`                                             | StandardTable + data.                                                                                 |
|                                            | `admin/*` (all 10)                                                          | Tables, modals, stats, health, ingestion, logs—organisms.                                             |
|                                            | `dashboard/ImprovementDriverCard.tsx`                                       | Card organism.                                                                                        |
|                                            | `dashboard/DashboardClient.tsx`                                             | Grid of cards + ChartContainer.                                                                       |
|                                            | `dashboard/EventAnalysisSection.tsx`                                        | Tabs + event analysis content.                                                                        |
|                                            | `dashboard/DashboardEventSelector.tsx`                                      | Selector UI.                                                                                          |
| `dashboard/EventAnalysisHeaderWrapper.tsx` | Header wrapper.                                                             |
|                                            | `dashboard/shell/AdaptiveNavigationRail.tsx`                                | Nav rail.                                                                                             |
|                                            | `dashboard/shell/CommandPalette.tsx`                                        | Command palette.                                                                                      |
|                                            | `dashboard/shell/ContextRibbon.tsx`                                         | Ribbon.                                                                                               |
|                                            | `dashboard/shell/DashboardActionsPopover.tsx`                               | Popover.                                                                                              |
|                                            | `dashboard/shell/EventSearchModal.tsx`                                      | Modal wrapping EventSearchContainer.                                                                  |
|                                            | `dashboard/shell/TopStatusBar.tsx`                                          | Status bar.                                                                                           |
|                                            | `dashboard/shell/UserProfileModal.tsx`                                      | Modal + LogoutButton.                                                                                 |
|                                            | `track-maps/ShapeToolbar.tsx`                                               | Toolbar.                                                                                              |
|                                            | `track-maps/ShapePropertiesPanel.tsx`                                       | Properties panel.                                                                                     |
|                                            | `track-maps/ShareMapDialog.tsx`                                             | Dialog.                                                                                               |
|                                            | `track-maps/TrackMapCanvas.tsx`                                             | Canvas.                                                                                               |
|                                            | `track-maps/TrackMapEditor.tsx`                                             | Editor composing toolbar, canvas, panel, dialog.                                                      |
|                                            | `events/EventsPageClient.tsx`                                               | Page-level client with ChartContainer.                                                                |
|                                            | `users/DriverLinkCard.tsx`                                                  | Card.                                                                                                 |
|                                            | `users/DriverLinksView.tsx`                                                 | View of links.                                                                                        |
| **Templates**                              |                                                                             |                                                                                                       |
|                                            | `dashboard/DashboardLayout.tsx`                                             | Shell: rail + status bar + main slot.                                                                 |
| **Pages** (optional tier)                  |                                                                             |                                                                                                       |
|                                            | Keep in `app/` only                                                         | All route pages stay in `src/app/.../page.tsx`; no `components/pages/` unless team decides otherwise. |
| **Non-atomic (keep as-is or relocate)**    |                                                                             |                                                                                                       |
|                                            | `dashboard/EventActionsContext.tsx`                                         | Context only; can live under `dashboard/` or a shared context folder.                                 |
|                                            | `dashboard/DashboardEventSearchProvider.tsx`                                | Provider; same.                                                                                       |
|                                            | `dashboard/EventActionsProvider.tsx`                                        | Provider; same.                                                                                       |
|                                            | `store/ReduxProvider.tsx`                                                   | Provider; keep under store or root.                                                                   |
|                                            | `AdminNav.tsx`, `AuthenticatedNav.tsx`, `AuthenticatedNavLinks.tsx`         | Nav components; can be organisms or stay at root until phase 6.                                       |
|                                            | `ConditionalNav.tsx`                                                        | Composes navs; organism.                                                                              |
|                                            | `ErrorBoundary.tsx`, `GlobalErrorHandler.tsx`                               | Error UI; can be molecules or stay root.                                                              |
|                                            | `Footer.tsx`, `Hero.tsx`, `LogoutButton.tsx`, `NavBar.tsx`, `Providers.tsx` | Layout/global; can be atoms/molecules or stay root.                                                   |

**Shared/ErrorDisplay and duplicate/optional components:**

- **shared/ErrorDisplay.tsx:** Remove or consolidate with
  event-search/ErrorDisplay (molecule) and single import path after refactor.
- **ChartIcon:** Move to atoms; leave unused until needed or remove in cleanup.
- **PageContainer / ContentWrapper:** Either start using from molecules/layout
  or update docs to remove requirement.

---

## 4. Target Folder Structure (After Full Refactor)

```
src/components/
  atoms/
    Button.tsx
    ListRow.tsx
    LoadingState.tsx
    StandardButton.tsx
    StandardInput.tsx
    StatusBadge.tsx
    ChartIcon.tsx
    Breadcrumbs.tsx
  molecules/
    Modal.tsx
    Tooltip.tsx
    StandardTable.tsx
    EventStatusBadge.tsx
    ErrorDisplay.tsx
    ContentWrapper.tsx
    PageContainer.tsx
  organisms/
    event-analysis/     (or flat with prefix event-analysis-)
    event-search/
    practice-days/
    search/
    admin/
    dashboard/
    track-maps/
    events/
    users/
    layout/             (nav, footer, etc., if not in app)
  templates/
    DashboardLayout.tsx
  (optional) pages/
  (optional) providers/ or context/ for EventActionsContext, ReduxProvider, etc.
```

Naming convention for organisms can be either (a) keep subfolders like
`organisms/event-analysis/ChartContainer.tsx` so paths stay recognizable, or (b)
flat `organisms/ChartContainer.tsx` with naming conflict avoided by prefix (e.g.
event-analysis-ChartContainer). Plan assumes (a) unless team prefers (b).

---

## 5. Dependency Order and Constraints

- **Atoms:** No component imports; only React, Next, tokens, and libs (e.g.
  modal-styles for Modal is in molecules). So first move: all atoms.
- **Molecules:** May import only from `@/components/atoms/` (and in MRE today,
  Modal/Tooltip/StandardTable don’t import other components; EventStatusBadge
  and ErrorDisplay don’t use other @/components). So second move: molecules and
  update their imports to atoms where applicable.
- **Organisms:** Depend on ListPagination, ChartContainer, Modal, Tooltip,
  StandardTable, EventStatusBadge, ErrorDisplay, etc. After atoms and molecules
  are in place, move organisms and update imports to `@/components/atoms/...`
  and `@/components/molecules/...` and `@/components/organisms/...` (same tier
  only where acyclic).
- **Templates:** DashboardLayout composes shell organisms; move after those
  organisms are under `organisms/dashboard/` (or equivalent).
- **Providers/context:** Can move last to a dedicated folder and update imports
  in app layout.

**Critical:** Before each phase, run a full grep for the old path (e.g.
`@/components/ui/Modal`) and replace with the new path (e.g.
`@/components/molecules/Modal`). No mixed old/new paths in the same tier.

---

## 6. Phased Implementation

### Phase 0: Preparation (No File Moves)

1. **Document baseline:** Ensure this plan’s Section 1 is still accurate (re-run
   greps for `@/components/`, `PageContainer`, `ContentWrapper`, `ChartIcon`,
   `shared/ErrorDisplay`).
2. **Decide:** (a) Barrel files: add `atoms/index.ts`, `molecules/index.ts`,
   etc., or keep direct file imports. (b) Organism subfolders: keep
   `event-analysis/`, `event-search/`, etc. under `organisms/` or flatten with
   prefixes. (c) shared/ErrorDisplay: delete or merge into ErrorDisplay molecule
   and single path.
3. **Branch:** Create a dedicated branch for the refactor; all moves and import
   updates on that branch.
4. **CI:** Ensure `npm run build` and existing tests pass before starting.

### Phase 1: Atoms

1. Create `src/components/atoms/`.
2. Move (copy then delete after verification) each atom file:
   - `ui/Button.tsx` → `atoms/Button.tsx`
   - `ui/ListRow.tsx` → `atoms/ListRow.tsx`
   - `ui/LoadingState.tsx` → `atoms/LoadingState.tsx`
   - `ui/StandardButton.tsx` → `atoms/StandardButton.tsx`
   - `ui/StandardInput.tsx` → `atoms/StandardInput.tsx`
   - `ui/StatusBadge.tsx` → `atoms/StatusBadge.tsx`
   - `icons/ChartIcon.tsx` → `atoms/ChartIcon.tsx`
   - `Breadcrumbs.tsx` → `atoms/Breadcrumbs.tsx`
3. Update imports: no current file imports Button, ListRow, LoadingState,
   StandardButton, StandardInput, StatusBadge, or ChartIcon (verified).
   Breadcrumbs is imported by many app pages; update each to
   `@/components/atoms/Breadcrumbs`.
4. Delete old files only after grep confirms no remaining references to old
   paths.
5. Run build and tests.

### Phase 2: Molecules

1. Create `src/components/molecules/`.
2. Move:
   - `ui/Modal.tsx` → `molecules/Modal.tsx`
   - `ui/Tooltip.tsx` → `molecules/Tooltip.tsx`
   - `ui/StandardTable.tsx` → `molecules/StandardTable.tsx`
   - `event-search/EventStatusBadge.tsx` → `molecules/EventStatusBadge.tsx`
   - `event-search/ErrorDisplay.tsx` → `molecules/ErrorDisplay.tsx`
   - `layout/ContentWrapper.tsx` → `molecules/ContentWrapper.tsx`
   - `layout/PageContainer.tsx` → `molecules/PageContainer.tsx`
3. Update all imports that referenced the old paths (see Section 1.3 and 1.4).
   Replace:
   - `@/components/ui/Modal` → `@/components/molecules/Modal`
   - `@/components/ui/Tooltip` → `@/components/molecules/Tooltip`
   - `@/components/ui/StandardTable` → `@/components/molecules/StandardTable`
   - `../event-search/ErrorDisplay` and `./ErrorDisplay` (event-search) →
     `@/components/molecules/ErrorDisplay`
   - EventStatusBadge: update EventRow, EventTable, EventSearchContainer to
     `@/components/molecules/EventStatusBadge` (and fix any relative imports of
     TrackRow/Event types—see 6.4).
4. Type exports: EventStatusBadge and EventRow/EventTable/EventSearchContainer
   use types from EventStatusBadge and TrackRow. After move, export types from
   `molecules/EventStatusBadge` and ensure Track type is still importable (e.g.
   from organisms/event-search/TrackRow or a shared types file).
5. Run build and tests.

### Phase 3: Organisms (In Dependency Order)

1. Create `src/components/organisms/` and subfolders (e.g. `event-analysis/`,
   `event-search/`, `admin/`, `dashboard/`, etc.) per Section 4.
2. Move organisms in an order that respects dependencies:
   - First: organisms that do not import other organisms (e.g. ChartContainer,
     ListPagination, ChartPagination, ChartColorPicker, ChartSection,
     ChartDataNotice, ChartTypeSelector, ClassFilter, EventStats, TabNavigation,
     RaceSelector, DriverCard, DriverList, DriverSelectionHeader,
     CollapsibleDriverPanel, etc.).
   - Then: organisms that import only already-moved organisms (e.g.
     ChartControls, ClassDetailsModal, EntryList, EventAnalysisSidebar,
     UnifiedPerformanceChart, SessionsTable, etc.).
   - Update every import from `@/components/event-analysis/...` to
     `@/components/organisms/event-analysis/...`, and similarly for
     event-search, admin, dashboard, practice-days, search, track-maps, events,
     users.
3. Cross-organism imports: e.g. EventSearchContainer uses ListPagination from
   event-analysis and PracticeDaySearchContainer from practice-days. After
   moves, these become `@/components/organisms/event-analysis/ListPagination`
   and `@/components/organisms/practice-days/PracticeDaySearchContainer`. Ensure
   no cycles (event-search → practice-days → event-search is OK if only
   data/types).
4. Types: Track (from TrackRow), Event (from EventRow), EventStatus (from
   EventStatusBadge) are used across event-search and practice-days. Decide: (a)
   re-export from organisms/event-search (e.g. TrackRow.tsx exports type Track),
   or (b) add `src/components/organisms/event-search/types.ts` (or shared types)
   and import from there. Document decision in plan update.
5. Run build and tests after each batch of organism moves.

### Phase 4: Templates

1. Create `src/components/templates/`.
2. Move `dashboard/DashboardLayout.tsx` → `templates/DashboardLayout.tsx`.
3. Update `src/app/(authenticated)/layout.tsx` to import from
   `@/components/templates/DashboardLayout`.
4. DashboardLayout imports AdaptiveNavigationRail, TopStatusBar, CommandPalette;
   these must already live under organisms (e.g. `organisms/dashboard/shell/`).
   Update DashboardLayout’s imports to
   `@/components/organisms/dashboard/shell/...`.
5. Run build and tests.

### Phase 5: Pages (Optional)

- If team wants a `components/pages/` tier: identify which app pages are thin
  wrappers and move the “client” component to `components/pages/` and have
  `app/.../page.tsx` import from there. Current codebase mostly uses components
  directly in page.tsx; this phase can be skipped and “pages” defined as app
  route components only.

### Phase 6: Cleanup and Documentation

1. **Remove dead code:** Delete `shared/ErrorDisplay.tsx` (or merge into
   molecules/ErrorDisplay and delete). Remove empty directories (layout/,
   icons/, ui/ after moves).
2. **Providers/context:** Move EventActionsContext, EventActionsProvider,
   DashboardEventSearchProvider, ReduxProvider to a folder like
   `components/providers/` or leave under dashboard/store and update layout
   imports if paths change.
3. **Root components:** AdminNav, AuthenticatedNav, Breadcrumbs (moved),
   ConditionalNav, ErrorBoundary, Footer, GlobalErrorHandler, Hero,
   LogoutButton, NavBar, Providers—either move to organisms/layout or keep at
   root and document as “global” components. If moved, update all app imports.
4. **Documentation updates:**
   - `docs/standards/typescript-react-style-guide.md`: Add “Atomic design”
     subsection under File Organization; list atoms, molecules, organisms,
     templates; state dependency rule.
   - `docs/architecture/mobile-safe-architecture-guidelines.md`: Update
     “Reusable UI Components” to point to `@/components/atoms/`,
     `@/components/molecules/` (Modal, ListRow, etc.), and
     PageContainer/ContentWrapper to `@/components/molecules/` if adopted.
   - `docs/development/FLEXBOX_LAYOUT_CHECKLIST.md`: Update paths for Modal,
     ListRow, PageContainer, ContentWrapper to new locations.
   - `docs/design/table-component-specification.md`: Update StandardTable path
     to molecules.
   - Create (optional) `docs/architecture/atomic-design-system.md`: Tier
     definitions, folder map, import rules, and link to this implementation
     plan.
5. **Lint/format:** Run project linter and formatter on changed files.

---

## 7. File Move and Import Update Procedure

- **One component at a time (or small batch):** Move file(s), then run grep for
  the old path (e.g. `@/components/ui/Modal` and
  `from \"@/components/ui/Modal\"` and `from '@/components/ui/Modal'`). Replace
  with new path. Then build.
- **Relative imports within same tier:** When moving e.g.
  event-analysis/sessions/SessionsTableRow.tsx to
  organisms/event-analysis/sessions/SessionsTableRow.tsx, update relative
  imports (e.g. `./SessionsTableResults`) to remain relative within the same
  folder; no change needed. Cross-folder relatives (e.g. from sessions/ to
  ../ChartContainer) become
  `@/components/organisms/event-analysis/ChartContainer` or keep relative
  `../ChartContainer` within organisms/event-analysis.
- **Barrel files:** If Phase 0 decides to add barrels, add them after moves and
  then optionally switch imports to barrel (e.g. `@/components/atoms`). Not
  required for correctness.

---

## 8. Verification and Testing

- After each phase: `npm run build` (or project build command) must succeed. Run
  from Docker if that’s the project standard:
  `docker exec -it mre-app npm run build`.
- Run existing tests: `docker exec -it mre-app npm test` (or equivalent).
- Manual smoke: Open dashboard, event search, admin tables, practice days,
  search, track maps; confirm no broken imports or missing components.
- Grep for obsolete paths: `grep -r "@/components/ui/" src` (and same for
  event-analysis, event-search, etc.) should return no results after Phase 2/3.

### 8.1 Validation Gates (Prevent Breakage)

Run these checks so the breakage scenarios in Section 9 are caught before merge.

**1. Missed imports (old paths still in use)**

- **When:** Before deleting old files in any phase; again after Phase 2 and
  Phase 3.
- **Check:** For each path being retired, grep the repo and fix or remove any
  remaining references. Do not delete a file until its path returns no matches.
- **Commands (examples; adjust paths to what was moved in that phase):**
  - After Phase 1: `grep -r "@/components/ui/Button" src` (and ListRow,
    LoadingState, StandardButton, StandardInput, StatusBadge),
    `grep -r "@/components/icons/ChartIcon" src`,
    `grep -r "@/components/Breadcrumbs" src` → expect no matches (or only the
    new `@/components/atoms/...` imports).
  - After Phase 2: `grep -r "@/components/ui/" src` → no results.
    `grep -r "from ['\"]\\.\\./event-search/ErrorDisplay" src` and
    `"from ['\"]\\./ErrorDisplay"` → no results.
  - After Phase 3: `grep -r "@/components/event-analysis/" src` and
    `@/components/event-search/` (etc.) → no results except any intentional
    re-exports.
- **Pass criteria:** Zero matches for old paths in `src/` (and in
  `docs/`/`scripts/` if included in step 3 below). Build and tests pass (Section
  8).

**2. Type re-exports (types still importable)**

- **When:** After Phase 2 (EventStatusBadge, ErrorDisplay moves); after Phase 3
  (Track, Event, EventStatus and any other shared types).
- **Check:** TypeScript must resolve all type imports; no type-only breakage.
- **Commands:**
  - `npm run build` (or `tsc --noEmit` if available) must succeed.
  - Grep for type imports that previously pointed at moved files and confirm
    they now point at the new location: e.g.
    `grep -r "import type.*EventStatus\|import.*EventStatus.*from" src` → all
    from `@/components/molecules/EventStatusBadge` (or chosen canonical path).
    Same for `Track`, `Event` (from EventRow/TrackRow).
- **Pass criteria:** Build succeeds with no type errors; every consumer of
  `EventStatus`, `Track`, `Event` imports from the agreed new path (document in
  plan if needed).

**3. References outside the updated set (docs, scripts, other)**

- **When:** After Phase 6 (or before closing the refactor).
- **Check:** Docs and scripts may reference old component paths; update or note
  them.
- **Commands:**
  - `grep -r "@/components/ui/" docs/ scripts/` (and
    `@/components/event-analysis/`, `@/components/event-search/`, etc.) → list
    matches. Update Section 10 docs; update any scripts or other docs that
    reference old paths.
  - If the repo is consumed by other repos or tooling, document the path changes
    there or add a short migration note.
- **Pass criteria:** All references in `docs/` and `scripts/` either updated to
  new paths or explicitly documented as out of scope. Section 10 checklist
  completed.

**4. Partial rollout (no mixed old/new paths mid-refactor)**

- **When:** Before considering each phase complete and before starting the next
  phase.
- **Check:** Do not merge or ship a partially completed refactor; avoid leaving
  the codebase with a mix of old and new paths for the same tier.
- **Gate:** Phase N is complete only when: (a) all moves and import updates for
  that phase are done, (b) grep for old paths (item 1) returns no matches for
  that phase’s paths, (c) build and tests pass, (d) type checks pass (item 2)
  where applicable. Do not start Phase N+1 until Phase N passes this gate.
- **Pass criteria:** No phase is marked complete until the above gate passes. If
  the refactor is paused, document “stopped after Phase X” and that old paths
  for Phase X+1 and beyond are still in use (no mixed state for the same
  component).

---

## 9. Risks and Rollback

- **Risk:** Large number of import path changes; one missed reference breaks
  build. **Mitigation:** Run the checks in Section 8.1 (item 1: grep old paths;
  pass criteria: zero matches before deleting files). Automate replace with a
  script if desired (script must be reviewed so it doesn’t replace inside
  strings/comments incorrectly).
- **Risk:** Type re-exports missed; TypeScript or runtime breaks.
  **Mitigation:** Section 8.1 item 2 (build/tsc + verify type-import paths after
  Phase 2 and 3).
- **Risk:** References in docs or scripts still point at old paths.
  **Mitigation:** Section 8.1 item 3 (grep docs/ and scripts/; update Section 10
  checklist and any other references).
- **Risk:** Partial rollout leaves mixed old/new paths and broken builds.
  **Mitigation:** Section 8.1 item 4 (phase completion gate: do not start Phase
  N+1 until Phase N passes all checks).
- **Risk:** Circular dependency if an organism imports another organism that
  eventually imports the first. **Mitigation:** Dependency order in Phase 3; if
  a cycle appears, extract a shared molecule or atom.
- **Rollback:** Revert the refactor branch; no database or API changes, so
  rollback is branch revert only.

---

## 10. Documentation Updates Checklist

- [x] `docs/standards/typescript-react-style-guide.md` – Atomic design
      subsection and paths.
- [x] `docs/architecture/mobile-safe-architecture-guidelines.md` – Reusable
      component paths (atoms/molecules).
- [x] `docs/development/FLEXBOX_LAYOUT_CHECKLIST.md` – Modal, ListRow,
      PageContainer, ContentWrapper paths.
- [x] `docs/design/table-component-specification.md` – StandardTable path.
- [x] `docs/architecture/atomic-design-system.md` – New doc describing tiers and
      rules.
- [ ] This plan: Update Section 1 if codebase drifts before implementation;
      leave “Verified from code” and date.

- [x] `docs/development/mobile-ui-removal-summary.md` – PageContainer,
      ContentWrapper atomic paths.

> **Reviewer comment (2026-01-31 / Codex):**
> `docs/development/mobile-ui-removal-summary.md` still references
> `PageContainer.tsx` and `ContentWrapper.tsx` (see lines 52-61) and will need
> the updated atomic paths as well—please add it to this checklist to avoid
> stale guidance. _(Completed)_

---

## 11. Summary

This plan refactors the existing MRE component tree into a full atomic design
system (atoms, molecules, organisms, templates) without changing behavior or the
existing token/modal/layout design. All current-state facts (paths, imports,
used vs unused components) are verified from the codebase. Implementation
proceeds in phases (atoms → molecules → organisms → templates → cleanup/docs)
with strict dependency order and full import path updates, and concludes with
documentation updates and optional removal of dead code (shared/ErrorDisplay,
unused ChartIcon/ui primitives).
