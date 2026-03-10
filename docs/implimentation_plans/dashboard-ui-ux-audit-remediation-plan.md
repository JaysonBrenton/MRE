# Dashboard UI/UX Audit Remediation Plan

**Created:** 2026-03-10  
**Source:** [docs/reviews/dashboard-ui-ux-audit-2026-03-10.md](../reviews/dashboard-ui-ux-audit-2026-03-10.md)  
**Status:**
In Progress (Phases 2 and 4 complete)

## Overview

This document outlines the implementation plan to address all recommendations
and suggestions from the Dashboard UI/UX Audit Report. Tasks are organized by
priority and grouped into phases for phased delivery.

**Scope:** Main dashboard (`/dashboard` – event selector + Event Analysis) and
all dashboard/event-analysis organisms.

## Priority Levels

- **P0 – Critical:** Design system violations, spec non-compliance (tables,
  buttons)
- **P1 – High:** Consistency impact (typography, colors, tokens)
- **P2 – Medium:** Accessibility, polish, documentation
- **P3 – Low:** Nice-to-have, future enhancements

---

## Phase 1: Critical Fixes (P0)

### 1.1 Migrate Tables to StandardTable

**Source:** Section 4.3  
**Priority:** P0 – Critical

**Issue:** Table component spec requires `@/components/molecules/StandardTable`.
Only RaceSelector complies. Six tables use custom markup with inconsistent
styling.

**Affected Components:**

- `src/components/organisms/event-analysis/CombinedDriversTable.tsx`
- `src/components/organisms/event-analysis/sessions/SessionsTable.tsx`
- `src/components/organisms/event-analysis/EntryList.tsx`
- `src/components/organisms/event-analysis/TrackLeaderboardTab.tsx`
- `src/components/organisms/event-analysis/PracticeClassLeaderboard.tsx`
- `src/components/organisms/event-analysis/MyEventsContent.tsx`

**Implementation Steps:**

1. Audit StandardTable API: `StandardTable`, `StandardTableHeader`,
   `StandardTableRow`, `StandardTableCell` (see
   `src/components/molecules/StandardTable.tsx`)
2. Migrate **CombinedDriversTable** – replace custom `<table>` with
   StandardTable components; preserve column structure, sorting, row actions
3. Migrate **SessionsTable** – replace custom table; handle expandable rows
   (SessionsTableRow with nested content) – may need extended pattern
4. Migrate **EntryList** – replace custom table
5. Migrate **TrackLeaderboardTab** – replace custom table
6. Migrate **PracticeClassLeaderboard** – replace custom table
7. Migrate **MyEventsContent** – replace custom table (event list)
8. **LapDataTable:** Document extended pattern for nested tables; either extend
   StandardTable to support nested rows or create `StandardNestedTable` variant.
   Implement migration.
9. Add `--token-surface-alt` to `src/app/globals.css` if SessionsTable depends
   on it, or replace with `--token-surface-elevated`
10. Document table patterns (expandable rows, nested tables) in
    `docs/design/table-component-specification.md`

**Acceptance Criteria:**

- All dashboard tables use StandardTable (or documented extended variant)
- Consistent header/cell padding, borders, hover states
- No visual regression; existing functionality preserved
- LapDataTable nested structure documented and implemented

**Estimated Effort:** 16–24 hours

---

### 1.2 Button Consistency – Use StandardButton/Button Everywhere

**Source:** Section 3.3  
**Priority:** P0 – Critical

**Issue:** Majority of buttons are raw `<button>` with ad-hoc classes. UX
principles mandate outlined/secondary style. Empty-state and retry CTAs use
accent fill.

**Affected Files:**

- `src/components/organisms/dashboard/DashboardClient.tsx` (empty state CTA)
- `src/components/organisms/dashboard/EventAnalysisSection.tsx` (retry button)
- EventActionsProvider, ChartControls, EventAnalysisSidebar,
  DriverCardsAndWeatherGrid, ContextRibbon, TopStatusBar, EventSearchModal,
  DashboardActionsPopover, AdaptiveNavigationRail, OverviewTab, ChartDataNotice,
  etc. (raw buttons)

**Implementation Steps:**

1. **Decision:** Align empty-state and retry CTAs with outlined style **or**
   document single primary CTA exception in `docs/design/mre-ux-principles.md`.
   If exception: keep empty-state CTA as primary; convert retry to outlined.
2. Replace empty-state CTA in DashboardClient with `StandardButton` or `Button`
   (default variant). If keeping primary: use `Button variant="primary"` and
   document exception.
3. Replace retry button in EventAnalysisSection with `StandardButton`
4. Audit all raw `<button>` in dashboard + event-analysis; replace with
   `StandardButton` or `Button` where applicable. For icon-only and menu-item
   buttons: either use Button with icon prop or extract `IconButton` /
   `MenuItemButton` molecule.
5. Deprecate or remove `Button` primary/error variants: Update `Button.tsx` –
   either remove variants and update CorrectVenueModal to use outlined style, or
   add JSDoc `@deprecated` and ensure no new usage. Align with UX principles.
6. Extract common patterns: Create `IconButton` atom for icon-only buttons;
   document menu-item button pattern if needed.

**Acceptance Criteria:**

- All action buttons use `StandardButton` or `Button`
- Empty-state and retry CTAs aligned (outlined or documented primary exception)
- No new usage of deprecated Button variants
- Icon/menu buttons use shared component or documented pattern

**Estimated Effort:** 12–16 hours

---

## Phase 2: High Priority – Typography and Color Tokens (P1) ✅ COMPLETE

### 2.1 Typography – Import and Use typography.ts ✅

**Source:** Section 2.4  
**Priority:** P1 – High

**Issue:** Zero components import `typography` from `@/lib/typography`. All use
inline Tailwind classes with inconsistent hierarchy.

**Affected Components:**

- DashboardClient, EventAnalysisSection, EventAnalysisHeader, EventSearchModal,
  UserProfileModal, AdaptiveNavigationRail, EventActionsProvider,
  ImprovementDriverCard, DriverCardsAndWeatherGrid, TopStatusBar,
  DashboardActionsPopover
- Event-analysis: ChartControls, LapDataTable, DriverCard,
  ClassMostImprovedCard, LinkYourDriverPrompt, sessions/\*, etc.

**Implementation Steps:**

1. Add `kpi` or `display` variant to `src/lib/typography.ts` for large metric
   numbers (e.g. `text-3xl font-bold`); otherwise map to h2/h3
2. Audit `text-[10px]` and `text-[11px]` – map to `typography.uppercase` or
   `typography.caption` where appropriate
3. Migrate components in batches:
   - **Batch 1:** DashboardClient, EventAnalysisSection, EventAnalysisHeader
   - **Batch 2:** Shell components (UserProfileModal, EventSearchModal,
     AdaptiveNavigationRail, TopStatusBar, DashboardActionsPopover,
     ContextRibbon)
   - **Batch 3:** Event-analysis cards and headers (ChartControls,
     EventActionsProvider, ImprovementDriverCard, DriverCardsAndWeatherGrid)
   - **Batch 4:** Tables, charts, remaining organisms
4. Replace inline classes: `text-2xl font-bold` → `typography.h2`,
   `text-sm text-[var(--token-text-secondary)]` → `typography.bodySecondary`,
   etc.
5. Standardise heading weights to `font-semibold` per guidelines (replace
   `font-bold` with `font-semibold` where headings)

**Acceptance Criteria:**

- All dashboard/event-analysis components import and use `typography` for
  headings, body, labels, caption
- Consistent h1–h6, body, bodySecondary, bodyMuted, label, caption usage
- No arbitrary `text-[10px]` / `text-[11px]` unless documented
- KPI/display variant added if needed

**Estimated Effort:** 8–12 hours

---

### 2.2 Replace Hardcoded Colors with Semantic Tokens ✅

**Source:** Sections 5.4, 6.3, 7.3, 9.3  
**Priority:** P1 – High

**Issue:** ChartContainer uses `#ffffff`; LapByLapTrendChart uses hex palette;
error states use `text-red-500`; UserProfileModal/ChartControls use
`bg-yellow-500/20` for badges.

**Affected Files:**

- `src/components/organisms/event-analysis/ChartContainer.tsx`
- `src/components/organisms/event-analysis/LapByLapTrendChart.tsx`
- `src/components/organisms/dashboard/shell/UserProfileModal.tsx`
- `src/components/organisms/event-analysis/ChartControls.tsx`
- `src/components/organisms/event-analysis/ComparisonTest.tsx`
- `src/components/organisms/event-analysis/MyLapsContent.tsx`
- `src/components/organisms/event-analysis/EventAnalysisSidebar.tsx`
- `src/components/organisms/event-analysis/MyEventsContent.tsx`
- `src/components/ErrorBoundary.tsx`
- Other files using `text-red-*`, `bg-yellow-*`

**Implementation Steps:**

1. **ChartContainer:** Replace `DEFAULT_AXIS_COLOR = "#ffffff"` with
   `var(--token-text-primary)` or `var(--token-text-secondary)`
2. **globals.css:** Add chart series palette: `--token-chart-series-1` through
   `--token-chart-series-12` (map from LapByLapTrendChart DRIVER_COLORS)
3. **LapByLapTrendChart:** Replace DRIVER_COLORS hex array with
   `var(--token-chart-series-N)`; replace SESSION_BAND_DEFAULT_HEX with tokens;
   replace `stroke="#ffffff"` with token
4. **Error states:** Replace all `text-red-500`, `text-red-600`,
   `dark:text-red-400` with `text-[var(--token-status-error-text)]`
5. **Yellow badges:** Add `--token-status-warning-text`,
   `--token-status-warning-bg` to globals.css if design supports; replace
   `bg-yellow-500/20 text-yellow-600` with tokens. Otherwise document yellow as
   one-off for rank/suggested in design docs.
6. **UserProfileModal getStatusBadgeColor:** Use status tokens for
   success/error/warning; align yellow with token or document
7. Grep for remaining `text-red-`, `bg-yellow-`, `text-yellow-` in dashboard
   scope; replace or document

**Acceptance Criteria:**

- ChartContainer uses tokens for axis colour
- LapByLapTrendChart uses `--token-chart-series-*` or equivalent
- All error text uses `--token-status-error-text`
- Yellow/warning badges use tokens or are documented
- No hardcoded hex for semantic colours in scope

**Estimated Effort:** 6–8 hours

---

## Phase 3: Accessibility and Loading/Error States (P2)

### 3.1 Accessibility – Error Announcements and Keyboard Support

**Source:** Section 6.3  
**Priority:** P2 – Medium

**Issue:** Error/loading messages lack `role="alert"` or `aria-live`. Clickable
rows/cards may lack keyboard support.

**Note:** The audit referenced DriverCardsAndWeatherGrid carousel auto-scrolling
every 5s without `prefers-reduced-motion` check. **DriverCardsAndWeatherGrid is
not used in the current dashboard** – it is not imported by OverviewTab,
EventAnalysisSection, or any page. The Overview tab uses WeatherCard,
ClassTopFastestLapsCard, MainPodiumCard, ChartSection, etc., instead. The
carousel is effectively dead code. If DriverCardsAndWeatherGrid is re-enabled in
future, it already implements `prefers-reduced-motion` (see lines 779–792, 821).

**Affected Files:**

- DashboardClient, EventAnalysisSection, UserProfileModal (error states)
- ChartContainer (loading/error states)
- SessionsTableRow, DriverCard, and other clickable rows/cards

**Implementation Steps:**

1. Add `role="alert"` or `aria-live="polite"` to error message containers
   (DashboardClient error, EventAnalysisSection error, UserProfileModal error)
2. Add `aria-live="polite"` to loading states that replace content (optional,
   for screen readers)
3. Audit clickable table rows/cards (SessionsTableRow, DriverCard, etc.) for
   keyboard support: add `role="button"`, `tabIndex={0}`, `onKeyDown`
   (Enter/Space) where onClick exists
4. Verify EventSearchModal focus trap and focus return on close
5. Verify tab min-height 44px for touch targets (TabNavigation, shell nav items)

**Acceptance Criteria:**

- Error messages announced to screen readers
- Clickable rows/cards keyboard-activatable
- Modal focus behaviour correct
- Touch targets meet 44px where feasible

**Estimated Effort:** 6–8 hours

---

### 3.2 Loading and Error State Consistency

**Source:** Section 7.3  
**Priority:** P2 – Medium

**Issue:** Error styling inconsistent (tokens vs `text-red-500`).
UserProfileModal lacks retry. No shared EmptyState/ErrorState molecule.

**Implementation Steps:**

1. Standardise error text colour to `--token-status-error-text` everywhere
   (overlap with 2.2; ensure complete)
2. Add Retry or "Try again" button to UserProfileModal when profile fetch fails
3. Consider creating `ErrorState` molecule:
   `src/components/molecules/ErrorState.tsx` – message, optional retry button,
   consistent styling. Use in EventAnalysisSection, UserProfileModal,
   ChartContainer.
4. Consider `EmptyState` molecule for "No data" patterns if reusable

**Acceptance Criteria:**

- All error states use token colour
- UserProfileModal has retry on error
- Shared ErrorState molecule used where appropriate

**Estimated Effort:** 4–6 hours

---

## Phase 4: Forms, Spacing, Navigation, IA (P2) ✅ COMPLETE

### 4.1 Form Field Width and StandardInput ✅

**Source:** Section 11.3  
**Priority:** P2 – Medium

**Issue:** ChartControls and EventActionsProvider driver search/filter fields
don't use `w-[9rem] min-w-[9rem]`. StandardInput not used for text inputs.

**Affected Files:**

- `src/components/organisms/event-analysis/ChartControls.tsx`
- `src/components/organisms/dashboard/EventActionsProvider.tsx`

**Implementation Steps:**

1. Apply `w-[9rem] min-w-[9rem]` to driver search and filter dropdowns in
   ChartControls
2. Apply same to EventActionsProvider driver modal search/filter
3. Audit text inputs in scope; use `StandardInput` where applicable
4. Document dropdown/combobox patterns in `docs/design/` (new or existing form
   guidelines)

**Acceptance Criteria:**

- Lookup/filter fields use `w-[9rem] min-w-[9rem]` per spec
- Text inputs use StandardInput where possible
- Dropdown pattern documented

**Estimated Effort:** 2–4 hours

---

### 4.2 Spacing and Density Token Usage ✅

**Source:** Section 8.3  
**Priority:** P2 – Medium

**Issue:** `--dashboard-gap` and `--token-spacing-*` rarely used; many arbitrary
values (`gap-6`, `space-y-6`). Density modes unclear.

**Implementation Steps:**

1. Audit which components read `data-density` or `--dashboard-gap`; list in doc
2. Replace common `gap-6`, `space-y-6` with `gap-[var(--dashboard-gap)]` in
   dashboard layout and card sections
3. Replace `px-5 py-5`-style padding with `--dashboard-card-padding` where
   appropriate
4. Document density behaviour: which components respond to
   compact/comfortable/spacious; verify visible changes
5. Add to `docs/design/mre-dark-theme-guidelines.md` or new spacing doc

**Acceptance Criteria:**

- Dashboard sections use `--dashboard-gap` for vertical rhythm
- Card padding uses token where applicable
- Density behaviour documented and verified

**Estimated Effort:** 4–6 hours

---

### 4.3 Navigation – Breadcrumbs and Event Context ✅

**Source:** Sections 12.3, 13.4, 1.6  
**Priority:** P2 – Medium

**Issue:** No breadcrumbs on dashboard. ContextRibbon doesn't show current event
name. URL doesn't retain eventId for deep linking.

**Affected Files:**

- `src/components/organisms/dashboard/shell/ContextRibbon.tsx`
- `src/components/organisms/dashboard/shell/TopStatusBar.tsx`
- `src/components/organisms/dashboard/DashboardEventSelector.tsx`
- Dashboard page, layout

**Implementation Steps:**

1. **Event context in shell:** When event is selected, display event name (and
   optionally track/date) in ContextRibbon or TopStatusBar. ContextRibbon button
   could show "Event: {name}" instead of generic "Select or change event" when
   event is selected.
2. **URL deep linking (documented):** Current product behaviour: the dashboard
   accepts `?eventId=` on load (e.g. `/dashboard?eventId=xxx`).
   `DashboardEventSelector` reads it, selects the event in Redux, then removes
   the query param to keep the URL clean. Deep links work for initial load only;
   the URL does not retain `eventId` while viewing. To retain `eventId` in the
   URL or use `/dashboard/[eventId]`, a separate product decision and
   implementation would be required.
3. **Breadcrumbs:** Added `Breadcrumbs` to dashboard page: "Dashboard" (link) >
   "Event Analysis" (current). See `docs/design/navigation-patterns.md` and
   `@/components/atoms/Breadcrumbs`.

**Acceptance Criteria:**

- Current event name visible in shell when selected
- Breadcrumb present on dashboard page
- URL behaviour documented (and implemented if chosen)

**Estimated Effort:** 4–6 hours

---

## Phase 5: Icon Consistency and Microcopy (P2–P3)

### 5.1 Icon Migration to lucide-react

**Source:** Section 10.3  
**Priority:** P2 – Medium

**Issue:** Few components use lucide-react; many use inline SVG. Sizing varies.

**Implementation Steps:**

1. Audit inline SVGs in dashboard and event-analysis (EventAnalysisHeader,
   ContextRibbon, buttons, etc.)
2. For each inline SVG, find equivalent lucide-react icon; replace
3. Standardise icon sizes: `w-4 h-4` for inline/small, `w-5 h-5` for buttons
4. Document icon mapping in `docs/architecture/atomic-design-system.md`: delete
   → Trash2, external → ExternalLink, etc.

**Acceptance Criteria:**

- Inline SVGs migrated to lucide-react where suitable
- Consistent icon sizing
- Icon mapping documented

**Estimated Effort:** 6–8 hours

---

### 5.2 Microcopy and Modal Audit

**Source:** Section 14.3  
**Priority:** P3 – Low

**Issue:** "Retry" could be "Retry loading". Modals may have "OK" or "Submit".
Error messages should be field-level.

**Implementation Steps:**

1. Change "Retry" to "Retry loading" in EventAnalysisSection
2. Audit CorrectVenueModal and other modals for "OK", "Submit", "Continue";
   replace with explicit labels
3. Ensure error messages are field-level where applicable; avoid generic
   "Something went wrong" in user-facing paths

**Acceptance Criteria:**

- Retry button says "Retry loading"
- Modal buttons use explicit labels
- Errors are field-level where possible

**Estimated Effort:** 2–3 hours

---

## Phase 6: Design System Documentation and Optional Enhancements (P3)

### 6.1 Blank Main Surface (Optional Hero/KPI Strip)

**Source:** Section 1.6  
**Priority:** P3 – Low

**Issue:** When event selected, DashboardClient returns null; no at-a-glance
hero/KPI strip above EventAnalysisSection.

**Note:** This was a known gap from Jan 2026 review. Implementing requires
product decision: add compact summary strip using eventData (from summary API)
when event is selected, before tab content.

**Implementation Steps (if approved):**

1. When `eventData` is present, DashboardClient renders compact strip: event
   name, date, track, summary stats (races, drivers, laps from
   eventData.summary)
2. Reuse or share weather if available; avoid duplicate fetch
3. Ensure strip appears above EventAnalysisSection; does not duplicate Overview
   tab content

**Acceptance Criteria:**

- At-a-glance strip visible when event selected
- Uses summary data; no blocking additional fetch
- Clean visual hierarchy

**Estimated Effort:** 6–8 hours

---

### 6.2 Collapsible Sections (Long Tab Content)

**Source:** Section 13.4  
**Priority:** P3 – Low

**Issue:** Long tab content could benefit from collapsible sections to reduce
scroll.

**Implementation Steps:**

1. Identify tabs with long content (Overview, Sessions, Drivers)
2. Add collapsible section pattern (accordion or expand/collapse) for logical
   groupings
3. Ensure pattern follows UX principles (no accordions if prohibited – check
   mre-ux-principles.md Section 9). Note: Section 9 says "Accordions" in "What
   Not To Do" – skip if still prohibited.
4. If accordions prohibited, consider "Show more" / pagination instead

**Acceptance Criteria:**

- Long content manageable without excessive scroll
- Pattern aligns with UX principles

**Estimated Effort:** 4–6 hours (or skip if accordions prohibited)

---

### 6.3 Update Design Documentation

**Implementation Steps:**

1. Update `docs/design/mre-ux-principles.md`: Document primary CTA exception if
   empty-state keeps accent style; clarify Button variant deprecation
2. Update `docs/design/table-component-specification.md`: Document nested table
   pattern, LapDataTable approach
3. Update `docs/architecture/atomic-design-system.md`: Icon mapping, any new
   components (IconButton, ErrorState)
4. Update `docs/design/mre-dark-theme-guidelines.md`: Chart series tokens,
   spacing/density section
5. Add `docs/design/form-patterns.md` or similar for dropdown/combobox if
   created

**Estimated Effort:** 2–3 hours

---

## Summary: Task Checklist

| Phase | Task                                          | Priority | Est. Hours |
| ----- | --------------------------------------------- | -------- | ---------- |
| 1.1   | Migrate tables to StandardTable               | P0       | 16–24      |
| 1.2   | Button consistency (StandardButton/Button)    | P0       | 12–16      |
| 2.1   | Typography – use typography.ts                | P1       | 8–12       |
| 2.2   | Replace hardcoded colors with tokens          | P1       | 6–8        |
| 3.1   | Accessibility (ARIA, keyboard, touch targets) | P2       | 6–8        |
| 3.2   | Loading/error state consistency               | P2       | 4–6        |
| 4.1   | Form field width and StandardInput            | P2       | 2–4        |
| 4.2   | Spacing and density tokens                    | P2       | 4–6        |
| 4.3   | Navigation (event context, breadcrumbs, URL)  | P2       | 4–6        |
| 5.1   | Icon migration to lucide-react                | P2       | 6–8        |
| 5.2   | Microcopy and modal audit                     | P3       | 2–3        |
| 6.1   | Blank main surface (optional)                 | P3       | 6–8        |
| 6.2   | Collapsible sections (optional)               | P3       | 4–6        |
| 6.3   | Update design documentation                   | P3       | 2–3        |

**Total estimated effort:** ~78–108 hours (depending on optional items and scope
creep)

---

## Dependencies and Ordering

- **Phase 1** (tables, buttons) can run in parallel or sequence
- **Phase 2** (typography, colors) can run in parallel; color tokens (2.2)
  should complete before 3.2
- **Phase 3** depends on 2.2 for error token consistency
- **Phase 4** can run after Phase 1–2
- **Phase 5** (icons, microcopy) can run anytime
- **Phase 6** (optional) last

## Reference

- **Audit report:**
  [docs/reviews/dashboard-ui-ux-audit-2026-03-10.md](../reviews/dashboard-ui-ux-audit-2026-03-10.md)
- **Design docs:** docs/design/, docs/architecture/atomic-design-system.md
