---
date: 2026-01-12
reviewer: Codex (GPT-5)
scope:
  Full documentation set (README, docs/*, operations, ADRs, user guides,
  standards)
---

## Review Method

- Indexed the entire `docs/` tree plus the root `README.md` and
  `docs/index/document-index.md` to ensure every document was considered.
- Cross-checked user-facing claims (user guides, specs, README scope statements)
  against the current Next.js app (pages under `src/app`, components in
  `src/components`, Redux slices, middleware) and supporting services (Prisma
  schema, ingestion service entry points).
- Verified navigation/feature availability by reading the actual route files and
  components wired into the authenticated shell
  (`src/components/dashboard/shell/*`).
- Looked for supporting implementation by searching the codebase (e.g.,
  confirming that no components implement stated keyboard shortcuts or export
  actions).

## Key Findings

1. **Dashboard + README promises vs. actual implementation**
   - Documentation (`README.md:85-115`,
     `docs/specs/mre-v0.1-feature-scope.md:244-310`,
     `docs/user-guides/dashboard.md:91-189`) claims customizable dashboards,
     team/track dashboards, telemetry workspaces, drag-and-drop/resizable
     widgets, and quick actions.
   - The dashboard implementation renders only an empty state plus a modal
     trigger (`src/components/dashboard/DashboardClient.tsx:208-265`);
     `DashboardHero` literally returns `null`
     (`src/components/dashboard/DashboardClient.tsx:314-330`).
   - All of the documented sub-pages for telemetry, engineer, data sources, and
     even nav entries (“My Team”, “My Club”) immediately redirect to
     `/under-development`
     (`src/app/(authenticated)/dashboard/my-telemetry/page.tsx:1-14`,
     `.../my-engineer/page.tsx:1-14`, `.../data-sources/page.tsx:1-14`,
     `src/components/dashboard/shell/AdaptiveNavigationRail.tsx:168-220`).  
     **Impact:** Users reading the docs will expect rich widgets, drag/drop
     layout controls, telemetry views, and team dashboards that simply do not
     exist yet.  
     **Fix:** Either implement the described functionality or significantly
     rewrite the README, feature spec, and dashboard guide to reflect the
     current minimal dashboard (empty state + event search modal) and clearly
     flag “My Telemetry/My Engineer/My Team/My Club” as future work.

2. **Event Search guide describes a retired flow**
   - `docs/user-guides/event-search.md:27-170` walks users through a dedicated
     Event Search page with a track selection modal, favourite chips, import
     status badges, and bulk LiveRC imports accessible from the main nav.
   - The route `/event-search` now just redirects to `/search`
     (`src/app/(authenticated)/event-search/page.tsx:1-18`), and the navigation
     rail points to the new unified `/search` page
     (`src/components/dashboard/shell/AdaptiveNavigationRail.tsx:58-92`). The
     `/search` implementation (`src/app/(authenticated)/search/page.tsx:1-82`,
     `src/components/search/SearchForm.tsx:1-140`,
     `src/components/search/SearchResultsTable.tsx:1-158`) offers only a
     text/driver/session filter and “View Event” links—no track modal, favourite
     chips, import checkboxes, or LiveRC status badges.  
     **Impact:** Following the guide is impossible; users land on a completely
     different UI and cannot import events from LiveRC as the guide promises.  
     **Fix:** Update or replace the Event Search guide to describe the current
     unified search experience, and add a separate section if the original
     track-based importer is intentionally hidden behind the dashboard modal.

3. **Navigation guide claims keyboard shortcuts and hamburger controls that do
   not exist**
   - `docs/user-guides/navigation.md:98-207` documents multi-level dropdown
     menus, a hamburger menu that toggles navigation, and Alt-based shortcuts
     (Alt+H/S/E/G) for page jumps.
   - The top “hamburger” button in
     `src/components/dashboard/shell/TopStatusBar.tsx:13-44` only opens the
     command palette; it does not toggle navigation. The navigation rail is a
     static list without dropdown logic beyond the guides accordion.
   - There is no keyboard shortcut handling for Alt+\* combinations anywhere in
     the codebase (`rg -n "altKey" src` returns no matches;
     `src/components/dashboard/shell/CommandPalette.tsx:28-66` listens only for
     `Escape`).  
     **Impact:** Accessibility and navigation expectations set by the
     documentation are unmet; power users relying on shortcuts will fail
     silently.  
     **Fix:** Remove or rewrite the keyboard-shortcut section (or implement the
     shortcuts), and clarify what the top-left button actually does.

4. **Event Analysis guide advertises CSV export & advanced controls with no
   implementation**
   - `docs/user-guides/event-analysis.md:300-346` promises page-level,
     tab-level, and per-chart CSV exports plus zoom/pan/reset controls.
   - There are zero components providing export actions
     (`rg -n "Export" -g"*.tsx" src` only finds the guides page itself), and
     none of the chart components (e.g.,
     `src/components/event-analysis/UnifiedPerformanceChart.tsx`,
     `src/components/event-analysis/sessions/HeatProgressionChart.tsx`) expose
     zoom/pan controls beyond static SVG rendering.  
     **Impact:** Users may expect downloadable data and advanced interactivity
     when neither exists, leading to support tickets.  
     **Fix:** Update the guide to match the actual capabilities (static charts
     with filtering/pagination) or add the documented export/download features.

5. **Dashboard quick-action narrative is inaccurate**
   - `docs/user-guides/dashboard.md:82-189` details quick action buttons for
     “Search Events”, “View My Events”, “Import Event”, and “View Guides”, along
     with real-time stats like “Events Imported”, “Tracks Searched”, recent
     activity feeds, etc.
   - `DashboardClient` currently renders only an empty state button to open the
     event search modal (`src/components/dashboard/DashboardClient.tsx:220-309`)
     and no widgets, quick-action row, or metrics; there is no import button
     anywhere on the dashboard.  
     **Impact:** Users looking for those controls waste time searching;
     onboarding/training material built from this guide will be incorrect.  
     **Fix:** Rewrite the dashboard guide to describe the current minimal
     experience (select an event to unlock analysis) or implement the promised
     quick actions and widgets.

## Areas with No Issues Found

- Architecture, ADR, security, operations, ingestion, and standards documents
  describe implementation details already present in the codebase (e.g., LiveRC
  ingestion service under `ingestion/`, middleware-based security, Prisma
  schema) and read as design references rather than end-user promises, so no
  contradictions surfaced there.
- Role descriptions, prompts, domain references, and reports also align with the
  current project state.

## Recommended Next Steps

1. Decide whether to downscope the README/specs to match the implemented feature
   set or to prioritize building the missing dashboard/search capabilities.
2. Update the affected user guides (Dashboard, Event Search, Event Analysis,
   Navigation) immediately so internal/onboarding audiences stop relying on
   inaccurate instructions.
3. If the track-based event importer is intended to return, document how to
   access it today (via dashboard modal) or expose a direct route again.
4. Once documentation is corrected, add regression checks so future feature
   removals/redirects trigger doc updates (e.g., update docs as part of PR
   review checklist).
