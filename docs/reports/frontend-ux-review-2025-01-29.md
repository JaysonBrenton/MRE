---
title: "Frontend UX Review – MRE v0.1.1"
date: 2025-01-29
author: Codex (LLM UX agent)
purpose: Document the most impactful user-experience improvements available in the Next.js app so the owning teams can prioritize fixes without code changes yet.
---

## Context
- Reviewed the authenticated surface area (`src/app`, `src/components`) plus the guardrail docs in `README.md`, `docs/design/*`, `docs/frontend/liverc/*`, and the version 0.1.1 architecture specs.
- Focused on the paths the README keeps in scope for v0.1.1: registration/login, welcome/admin surfaces, dashboards, Event Search/Event Analysis, Events list, and driver management.
- Highlighted deltas where the UI deviates from canonical docs so that role owners (Next.js Front-End Engineer, Senior UX Expert, Admin Console owner) can schedule remediation.

## Findings & Opportunities

### 1. Navigation patterns from the spec are barely present
- The LiveRC workflow requires Event Search to be a **top-level navigation item available on every authenticated screen** (`docs/frontend/liverc/user-workflow.md:31` and `docs/frontend/liverc/user-workflow.md:51`), yet the logged-in navigation only renders "Dashboard" and Logout with no shortcut to Event Search or Events (`src/components/AuthenticatedNav.tsx:41-48`).
- Required navigation affordances—breadcrumbs on hierarchical pages and the simplified hamburger toggle—are absent outside the Event Analysis header even though the Navigation Patterns guide makes them mandatory (`docs/design/navigation-patterns.md:62`, `docs/design/navigation-patterns.md:107`).
- `docs/architecture/mobile-safe-architecture-guidelines.md:335-341` explicitly calls navigation structures out as a must-have for v0.1.1, but there is no hamburger drawer, no multi-level dropdown for Events/Admin, and breadcrumbs are missing from `/dashboard`, `/event-search`, `/events`, and every admin route.
- **Opportunities:** introduce a single responsive navigation system with (1) a breadcrumb trail rendered by `src/components/Breadcrumbs.tsx` on every page stack, (2) a hamburger-triggered drawer for mobile that mirrors the desktop links, and (3) an updated link list that includes Event Search, Events, Drivers, and Admin where appropriate. Reuse the documented aria patterns so the hamburger is keyboard operable.

### 2. Driver and admin workflows are stubbed out despite being in-scope
- Version 0.1.1 is only “complete” when driver pages, the admin console, tables, and navigation all work (`docs/specs/mre-v0.1-feature-scope.md:421-443`). Every admin sub-route except `/admin/ingestion` immediately redirects to `/under-development` (`src/app/admin/users/page.tsx:14-26`, `src/app/admin/tracks/page.tsx:1-11`, `src/app/admin/events/page.tsx:1-11`, etc.), so there are no user, track, audit, logs, or health tables.
- Driver management is also unimplemented: `/drivers/[driverId]` simply redirects to `/under-development` (`src/app/drivers/[driverId]/page.tsx:24-37`), leaving the required driver detail, transponder overrides, and management tables absent even though the table spec lists driver lists as required usage locations (`docs/design/table-component-specification.md:51-69`).
- **Opportunities:** stand up the admin tables called out in the spec (users, tracks, events) with the documented sorting/filtering/pagination patterns, and build the driver detail view so that Event Analysis → Drivers → “View profile” flows aren’t dead ends. Wiring these pages first also unblocks QA on the shared table components.

### 3. Dashboard implementation doesn’t match the widget-based architecture
- The dashboard contract requires full widgetization (stat cards, charts, quick actions) plus separate user/driver/team/track dashboard modes with customization controls (`docs/architecture/dashboard-architecture.md:36-116`).
- `src/components/dashboard/DashboardClient.tsx:20-200` only checks sessionStorage for a selected event, renders a single EventOverview card, and lists five recent events—no drag-and-drop widgets, no personal stats, no driver/team/track dashboards, and no customization affordances.
- Because of that gap, the "Dashboard system works" exit criterion from the feature scope (`docs/specs/mre-v0.1-feature-scope.md:429-442`) is not met, and users have no place to configure data they care about.
- **Opportunities:** implement the widget grid described in the architecture doc (stat cards + Visx charts + quick-action tiles), expose dashboards for each persona (user/driver/team/track) with appropriate data sources, and persist customization (layout, widget selection) per user. The existing Visx stack can be reused for the new widgets.

### 4. Event Search interactions ignore the mobile touch + flexbox guardrails
- The UI guideline mandates 44px touch targets for every interactive element (`docs/design/mre-mobile-ux-guidelines.md:68-83`), but several controls are far smaller: favourite track chips use `py-1` and `text-xs` (`src/components/event-search/EventSearchForm.tsx:125-135`), the date-filter toggle checkbox is `w-4 h-4` (`src/components/event-search/EventSearchForm.tsx:143-151`), and EventRow selection checkboxes are `w-5 h-5` (`src/components/event-search/EventRow.tsx:118-128`).
- The same guideline (and the mobile-safe architecture doc) insists we **always** use the reusable `ListRow` component for list items to prevent horizontal compression (`docs/design/mre-mobile-ux-guidelines.md:218-252`, `docs/architecture/mobile-safe-architecture-guidelines.md:351-359`). Event rows still use a hand-rolled `div` (`src/components/event-search/EventRow.tsx:110-172`) without `min-w-0` styles, so long event names can still crush the action buttons on narrow screens.
- **Opportunities:** swap the track chips and both checkbox controls for 44px-high components (e.g., pill buttons that use the `mobile-button` base and wrap an actual checkbox via visually hidden input) and refactor EventRow to compose `ListRow`, `ListRowText`, and `ListRowAction`. That simultaneously fixes the touch target issue and guarantees truncation.

### 5. Event Analysis tabs are placeholders instead of the required telemetry experiences
- The spec requires telemetry visualizations, driver comparisons, and sessions/heats analysis to be working for v0.1.1 (`docs/specs/mre-v0.1-feature-scope.md:433-444` and `docs/architecture/mobile-safe-architecture-guidelines.md:335-340`).
- The "Sessions / Heats" and "Comparisons" tabs are currently placeholders that just show “coming soon” text (`src/components/event-analysis/SessionsTab.tsx:1-8`, `src/components/event-analysis/ComparisonsTab.tsx:1-8`), so two of the four tabs offer no functionality and none of the promised telemetry charts (sector analysis, speed graphs, GPS traces) exist.
- **Opportunities:** build out the missing tabs with the telemetry visualizations enumerated in the spec (lap-time vs. speed charts, sector heatmaps, comparison overlays). The Visx infrastructure already in the repo can power these views once the data plumbing is in place.

### 6. Surface metadata still advertises the wrong release
- The canonical source says the repo is on **Version 0.1.1** (`README.md:1-20`), but the shared footer rendered on every page hard-codes “Alpha build · v0.1.0” (`src/components/Footer.tsx:18-27`).
- This mismatch makes it harder for QA and stakeholders to know which build they are looking at and undermines the README’s role as the single source of truth.
- **Opportunities:** drive the footer/version badge from a single config (package.json version or an app constant) and include the commit SHA/role-specific build info so that multi-agent reviews can confidently tell which release is deployed.

## Suggested Next Steps
1. Carve off a navigation refresh that introduces the breadcrumb + hamburger patterns, adds the missing Event Search link, and unifies desktop/mobile nav behaviour.
2. Prioritize enabling at least one driver page and one admin table so the spec no longer routes business-critical paths to `/under-development` (these screens also exercise the shared table components).
3. Size the dashboard + telemetry backlog in parallel; the widget system and the missing analysis tabs both depend on richer event/driver data but can be developed incrementally (e.g., start with stat cards and a comparisons chart).
