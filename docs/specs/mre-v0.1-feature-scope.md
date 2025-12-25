---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Strict, locked-down feature set for MRE Version 0.1.0 Release
purpose: Defines the strict, locked-down feature set for the My Race Engineer (MRE) Version 0.1.0
         Release. These requirements are binding. No feature may be added, expanded, or
         modified unless this document is explicitly updated. Version 0.1.0 focuses
         entirely on authentication, minimal user flows, and architectural correctness.
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

# MRE Version 0.1.0 Feature Scope (Authoritative Specification)

This document defines the **strict, locked-down feature set** for the **My Race Engineer (MRE) Version 0.1.0 Release**. These requirements are binding. No feature may be added, expanded, or modified unless this document is explicitly updated.

Version 0.1.0 focuses entirely on authentication, minimal user flows, and architectural correctness.

---

# 1. Purpose of the Version 0.1.0 Release

The purpose of the version 0.1.0 release is to establish:

* A stable authentication foundation
* Backend architecture correctness (API-first, mobile-safe, testable)
* Dark theme consistency
* Mobile-first UI behaviour
* Clean separation between user and admin flows
* Strict prevention of feature creep

The version 0.1.0 release is **not** intended to demonstrate telemetry, analytics, or sensor-based racing functionality.

---

# 2. Version 0.1.0 Features (Allowed)

Only the following features are permitted.
If a feature is not listed here, it **must not** be implemented.

## ✔ 2.1 Account Registration

Users can create an account using the following required fields:

* Email or Username (required)
* Password (required)
* Driver Name (required)
* Team Name (optional)

All fields must be:

* Validated according to architecture rules
* Stored in PostgreSQL using Prisma
* Processed through `/api/v1/` JSON APIs

No additional fields may be introduced.

---

## ✔ 2.2 Login

Users must be able to authenticate using:

* Email or Username
* Password

Upon successful login:

* A session must be created using the documented session/token model
* User must be redirected to their Welcome page (Section 2.3)

Mobile clients must be able to authenticate via tokens (future-safe requirement), though version 0.1.0 may temporarily rely on cookie sessions as long as the architecture supports future token integration.

---

## ✔ 2.3 User Welcome Page

After login, users must see the following message exactly:

```
Welcome back <Driver Name>
```

No controls, buttons, menus, widgets, or data visualisation elements may appear on this page.

---

## ✔ 2.4 Administrator Login (Backend-Only Creation)

An administrator account may **not** be created via the registration flow.

Admin creation must only occur through backend mechanisms such as:

* Seed scripts
* Direct database updates
* Secure migration scripts

Upon login, an administrator must be redirected to:

### **Administration Console**

The page must display the following message exactly:

```
Welcome back <administrator-name>
```

No additional admin UI may exist in version 0.1.0.

---

## ✔ 2.6 LiveRC Ingestion

The LiveRC ingestion subsystem provides MRE with the ability to retrieve, normalize, and store race event data from LiveRC. This includes:

* Track catalogue - Complete catalogue of all LiveRC tracks
* Event discovery - On-demand discovery of events for a selected track within a date range
* Event data ingestion - Deep ingestion of full event details (races, drivers, results, laps) on demand
* Data storage - Long-term storage of ingested data for user analysis and visualization

All LiveRC ingestion features must follow the architecture defined in:

```
docs/architecture/liverc-ingestion/
```

See [LiveRC Ingestion Overview](../architecture/liverc-ingestion/01-overview.md) for complete architecture specification.

---

# 3. Explicitly Out of Scope (Forbidden)

The following features are **not allowed** in version 0.1.0. They may not appear in UI, backend logic, comments, placeholder pages, or database models.

These features must only appear as links that redirect to `/under-development` when part of the public landing page.

### ❌ Racing and Telemetry

* Telemetry ingestion
* Sensor data storage
* Lap analysis
* Race session parsing
* GPS or IMU data handling

### ❌ User Features

* Profile editing
* Settings
* Preferences beyond dark mode
* Notifications or emails
* Uploading data
* Setup sheets

### ❌ UI / Navigation

* Multi-page flows beyond login/registration/welcome/admin/dashboard/events/event-search/event-analysis/drivers
* Tables or charts (except for event analysis visualization)

**Note:** The following pages ARE in scope for version 0.1.0:
- Dashboard page (overview with navigation to event search)
- Events list page (browse imported events)
- Event Search page (search and import events from LiveRC)
- Event Analysis page (view and analyze event data with charts)
- Driver detail pages (view driver information and transponder overrides)

Sidebars are allowed in version 0.1.0 to support navigation on these pages.

### ❌ Backend

* Background jobs
* Queue processing
* Scheduled tasks
* Webhooks

---

# 4. Architecture Requirements

All version 0.1.0 features must follow the architecture defined in:

```
docs/architecture/mobile-safe-architecture-guidelines.md
```

This includes:

* API-first workflow
* `/api/v1/...` versioning
* Business logic inside `src/core/*`
* No business logic in UI components
* No browser-specific dependencies
* Support for future mobile clients

Failure to follow architecture rules is considered a **violation of version 0.1.0 scope**.

---

# 5. UI/UX Requirements

All version 0.1.0 screens (registration, login, welcome, admin) must follow:

* `docs/design/mre-dark-theme-guidelines.md`
* `docs/design/mre-mobile-ux-guidelines.md`
* `docs/design/mre-ux-principles.md`

This includes:

* Dark theme (default) with optional light theme toggle
* Theme toggle component allows users to switch between dark and light themes
* Theme preference persisted in localStorage
* Semantic tokens for visuals (support both dark and light themes)
* Mobile-first layouts
* Accessible form handling
* UX consistency across all screens

---

# 6. LLM Guardrails

All LLM-based agents (Cursor, Copilot, ChatGPT Coding Mode) must:

1. **Follow the version 0.1.0 feature list strictly**
2. Reject any feature request outside this spec
3. Use only `/docs/` files as references
4. Quote exact sections when validating code
5. Avoid best-practice substitution unless explicitly requested
6. Obey file boundaries, folder structures, and naming rules

---

# 7. Completion Criteria

Version 0.1.0 is considered complete when:

### ✔ Registration works

### ✔ Login works

### ✔ Admin login works

### ✔ Welcome/Dashboard page works

### ✔ Admin console works

### ✔ Events pages work (list, search, analysis)

### ✔ Driver pages work

### ✔ Dark theme applied globally

### ✔ API-first architecture validated

### ✔ Folder structure validated

### ✔ `/under-development` routing exists

### ✔ LLM guardrails are correct and enforceable

---

# 8. Future Phases (Post-0.1.0)

The following will be introduced in later phases:

* Landing page
* Navigation
* Telemetry system
* Analytics engine
* Setup sheets
* Data import/export tools
* Admin scraping workflows
* AI coach
* Pricing
* Blog
* Mobile apps

These may be described in documentation but **must never be implemented in version 0.1.0**.

---

# 9. Role Ownership

The following roles have primary responsibility for implementing and maintaining version 0.1.0 features:

* **TypeScript Domain Engineer** (`docs/roles/typescript-domain-engineer.md`): Owns business logic for registration, login, and user management in `src/core/auth/` and `src/core/users/`. Ensures all version 0.1.0 features follow mobile-safe architecture.

* **Next.js Front-End Engineer** (`docs/roles/nextjs-front-end-engineer.md`): Owns UI implementation for registration, login, welcome pages, and admin console. Ensures UI follows UX principles and design guidelines.

* **Prisma/PostgreSQL Backend Engineer** (`docs/roles/prisma-postgresql-backend-engineer.md`): Owns database schema, migrations, and data persistence for User model. Ensures all Prisma queries follow architecture rules.

* **Senior UI/UX Expert** (`docs/roles/senior-ui-ux-expert.md`): Owns UX design for all version 0.1.0 screens, ensures accessibility compliance, and maintains design system consistency.

* **Quality & Automation Engineer** (`docs/roles/quality-automation-engineer.md`): Owns test coverage for version 0.1.0 features, ensures all completion criteria (Section 7) are validated through automated tests.

* **DevOps & Platform Engineer** (`docs/roles/devops-platform-engineer.md`): Owns deployment infrastructure and environment configuration that supports version 0.1.0 features.

* **Documentation & Knowledge Steward** (`docs/roles/documentation-knowledge-steward.md`): Owns this specification document, ensures it stays current, and facilitates updates when version 0.1.0 scope changes.

All roles must coordinate to ensure version 0.1.0 features are implemented correctly and remain within scope.

---

# 10. License

Internal use only. This specification governs internal development for the version 0.1.0 release of MRE.

