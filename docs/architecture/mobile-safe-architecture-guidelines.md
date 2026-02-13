---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-12-28
description:
  Authoritative architecture guidelines for API-first application structure
purpose:
  Defines the complete architectural framework for the My Race Engineer (MRE)
  application. Ensures the system is API-first, maintains separation of
  concerns, and is compliant with enterprise-grade structure and maintainability
  requirements. These rules are binding, not advisory. Version 0.1.1
  implementation must follow these guidelines exactly.
relatedFiles:
  - docs/adr/ADR-20250127-adopt-mobile-safe-architecture.md
  - docs/specs/mre-v0.1-feature-scope.md
  - docs/design/mre-dark-theme-guidelines.md
  - docs/design/mre-ux-principles.md
  - docs/roles/typescript-domain-engineer.md
  - docs/roles/nextjs-front-end-engineer.md
  - docs/roles/prisma-postgresql-backend-engineer.md
  - docs/roles/senior-ui-ux-expert.md
  - docs/roles/devops-platform-engineer.md
  - docs/roles/observability-incident-response-lead.md
  - docs/roles/quality-automation-engineer.md
  - docs/roles/documentation-knowledge-steward.md
  - docs/architecture/atomic-design-system.md
---

# Architecture Guidelines for My Race Engineer (MRE)

**Version:** 0.1.1 **Status:** Authoritative Architecture Standard **Scope:**
Governs all backend, API, client, UI, and LLM-generated code **Applicability:**
ALL contributors, including Cursor, Copilot, and ChatGPT Coding Mode

This document defines the complete architectural framework for the **My Race
Engineer (MRE)** application. It ensures the system is API-first, maintains
separation of concerns, and is compliant with enterprise-grade structure and
maintainability requirements.

These rules are **binding**, not advisory. Version 0.1.1 implementation must
follow these guidelines exactly.

**Note:** The term "mobile-safe" in this document refers to architectural
patterns (API-first, separation of concerns) that enable clean architecture, not
mobile UI support. The application is desktop-only for UI, but the architecture
patterns remain valuable for maintainability and future flexibility.

**Mobile strategy:** Version 0.1.1 does not support mobile. Telemetry
visualizations, dashboards, and all user-facing features are desktop-only (1280px+
viewport). A separate native mobile app is planned for a future release. Do not
implement mobile-specific layouts, touch optimizations, or responsive breakpoints
for telemetry or dashboard features in the web app.

---

# 1. Architectural Principles (Four Core Rules)

The entire MRE codebase is governed by four foundational architectural rules.
All design decisions must align with them.

## **Rule 1 — API-First Backend**

All features must be exposed via clean, typed JSON APIs.

- Every user-facing workflow must have a corresponding `/api/v1/...` endpoint.
- No UI-exclusive logic is permitted.
- API responses must follow the documented standard format (Section 7).

**Why this matters:**

- Simplifies testing, automation, and validation
- Decouples UI from logic for long-term maintainability
- Enables future client types (CLI tools, automation scripts) without web
  assumptions

---

## **Rule 2 — Separation of UI and Business Logic**

UI components must be thin and must never contain:

- validation
- parsing
- business rules
- data transformation
- Prisma queries
- authentication logic

All logic must reside in:

```
src/core/<domain>/
```

For example:

```
src/core/auth/register.ts
src/core/auth/login.ts
src/core/users/get-user.ts
```

**Why this matters:**

- Ensures shared logic works on server and future CLI tools
- Prevents React-specific coupling
- Enforces predictable architecture for LLMs

---

## **Rule 3 — Avoid Browser-Specific Dependencies**

**Core business logic** must not depend on:

- DOM APIs (`document`, `window`, etc.)
- Browser events
- URLSearchParams in business logic
- FormData inside business logic functions

**Exception:** UI-only features like theme preferences may use browser APIs such
as `localStorage` for client-side state management, as long as they do not
affect business logic or data persistence.

All essential business logic must function:

- in Node
- in serverless runtimes

**Why this matters:**

- Prevents hidden UI-only assumptions
- Allows UI enhancements while maintaining clean architecture

---

## **Rule 4 — Authentication Must Support Cookies**

Authentication system must:

- support cookie-based sessions for web

In version 0.1.1, authentication uses cookies only for web sessions.

**Why this matters:**

- Keeps authentication simple and focused
- Provides secure session management for web clients

---

# 2. Folder Structure Requirements

The following structure is **mandatory** for the entire codebase:

```
src/
  core/
    auth/
    users/
    common/
  app/
    api/
      v1/
        <domain>/
          <action>/
            route.ts
  components/
  lib/
```

**Note:** API routes are located in `src/app/api/v1/...` following Next.js App
Router conventions. The `src/app/` directory contains both pages and API routes.

### **Forbidden:**

- Business logic inside API routes
- Prisma queries inside React components
- Token generation inside UI components

### **Allowed:**

- API routes that call core functions
- UI components that call server actions which call core functions

---

# 3. API Standards

## 3.1 Versioned Endpoints

**Requirement:** All API routes must be under `/api/v1/` except
framework-required exceptions.

All APIs must be under:

```
src/app/api/v1/<domain>/<action>/route.ts
```

Examples:

```
src/app/api/v1/auth/register/route.ts
src/app/api/v1/auth/login/route.ts
src/app/api/v1/tracks/route.ts
src/app/api/v1/health/route.ts
```

These routes are accessible at:

```
/api/v1/auth/register
/api/v1/auth/login
/api/v1/tracks
/api/v1/health
```

### 3.1.1 Framework-Required Exceptions

The following routes are exceptions to the `/api/v1/` requirement due to
framework constraints:

**NextAuth Authentication Route:**

- **Path:** `/api/auth/[...nextauth]`
- **File:** `src/app/api/auth/[...nextauth]/route.ts`
- **Reason:** NextAuth framework requires this exact path structure for its
  callback handling and authentication endpoints
- **Status:** This is the only acceptable exception to the v1 requirement

All other routes must be under `/api/v1/`.

## 3.2 API Format

Responses must follow this structure:

```
// Success
{
  "success": true,
  "data": { ... },
  "message": "optional"
}

// Error
{
  "success": false,
  "error": {
    "code": "SOME_ERROR_CODE",
    "message": "Human readable message",
    "details": { ...optional }
  }
}
```

## 3.3 API Validation

All validation must occur in `src/core/<domain>/validate-*.ts`.

API routes may _not_ perform validation beyond basic shape checking.

## 3.4 API Error Handling

API routes must:

- never throw unhandled errors
- return structured API error format
- log critical failures using standardized logging

---

# 4. Session & Authentication Rules

## 4.1 Required Behaviours

- Sessions must be created only inside `src/core/auth/session.ts`
- Cookies used for version 0.1.1 UI
- Token model scaffolded for future mobile use

## 4.2 Forbidden in Version 0.1.1

- OAuth providers
- External identity management
- Email verification flows
- Magic links
- Social login

All authentication must remain minimalistic for version 0.1.1.

---

# 5. Database Rules

## 5.1 Location of DB Access

**API Routes:** API routes must never contain Prisma queries. All database
access must go through core functions.

**Repository Files:** Simple CRUD operations and reusable query functions must
exist in:

```
src/core/<domain>/repo.ts
```

**Core Business Logic Files:** Core business logic files
(`src/core/<domain>/*.ts`) may use Prisma directly for complex queries that:

- Combine multiple entities with joins
- Perform aggregations across multiple tables
- Require complex query logic that is part of business logic rather than simple
  data access

**Examples of acceptable Prisma usage in core business logic:**

- `src/core/users/driver-links.ts` - Complex joins across UserDriverLink,
  Driver, and EventDriverLink
- `src/core/personas/driver-events.ts` - Multi-entity queries combining
  EventDriverLink, EventEntry, and Event
- `src/core/events/get-event-analysis-data.ts` - Aggregations and complex joins
  for event analysis

**Preference:** When possible, core business logic files should prefer
delegating to repo functions. Direct Prisma usage is acceptable for complex
multi-entity operations that are inherently part of the business logic.

## 5.2 Entities

Version 0.1.1 entities include:

- **User**
  - id
  - email/username
  - password hash
  - driverName
  - teamName
  - isAdmin
  - timestamps

- **LiveRC Ingestion Entities** (in scope for version 0.1.1)
  - Track (track catalogue)
  - Event (race events)
  - Race (race sessions within events)
  - RaceDriver (drivers in races)
  - RaceResult (race results per driver)
  - Lap (lap-by-lap data)

  These entities support the LiveRC ingestion subsystem, which is a version
  0.1.1 feature. See `docs/architecture/liverc-ingestion/` for complete
  architecture specification.

## 5.3 Forbidden

- No user-generated session models (race setup sheets, custom sessions)
- No analytics/aggregation tables beyond basic race results

---

# 6. Desktop UI Architecture

UI must:

- use semantic tokens for colors (supports theme experimentation)
- dark theme is default, but theme system supports experimentation
- load fast
- avoid complex state machines
- be optimized for desktop viewports (1280px+)

**Version 0.1.1 Additions (All Required):**

- Table components (fully in-scope, used in admin console, event lists, driver
  management, race results)
- Dashboard systems with customizable widgets (user, driver, team, track
  dashboards with drag-and-drop, resize, rearrange)
- Telemetry visualizations (all visualization types: lap time charts, speed
  graphs, GPS tracks, sensor data, sector analysis - real-time and historical;
  desktop-only; see `docs/telemetry/Design/Telemetry_Ux_Blueprint.md`)
- Navigation structures (breadcrumb navigation as primary pattern, sidebars,
  multi-level dropdowns and tabs as secondary patterns)

All UI must follow:

- `docs/design/mre-dark-theme-guidelines.md`
- `docs/design/mre-ux-principles.md`
- `docs/design/navigation-patterns.md` (for navigation features)
- `docs/design/table-component-specification.md` (for table components)
- `docs/architecture/dashboard-architecture.md` (for dashboard systems)
- `docs/design/telemetry-visualization-specification.md` (for telemetry
  visualizations)
- `docs/design/chart-design-standards.md` (for all chart components - MANDATORY)

**Reusable UI Components (MUST USE):**

To prevent common layout bugs, especially horizontal compression issues in flex
containers:

- **Modals**: **ALWAYS use `src/components/molecules/Modal.tsx`** - enforces
  proper width constraints
  - If you MUST create a custom modal (strongly discouraged), use
    `getModalContainerStyles()` from `src/lib/modal-styles.ts`
  - **NEVER use Tailwind classes (`w-full max-w-*`) alone in flex containers
    with `items-center`/`justify-center`** - they will compress
  - Required pattern: `minWidth: '20rem'`, `flexShrink: 0`, `flexGrow: 0`, plus
    `width: '100%'` and `maxWidth`
- **List Rows**: Always use `src/components/atoms/ListRow.tsx` - enforces proper
  text truncation
- **Page Containers**: Use `src/components/molecules/PageContainer.tsx` and
  `ContentWrapper.tsx`
- **Pagination Components**: **CRITICAL - Must have `mb-16` (4rem / 64px) bottom
  margin to prevent footer overlap**
  - See `docs/development/PAGINATION_SPACING_GUIDELINES.md` for complete
    requirements
  - Reference implementation:
    `src/components/organisms/event-analysis/ChartPagination.tsx`
  - **Common bug:** Using `mb-8` instead of `mb-16` causes footer overlap

These components prevent the common flexbox shrink issues that cause layout
breakage. See `docs/development/FLEXBOX_LAYOUT_CHECKLIST.md` for detailed
prevention guidelines.

**Note:** All features listed above are fully in-scope and required for version
0.1.1. These are architectural requirements, not optional features.

---

# 7. Logging & Telemetry

In version 0.1.1:

- Logging must be console-based
- Errors must be structured and human-readable
- No external telemetry services may be integrated (except visualization
  libraries for telemetry data display)

---

# 8. LLM Enforcement Layer

All LLMs must:

- Obey this document
- Quote this document when making decisions
- Refuse to generate code violating any rule here
- Refuse to create features outside version 0.1.1 scope
- Use core folder structure
- Use `/docs/` as authoritative source

Cursor validation steps must include:

1. Scope check against version 0.1.1 spec
2. Architecture check against this document
3. UX/Dark theme check
4. Error format check
5. Folder structure check

---

# 9. Testing Requirements

Minimum version 0.1.1 test coverage:

- registration core logic
- login core logic
- admin detection logic
- API return format
- `/under-development` routing

Future phases will introduce full unit/integration/e2e coverage.

---

# 10. Performance Requirements

Version 0.1.1 must:

- render all screens < 200ms on local
- API responses < 300ms for simple requests
- avoid expensive Prisma queries
- avoid large dependencies
- optimize dashboard widget loading (required - dashboards with customizable
  widgets must load efficiently)
- optimize table rendering for large datasets (required - tables in admin
  console, event lists, driver management, race results must be performant)
- optimize telemetry visualization performance (required - all visualization
  types must render efficiently)

---

# 11. Security Requirements

- All passwords must be hashed using Argon2id
- No plaintext logging
- No insecure tokens
- No direct JWT exposure in UI
- No hardcoded secrets
- `.env` must not be included in repo
- Admin role must be backend-created only

---

# 12. Future Architecture Hooks (Not Implemented in Version 0.1.1)

These items may be referenced but **must not** be implemented:

- Race session pipelines
- Worker queues
- Python-based LiveRC scraper
- Analytics engine
- Event/time-series storage
- Data import graph
- AI coach modules
- Mobile OAuth integration

These will be added in Beta/Production using this architecture as foundation.

---

# 13. Role Responsibilities

Different engineering roles have specific responsibilities for maintaining and
enforcing these architecture guidelines:

- **TypeScript Domain Engineer** (`docs/roles/typescript-domain-engineer.md`):
  Responsible for enforcing Rule 2 (Separation of UI and Business Logic),
  maintaining the `src/core/` structure, and ensuring business logic remains
  framework-agnostic. Creates ADRs for domain architecture changes.

- **Next.js Front-End Engineer** (`docs/roles/nextjs-front-end-engineer.md`):
  Responsible for ensuring UI components follow the architecture, and
  maintaining the separation between UI and business logic. Works with
  TypeScript Domain Engineers to ensure proper layering.

- **Prisma/PostgreSQL Backend Engineer**
  (`docs/roles/prisma-postgresql-backend-engineer.md`): Responsible for database
  rules (Section 5), ensuring all Prisma queries exist only in
  `src/core/<domain>/repo.ts`, and maintaining database schema alignment with
  architecture requirements.

- **Senior UI/UX Expert** (`docs/roles/senior-ui-ux-expert.md`): Responsible for
  UI design decisions, ensuring UI follows architectural patterns, and
  maintaining consistency with design guidelines referenced in Section 6.

- **DevOps & Platform Engineer** (`docs/roles/devops-platform-engineer.md`):
  Responsible for deployment infrastructure that supports the architecture,
  ensuring environment configuration aligns with architecture requirements, and
  maintaining CI/CD pipelines that enforce architecture rules.

- **Observability & Incident Response Lead**
  (`docs/roles/observability-incident-response-lead.md`): Responsible for
  logging and telemetry standards (Section 7), ensuring observability follows
  architecture constraints, and maintaining structured logging.

- **Quality & Automation Engineer**
  (`docs/roles/quality-automation-engineer.md`): Responsible for testing
  requirements (Section 9), ensuring tests validate architecture compliance, and
  maintaining quality gates that prevent architectural violations.

- **Documentation & Knowledge Steward**
  (`docs/roles/documentation-knowledge-steward.md`): Responsible for maintaining
  this architecture document, facilitating ADRs for architecture changes, and
  ensuring all role documentation aligns with architecture guidelines.

All roles must coordinate to ensure architecture compliance. Violations should
be caught in code review and addressed immediately.

---

# 14. License

Internal use only. This document governs architecture for the version 0.1.1
release of MRE.
