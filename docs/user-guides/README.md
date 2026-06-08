---
created: 2026-01-27
creator: Jayson Brenton
lastModified: 2026-06-08
description: Index of all end-user guides for My Race Engineer
purpose:
  Central directory for Markdown user documentation that mirrors the SPA guide
  surfaces under `/guides/*`, with links into supporting architecture notes.
relatedFiles:
  - docs/index/document-index.md
  - src/app/(authenticated)/guides/page.tsx
  - docs/user-guides/images/README.md
---

# User guides index

Welcome! These Markdown files track the **Alpha · v0.1.0** experience (see
authenticated footer). In-app cards at `/guides` stay textually aligned—update
both when changing high-level marketing copy.

Screenshots live in [`images/`](./images/) and are embedded throughout the
guides; see [`images/README.md`](./images/README.md) for refresh tips.

## Featured guides

| Guide                                                | Highlights                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [Getting started](getting-started.md)                | Register/login redirects, rails overview, Guides landing                                                |
| [Account management](account-management.md)          | Profile modal densities/themes, signup validation                                                       |
| [Navigation](navigation.md)                          | Adaptive rail taxonomy, telemetry / car / driver profiles, Track Maps, breadcrumbs, **My Events** latch |
| [Global Search](global-search.md)                    | `/search` keyword + session lookup, pagination, **View Event** deep links                               |
| [Event Search (Find Events modal)](event-search.md)  | Omnibox, Filters popover, LiveRC discovery, import, status filters, cross-track browse                  |
| [My Event Analysis (dashboard shell)](dashboard.md)  | Redux selection, ingestion drawers, shortcuts                                                           |
| [Event Analysis (tabs + subtabs)](event-analysis.md) | Race vs Practice layouts, submenu analytics                                                             |
| [Car type mapping](car-type-mapping.md)              | Account-wide taxonomy rules surfaced via **Actions**                                                    |
| [Driver features](driver-features.md)                | Fuzzy confirmations, personas, API touchpoints                                                          |
| [Troubleshooting](troubleshooting.md)                | Deterministic triage aligned with ingestion stack                                                       |

### For administrators

| Guide                                                     | Highlights                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| [Ingestion settings (admin)](admin-ingestion-settings.md) | Runtime config console at `/admin/ingestion/settings`, site policy JSON |

### For new racers (suggested reading order)

1. [Getting started](getting-started.md)
2. [Navigation](navigation.md)
3. [Event Search](event-search.md) (Find Events modal) or
   [Global Search](global-search.md)
4. [My Event Analysis](dashboard.md) + [Event Analysis](event-analysis.md)
5. [Driver features](driver-features.md)

### Companion documentation

| Doc                                                                                                  | Relationship                                |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [`docs/specs/mre-v0.1-feature-scope.md`](../specs/mre-v0.1-feature-scope.md)                         | Formal scope vs aspirational backlog        |
| [`docs/architecture/dashboard-architecture.md`](../architecture/dashboard-architecture.md)           | Engineering view of Redux & widgets         |
| [`docs/architecture/event-analysis-mains-ladder.md`](../architecture/event-analysis-mains-ladder.md) | Mains Ladder bracket + progressed-driver UX |
| [`docs/frontend/liverc/user-workflow.md`](../frontend/liverc/user-workflow.md)                       | Connector-level narrative                   |

## Feedback & maintenance

Markdown is truth for offline reviewers; SPA cards should stay consistent. Bump
front-matter **`lastModified`** dates whenever behaviour changes materially.

Prefer attaching fresh screenshots alongside textual edits so onboarding stays
faithful across theme tweaks.
