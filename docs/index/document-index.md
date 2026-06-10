---
created: 2026-01-05
creator: Documentation System
lastModified: 2026-05-31
description: Comprehensive index of all documentation in the MRE repository
purpose:
  Provides a complete, directory-organized listing of every documentation file
  in the repository so contributors can discover and navigate all available
  knowledge artefacts. Verified against the actual `docs/` tree.
relatedFiles:
  - docs/README.md (curated documentation index)
  - README.md (project root entry point)
---

# MRE Documentation Index

**Last Updated:** 2026-06-10  
**Purpose:** Complete listing of all documentation files in the MRE repository.

This index is organized by directory to mirror the on-disk layout under `docs/`
(plus the package-local docs that live next to code). It is verified against the
actual file tree. For a curated, description-rich entry point, see
[docs/README.md](../README.md).

> **Documentation truth rule (see `docs/AGENTS.md`):** Normative docs (ADRs,
> architecture intent, standards, security policy) guide how work should be
> done. Descriptive docs (API reference, schema prose, user guides, ops
> runbooks, generated manifests) must match the **actual build**; when they
> disagree, the code wins and the doc is updated or marked
> planned/not-implemented.

---

## Table of Contents

- [Top-Level Entry Points](#top-level-entry-points)
- [Architecture (`docs/architecture/`)](#architecture-docsarchitecture)
- [LiveRC Ingestion Architecture (`docs/architecture/liverc-ingestion/`)](#liverc-ingestion-architecture-docsarchitectureliverc-ingestion)
- [Everlaps Ingestion (`docs/architecture/everlaps-ingestion/`)](#everlaps-ingestion-docsarchitectureeverlaps-ingestion)
- [API (`docs/api/` + generated reference)](#api-docsapi--generated-reference)
- [Database (`docs/database/`)](#database-docsdatabase)
- [Domain (`docs/domain/`)](#domain-docsdomain)
- [Design (`docs/design/`)](#design-docsdesign)
- [Development (`docs/development/`)](#development-docsdevelopment)
- [Operations (`docs/operations/`)](#operations-docsoperations)
- [Telemetry (`docs/telemetry/`)](#telemetry-docstelemetry)
- [Security (`docs/security/`)](#security-docssecurity)
- [Specifications (`docs/specs/`)](#specifications-docsspecs)
- [Standards (`docs/standards/`)](#standards-docsstandards)
- [Frontend (`docs/frontend/`)](#frontend-docsfrontend)
- [User Guides (`docs/user-guides/`)](#user-guides-docsuser-guides)
- [User Stories (`docs/user-stories/`)](#user-stories-docsuser-stories)
- [Architecture Decision Records (`docs/adr/`)](#architecture-decision-records-docsadr)
- [Roles (`docs/roles/`)](#roles-docsroles)
- [Plans (`docs/plans/`)](#plans-docsplans)
- [Implementation Plans (`docs/implimentation_plans/`)](#implementation-plans-docsimplimentation_plans)
- [Future Ideas & Feature Ideas](#future-ideas--feature-ideas)
- [Reviews (`docs/reviews/`)](#reviews-docsreviews)
- [Reports (`docs/reports/`)](#reports-docsreports)
- [Reference Material (`docs/reference_material/`)](#reference-material-docsreference_material)
- [Debug & Refactor Notes](#debug--refactor-notes)
- [Package-Local Docs (next to code)](#package-local-docs-next-to-code)

---

## Top-Level Entry Points

- [Project README](../../README.md) — Primary entry point. Version 0.1.1 scope,
  Docker-only environment rules, directory structure, utility scripts, curated
  API endpoint list, and Python ingestion service overview.
- [Curated Documentation Index (`docs/README.md`)](../README.md) —
  Description-rich navigation for the most-used docs.
- [MRE Agents Handbook (`docs/AGENTS.md`)](../AGENTS.md) — Guardrails for human
  and LLM contributors; Docker-only rules; agent domains; documentation-truth
  rule.
- [Document Index (`docs/index/document-index.md`)](document-index.md) — This
  file.

---

## Architecture (`docs/architecture/`)

- [Mobile-Safe Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md)
  — Authoritative architecture standard (API-first, `/api/v1`, `src/core` folder
  contracts, JSON envelopes, security/testing/performance rules).
- [Atomic Design System](../architecture/atomic-design-system.md) — Component
  tiers (atoms/molecules/organisms/templates), import rules, and canonical
  component paths under `src/components/`.
- [Dashboard Architecture](../architecture/dashboard-architecture.md) — Event
  selection + Event Analysis integration model and Redux-backed UI state.
- [Search Feature](../architecture/search-feature.md) — `/search` Global Search;
  `/event-search` redirect; Redux slices and persisted filters.
- [Event Search Omnibox](../architecture/event-search-omnibox.md) —
  database-only type-ahead omnibox and collapsed Filters control for the
  dashboard Event Search modal.
- [Profiles Feature](../architecture/profiles-feature.md) — Car/driver profile
  pages and APIs.
- [Event Analysis — Mains Ladder](../architecture/event-analysis-mains-ladder.md)
  — Mains Ladder bracket UX, `OverviewTab` wiring, progressed-driver tables.
- [Lap Trend Pace Heat Line](../architecture/lap-trend-pace-heat-line.md) —
  Pace-encoded lap line coloring on `LapByLapTrendChart` (single-driver mode).
  **Status:** planned.
- [Event Overview: Class Winners & LiveRC Overall Final Ranking](../architecture/event-overview-class-winners-liverc-overall-final-ranking.md)
- [Event Host/Track User Override](../architecture/event-host-track-user-override.md)
- [Event Search: Include Practice Days Design](../architecture/event-search-include-practice-days-design.md)
- [Practice Day Search Performance Design](../architecture/practice-day-search-performance-design.md)
- [Practice Day Full Ingestion Design](../architecture/practice-day-full-ingestion-design.md)
- [Practice Day Dashboard Visualization Design](../architecture/practice-day-dashboard-visualization-design.md)
- [Car Taxonomy & User Car-Type Mapping](../architecture/car-taxonomy-user-mapping.md)
- [Driver Deduplication Design](../architecture/driver-deduplication-design.md)
- [Address Normalization](../architecture/address-normalization.md)
- [Lap Annotations](../architecture/lap-annotations.md)
- [Top Qualifiers](../architecture/top-qualifiers.md)
- [Error Handling & Error Codes Catalog](../architecture/error-handling.md)
- [Performance Requirements & Benchmarks](../architecture/performance-requirements.md)
- [Logging Standards](../architecture/logging.md)
- [Rate Limiting Plan](../architecture/rate-limiting-plan.md)
- [Security Headers Plan](../architecture/security-headers-plan.md)
- [Venue Correction Deprecation](../architecture/venue-correction-deprecation.md)

---

## LiveRC Ingestion Architecture (`docs/architecture/liverc-ingestion/`)

A 31-document series covering the Python ingestion subsystem.

- [01 - Overview](../architecture/liverc-ingestion/01-overview.md)
- [02 - Connector Architecture](../architecture/liverc-ingestion/02-connector-architecture.md)
- [03 - Ingestion Pipeline](../architecture/liverc-ingestion/03-ingestion-pipeline.md)
- [04 - Data Model](../architecture/liverc-ingestion/04-data-model.md) —
  includes
  [Track catalogue flags and follow model](../architecture/liverc-ingestion/04-data-model.md#track-catalogue-flags-and-follow-model)
  (`is_active`, `is_followed`, favourites)
- [05 - API Contracts](../architecture/liverc-ingestion/05-api-contracts.md)
- [06 - Admin CLI Specification](../architecture/liverc-ingestion/06-admin-cli-spec.md)
- [07 - Ingestion State Machine](../architecture/liverc-ingestion/07-ingestion-state-machine.md)
- [08 - Ingestion Pipeline Internals](../architecture/liverc-ingestion/08-ingestion-pipeline-internals.md)
- [09 - Connector Contracts](../architecture/liverc-ingestion/09-connector-contracts.md)
- [10 - Connector Browser Strategy](../architecture/liverc-ingestion/10-connector-browser-strategy.md)
- [11 - Ingestion Error Handling](../architecture/liverc-ingestion/11-ingestion-error-handling.md)
- [12 - Ingestion Validation Rules](../architecture/liverc-ingestion/12-ingestion-validation-rules.md)
- [13 - Ingestion Performance & Scaling](../architecture/liverc-ingestion/13-ingestion-performance-and-scaling.md)
- [14 - Ingestion Idempotency Design](../architecture/liverc-ingestion/14-ingestion-idempotency-design.md)
- [15 - Ingestion Observability](../architecture/liverc-ingestion/15-ingestion-observability.md)
- [16 - Ingestion Concurrency & Locking](../architecture/liverc-ingestion/16-ingestion-concurrency-and-locking.md)
- [17 - Ingestion Security](../architecture/liverc-ingestion/17-ingestion-security.md)
- [18 - Ingestion Testing Strategy](../architecture/liverc-ingestion/18-ingestion-testing-strategy.md)
- [19 - Ingestion Fixture Management](../architecture/liverc-ingestion/19-ingestion-fixture-management.md)
- [20 - Ingestion Replay & Debugging](../architecture/liverc-ingestion/20-ingestion-replay-and-debugging.md)
- [21 - Ingestion Recovery Procedures](../architecture/liverc-ingestion/21-ingestion-recovery-procedures.md)
- [22 - Ingestion Versioning & Migrations](../architecture/liverc-ingestion/22-ingestion-versioning-and-migrations.md)
- [23 - Ingestion Cross-Connector Abstractions](../architecture/liverc-ingestion/23-ingestion-cross-connector-abstractions.md)
- [24 - Ingestion Security Hardening](../architecture/liverc-ingestion/24-ingestion-security-hardening.md)
- [25 - HTTPX Client Architecture](../architecture/liverc-ingestion/25-httpx-client-architecture.md)
- [26 - HTML Parsing Architecture](../architecture/liverc-ingestion/26-html-parsing-architecture.md)
- [27 - Web Scraping Best Practices](../architecture/liverc-ingestion/27-web-scraping-best-practices.md)
- [28 - Async Ingestion Queue](../architecture/liverc-ingestion/28-async-ingestion-queue.md)
- [29 - Pitstop Detection System (Nitro-Only)](../architecture/liverc-ingestion/29-pitstop-detection-system.md)
- [30 - Pitstop Detection Testing Strategy](../architecture/liverc-ingestion/30-pitstop-detection-testing-strategy.md)
- [31 - Recent Events Auto-Ingest](../architecture/liverc-ingestion/31-recent-events-auto-ingest.md)
  — Nightly discovery + full ingest for recent LiveRC events on followed tracks
  (implemented; gated by `MRE_RECENT_EVENTS_AUTO_INGEST_ENABLED`, default off)
- [33 - Ingestion Settings Registry and Runtime Config](../architecture/liverc-ingestion/33-ingestion-settings-registry-and-runtime-config.md)
  — **Implemented** (47 keys)
- [Admin Ingestion Settings Console](../architecture/admin-ingestion-settings-console.md)
  — **Implemented**

---

## Everlaps Ingestion (`docs/architecture/everlaps-ingestion/`)

- [00 - Preliminary Scoping and Design](../architecture/everlaps-ingestion/00-preliminary-scoping-and-design.md)
  — Exploratory scope for Everlaps as an alternate timing/event source.

---

## API (`docs/api/` + generated reference)

- [API Reference](../api/api-reference.md) — Endpoint catalog for the `/api/v1`
  surface (auth, events, races, drivers, telemetry, track-maps, profiles, car
  taxonomy, leaderboards, practice-days, personas, admin).
- [Admin Ingestion Settings API](../api/admin-ingestion-settings-api.md) —
  **Implemented** settings console contracts
- [API Versioning Strategy](../api/versioning-strategy.md) — URL path versioning
  (`/api/v1`), deprecation policy, breaking-change rules.
- [Generated Documentation Inventory](../reference/generated/README.md) — How
  the machine-generated manifests are produced (`npm run docs:inventory`).
  - `docs/reference/generated/api-routes.manifest.json` — Canonical list of all
    API routes + HTTP methods (regenerate in the app container).
  - `docs/reference/generated/component-files.manifest.json` — Canonical list of
    `src/components/` files.

---

## Database (`docs/database/`)

- [Database Schema Documentation](../database/schema.md) — Human-readable
  overview of all Prisma models and enums, relationships, indexes, and
  lifecycle. Source of truth is
  [`prisma/schema.prisma`](../../prisma/schema.prisma).

---

## Domain (`docs/domain/`)

- [Racing Classes Domain Model](../domain/racing-classes.md)
- [Triple A-Main Overall Scoring (IFMAR & ROAR)](../domain/triple-a-main-scoring.md)
- [Bump-ups Inference](../domain/bump-ups-inference.md)
- [LiveRC Qual Points (`view_points`) Explainer](../domain/liverc-qual-points-view-explainer.md)

---

## Design (`docs/design/`)

- [MRE UX Principles](../design/mre-ux-principles.md)
- [MRE Dark Theme Guidelines](../design/mre-dark-theme-guidelines.md)
- [MRE Personas](../design/mre-personas.md)
- [MRE Hero Image Generation](../design/mre-hero-image-generation.md)
- [Chart Design Standards](../design/chart-design-standards.md)
- [Navigation Patterns](../design/navigation-patterns.md)
- [Table Component Specification](../design/table-component-specification.md)
- [Event Analysis Table Surfaces](../design/event-analysis-table-surfaces.md)
- [Event Analysis Weather Card Design](../design/event-analysis-weather-card-design.md)
- [Compact Label-Value Card](../design/compact-label-value-card.md)
- [Form Patterns](../design/form-patterns.md)
- [Standard Form Field Width](../design/standard-form-field-width.md)
- [Telemetry Visualization Specification](../design/telemetry-visualization-specification.md)

---

## Development (`docs/development/`)

- [Developer Quick Start](../development/quick-start.md)
- [Contributing Guidelines](../development/CONTRIBUTING.md)
- [Testing Strategy & Guidelines](../development/testing-strategy.md)
- [Integration Testing Guide](../development/integration-testing-guide.md)
- [CHANGELOG](../development/CHANGELOG.md)
- [CHANGELOG Guide](../development/CHANGELOG_GUIDE.md)
- [Component Creation Checklist](../development/COMPONENT_CREATION_CHECKLIST.md)
- [Flexbox Layout Checklist](../development/FLEXBOX_LAYOUT_CHECKLIST.md)
- [Pagination Component Template](../development/PAGINATION_COMPONENT_TEMPLATE.md)
- [Pagination Spacing Guidelines](../development/PAGINATION_SPACING_GUIDELINES.md)
- [Mobile UI Removal Summary](../development/mobile-ui-removal-summary.md)
- [Speed Test (Event vs Practice Search)](../development/speed-test-search.md)
- [SSL Certificates for Development](../../certs/README.md)

---

## Operations (`docs/operations/`)

- [Docker User Guide](../operations/docker-user-guide.md)
- [Build & Runtime Reference (Compose)](../operations/build-runtime-reference.md)
  — Inventory of all Compose services (`postgres`, `app`, `clickhouse`,
  `liverc-ingestion-service`, `telemetry-worker`), ports, and volumes.
- [Environment Variables Reference](../operations/environment-variables.md)
- [Deployment & DevOps Runbook](../operations/deployment-guide.md)
- [Monitoring & Observability Guide](../operations/observability-guide.md)
- [LiveRC Operations Guide](../operations/liverc-operations-guide.md)
- [Recent Events Auto-Ingest Runbook](../operations/recent-events-auto-ingest-runbook.md)
- [Admin Ingestion Settings Runbook](../operations/admin-ingestion-settings-runbook.md)
  — **Implemented**
- [Pitstop Detection Runbook](../operations/pitstop-detection-runbook.md)

---

## Telemetry (`docs/telemetry/`)

- [Telemetry Documentation Index](../telemetry/README.md)

### Design (`docs/telemetry/Design/`)

- [API Contract — Telemetry](../telemetry/Design/API_Contract_Telemetry.md)
- [Architecture Blueprint — Ingest/Storage/Compute/Query](../telemetry/Design/Architecture_Blueprint_Telemetry_Ingest_Storage_Compute_Query.md)
- [GNSS + IMU Fusion Blueprint](../telemetry/Design/Gnss_plus_Imu_Fusion_Blueprint.md)
- [Lap Segment and Corner Detection Specification](../telemetry/Design/Lap%20Segment%20and%20Corner%20Detection%20Specification.md)
- [Operational Runbook](../telemetry/Design/Operational%20Runbook.md)
- [Performance Plan and Benchmarking](../telemetry/Design/Performance%20Plan%20and%20Benchmarking.md)
- [Security, Privacy, Retention and Deletion](../telemetry/Design/Security%20Privacy%20Retention%20and%20Deletion.md)
- [Supported Formats and Parser Specification](../telemetry/Design/Supported%20Formats%20and%20Parser%20Specification.md)
- [Concrete Data Model and Contracts](../telemetry/Design/Telemetry%20-%20Concrete%20Data%20Model%20And%20Contracts.md)
- [Processing Pipeline, Job Orchestration and State Machine](../telemetry/Design/Telemetry%20Processing%20Pipeline%20Job%20Orchestration%20and%20State%20Machine.md)
- [Telemetry Implementation Design](../telemetry/Design/Telemetry_Implementation_Design.md)
- [Telemetry Import UX Design](../telemetry/Design/Telemetry_Import_UX_Design.md)
- [Telemetry MVP Implementation Decisions](../telemetry/Design/Telemetry_MVP_Implementation_Decisions.md)
- [Telemetry Seed Data Guide](../telemetry/Design/Telemetry_Seed_Data_Guide.md)
- [Telemetry UX Blueprint](../telemetry/Design/Telemetry_Ux_Blueprint.md)
- [Test Strategy and Synthetic Datasets](../telemetry/Design/Test%20Strategy%20and%20Synthetic%20Datasets.md)
- [Trust, Quality Scoring and Honesty Rules](../telemetry/Design/Trust%20Quality%20Scoring%20and%20Honesty%20Rules.md)

### User Story & End-User Experience

- [User Story — Universal Telemetry Import & Analysis (GNSS + IMU)](../telemetry/User_Story/User_Story_Universal_Telemetry_Import_and_Analysis_%28GNSS_%2B_IMU%29.md)
- [Exploring the End-User Experience for Telemetry](../telemetry/End_User_Experience/Exploring_the_End_User_Experience_for_Telemetry_in_MRE.md)

### Telemetry Reviews

- [Telemetry Documentation Deep Review (2026-02-13)](../telemetry/reviews/telemetry-documentation-deep-review-2026-02-13.md)
- [Telemetry Design Review](../telemetry/reviews/telemetry_design_review.md)
- [Gaps and Recommended Additions (archived)](../telemetry/reviews/Old/Gaps%20And%20Recommended%20Additions.md)

---

## Security (`docs/security/`)

- [Security Overview](../security/security-overview.md) — Authentication
  (Argon2id), authorization, session management, API security, data protection,
  security headers.

---

## Specifications (`docs/specs/`)

- [MRE Version 0.1.1 Feature Scope](../specs/mre-v0.1-feature-scope.md)
- [MRE Under Development Page Specification](../specs/mre-under-development-page.md)

---

## Standards (`docs/standards/`)

- [Standards Index](../standards/README.md)
- [File Headers and Code Commenting Guidelines](../standards/file-headers-and-commenting-guidelines.md)
- [TypeScript & React Style Guide](../standards/typescript-react-style-guide.md)

---

## Frontend (`docs/frontend/`)

- [Component Catalog](../frontend/component-catalog.md) — Machine-generated
  inventory of every production file under `src/components/`. Regenerate with
  `docker exec -it mre-app npm run docs:component-catalog`.
- [LiveRC User Workflow](../frontend/liverc/user-workflow.md)
- [LiveRC Event Search & Analysis User Stories](../frontend/liverc/event-search-and-analysis-user-stories.md)

---

## User Guides (`docs/user-guides/`)

These guides mirror the in-app `/guides/*` routes.

- [User Guides Index](../user-guides/README.md)
- [Getting Started](../user-guides/getting-started.md)
- [Navigation](../user-guides/navigation.md)
- [Account Management](../user-guides/account-management.md)
- [Event Search (Find Events modal)](../user-guides/event-search.md)
- [Global Search (`/search`)](../user-guides/global-search.md)
- [Event Analysis](../user-guides/event-analysis.md)
- [My Event Analysis (Dashboard)](../user-guides/dashboard.md)
- [Car Type Mapping](../user-guides/car-type-mapping.md)
- [Driver Features](../user-guides/driver-features.md)
- [Troubleshooting](../user-guides/troubleshooting.md)
- [Admin: Ingestion Settings](../user-guides/admin-ingestion-settings.md) —
  **Implemented** (admin-only)
- [User Guide Images](../user-guides/images/README.md)

---

## User Stories (`docs/user-stories/`)

- [User Stories Index](../user-stories/README.md)
- [Authentication Epic](../user-stories/authentication.md)
- [User Management Epic](../user-stories/user-management.md)
- [Administrator Epic](../user-stories/admin.md)
- [LiveRC Integration Epic](../user-stories/liverc-integration.md)
- [System Epic](../user-stories/system.md)
- [User Journeys](../user-stories/user-journeys.md)
- [Future Features](../user-stories/future-features.md)
- [Non-Functional Requirements](../user-stories/non-functional-requirements.md)

---

## Architecture Decision Records (`docs/adr/`)

- [ADR Index and Guidelines](../adr/README.md)
- [ADR-20250127 — Adopt Mobile-Safe Architecture](../adr/ADR-20250127-adopt-mobile-safe-architecture.md)
- [ADR-20251228 — Allow Sidebar Navigation](../adr/ADR-20251228-allow-sidebar-navigation.md)
- [ADR-20260131 — Telemetry Identifier Strategy](../adr/ADR-20260131-telemetry-identifier-strategy.md)
- [ADR-20260131 — Telemetry Storage and Raw Retention](../adr/ADR-20260131-telemetry-storage-and-raw-retention.md)
- [ADR-20260203 — Time-Series Parquet Canonical + ClickHouse Cache](../adr/ADR-20260203-time-series-parquet-canonical-clickhouse-cache.md)
- [ADR-20260404 — Bump-ups Inferred from Results](../adr/ADR-20260404-bump-ups-inferred-from-results.md)
- [ADR-20260405 — Bump-ups LiveRC Heat Sheet Ladder Strategy](../adr/ADR-20260405-bump-ups-liveRC-heat-sheet-ladder-strategy.md)
- [ADR-20260531 — Scheduled Recent Events Auto-Ingest](../adr/ADR-20260531-scheduled-recent-events-auto-ingest.md)
- [ADR-20260601 — Event Search Omnibox (Database-Only)](../adr/ADR-20260601-event-search-omnibox-db-only.md)
- [ADR-20260608 — Admin Ingestion Settings Console](../adr/ADR-20260608-admin-ingestion-settings-console.md)
  — **Accepted**

---

## Roles (`docs/roles/`)

- [DevOps & Platform Engineer](../roles/devops-platform-engineer.md)
- [Documentation & Knowledge Steward](../roles/documentation-knowledge-steward.md)
- [Next.js Front-End Engineer](../roles/nextjs-front-end-engineer.md)
- [Observability & Incident Response Lead](../roles/observability-incident-response-lead.md)
- [Prisma/PostgreSQL Backend Engineer](../roles/prisma-postgresql-backend-engineer.md)
- [Quality & Automation Engineer](../roles/quality-automation-engineer.md)
- [Senior UI/UX Expert](../roles/senior-ui-ux-expert.md)
- [TypeScript Domain Engineer](../roles/typescript-domain-engineer.md)

---

## Plans (`docs/plans/`)

- [Bump-ups Feature Spec](../plans/bump-ups-feature-spec.md)
- [Bump-ups LiveRC Main Events Solution](../plans/bump-ups-liverc-main-events-solution.md)
- [Bump-ups Test Plan](../plans/bump-ups-test-plan.md)
- [Bump-ups UX Surfacing](../plans/bump-ups-ux-surfacing.md)
- [Event Analysis UI Implementation Plan](../plans/event-analysis-ui-implementation-plan.md)
- [Pitstop Detection Implementation Plan](../plans/pitstop-detection-implementation-plan.md)

---

## Implementation Plans (`docs/implimentation_plans/`)

> The folder name retains its historical spelling (`implimentation_plans`).

- [Implementation Plans Index](../implimentation_plans/README.md)
- [Analysis Card Collapse + Mini Chart (2026-05)](../implimentation_plans/analysis-card-collapse-mini-chart-2026-05.md)
- [Application Performance Remediation (2026-03)](../implimentation_plans/application-performance-remediation-2026-03.md)
- [Event Host/Track Override (2026-04)](../implimentation_plans/event-host-track-override-2026-04.md)
- [Recent Events Auto-Ingest (2026-05)](../implimentation_plans/recent-events-auto-ingest-2026-05.md)
- [Admin Ingestion Settings Console (2026-06)](../implimentation_plans/admin-ingestion-settings-console-2026-06.md)
  — **Implemented**
- [Admin Ingestion Settings Checklist](../implimentation_plans/admin-ingestion-settings-console-checklist.md)
  — task tracker (Phases 1–4 complete)
- [Event Search Omnibox (2026-06)](../implimentation_plans/event-search-omnibox-2026-06.md)
- [Telemetry Implementation Plan](../implimentation_plans/telemetry-implementation-plan.md)
- [Top Qualifiers (2026-04)](../implimentation_plans/top-qualifiers-2026-04.md)
- [Lap Trend Pace Heat Line (2026-06)](../implimentation_plans/lap-trend-pace-heat-line-2026-06.md)
- [Lap Trend Pace Heat Line Checklist](../implimentation_plans/lap-trend-pace-heat-line-checklist.md)

---

## Future Ideas & Feature Ideas

- [Future Ideas Index](../future-ideas/README.md)
- [Event Series Linking](../future-ideas/event-series-linking.md)
- [Graph-Based Race Replay](../future-ideas/graph-based-race-replay.md)
- [Lap Trend Pace Analysis Follow-Ons](../future-ideas/lap-trend-pace-analysis-follow-ons.md)
- [Top Qualifiers and Seeding Rounds](../future-ideas/top-qualifiers-and-seeding-rounds.md)
- [Feature Ideas (scratchpad)](../feature_ideas/feature_ideas.md)

---

## Reviews (`docs/reviews/`)

- [Reviews Working Notes](../reviews/review.md)
- [Application Performance Review (2026-03, archived)](../reviews/Old/application-performance-review-2026-03.md)

---

## Reports (`docs/reports/`)

Automated track-synchronisation reports produced by the ingestion cron job (one
per run). The directory currently holds daily reports for **May 2026**
(`track-sync-2026-05-01-*` … `track-sync-2026-05-30-*`). Retention is governed
by `TRACK_SYNC_REPORT_RETENTION_DAYS` (default 30). These are generated
artefacts — do not edit by hand.

---

## Reference Material (`docs/reference_material/`)

Captured upstream HTML samples and external rule references used for parser
development and testing.

- [1/8 Nitro Off-Road Bump-Up Rules](../reference_material/Racing%20Rules%20and%20Regulations/1-8-nitro-off-road-bump-up-rules.md)
- LiveRC HTML samples under `docs/reference_material/liverc/` (event detail,
  track catalogue/listing, dashboards, A/B-main results, practice sessions,
  entry lists). Used as fixtures/reference for parser maintenance.
- Everlaps full event dump under `docs/reference_material/Everlaps/`.
- Track photos under `docs/reference_material/Canberra Track Photos/`.

---

## Debug & Refactor Notes

- [Vehicle Type Save Debug Report](../debug/vehicle-type-save-debug-report.md)
- [Event Details UI/UX Refactor Notes](../eventDetailsUIUXRefactor/README.md)
  (with reference mockup images).

---

## Package-Local Docs (next to code)

These operational READMEs live next to code and link back to `docs/` for full
specifications.

- [Ingestion Service README](../../ingestion/README.md)
- [Parser Implementation Status](../../ingestion/PARSER_IMPLEMENTATION_STATUS.md)
- [LiveRC Parser CSS Selector Reference](../../ingestion/connectors/liverc/PARSER_SELECTORS.md)
- [SSL Certificates README](../../certs/README.md)

---

## Maintenance

This index is maintained by the **Documentation & Knowledge Steward** role. When
adding, renaming, or removing documentation:

1. Add/adjust the entry in the appropriate directory section above.
2. Keep the listing aligned with the actual `docs/` tree (the code/file tree is
   the source of truth).
3. Update this index's `lastModified` date.
4. Ensure the document follows the file-header standards.

---

**End of Document Index**
