---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Authoritative architecture guidelines for mobile-safe, API-first application structure
purpose: Defines the complete architectural framework for the My Race Engineer (MRE) application.
         Ensures the system is fully mobile-safe, API-first, future-native for iOS/Android clients,
         and compliant with enterprise-grade structure and maintainability requirements. These
         rules are binding, not advisory. Alpha implementation must follow these guidelines exactly.
relatedFiles:
  - docs/adr/ADR-20250127-adopt-mobile-safe-architecture.md
  - docs/specs/mre-alpha-feature-scope.md
  - docs/design/mre-dark-theme-guidelines.md
  - docs/design/mre-mobile-ux-guidelines.md
  - docs/design/mre-ux-principles.md
  - docs/roles/typescript-domain-engineer.md
  - docs/roles/nextjs-front-end-engineer.md
  - docs/roles/prisma-postgresql-backend-engineer.md
  - docs/roles/senior-ui-ux-expert.md
  - docs/roles/devops-platform-engineer.md
  - docs/roles/observability-incident-response-lead.md
  - docs/roles/quality-automation-engineer.md
  - docs/roles/documentation-knowledge-steward.md
---

# Mobile-Safe Architecture Guidelines for My Race Engineer (MRE)

**Version:** Alpha
**Status:** Authoritative Architecture Standard
**Scope:** Governs all backend, API, client, UI, and LLM-generated code
**Applicability:** ALL contributors, including Cursor, Copilot, and ChatGPT Coding Mode

This document defines the complete architectural framework for the **My Race Engineer (MRE)** application. It ensures the system is fully mobile-safe, API-first, future-native for iOS/Android clients, and compliant with enterprise-grade structure and maintainability requirements.

These rules are **binding**, not advisory. Alpha implementation must follow these guidelines exactly.

---

# 1. Architectural Principles (Five Core Rules)

The entire MRE codebase is governed by five foundational architectural rules. All design decisions must align with them.

## **Rule 1 — API-First Backend**

All features must be exposed via clean, typed JSON APIs.

* Every user-facing workflow must have a corresponding `/api/v1/...` endpoint.
* No UI-exclusive logic is permitted.
* Mobile clients must be able to perform all actions without a browser.
* API responses must follow the documented standard format (Section 7).

**Why this matters:**

* Enables mobile apps (iOS/Android) to interact without web assumptions
* Simplifies testing, automation, and validation
* Decouples UI from logic for long-term maintainability

---

## **Rule 2 — Separation of UI and Business Logic**

UI components must be thin and must never contain:

* validation
* parsing
* business rules
* data transformation
* Prisma queries
* authentication logic

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

* Ensures shared logic works on mobile, server, and future CLI tools
* Prevents React-specific coupling
* Enforces predictable architecture for LLMs

---

## **Rule 3 — Avoid Browser-Specific Dependencies**

Core logic must not depend on:

* DOM APIs (`document`, `window`, `localStorage`, etc.)
* Browser events
* URLSearchParams in UI
* FormData inside React components

All essential logic must function:

* in Node
* in serverless runtimes
* inside mobile JS runtimes

**Why this matters:**

* Guarantees the business logic works for mobile apps
* Prevents hidden UI-only assumptions

---

## **Rule 4 — Design UI/UX with Mobile Constraints**

All UI must be:

* one-column-first
* fully touch-safe
* accessible with minimal device precision
* free of hover-only interactions
* adaptive to small screens by default

Tables must degrade into:

* lists, or
* cards

Complex multicolumn layouts are prohibited in Alpha.

**Why this matters:**

* Ensures web and mobile experiences are aligned
* Prevents UIs that cannot be translated to mobile

---

## **Rule 5 — Authentication Must Support Cookies AND Mobile Tokens**

Authentication system must:

* support cookie-based sessions for web
* be architecturally ready for token-based mobile login
* expose token-based session endpoints (even if stubbed)

During Alpha, UI may use cookies only—but backend must be structured for mobile.

**Why this matters:**

* Prevents future lock-in to browser-only authentication
* Enables mobile app login without hacks

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

**Note:** API routes are located in `src/app/api/v1/...` following Next.js App Router conventions. The `src/app/` directory contains both pages and API routes.

### **Forbidden:**

* Business logic inside API routes
* Prisma queries inside React components
* Token generation inside UI components

### **Allowed:**

* API routes that call core functions
* UI components that call server actions which call core functions

---

# 3. API Standards

## 3.1 Versioned Endpoints

All APIs must be under:

```
src/app/api/v1/<domain>/<action>/route.ts
```

Examples:

```
src/app/api/v1/auth/register/route.ts
src/app/api/v1/auth/login/route.ts
src/app/api/v1/tracks/route.ts
```

These routes are accessible at:

```
/api/v1/auth/register
/api/v1/auth/login
/api/v1/tracks
```

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

API routes may *not* perform validation beyond basic shape checking.

## 3.4 API Error Handling

API routes must:

* never throw unhandled errors
* return structured API error format
* log critical failures using standardized logging

---

# 4. Session & Authentication Rules

## 4.1 Required Behaviours

* Sessions must be created only inside `src/core/auth/session.ts`
* Cookies used for Alpha UI
* Token model scaffolded for future mobile use

## 4.2 Forbidden in Alpha

* OAuth providers
* External identity management
* Email verification flows
* Magic links
* Social login

All authentication must remain minimalistic for Alpha.

---

# 5. Database Rules

## 5.1 Location of DB Access

All Prisma queries must exist only in:

```
src/core/<domain>/repo.ts
```

## 5.2 Entities

Alpha entities include:

* **User**

  * id
  * email/username
  * password hash
  * driverName
  * teamName
  * isAdmin
  * timestamps

* **LiveRC Ingestion Entities** (in scope for Alpha)

  * Track (track catalogue)
  * Event (race events)
  * Race (race sessions within events)
  * RaceDriver (drivers in races)
  * RaceResult (race results per driver)
  * Lap (lap-by-lap data)

  These entities support the LiveRC ingestion subsystem, which is an Alpha feature. See `docs/architecture/liverc-ingestion/` for complete architecture specification.

## 5.3 Forbidden

* No telemetry tables (sensor data, GPS, IMU)
* No user-generated session models (race setup sheets, custom sessions)
* No analytics/aggregation tables beyond basic race results

---

# 6. Mobile-Safe UI Architecture

UI must:

* use semantic tokens for colors
* use dark mode only
* avoid hover interactions
* support small screens
* follow tap target guidelines
* load fast
* avoid complex state machines

All UI must follow:

* `docs/design/mre-dark-theme-guidelines.md`
* `docs/design/mre-mobile-ux-guidelines.md`
* `docs/design/mre-ux-principles.md`

---

# 7. Logging & Telemetry

During Alpha:

* Logging must be console-based
* Errors must be structured and human-readable
* No external telemetry services may be integrated

---

# 8. LLM Enforcement Layer

All LLMs must:

* Obey this document
* Quote this document when making decisions
* Refuse to generate code violating any rule here
* Refuse to create non-Alpha features
* Use core folder structure
* Use `/docs/` as authoritative source

Cursor validation steps must include:

1. Scope check against Alpha spec
2. Architecture check against this document
3. UX/Dark theme check
4. Error format check
5. Folder structure check

---

# 9. Testing Requirements

Minimum Alpha test coverage:

* registration core logic
* login core logic
* admin detection logic
* API return format
* `/under-development` routing

Future phases will introduce full unit/integration/e2e coverage.

---

# 10. Performance Requirements

Alpha must:

* render all screens < 200ms on local
* API responses < 300ms for simple requests
* avoid expensive Prisma queries
* avoid large dependencies

---

# 11. Security Requirements

* All passwords must be hashed using Argon2id
* No plaintext logging
* No insecure tokens
* No direct JWT exposure in UI
* No hardcoded secrets
* `.env` must not be included in repo
* Admin role must be backend-created only

---

# 12. Future Architecture Hooks (Not Implemented in Alpha)

These items may be referenced but **must not** be implemented:

* Telemetry ingestion services
* Race session pipelines
* Worker queues
* Python-based LiveRC scraper
* Analytics engine
* Event/time-series storage
* Data import graph
* AI coach modules
* Mobile OAuth integration

These will be added in Beta/Production using this architecture as foundation.

---

# 13. Role Responsibilities

Different engineering roles have specific responsibilities for maintaining and enforcing these architecture guidelines:

* **TypeScript Domain Engineer** (`docs/roles/typescript-domain-engineer.md`): Responsible for enforcing Rule 2 (Separation of UI and Business Logic), maintaining the `src/core/` structure, and ensuring business logic remains framework-agnostic. Creates ADRs for domain architecture changes.

* **Next.js Front-End Engineer** (`docs/roles/nextjs-front-end-engineer.md`): Responsible for implementing Rule 4 (Mobile-First UI), ensuring UI components follow the architecture, and maintaining the separation between UI and business logic. Works with TypeScript Domain Engineers to ensure proper layering.

* **Prisma/PostgreSQL Backend Engineer** (`docs/roles/prisma-postgresql-backend-engineer.md`): Responsible for database rules (Section 5), ensuring all Prisma queries exist only in `src/core/<domain>/repo.ts`, and maintaining database schema alignment with architecture requirements.

* **Senior UI/UX Expert** (`docs/roles/senior-ui-ux-expert.md`): Responsible for Rule 4 (Mobile-First UI) design decisions, ensuring UI follows mobile-safe patterns, and maintaining consistency with design guidelines referenced in Section 6.

* **DevOps & Platform Engineer** (`docs/roles/devops-platform-engineer.md`): Responsible for deployment infrastructure that supports the architecture, ensuring environment configuration aligns with architecture requirements, and maintaining CI/CD pipelines that enforce architecture rules.

* **Observability & Incident Response Lead** (`docs/roles/observability-incident-response-lead.md`): Responsible for logging and telemetry standards (Section 7), ensuring observability follows architecture constraints, and maintaining structured logging that supports mobile-safe architecture.

* **Quality & Automation Engineer** (`docs/roles/quality-automation-engineer.md`): Responsible for testing requirements (Section 9), ensuring tests validate architecture compliance, and maintaining quality gates that prevent architectural violations.

* **Documentation & Knowledge Steward** (`docs/roles/documentation-knowledge-steward.md`): Responsible for maintaining this architecture document, facilitating ADRs for architecture changes, and ensuring all role documentation aligns with architecture guidelines.

All roles must coordinate to ensure architecture compliance. Violations should be caught in code review and addressed immediately.

---

# 14. License

Internal use only. This document governs architecture for the Alpha release of MRE.
