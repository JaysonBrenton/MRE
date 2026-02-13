---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Expanded feature set for MRE Version 0.1.1 Release
purpose:
  Defines the feature set for the My Race Engineer (MRE) Version 0.1.1 Release.
  These requirements are binding. No feature may be added, expanded, or modified
  unless this document is explicitly updated. Version 0.1.1 builds on the
  architectural foundation of version 0.1.0, adding navigation, tables,
  dashboards, and telemetry visualizations.
relatedFiles:
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/adr/ADR-20250127-adopt-mobile-safe-architecture.md
  - docs/design/mre-dark-theme-guidelines.md
  - docs/design/mre-ux-principles.md
  - docs/roles/typescript-domain-engineer.md
  - docs/roles/nextjs-front-end-engineer.md
  - docs/roles/prisma-postgresql-backend-engineer.md
  - docs/roles/senior-ui-ux-expert.md
  - docs/roles/quality-automation-engineer.md
  - docs/roles/devops-platform-engineer.md
  - docs/roles/documentation-knowledge-steward.md
---

# MRE Version 0.1.1 Feature Scope (Authoritative Specification)

This document defines the **feature set** for the **My Race Engineer (MRE)
Version 0.1.1 Release**. These requirements are binding. No feature may be
added, expanded, or modified unless this document is explicitly updated.

Version 0.1.1 builds on the architectural foundation of version 0.1.0, adding
navigation features, table components, dashboard systems, and telemetry
visualizations while maintaining architectural correctness.

**Implementation status (current build):** The following sections describe the
intended v0.1.1 scope. As of the last doc update, the implemented build
includes: registration, login, welcome, admin (users, events, tracks, ingestion,
audit, health, logs), LiveRC ingestion, breadcrumbs/navigation, tables (admin,
event lists, driver/race results), dashboard shell and my-event (event-centric
dashboard), event search and practice-day search, event analysis (sessions,
laps, charts from LiveRC lap data), under-development placeholder, and atomic
design (atoms/molecules/organisms/templates). Features such as full dashboard
widget customization, team/track dashboards, and My Telemetry (sensor/GPS
import) are in scope but not yet implemented; those routes redirect to
`/under-development` where applicable.

---

# 1. Purpose of the Version 0.1.1 Release

The purpose of the version 0.1.1 release is to build upon version 0.1.0 by
adding:

- Advanced navigation features (hamburger menus, multi-level navigation, tabs,
  breadcrumbs)
- Table components with sorting, filtering, and pagination
- Complex dashboard systems with customizable widgets
- Telemetry visualizations for lap data and future sensor data
- Enhanced UI patterns optimized for desktop

Version 0.1.1 maintains the architectural foundation from version 0.1.0 while
expanding UI capabilities.

---

# 2. Version 0.1.1 Features (Allowed)

Only the following features are permitted. If a feature is not listed here, it
**must not** be implemented.

**Note:** All features from version 0.1.0 are included in version 0.1.1. The
sections below document new features added in 0.1.1.

## ✔ 2.1 Account Registration

Users can create an account using the following required fields:

- Email or Username (required)
- Password (required)
- Driver Name (required)
- Team Name (optional)

All fields must be:

- Validated according to architecture rules
- Stored in PostgreSQL using Prisma
- Processed through `/api/v1/` JSON APIs

No additional fields may be introduced.

---

## ✔ 2.2 Login

Users must be able to authenticate using:

- Email or Username
- Password

Upon successful login:

- A session must be created using the documented session/token model
- User must be redirected to their Welcome page (Section 2.3)

Mobile clients must be able to authenticate via tokens (future-safe
requirement), though version 0.1.1 may temporarily rely on cookie sessions as
long as the architecture supports future token integration.

---

## ✔ 2.3 User Welcome Page

After login, users must see the following message exactly:

```
Welcome back <Driver Name>
```

No controls, buttons, menus, widgets, or data visualisation elements may appear
on this page.

---

## ✔ 2.4 Administrator Login (Backend-Only Creation)

An administrator account may **not** be created via the registration flow.

Admin creation must only occur through backend mechanisms such as:

- Seed scripts
- Direct database updates
- Secure migration scripts

Upon login, an administrator must be redirected to:

### **Administration Console**

The Administration Console provides comprehensive administrative features for
managing the MRE application. The console includes:

**Dashboard Overview:**

- System statistics (user count, event count, track count, database size)
- Health status indicators
- Quick action cards
- Recent activity feed

**User Management:**

- View all users with pagination, sorting, and filtering
- Edit user details (driverName, teamName, email)
- Delete users (with confirmation)
- Promote/demote administrators (toggle isAdmin flag)
- Search and filter by email, driver name, admin status

**System Statistics:**

- Dashboard cards showing key metrics
- Database statistics (connection pool, query performance, table sizes)
- Real-time updates with refresh capability

**Event Management:**

- View all ingested events with details
- Re-ingest events (trigger re-ingestion for selected events)
- Delete events (with cascade delete handling)
- Filter and sort by track, date range, ingestion status

**Track Management:**

- View all tracks with details and event counts
- Follow/unfollow tracks (toggle isFollowed flag)
- View events for specific tracks
- Filter and sort by name, source, follow status

**LiveRC Ingestion Controls:**

- Manual trigger for track sync or event ingestion
- View ingestion jobs (recent/active jobs)
- View ingestion logs for specific operations
- Real-time status updates for running jobs

**Audit Logs:**

- View all audit log entries
- Filter by user, action type, resource type, date range
- Expandable rows showing full audit log details
- Export filtered logs (optional)

**Health Checks:**

- Detailed health checks for database connectivity, ingestion service status,
  disk space, memory usage
- Color-coded status indicators (green/yellow/red)
- Individual component health status
- Manual refresh capability

**Log Viewing:**

- Real-time log streaming (tail -f style)
- Paginated log viewing (browse historical logs)
- Search and filter by log level, service, date range, search term
- Support for multiple log sources (Next.js, ingestion service, database)
- Pretty-print JSON logs with syntax highlighting

All admin features are accessible only to users with `isAdmin: true`. All admin
actions are logged to the audit log for security and compliance.

---

## ✔ 2.6 LiveRC Ingestion

The LiveRC ingestion subsystem provides MRE with the ability to retrieve,
normalize, and store race event data from LiveRC. This includes:

- Track catalogue - Complete catalogue of all LiveRC tracks
- Event discovery - On-demand discovery of events for a selected track within a
  date range
- Event data ingestion - Deep ingestion of full event details (races, drivers,
  results, laps) on demand
- Data storage - Long-term storage of ingested data for user analysis and
  visualization

All LiveRC ingestion features must follow the architecture defined in:

```
docs/architecture/liverc-ingestion/
```

See [LiveRC Ingestion Overview](../architecture/liverc-ingestion/01-overview.md)
for complete architecture specification.

---

## ✔ 2.7 Navigation Features

Version 0.1.1 includes navigation features to improve user experience and
support complex application structures. **Breadcrumb navigation is the primary
navigation pattern** for version 0.1.1.

**Breadcrumb Navigation (Primary Pattern):**

- Breadcrumb trails for deep navigation
- Shows current location in application hierarchy
- Clickable navigation path
- Preferred navigation method for version 0.1.1
- Must be implemented on all pages with hierarchical navigation
- See `docs/design/navigation-patterns.md` for implementation guidelines

**Simplified Hamburger Menus:**

- Basic open/close toggle functionality
- Desktop-optimized implementation
- Complements sidebars on desktop (hamburger for mobile, sidebar for desktop)
- Minimal features (basic state management, simple accessibility)
- Accessible and keyboard-navigable
- See `docs/design/navigation-patterns.md` for simplified implementation
  guidelines

**Multi-Level Dropdown Menus (Secondary Pattern):**

- Hierarchical navigation structures (secondary to breadcrumbs)
- Support for nested menu items
- Keyboard navigation support
- Mobile-friendly collapsible menus
- Use when breadcrumbs are insufficient for navigation needs

**Tab-Based Navigation (Secondary Pattern):**

- Tab navigation for organizing related content within pages
- Desktop-optimized tab behavior
- Accessible tab panels
- Use for organizing content within a single page context

All navigation features must follow desktop-optimized principles and maintain
accessibility standards. Breadcrumb navigation should be the primary method used
throughout the application. See `docs/design/navigation-patterns.md` for
complete specifications.

---

## ✔ 2.8 Table Components

Version 0.1.1 includes table components for displaying structured data across
the application. Tables are fully in-scope and required for all specified usage
locations.

**Usage Locations (All Required):**

- Admin console (users, events, tracks lists)
- Event lists page (browse imported events)
- Driver lists and management (driver information and transponder overrides)
- Race results display (race results with lap times and positions)

**Required Features:**

- Column sorting (ascending/descending)
- Row filtering and search
- Pagination for large datasets
- Desktop-optimized layouts
- Horizontal scroll support for wide tables if needed
- Accessible interactions
- Column visibility strategies for small screens

**Mobile Behavior:**

- Horizontal scroll allowed for tables on mobile devices (preferred approach)
- Touch-friendly interactions
- Column visibility strategies for small screens
- Degradation to lists or cards as alternative approach

All tables must be accessible and performant. Tables are fully in-scope for
version 0.1.1 and must be implemented in all specified locations. See
`docs/design/table-component-specification.md` for complete specifications.

---

## ✔ 2.9 Dashboard System

Version 0.1.1 includes a comprehensive dashboard system with customizable
widgets. Complex dashboards beyond the admin console are fully in-scope and
required.

**Current implementation:** Dashboard shell and my-event (event-centric
dashboard) are implemented. Full widget customization (drag-and-drop, resize,
save layout) and team/track dashboards are not yet implemented.

**Dashboard Types (All Required):**

- User dashboard (personal stats, recent events, quick actions)
- Driver dashboard (performance metrics, lap times, race results)
- Team dashboard (team statistics, member performance, team events)
- Track dashboard (track-specific statistics, event history, track records)

**Widget Types:**

- Stat cards (counts, totals, averages, trend indicators)
- Charts and graphs (line, bar, pie charts)
- Recent activity feeds
- Quick action buttons

**Customization (Required Features):**

- Full customization support (drag-and-drop, resize, rearrange)
- Users can show/hide widgets
- Customizable layouts per dashboard type
- Save custom layouts per user per dashboard type
- Reset to default layout capability

All dashboards must follow desktop-optimized design and performance
optimization. Complex dashboards with customizable widgets are fully in-scope
for version 0.1.1. See `docs/architecture/dashboard-architecture.md` for
complete specifications.

---

## ✔ 2.10 Telemetry Visualizations

Version 0.1.1 includes telemetry visualization capabilities. All visualization
types are fully in-scope and required.

**Current implementation:** Lap time and event analysis charts from LiveRC lap
data are implemented. GPS track visualization, sensor data visualization, sector
analysis, and the My Telemetry flow (import/analysis) are not yet implemented;
`/dashboard/my-telemetry` redirects to `/under-development`.

**Visualization Types (All Required):**

- Lap time charts (line graphs, comparisons, lap-by-lap analysis)
- Speed graphs (over time, by sector, speed analysis)
- GPS track visualization (maps, track layouts, racing line visualization)
- Sensor data visualization (throttle, brake, steering, RPM, temperature
  sensors)
- Sector analysis (heatmaps, comparisons, sector time breakdowns)

**Data Sources:**

- Existing lap data from LiveRC ingestion (available now)
- Future sensor data (visualization components ready, data ingestion out of
  scope)

**Support:**

- Real-time visualization (live race data when available)
- Historical visualization (past race data from LiveRC ingestion)
- Both real-time and historical support

All visualizations must be performant and mobile-friendly. All visualization
types listed above are fully in-scope for version 0.1.1 and must be implemented.
See `docs/design/telemetry-visualization-specification.md` for complete
specifications.

---

## ✔ 2.11 Telemetry Ingestion

Version 0.1.1 includes telemetry ingestion for GNSS and IMU data from devices.
Users can upload telemetry files, and the system parses, stores, and analyzes
them. Synthetic seed data and fixtures support development and testing.

**In scope:**

- Upload telemetry files (CSV, GPX, and supported formats)
- Parsing and normalisation to canonical streams
- Seed data generator and KML track templates
- Fixtures under `ingestion/tests/fixtures/telemetry/`

**Reference:** See `docs/telemetry/` for design, API contract, and seed data
guide.

---

# 3. Explicitly Out of Scope (Forbidden)

The following features are **not allowed** in version 0.1.1. They may not appear
in UI, backend logic, comments, placeholder pages, or database models.

These features must only appear as links that redirect to `/under-development`
when part of the public landing page.

### ❌ Racing and Telemetry

- Race session parsing (beyond existing LiveRC ingestion)

**Note:** Telemetry visualization (Section 2.10) and telemetry ingestion
(Section 2.11) are in scope.

### ❌ User Features

- Profile editing
- Settings (beyond theme preferences)
- Preferences beyond dark mode
- Notifications or emails
- Uploading data
- Setup sheets

### ❌ UI / Navigation

- Multi-page flows beyond
  login/registration/welcome/admin/dashboard/events/event-search/event-analysis/drivers

**Note:** The following pages ARE in scope for version 0.1.1:

- Dashboard page (overview with navigation to event search)
- Events list page (browse imported events)
- Event Search page (search and import events from LiveRC)
- Event Analysis page (view and analyze event data with charts)
- Driver detail pages (view driver information and transponder overrides) _(UI
  route exists but currently redirects to `/under-development`; full page build
  remains pending and must follow this spec when implemented)._

**Note:** Navigation features ARE in scope for version 0.1.1:

- Breadcrumb navigation (primary pattern)
- Simplified hamburger menus (basic toggle functionality)
- Multi-level dropdown menus (secondary pattern)
- Tab-based navigation (secondary pattern)
- Sidebars for navigation on in-scope pages

All navigation features must follow desktop-optimized principles and maintain
accessibility standards.

### ❌ Backend

- Background jobs
- Queue processing
- Scheduled tasks
- Webhooks

---

# 4. Architecture Requirements

All version 0.1.1 features must follow the architecture defined in:

```
docs/architecture/mobile-safe-architecture-guidelines.md
```

This includes:

- API-first workflow
- `/api/v1/...` versioning
- Business logic inside `src/core/*`
- No business logic in UI components
- No browser-specific dependencies
- Support for future mobile clients

Failure to follow architecture rules is considered a **violation of version
0.1.1 scope**.

---

# 5. UI/UX Requirements

All version 0.1.1 screens (registration, login, welcome, admin, dashboards,
tables) must follow:

- `docs/design/mre-dark-theme-guidelines.md`
- `docs/design/mre-mobile-ux-guidelines.md`
- `docs/design/mre-ux-principles.md`

This includes:

- Theme system with dark theme as default (light theme available via toggle)
- Theme toggle component allows users to switch between dark and light themes
- Theme preference persisted in localStorage
- Semantic tokens for visuals (support theme experimentation - dark, light, and
  future themes)
- Desktop-optimized layouts
- Accessible form handling
- UX consistency across all screens
- Theme system designed to support experimentation while maintaining
  accessibility

---

# 6. LLM Guardrails

All LLM-based agents (Cursor, Copilot, ChatGPT Coding Mode) must:

1. **Follow the version 0.1.1 feature list strictly**
2. Reject any feature request outside this spec
3. Use only `/docs/` files as references
4. Quote exact sections when validating code
5. Avoid best-practice substitution unless explicitly requested
6. Obey file boundaries, folder structures, and naming rules

---

# 7. Completion Criteria

Version 0.1.1 is considered complete when:

### ✔ Registration works

### ✔ Login works

### ✔ Admin login works

### ✔ Welcome/Dashboard page works

### ✔ Admin console works

### ✔ Events pages work (list, search, analysis)

### ✔ Driver pages work

### ✔ Navigation features work (hamburger menus, multi-level nav, tabs, breadcrumbs)

### ✔ Table components work (sorting, filtering, pagination, mobile scroll)

### ✔ Dashboard system works (all dashboard types, widgets, customization)

### ✔ Telemetry visualizations work (all visualization types, real-time and historical)

### ✔ Dark theme applied globally

### ✔ API-first architecture validated

### ✔ Folder structure validated

### ✔ `/under-development` routing exists

### ✔ LLM guardrails are correct and enforceable

---

# 8. Future Phases (Post-0.1.1)

The following will be introduced in later phases:

- Landing page
- Analytics engine
- Setup sheets
- Data import/export tools
- Admin scraping workflows
- AI coach
- Pricing
- Blog
- Mobile apps

**Note:** Navigation features, table components, dashboard systems, telemetry
visualizations, and telemetry ingestion are in-scope for version 0.1.1 (see
Sections 2.7, 2.8, 2.9, 2.10, and 2.11).

These future features may be described in documentation but **must never be
implemented in version 0.1.1**.

---

# 9. Role Ownership

The following roles have primary responsibility for implementing and maintaining
version 0.1.1 features:

- **TypeScript Domain Engineer** (`docs/roles/typescript-domain-engineer.md`):
  Owns business logic for registration, login, and user management in
  `src/core/auth/` and `src/core/users/`. Ensures all version 0.1.1 features
  follow mobile-safe architecture.

- **Next.js Front-End Engineer** (`docs/roles/nextjs-front-end-engineer.md`):
  Owns UI implementation for registration, login, welcome pages, and admin
  console. Ensures UI follows UX principles and design guidelines.

- **Prisma/PostgreSQL Backend Engineer**
  (`docs/roles/prisma-postgresql-backend-engineer.md`): Owns database schema,
  migrations, and data persistence for User model. Ensures all Prisma queries
  follow architecture rules.

- **Senior UI/UX Expert** (`docs/roles/senior-ui-ux-expert.md`): Owns UX design
  for all version 0.1.1 screens, ensures accessibility compliance, and maintains
  design system consistency. Owns navigation patterns, table components, and
  telemetry visualization design.

- **Quality & Automation Engineer**
  (`docs/roles/quality-automation-engineer.md`): Owns test coverage for version
  0.1.1 features, ensures all completion criteria (Section 7) are validated
  through automated tests.

- **DevOps & Platform Engineer** (`docs/roles/devops-platform-engineer.md`):
  Owns deployment infrastructure and environment configuration that supports
  version 0.1.1 features.

- **Documentation & Knowledge Steward**
  (`docs/roles/documentation-knowledge-steward.md`): Owns this specification
  document, ensures it stays current, and facilitates updates when version 0.1.1
  scope changes.

All roles must coordinate to ensure version 0.1.1 features are implemented
correctly and remain within scope.

---

# 10. License

Internal use only. This specification governs internal development for the
version 0.1.1 release of MRE.
