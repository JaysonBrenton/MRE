---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2026-05-31
description: Central index and navigation for all MRE project documentation
purpose:
  Provides a comprehensive index of all documentation in the MRE project,
  organized by category with brief descriptions and cross-references. This
  document serves as the entry point for discovering and navigating all project
  documentation.
relatedFiles:
  - README.md (project root)
  - docs/roles/documentation-knowledge-steward.md
---

# MRE Documentation Index

This document provides a **curated** index of the most-used documentation in the
My Race Engineer (MRE) project. Use this as your starting point for discovering
and navigating project documentation. For an exhaustive, directory-organized
listing of **every** document, see the
[full Document Index](index/document-index.md).

---

## Quick Navigation

- [Architecture](#architecture)
- [API Documentation](#api-documentation)
- [Database](#database)
- [Design](#design)
- [Development](#development)
- [Operations](#operations)
- [Security](#security)
- [Specifications](#specifications)
- [Future Ideas](#future-ideas)
- [Architecture Decision Records (ADRs)](#architecture-decision-records-adrs)
- [Role Documentation](#role-documentation)
- [Standards](#standards)
- [Reviews](#reviews)
- [Frontend](#frontend)

---

## Architecture

Core architectural guidelines and principles that govern the entire codebase.

### [Mobile-Safe Architecture Guidelines](architecture/mobile-safe-architecture-guidelines.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

**Authoritative architecture standard** for the MRE application. Defines the
complete architectural framework ensuring the system is mobile-safe, API-first,
and future-native for iOS/Android clients. All code must follow these
guidelines.

**Key Topics:** API-first backend, separation of UI and business logic, folder
structure, database rules, authentication, desktop UI architecture, performance
requirements.

**Related:** See
[Role Responsibilities](architecture/mobile-safe-architecture-guidelines.md#13-role-responsibilities)
section for role ownership.

### [LiveRC Ingestion Architecture](architecture/liverc-ingestion/01-overview.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Comprehensive architecture documentation for the LiveRC ingestion subsystem.
This subsystem provides MRE with the ability to retrieve, normalize, and store
race event data from LiveRC. **Status:** This subsystem is in scope for version
0.1.1 release (see
[MRE Version 0.1.1 Feature Scope](specs/mre-v0.1-feature-scope.md)).

**Key Topics:** Connector architecture, ingestion pipeline, data model, API
contracts, admin CLI, state machine, error handling, validation, performance,
idempotency, observability, security, testing, fixture management,
replay/debugging, recovery procedures, versioning, cross-connector abstractions.

**Document Series:** This is a 31-document series covering all aspects of the
ingestion system:

- [01 - Overview](architecture/liverc-ingestion/01-overview.md)
- [02 - Connector Architecture](architecture/liverc-ingestion/02-connector-architecture.md)
- [03 - Ingestion Pipeline](architecture/liverc-ingestion/03-ingestion-pipeline.md)
- [04 - Data Model](architecture/liverc-ingestion/04-data-model.md)
- [05 - API Contracts](architecture/liverc-ingestion/05-api-contracts.md)
- [06 - Admin CLI Specification](architecture/liverc-ingestion/06-admin-cli-spec.md)
- [31 - Recent Events Auto-Ingest](architecture/liverc-ingestion/31-recent-events-auto-ingest.md) -
  Planned nightly discovery and full ingest for recent LiveRC events (followed
  tracks, date window, caps)
- [33 - Ingestion Settings Registry](architecture/liverc-ingestion/33-ingestion-settings-registry-and-runtime-config.md)
  — **Implemented** canonical registry (47 keys) for admin console
- [Admin Ingestion Settings Console](architecture/admin-ingestion-settings-console.md)
  — **Implemented** admin UI at `/admin/ingestion/settings`
- [29 - Pitstop Detection System (Nitro-Only)](architecture/liverc-ingestion/29-pitstop-detection-system.md) -
  Race-length-aware nitro pit detection design, pit-time estimates, and strategy
  inference
- [30 - Pitstop Detection Testing Strategy](architecture/liverc-ingestion/30-pitstop-detection-testing-strategy.md) -
  Fixture-first validation across 7/10/30/60-minute races and false-positive
  controls
- [27 - Web Scraping Best Practices](architecture/liverc-ingestion/27-web-scraping-best-practices.md) -
  Comprehensive guide to robots.txt compliance, rate limiting, User-Agent
  policy, HTTP caching, retry logic, and kill switch mechanism
- [07-26 - Additional technical specifications](architecture/liverc-ingestion/)

**Related:** See
[MRE Version 0.1.1 Feature Scope](specs/mre-v0.1-feature-scope.md) for version
0.1.1 feature specifications. See
[Mobile-Safe Architecture Guidelines](architecture/mobile-safe-architecture-guidelines.md)
for overall architecture principles.

### [Error Handling and Error Codes Catalog](architecture/error-handling.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Comprehensive error handling documentation including error codes, error response
formats, HTTP status mappings, and error handling patterns. Provides guidance
for consistent error handling across the application.

**Key Topics:** Standard error response format, error code catalog, error
handling patterns, client-side and server-side error handling, error logging,
user-facing vs technical errors.

**Related:** See [API Reference](api/api-reference.md) for API error
documentation. See
[LiveRC Ingestion Error Handling](architecture/liverc-ingestion/11-ingestion-error-handling.md)
for ingestion-specific errors.

### [Performance Requirements and Benchmarks](architecture/performance-requirements.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Performance requirements and benchmarks for the MRE application. Defines
performance goals, performance budgets, database performance requirements, API
response time targets, and optimization guidelines.

**Key Topics:** Performance goals, performance budgets, database performance
requirements, API response time targets, load testing, performance monitoring,
optimization guidelines, scalability considerations.

**Related:** See
[Mobile-Safe Architecture Guidelines](architecture/mobile-safe-architecture-guidelines.md)
for performance rules. See
[Ingestion Performance and Scaling](architecture/liverc-ingestion/13-ingestion-performance-and-scaling.md)
for ingestion performance.

### [Observability Platform Architecture](architecture/observability-platform.md)

**Status:** Normative (proposed)  
**Last Updated:** 2026-06-07

Target observability stack for final release: OpenTelemetry instrumentation,
third-party SaaS (Datadog default), Docker agent model, correlation, and
migration from Alpha console/DB logging.

**Related:** [Logging Architecture](architecture/logging.md),
[ADR-20260607](adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md),
[Implementation Plan](implimentation_plans/observability-platform-remediation-2026-06.md).

### [Logging Architecture](architecture/logging.md)

**Status:** Alpha (migrating)  
**Last Updated:** 2026-06-07

Next.js structured logging, client logger, request context, ApplicationLog
persistence, and cross-service guidelines.

### [Car taxonomy and user car-type mapping](architecture/car-taxonomy-user-mapping.md)

**Status:** Complete  
**Last Updated:** 2026-04-07

Per-user global rules that map LiveRC class names, race titles, and related
strings to **canonical vehicle classes** for Session Analysis. Covers data
model, migrations, APIs, resolution order, UI entry point (**Map car types**),
and Docker operational notes.

**Related:** [Database schema – CarTaxonomyNode](database/schema.md),
[API Reference – car-taxonomy endpoints](api/api-reference.md).

### [Event Analysis — mains ladder (bracket UX)](architecture/event-analysis-mains-ladder.md)

**Status:** Active  
**Last Updated:** 2026-05-19

Defines the shipped **Event Level Analysis → Mains Ladder** bracket panel (SVG
diagram, **Drivers who progressed from earlier rounds** tables), how it nests
inside `OverviewTab`, and how Bump-Up inference / driver-progression matrices
relate engineering-wise.

### [Lap trend pace heat line](architecture/lap-trend-pace-heat-line.md)

**Status:** Planned  
**Last Updated:** 2026-06-10

Normative design for **Pace heat line** on `LapByLapTrendChart`: when one driver
is selected, optional Display toggle colors the lap trace by delta to personal
best (green through red). Implementation:
[lap-trend-pace-heat-line-2026-06.md](implimentation_plans/lap-trend-pace-heat-line-2026-06.md).
User guide:
[event-analysis.md](user-guides/event-analysis.md#pace-heat-line-single-driver).

---

## API Documentation

API reference documentation and versioning strategy.

### [API Reference](api/api-reference.md)

**Status:** Complete  
**Last Updated:** 2025-01-29

Complete API reference documentation for all MRE API endpoints. Provides
comprehensive catalog of endpoints, request/response formats, authentication
requirements, error codes, and usage examples.

**Key Topics:** Authentication endpoints, LiveRC ingestion endpoints, health
check, error handling, authentication requirements, rate limiting, API
versioning.

**Related:** See
[Mobile-Safe Architecture Guidelines](architecture/mobile-safe-architecture-guidelines.md)
for API standards. See [Error Handling](architecture/error-handling.md) for
error handling details.

### [API Versioning Strategy](api/versioning-strategy.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

API versioning strategy and deprecation policy. Defines versioning approach,
when to create new versions, deprecation timeline, breaking change policy, and
migration guide.

**Key Topics:** URL path versioning, deprecation timeline, breaking change
policy, backward compatibility, version migration guide, version lifecycle.

**Related:** See [API Reference](api/api-reference.md) for current API
endpoints. See
[Mobile-Safe Architecture Guidelines](architecture/mobile-safe-architecture-guidelines.md)
for API versioning standards.

---

## Database

Database schema and data model documentation.

### [Database Schema Documentation](database/schema.md)

**Status:** Complete  
**Last Updated:** 2026-04-07

Human-readable database schema documentation. Provides comprehensive overview of
all models, relationships, indexes, constraints, and business rules. Essential
reference for developers understanding the data model.

**Key Topics:** Entity relationship diagram, models (User, Track, Event, Race,
RaceDriver, RaceResult, Lap, `CarTaxonomyNode`, `UserCarTaxonomyRule`), enums,
indexes, relationships, data lifecycle, common query patterns, performance
considerations.

**Related:** See [Prisma Schema](../prisma/schema.prisma) for source of truth.
See
[LiveRC Ingestion Data Model](architecture/liverc-ingestion/04-data-model.md)
for ingestion-specific models. See
[Car taxonomy and user car-type mapping](architecture/car-taxonomy-user-mapping.md)
for per-user vehicle-class mapping.

---

## Domain

Domain models and business logic documentation.

### [Racing Classes Domain Model](domain/racing-classes.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Authoritative domain model for racing classes in the MRE application. Defines
the complete taxonomy of car classes (vehicle types), modification rules
(Modified/Stock), and skill groupings (Junior/Pro/Expert). Essential reference
for understanding what racing classes mean in the MRE domain and how they are
extracted from LiveRC data.

**Key Topics:** Car classes (1/8 buggy, 1/8 truggy, 1/10 2WD/4WD), modification
rules (Modified vs Stock), skill groupings, class name extraction, database
storage, future normalization considerations.

**Related:** See [Database Schema Documentation](database/schema.md) for
`Race.className` field. See
[LiveRC Ingestion Data Model](architecture/liverc-ingestion/04-data-model.md)
for data model specification.

### [Bump-ups inference](domain/bump-ups-inference.md)

**Status:** Active  
**Last Updated:** 2026-04-04

Defines bump-ups as observed advancement from ingested results (not
sanctioning-body rules), the LiveRC Main Events schedule model, LCQ and
multi-strategy tier notes. Links to product spec, technical solution plan, and
ADRs **ADR-20260404**, **ADR-20260405**.

**Related:**
[Bump-ups LiveRC Main Events solution](plans/bump-ups-liverc-main-events-solution.md).

### [LiveRC Qual Points page (view_points) explainer](domain/liverc-qual-points-view-explainer.md)

**Status:** Reference  
**Last Updated:** 2026-05-20

How to read LiveRC **Qual Points** (`view_points`) pages: **best N of M**,
IFMAR-style **Result** totals, `points : laps/time` cells (elapsed time, not avg
lap), tie-breaker cell layout, DNS/DNF. Includes **2025 RCRA Nationals** Buggy
(**best 3 of 5**) and a full-field table + tie examples. Descriptive of LiveRC,
not normative MRE product logic; complements
[Top qualifiers (TQ)](architecture/top-qualifiers.md).

---

## Design

Visual design, UX principles, and user experience guidelines.

### [MRE UX Principles](design/mre-ux-principles.md)

**Status:** Complete  
**Last Updated:** 2025-01-29

Mandatory User Experience principles for all MRE version 0.1.1 features. Defines
core UX philosophy, laws of UX, foundational layout rules, form patterns,
content rules, and mobile-specific requirements.

**Key Topics:** Jakob's Law, Fitts's Law, single-column layouts, form
validation, error handling, mobile-first design.

**Related:** See
[Role Responsibilities](design/mre-ux-principles.md#12-role-responsibilities)
section for UX role ownership.

### [MRE Dark Theme Guidelines](design/mre-dark-theme-guidelines.md)

**Status:** Complete  
**Last Updated:** 2025-01-29

Visual standards and token system for MRE dark theme implementation. Defines
semantic token naming (`--token-*`), core dark theme rules, typography, spacing,
forms, and mobile requirements.

**Key Topics:** Token naming convention, contrast ratios, layered surfaces,
typography rules, spacing scale, form styling.

### MRE Mobile UX Guidelines (removed)

**Status:** Removed  
**Note:** The application is now desktop-only for UI. The former mobile UX
guidelines document no longer exists; see
[MRE UX Principles](design/mre-ux-principles.md) for current UX guidance and
[Mobile UI Removal Summary](development/mobile-ui-removal-summary.md) for the
migration record.

### [MRE Hero Image Generation](design/mre-hero-image-generation.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Standards and prompts for generating MRE hero images using AI tools. Defines
visual style, composition rules, Stable Diffusion prompt structure, and image
output requirements.

**Key Topics:** Visual style guidelines, prompt templates, negative prompts,
image format requirements, licensing rules.

**Note:** Active but not implemented in Alpha UI.

---

## Development

Development guides, testing strategies, and contributing guidelines.

### [Developer Quick Start Guide](development/quick-start.md)

**Status:** Complete  
**Last Updated:** 2026-05-16

Step-by-step developer onboarding guide. Provides prerequisites, setup
instructions, first-time workflow, running tests, useful commands, common setup
issues, and IDE recommendations.

**Key Topics:** Prerequisites, initial setup, running the application,
first-time developer workflow, running tests, useful commands, troubleshooting,
IDE recommendations.

**Related:** See [README.md](../README.md) for project overview. See
[Environment Variables Reference](operations/environment-variables.md) for
configuration.

### [Testing Strategy and Guidelines](development/testing-strategy.md)

**Status:** Complete  
**Last Updated:** 2026-05-16

Comprehensive testing strategy for the MRE application. Defines testing pyramid,
testing tools, test organization, testing patterns, frontend/backend/integration
testing guidelines, and CI/CD requirements.

**Key Topics:** Testing pyramid, testing tools (pytest, Vitest), test
organization, testing patterns, frontend testing, backend testing, integration
testing, test coverage requirements, CI/CD testing.

**Related:** See
[Ingestion Testing Strategy](architecture/liverc-ingestion/18-ingestion-testing-strategy.md)
for ingestion-specific testing. See
[Integration Testing Guide](development/integration-testing-guide.md) for
detailed integration testing.

### [Integration Testing Guide](development/integration-testing-guide.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Detailed integration testing guide. Provides guidance for integration test
setup, test data management, mocking strategies, database testing, API
integration testing, and CI/CD integration.

**Key Topics:** Integration test setup, test data management, mocking external
services, database testing strategies, API integration testing, end-to-end
testing, CI/CD integration testing.

**Related:** See [Testing Strategy](development/testing-strategy.md) for overall
testing approach. See [Contributing Guidelines](development/CONTRIBUTING.md) for
testing requirements.

### [Contributing Guidelines](development/CONTRIBUTING.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Comprehensive contributing guidelines for the MRE project. Includes code of
conduct, development workflow, branch naming, commit messages, pull request
process, code review guidelines, testing requirements, and release process.

**Key Topics:** Code of conduct, development workflow, branch naming
conventions, commit message guidelines, pull request process, code review
guidelines, testing requirements, documentation requirements, release process.

**Related:** See [Quick Start Guide](development/quick-start.md) for setup. See
[File Headers Standards](standards/file-headers-and-commenting-guidelines.md)
for code standards.

### [CHANGELOG](development/CHANGELOG.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Changelog template following Keep a Changelog format. Documents all notable
changes to the MRE project, organized by version with categories for Added,
Changed, Deprecated, Removed, Fixed, and Security.

**Key Topics:** Version history, change categories, release notes format.

**Related:** See [API Versioning Strategy](api/versioning-strategy.md) for API
versioning. See [Contributing Guidelines](development/CONTRIBUTING.md) for
release process.

### [Implementation plans (`docs/implimentation_plans/`)](implimentation_plans/README.md)

**Status:** Active  
**Last Updated:** 2026-05-16

Index for time-bound implementation and remediation plans. Explains directory
scope and the historical spelling of the folder name (`implimentation_plans`).

---

## Specifications

Feature specifications and requirements for the version 0.1.1 release.

### [MRE Version 0.1.1 Feature Scope](specs/mre-v0.1-feature-scope.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

**Authoritative specification** for the strict, locked-down feature set for the
MRE Version 0.1.1 Release. Defines allowed features (registration, login,
welcome pages, admin console, LiveRC ingestion, navigation features, table
components, dashboard systems, telemetry visualizations) and explicitly
forbidden features.

**Key Topics:** version 0.1.1 feature list, out-of-scope features, architecture
requirements, UI/UX requirements, completion criteria.

**Related:** See
[Role Ownership](specs/mre-v0.1-feature-scope.md#9-role-ownership) section for
feature ownership.

### [MRE Under Development Page Specification](specs/mre-under-development-page.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Complete specification for the `/under-development` placeholder page. Defines
route, required message, layout requirements, accessibility, and integration
with navigation.

**Key Topics:** Route definition, required message, layout rules, component
usage, testing requirements.

---

## Future Ideas

Exploratory product and UX concepts that are **not** roadmap commitments. Use
this area to capture possibilities before they graduate to plans, ADRs, or the
formal future-features epic.

### [Future Ideas Index](future-ideas/README.md)

**Status:** Active  
**Last Updated:** 2026-04-05

Lightweight index of future possibilities (e.g. graph-based race replay). Not
normative; see
[MRE Version 0.1.1 Feature Scope](specs/mre-v0.1-feature-scope.md) for in-scope
work.

**Related:** [Future Features Epic](user-stories/future-features.md) for
Beta+-style placeholder stories.

---

## Architecture Decision Records (ADRs)

Documentation of significant architectural decisions.

### [ADR Index and Guidelines](adr/README.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Index and guidelines for Architecture Decision Records (ADRs). Defines when to
create ADRs, ADR format, lifecycle, storage structure, and usage in development.

**Key Topics:** ADR purpose, when to create ADRs, ADR format template, lifecycle
(Proposed/Accepted/Rejected/Superseded), role responsibilities.

**Related:** See
[Role Responsibilities for ADRs](adr/README.md#9-role-responsibilities-for-adrs)
section.

### [ADR-20250127: Adopt Mobile-Safe Architecture](adr/ADR-20250127-adopt-mobile-safe-architecture.md)

**Status:** Complete (ADR Status: Accepted)  
**Last Updated:** 2025-01-27

Documents the architectural decision to adopt the Mobile-Safe Architecture
Guidelines as the authoritative standard for the MRE codebase.

**Key Topics:** Context for mobile-safe architecture, decision rationale,
consequences, alternatives considered.

### [ADR-20260607: Adopt OpenTelemetry and observability platform](adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md)

**Status:** Complete (ADR Status: Proposed)  
**Last Updated:** 2026-06-07

Documents the decision to adopt OpenTelemetry instrumentation and a third-party
SaaS observability platform (Datadog recommended) for final release, while
retaining Postgres `AuditLog` and demoting `ApplicationLog` volume in
production.

**Key Topics:** OTel, log shipping, error tracking, correlation, sampling,
implementation phases.

**Related:**
[Observability Platform Architecture](architecture/observability-platform.md),
[Implementation Plan](implimentation_plans/observability-platform-remediation-2026-06.md).

---

## Role Documentation

Engineering role definitions, responsibilities, and collaboration patterns.

### Overview

The MRE project uses a role-based development approach where different
engineering roles have specific responsibilities and areas of ownership. Each
role document defines:

- Mission statement
- Core responsibilities
- Key handoffs and collaboration
- Success metrics

### Role Documents

- **[DevOps & Platform Engineer](roles/devops-platform-engineer.md)**  
  **Status:** Complete | **Last Updated:** 2025-01-27  
  Infrastructure, CI/CD pipelines, deployment automation, environment
  provisioning

- **[Documentation & Knowledge Steward](roles/documentation-knowledge-steward.md)**  
  **Status:**
  Complete | **Last Updated:** 2025-01-27  
  Documentation quality, ADR facilitation, knowledge management, cross-linking

- **[Next.js Front-End Engineer](roles/nextjs-front-end-engineer.md)**  
  **Status:** Complete | **Last Updated:** 2025-01-27  
  UI components, App Router patterns, performance budgets, design token usage

- **[Observability & Incident Response Lead](roles/observability-incident-response-lead.md)**  
  **Status:**
  Complete | **Last Updated:** 2025-01-27  
  Structured logging, metrics, tracing, alerting, incident response

- **[Prisma/PostgreSQL Backend Engineer](roles/prisma-postgresql-backend-engineer.md)**  
  **Status:**
  Complete | **Last Updated:** 2025-01-27  
  Database schema, migrations, query performance, data integrity

- **[Quality & Automation Engineer](roles/quality-automation-engineer.md)**  
  **Status:** Complete | **Last Updated:** 2025-01-27  
  Testing strategies, CI/CD pipelines, test coverage, quality gates

- **[Senior UI/UX Expert](roles/senior-ui-ux-expert.md)**  
  **Status:** Complete | **Last Updated:** 2025-01-27  
  UX principles, design systems, accessibility standards, information
  architecture

- **[TypeScript Domain Engineer](roles/typescript-domain-engineer.md)**  
  **Status:** Complete | **Last Updated:** 2025-01-27  
  Domain modeling, business logic, type safety, framework-agnostic design

**See also:** [README.md](../README.md#9-role-documentation) in project root for
role overview.

---

## Standards

Coding standards and documentation guidelines.

### [File Headers and Code Commenting Guidelines](standards/file-headers-and-commenting-guidelines.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Mandatory standards for file headers and code commenting across all files in the
MRE project. Defines header format by file type, code commenting standards,
maintenance guidelines, and LLM behavior requirements.

**Key Topics:** File header format (TypeScript, Markdown, JSON, YAML, Prisma,
CSS), JSDoc comments, inline comments, TODO/FIXME format, maintenance checklist.

---

## Reviews

Infrastructure and environment reviews.

### Docker Review Report

**Status:** Not Available  
**Last Updated:** 2025-01-29

**Note:** This document is not currently available. See
[Docker User Guide](operations/docker-user-guide.md) for Docker infrastructure
and environment setup documentation.

---

## Operations

Operational documentation for deployment, environment configuration, and
observability.

### [Docker User Guide](operations/docker-user-guide.md)

**Status:** Complete  
**Last Updated:** 2026-05-16

**Comprehensive Docker user guide** providing complete Docker architecture
documentation, setup instructions, usage guide, development workflow,
troubleshooting, and production considerations. This is the authoritative guide
for understanding and working with the MRE Docker environment.

**Key Topics:** Docker architecture, container details, network architecture,
volume management, environment configuration, initial setup, daily usage,
development workflow, troubleshooting, production considerations.

**Related:** See [Quick Start Guide](development/quick-start.md) for developer
onboarding. See [Deployment Guide](operations/deployment-guide.md) for
deployment procedures.

### [Build and runtime reference (Compose)](operations/build-runtime-reference.md)

**Status:** Complete  
**Last Updated:** 2026-05-16

**Authoritative inventory** of `docker-compose.yml` services, container names,
default ports, images/build targets, and shared volumes. Use this to verify that
operational docs match the actual stack (including `telemetry-worker` and
`clickhouse`).

### [Environment Variables Reference](operations/environment-variables.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Complete reference for all environment variables used in the MRE application.
Documents required vs optional variables, default values, validation rules,
environment-specific configurations, and security considerations.

**Key Topics:** Variable groups (database, application, authentication,
ingestion, system), required vs optional, default values, validation rules,
environment-specific values, security considerations, example configurations.

**Related:** See [Docker User Guide](operations/docker-user-guide.md) for Docker
setup. See [Deployment Guide](operations/deployment-guide.md) for deployment
configuration.

### [Deployment and DevOps Runbook](operations/deployment-guide.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Comprehensive deployment procedures and DevOps runbook. Includes pre-deployment
checklists, deployment steps, database migration procedures, rollback
procedures, health checks, and post-deployment verification.

**Key Topics:** Deployment architecture, pre-deployment checklist, deployment
procedures (development, staging, production), database migrations, rollback
procedures, health checks, monitoring and alerting, disaster recovery.

**Related:** See [Docker User Guide](operations/docker-user-guide.md) for Docker
architecture and usage. See
[Environment Variables Reference](operations/environment-variables.md) for
configuration.

### [Monitoring and Observability Guide](operations/observability-guide.md)

**Status:** Complete (platform migration in progress)  
**Last Updated:** 2026-06-07

Comprehensive observability guide covering logging, metrics, tracing, alerting,
dashboard setup, troubleshooting, and performance monitoring.

**Key Topics:** Current vs target observability stack, OpenTelemetry, SaaS
platform (Datadog default), correlation IDs, implementation phase status.

**Related:**

- [Observability Platform Architecture](architecture/observability-platform.md)
- [Logging Architecture](architecture/logging.md)
- [Observability Platform Setup Runbook](operations/observability-platform-setup-runbook.md)
- [Observability Alerting Runbook](operations/observability-alerting-runbook.md)
- [Implementation Plan](implimentation_plans/observability-platform-remediation-2026-06.md)
- [ADR-20260607](adr/ADR-20260607-adopt-opentelemetry-and-observability-platform.md)
- [Observability & Incident Response Lead Role](roles/observability-incident-response-lead.md)
- [Ingestion Observability](architecture/liverc-ingestion/15-ingestion-observability.md)

### [Observability Platform Setup Runbook](operations/observability-platform-setup-runbook.md)

**Status:** Complete  
**Last Updated:** 2026-06-07

Step-by-step Datadog (default) or Grafana Cloud + Sentry setup for Docker
Compose, including agent configuration, log pipelines, APM, and verification.

### [Observability Alerting Runbook](operations/observability-alerting-runbook.md)

**Status:** Complete  
**Last Updated:** 2026-06-07

Monitor definitions (P1–P4), Log Explorer queries, incident workflow, and SLO
targets for production.

### [LiveRC Operations Guide](operations/liverc-operations-guide.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Operational guide for LiveRC ingestion operations. Provides commands and
procedures for managing ingestion operations, track management, and event
processing.

**Key Topics:** Ingestion commands, track management, event operations,
operational procedures.

**Related:** See
[LiveRC Ingestion Architecture](architecture/liverc-ingestion/01-overview.md)
for technical details. See
[Recent Events Auto-Ingest Runbook](operations/recent-events-auto-ingest-runbook.md)
for the planned nightly auto-ingest job (doc 31).

### [Admin Ingestion Settings Runbook](operations/admin-ingestion-settings-runbook.md)

**Status:** Implemented  
**Last Updated:** 2026-06-08

Operations runbook for the admin ingestion settings console: runtime vs
restart-required settings, scrape kill switch, auto-ingest tuning,
troubleshooting config drift, and audit review.

**Related:** [Admin user guide](user-guides/admin-ingestion-settings.md),
[Architecture](architecture/admin-ingestion-settings-console.md),
[Implementation plan](implimentation_plans/admin-ingestion-settings-console-2026-06.md),
[ADR-20260608](adr/ADR-20260608-admin-ingestion-settings-console.md).

### [Recent Events Auto-Ingest Runbook](operations/recent-events-auto-ingest-runbook.md)

**Status:** Planned — documentation complete; implementation pending  
**Last Updated:** 2026-05-31

Operations runbook for scheduled discovery and full ingestion of recent LiveRC
events on followed tracks. Covers enable/disable, cron schedule, env vars,
manual CLI, monitoring, troubleshooting, and QA fixture (Hot Rod Hobbies
`506979`).

**Key Topics:** `refresh-recent-events` CLI, `MRE_RECENT_EVENTS_*` env vars,
02:00 UTC cron, caps, kill switches, canonical test event.

**Related:** See
[31 - Recent Events Auto-Ingest](architecture/liverc-ingestion/31-recent-events-auto-ingest.md),
[implementation plan](implimentation_plans/recent-events-auto-ingest-2026-05.md),
[ADR-20260531](adr/ADR-20260531-scheduled-recent-events-auto-ingest.md).

### [Pitstop Detection Runbook](operations/pitstop-detection-runbook.md)

**Status:** Planned for implementation  
**Last Updated:** 2026-05-12

Operational runbook for nitro-only pitstop detection outputs: verification,
false-positive triage, strategy-label troubleshooting, and threshold tuning.

**Key Topics:** race-length sanity checks (7/10/30/60 minutes), pit event
validation, strategy validation, escalation criteria, and tuning protocol.

**Related:** See
[Pitstop Detection System](architecture/liverc-ingestion/29-pitstop-detection-system.md)
and
[Pitstop Detection Testing Strategy](architecture/liverc-ingestion/30-pitstop-detection-testing-strategy.md).

---

## Security

Security documentation and best practices.

### [Security Overview](security/security-overview.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Comprehensive security documentation covering authentication, authorization,
password security, session management, API security, data protection, security
headers, dependency security, and security best practices.

**Key Topics:** Authentication architecture, authorization model, password
security (Argon2id), session management, API security, data protection, security
headers, dependency security, security best practices, incident response.

**Related:** See
[Mobile-Safe Architecture Guidelines](architecture/mobile-safe-architecture-guidelines.md)
for security rules. See
[Ingestion Security](architecture/liverc-ingestion/17-ingestion-security.md) for
ingestion-specific security.

---

## Frontend

Frontend-specific workflows and user experience documentation.

### [Component catalog](frontend/component-catalog.md)

Build-aligned inventory of every production file under `src/components/`.
Generate with  
`docker exec -it mre-app npm run docs:component-catalog` (see also
[`docs/reference/generated/README.md`](reference/generated/README.md)).

### [LiveRC User Workflow](frontend/liverc/user-workflow.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

User workflow documentation for LiveRC integration features. Defines the
end-to-end user experience for discovering tracks, selecting events, and viewing
race data.

**Key Topics:** User journey, track selection, event discovery, date filtering,
on-demand ingestion, data visualization.

**Note:** This feature is in scope for version 0.1.1 release. See
[MRE Version 0.1.1 Feature Scope](specs/mre-v0.1-feature-scope.md) for details.

**Related:** See
[LiveRC Ingestion Architecture](architecture/liverc-ingestion/01-overview.md)
for technical implementation details.

---

## Documentation Status

This file is a **curated** entry point covering the most-used documents. For the
**complete, directory-organized listing of every document** in the repository,
see the [full Document Index](index/document-index.md).

**Last Updated:** 2026-05-31

**Note:** Detailed documentation status tracking is managed via version control
and code review processes.

---

## Documentation Maintenance

This documentation index is maintained by the **Documentation & Knowledge
Steward** role. See
[Documentation & Knowledge Steward](roles/documentation-knowledge-steward.md)
for responsibilities.

When adding new documentation:

1. Add entry to appropriate section above
2. Include brief description and key topics
3. Link to related documentation
4. Update this index's `lastModified` date

---

## License

Internal use only. This documentation index governs documentation discovery and
navigation for the MRE project.
