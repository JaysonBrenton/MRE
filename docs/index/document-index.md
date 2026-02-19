---
created: 2026-01-05
creator: Documentation System
lastModified: 2026-01-27
description: Comprehensive index of all documentation in the MRE repository
purpose:
  Provides a complete listing of every document in the repository with links and
  descriptions, organized into logical sections for easy navigation and
  discovery.
relatedFiles:
  - docs/README.md (main documentation index)
---

# MRE Documentation Index

**Last Updated:** 2026-01-27  
**Purpose:** Complete listing of all documentation files in the MRE repository

This document provides a comprehensive index of every document in the MRE
repository, organized into logical sections with descriptions and direct links.
Use this document to discover and navigate all available documentation.

---

## Table of Contents

- [Getting Started & Overview](#getting-started--overview)
- [User Guides](#user-guides)
- [Architecture](#architecture)
- [API Documentation](#api-documentation)
- [Database](#database)
- [Domain](#domain)
- [Design](#design)
- [Development](#development)
- [Operations](#operations)
- [Ingestion Service Documentation](#ingestion-service-documentation)
- [Security](#security)
- [Specifications](#specifications)
- [Architecture Decision Records (ADRs)](#architecture-decision-records-adrs)
- [User Stories](#user-stories)
- [Role Documentation](#role-documentation)
- [Standards](#standards)
- [Frontend](#frontend)
- [Implementation Plans](#implementation-plans)
- [Reviews](#reviews)
- [Reports](#reports)
- [Reference Material](#reference-material)
- [Prompts](#prompts)

---

## Getting Started & Overview

### [Project README](../../README.md)

Main project documentation and entry point. Defines version 0.1.1 feature scope,
system architecture requirements, Docker setup instructions, API endpoints,
utility scripts, and project structure. **CRITICAL: Contains Docker-only
environment requirements** - the application runs exclusively in Docker
containers.

### [Main Documentation Index](../README.md)

Comprehensive index and navigation for all MRE project documentation. Provides
organized entry point for discovering and navigating all project documentation
with brief descriptions and cross-references.

### [AGENTS.md](../AGENTS.md)

MRE Agents Handbook describing all autonomous and semi-autonomous contributors
(human or LLM) that operate inside the MRE repo and the guardrails they must
obey. **CRITICAL: Contains Docker-only environment requirements** - the
application runs exclusively in Docker containers. Defines agent domains, global
guardrails (including mandatory Docker environment rules), and operational
rules.

---

## User Guides

End-user documentation providing step-by-step instructions for using My Race
Engineer features. These guides are written for all users (both new and
experienced) and complement the technical documentation.

### [User Guides Index](../user-guides/README.md)

Central index and navigation for all end-user guides. Provides overview of
available guides, quick reference, and guide categories to help users find the
information they need.

### [Getting Started Guide](../user-guides/getting-started.md)

Perfect for new users! Learn how to create an account, log in, understand the
welcome page, and get started with MRE. Covers account creation, login, basic
navigation, and next steps.

### [Event Search Guide](../user-guides/event-search.md)

Complete guide to searching for race events, selecting tracks (including
favorites), setting date ranges, importing events from LiveRC, and understanding
event status indicators.

### [Event Analysis Guide](../user-guides/event-analysis.md)

Learn how to analyze race event data, view interactive charts, compare drivers,
explore sessions/heats, and export data to CSV. Covers overview, drivers,
sessions, and comparisons tabs.

### [Dashboard Guide](../user-guides/dashboard.md)

Guide to using your personal dashboard, understanding widgets, customizing
layouts, viewing statistics, and using quick actions. Learn how to personalize
your MRE experience.

### [Driver Features Guide](../user-guides/driver-features.md)

Learn how MRE automatically discovers events where you participated using fuzzy
matching. Understand match types (transponder, exact, fuzzy), confirm
participation, and manage driver information.

### [Navigation Guide](../user-guides/navigation.md)

Master navigation patterns including breadcrumb navigation, menus, tabs,
keyboard shortcuts, and finding features. Learn how to navigate MRE efficiently
on both desktop and mobile.

### [Account Management Guide](../user-guides/account-management.md)

Complete guide to managing your account, including registration, login, password
management, session management, and account security. Essential for account
setup and maintenance.

### [Troubleshooting Guide](../user-guides/troubleshooting.md)

Find solutions to common problems including login issues, event import failures,
search problems, chart display issues, performance problems, and getting help.
Quick reference for resolving issues.

---

## Architecture

Core architectural guidelines, principles, and specifications that govern the
entire codebase.

### Core Architecture

#### [Mobile-Safe Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md)

Authoritative architecture standard for the MRE application. Defines the
complete architectural framework ensuring the system is mobile-safe, API-first,
and future-native for iOS/Android clients. All code must follow these
guidelines.

#### [Event Search: Include Practice Days Design](../architecture/event-search-include-practice-days-design.md)

Design for Event Search with optional “Include practice days”: single combined
list (events + practice days), practice range = event min/max, in-app Prisma for
practice-day list, single discover-range request (or streaming), 180-day default,
and cache for fast repeat searches.

#### [Practice Day Search Performance Design](../architecture/practice-day-search-performance-design.md)

Practice day discovery performance: design options and **implemented** improvements
(single discover-range request, cache, timeouts, streaming, 180-day default, skip
when covered, optimistic import). Includes before/after timings and env vars for
cache TTL and timeouts.

#### [Dashboard Architecture](../architecture/dashboard-architecture.md)

Dashboard architecture and widget system for MRE version 0.1.1. Defines
dashboard types, widget system, customization architecture, and implementation
guidelines.

#### [Error Handling and Error Codes Catalog](../architecture/error-handling.md)

Comprehensive error handling documentation including error codes, error response
formats, HTTP status mappings, and error handling patterns. Provides guidance
for consistent error handling across the application.

#### [Performance Requirements and Benchmarks](../architecture/performance-requirements.md)

Performance requirements and benchmarks for the MRE application. Defines
performance goals, performance budgets, database performance requirements, API
response time targets, and optimization guidelines.

#### [Logging Standards](../architecture/logging.md)

Logging standards and practices for the MRE application. Defines structured
logging requirements, log levels, and logging patterns.

#### [Rate Limiting Plan](../architecture/rate-limiting-plan.md)

Rate limiting strategy and implementation plan for API endpoints and external
service interactions.

#### [Security Headers Plan](../architecture/security-headers-plan.md)

Security headers implementation plan and configuration guidelines.

### LiveRC Ingestion Architecture

Comprehensive architecture documentation for the LiveRC ingestion subsystem.
This subsystem provides MRE with the ability to retrieve, normalize, and store
race event data from LiveRC.

#### [01 - Overview](../architecture/liverc-ingestion/01-overview.md)

Overview and goals for the LiveRC ingestion subsystem. Provides the conceptual
foundation, high-level user workflow, architectural goals, constraints, and
long-term vision.

#### [02 - Connector Architecture](../architecture/liverc-ingestion/02-connector-architecture.md)

Connector architecture and design patterns for LiveRC data connectors. Defines
connector interfaces, HTTPX and Playwright usage patterns, and browser
automation strategies.

#### [03 - Ingestion Pipeline](../architecture/liverc-ingestion/03-ingestion-pipeline.md)

Ingestion pipeline architecture and orchestration. Defines pipeline stages,
idempotency requirements, locking mechanisms, and state management.

#### [04 - Data Model](../architecture/liverc-ingestion/04-data-model.md)

Data model specification for LiveRC ingestion. Defines entity relationships,
data normalization rules, and storage patterns.

#### [05 - API Contracts](../architecture/liverc-ingestion/05-api-contracts.md)

API contracts and endpoint specifications for the ingestion service. Defines
REST API endpoints, request/response formats, and authentication requirements.

#### [06 - Admin CLI Specification](../architecture/liverc-ingestion/06-admin-cli-spec.md)

Administrative CLI specification for managing ingestion operations. Defines
command-line interface, commands, and usage patterns.

#### [07 - Ingestion State Machine](../architecture/liverc-ingestion/07-ingestion-state-machine.md)

State machine design for ingestion workflows. Defines state transitions, event
handling, and state persistence.

#### [08 - Ingestion Pipeline Internals](../architecture/liverc-ingestion/08-ingestion-pipeline-internals.md)

Detailed internal architecture of the ingestion pipeline. Covers pipeline
stages, data flow, and internal processing logic.

#### [09 - Connector Contracts](../architecture/liverc-ingestion/09-connector-contracts.md)

Connector contract specifications and interface definitions. Defines required
methods, return types, and error handling patterns.

#### [10 - Connector Browser Strategy](../architecture/liverc-ingestion/10-connector-browser-strategy.md)

Browser automation strategy for connectors requiring JavaScript execution.
Defines Playwright usage patterns, browser lifecycle management, and performance
considerations.

#### [11 - Ingestion Error Handling](../architecture/liverc-ingestion/11-ingestion-error-handling.md)

Error handling patterns and strategies for ingestion operations. Defines error
types, recovery procedures, and error reporting.

#### [12 - Ingestion Validation Rules](../architecture/liverc-ingestion/12-ingestion-validation-rules.md)

Data validation rules and validation framework for ingested data. Defines
validation schemas, validation stages, and error reporting.

#### [13 - Ingestion Performance and Scaling](../architecture/liverc-ingestion/13-ingestion-performance-and-scaling.md)

Performance optimization and scaling strategies for ingestion operations.
Defines performance targets, scaling patterns, and optimization techniques.

#### [14 - Ingestion Idempotency Design](../architecture/liverc-ingestion/14-ingestion-idempotency-design.md)

Idempotency design and implementation patterns. Defines idempotency keys,
duplicate detection, and idempotent operation patterns.

#### [15 - Ingestion Observability](../architecture/liverc-ingestion/15-ingestion-observability.md)

Observability architecture for ingestion operations. Defines logging, metrics,
tracing, and monitoring patterns.

#### [16 - Ingestion Concurrency and Locking](../architecture/liverc-ingestion/16-ingestion-concurrency-and-locking.md)

Concurrency control and locking mechanisms for ingestion operations. Defines
advisory locks, concurrent operation handling, and race condition prevention.

#### [17 - Ingestion Security](../architecture/liverc-ingestion/17-ingestion-security.md)

Security architecture for ingestion operations. Defines authentication,
authorization, data protection, and security best practices.

#### [18 - Ingestion Testing Strategy](../architecture/liverc-ingestion/18-ingestion-testing-strategy.md)

Testing strategy and patterns for ingestion code. Defines unit testing,
integration testing, fixture management, and test data patterns.

#### [19 - Ingestion Fixture Management](../architecture/liverc-ingestion/19-ingestion-fixture-management.md)

Fixture management system for ingestion testing. Defines fixture structure,
fixture loading, and fixture maintenance procedures.

#### [20 - Ingestion Replay and Debugging](../architecture/liverc-ingestion/20-ingestion-replay-and-debugging.md)

Replay and debugging capabilities for ingestion operations. Defines replay
mechanisms, debugging tools, and troubleshooting procedures.

#### [21 - Ingestion Recovery Procedures](../architecture/liverc-ingestion/21-ingestion-recovery-procedures.md)

Recovery procedures for failed ingestion operations. Defines failure scenarios,
recovery strategies, and manual intervention procedures.

#### [22 - Ingestion Versioning and Migrations](../architecture/liverc-ingestion/22-ingestion-versioning-and-migrations.md)

Versioning strategy and migration procedures for ingestion system changes.
Defines version management, migration patterns, and backward compatibility.

#### [23 - Ingestion Cross-Connector Abstractions](../architecture/liverc-ingestion/23-ingestion-cross-connector-abstractions.md)

Cross-connector abstraction patterns and shared components. Defines common
interfaces, shared utilities, and connector framework.

#### [24 - Ingestion Security Hardening](../architecture/liverc-ingestion/24-ingestion-security-hardening.md)

Security hardening procedures and best practices for ingestion operations.
Defines security controls, threat mitigation, and security audit procedures.

#### [25 - HTTPX Client Architecture](../architecture/liverc-ingestion/25-httpx-client-architecture.md)

HTTPX client architecture and configuration for HTTP requests. Defines client
configuration, retry logic, timeout handling, and connection pooling.

#### [26 - HTML Parsing Architecture](../architecture/liverc-ingestion/26-html-parsing-architecture.md)

HTML parsing architecture and parser patterns. Defines parsing strategies, error
handling, and parser extensibility.

#### [27 - Web Scraping Best Practices](../architecture/liverc-ingestion/27-web-scraping-best-practices.md)

Comprehensive guide to web scraping practices and ethical guidelines. Covers
robots.txt compliance, rate limiting, User-Agent policy, HTTP caching, retry
logic, and kill switch mechanism.

#### [28 - Async Ingestion Queue](../architecture/liverc-ingestion/28-async-ingestion-queue.md)

Asynchronous ingestion via in-process job queue. Describes 202 Accepted + job_id
when queue is enabled, GET job status endpoint, queue_position, frontend
polling, and configuration (INGESTION_USE_QUEUE, UVICORN_WORKERS).

---

## API Documentation

API reference documentation and versioning strategy.

### [API Reference](../api/api-reference.md)

Complete API reference documentation for all MRE API endpoints. Provides
comprehensive catalog of endpoints, request/response formats, authentication
requirements, error codes, and usage examples.

### [API Versioning Strategy](../api/versioning-strategy.md)

API versioning strategy and deprecation policy. Defines versioning approach,
when to create new versions, deprecation timeline, breaking change policy, and
migration guide.

---

## Database

Database schema and data model documentation.

### [Database Schema Documentation](../database/schema.md)

Human-readable database schema documentation. Provides comprehensive overview of
all models, relationships, indexes, constraints, and business rules. Essential
reference for developers understanding the data model.

---

## Domain

Domain models and business logic documentation.

### [Racing Classes Domain Model](../domain/racing-classes.md)

Authoritative domain model for racing classes in the MRE application. Defines
the complete taxonomy of car classes (vehicle types), modification rules
(Modified/Stock), and skill groupings (Junior/Pro/Expert).

---

## Design

Visual design, UX principles, and user experience guidelines.

### [MRE UX Principles](../design/mre-ux-principles.md)

Mandatory User Experience principles for all MRE version 0.1.1 features. Defines
core UX philosophy, laws of UX, foundational layout rules, form patterns,
content rules, and mobile-specific requirements.

### [MRE Dark Theme Guidelines](../design/mre-dark-theme-guidelines.md)

Visual standards and token system for MRE dark theme implementation. Defines
semantic token naming (`--token-*`), core dark theme rules, typography, spacing,
forms, and mobile requirements.

### [MRE Personas](../design/mre-personas.md)

Comprehensive persona documentation for MRE application. Defines detailed
persona descriptions, user journeys, technical specifications, and UI mockups
for all MRE personas: Driver, Admin, Team Manager, and Race Engineer.

### [MRE Hero Image Generation](../design/mre-hero-image-generation.md)

Standards and prompts for generating MRE hero images using AI tools. Defines
visual style, composition rules, Stable Diffusion prompt structure, and image
output requirements.

### [Chart Design Standards](../design/chart-design-standards.md)

Chart design standards and visualization guidelines. Defines chart types,
styling patterns, color usage, and accessibility requirements.

### [Navigation Patterns](../design/navigation-patterns.md)

Navigation patterns and information architecture guidelines. Defines navigation
structures, menu patterns, and user flow patterns.

### [Table Component Specification](../design/table-component-specification.md)

Table component specification and design guidelines. Defines table patterns,
sorting, filtering, pagination, and responsive behavior.

### [Event Analysis Weather Card and Icon Library](../design/event-analysis-weather-card-design.md)

Design for the Overview tab weather card (placement next to EventStats, compact
label-value layout, condition icons) and adoption of `lucide-react`. Reuses
existing weather API, types, and dashboard patterns.

### [Telemetry Visualization Specification](../design/telemetry-visualization-specification.md)

Telemetry visualization specification for lap data and sensor data. Defines
visualization types, data formats, and interaction patterns. Desktop-only;
separate mobile app planned for future.

### [Telemetry Documentation Index](../telemetry/README.md)

Index of all telemetry design documentation: user stories, UX blueprint, API
contract, data model, processing pipeline, formats, security, and related ADRs.
Use this as the entry point for telemetry implementation.

### [Telemetry Seed Data Guide](../telemetry/Design/Telemetry_Seed_Data_Guide.md)

Practical guide for creating telemetry seed data sets for testing, development,
and UX validation. Covers synthetic vs. dummy data, storage layout, quick-start
options, and implementation order. Entry point for fixture creation.

---

## Development

Development guides, testing strategies, contributing guidelines, and development
checklists.

### Getting Started

#### [Developer Quick Start Guide](../development/quick-start.md)

Step-by-step developer onboarding guide for Docker-based development
environment. Provides prerequisites, Docker setup instructions, first-time
workflow, running tests in containers, useful Docker commands, common setup
issues, and IDE recommendations. **All development occurs in Docker
containers.**

#### [Contributing Guidelines](../development/CONTRIBUTING.md)

Comprehensive contributing guidelines for the MRE project. Includes code of
conduct, development workflow, branch naming, commit messages, pull request
process, code review guidelines, testing requirements, and release process.

### Testing

#### [Testing Strategy and Guidelines](../development/testing-strategy.md)

Comprehensive testing strategy for the MRE application. Defines testing pyramid,
testing tools, test organization, testing patterns, frontend/backend/integration
testing guidelines, and CI/CD requirements.

#### [Integration Testing Guide](../development/integration-testing-guide.md)

Detailed integration testing guide. Provides guidance for integration test
setup, test data management, mocking strategies, database testing, API
integration testing, and CI/CD integration.

### Changelog

#### [CHANGELOG](../development/CHANGELOG.md)

Changelog template following Keep a Changelog format. Documents all notable
changes to the MRE project, organized by version with categories for Added,
Changed, Deprecated, Removed, Fixed, and Security.

#### [CHANGELOG Guide](../development/CHANGELOG_GUIDE.md)

Guidelines for writing and maintaining the CHANGELOG. Defines changelog format,
entry categories, and maintenance procedures.

### Development Checklists and Guidelines

#### [Component Creation Checklist](../development/COMPONENT_CREATION_CHECKLIST.md)

Pre-commit checklist for component creation. Provides quick reference checklist
to run before committing any new or modified component.

#### [Flexbox Layout Checklist](../development/FLEXBOX_LAYOUT_CHECKLIST.md)

Flexbox layout guidelines and common issues checklist. Helps identify and
resolve common flexbox layout problems.

#### [Pagination Component Template](../development/PAGINATION_COMPONENT_TEMPLATE.md)

Template and guidelines for creating pagination components. Provides standard
patterns and implementation guidelines.

#### [Pagination Spacing Guidelines](../development/PAGINATION_SPACING_GUIDELINES.md)

Spacing guidelines for pagination components. Defines spacing requirements and
common spacing issues.

#### [Mobile UI Removal Summary](../development/mobile-ui-removal-summary.md)

Summary of mobile UI removal changes and migration guide. Documents the
transition from mobile-first to desktop-only UI.

### Development Tools and Configuration

#### [SSL Certificates for Development](../../certs/README.md)

Documentation for self-signed SSL certificates used in HTTPS development.
Includes certificate details, installation instructions for macOS/Linux/Windows,
regeneration procedures, and security notes. **Development only** - certificates
are self-signed and not for production use.

---

## Operations

Operational documentation for deployment, environment configuration,
observability, and system operations.

### [Docker User Guide](../operations/docker-user-guide.md)

Comprehensive Docker user guide providing complete Docker architecture
documentation, setup instructions, usage guide, development workflow,
troubleshooting, and production considerations.

### [Deployment and DevOps Runbook](../operations/deployment-guide.md)

Comprehensive deployment procedures and DevOps runbook. Includes pre-deployment
checklists, deployment steps, database migration procedures, rollback
procedures, health checks, and post-deployment verification.

### [Environment Variables Reference](../operations/environment-variables.md)

Complete reference for all environment variables used in the MRE application.
Documents required vs optional variables, default values, validation rules,
environment-specific configurations, and security considerations.

### [Monitoring and Observability Guide](../operations/observability-guide.md)

Comprehensive observability guide covering logging, metrics, tracing, alerting,
dashboard setup, troubleshooting, and performance monitoring. Ensures consistent
observability practices across the application.

### [LiveRC Operations Guide](../operations/liverc-operations-guide.md)

Operational guide for LiveRC ingestion operations. Provides commands and
procedures for managing ingestion operations, track management, and event
processing.

---

## Ingestion Service Documentation

Documentation for the Python-based LiveRC ingestion service. This service
handles data retrieval, parsing, normalization, and storage from LiveRC.

### [Ingestion Service README](../../ingestion/README.md)

Comprehensive guide for the LiveRC ingestion service. Includes setup
instructions, development workflow, API endpoints, CLI commands (Docker-based
execution), testing strategies, fixture management, troubleshooting procedures,
and parser selector reference. **All commands must be executed inside Docker
containers.**

### [Parser Implementation Status](../../ingestion/PARSER_IMPLEMENTATION_STATUS.md)

Status tracking document for LiveRC parser implementation. Documents completion
status of all parsers (100% complete), CSS selectors used, test fixtures, known
edge cases, and parser features. Essential reference for understanding parser
capabilities and implementation details.

### [LiveRC Parser CSS Selector Reference](../../ingestion/connectors/liverc/PARSER_SELECTORS.md)

Complete CSS selector reference for all LiveRC parsers. Documents HTML structure
dependencies, CSS selectors, data extraction patterns, edge cases, and
maintenance procedures. Critical reference for maintaining parsers when LiveRC
HTML structure changes. Covers TrackListParser, EventListParser,
EventMetadataParser, RaceListParser, RaceResultsParser, RaceLapParser, and
EntryListParser.

---

## Security

Security documentation and best practices.

### [Security Overview](../security/security-overview.md)

Comprehensive security documentation covering authentication, authorization,
password security, session management, API security, data protection, security
headers, dependency security, and security best practices.

---

## Specifications

Feature specifications and requirements.

### [MRE Version 0.1.1 Feature Scope](../specs/mre-v0.1-feature-scope.md)

Authoritative specification for the strict, locked-down feature set for the MRE
Version 0.1.1 Release. Defines allowed features and explicitly forbidden
features.

### [MRE Under Development Page Specification](../specs/mre-under-development-page.md)

Complete specification for the `/under-development` placeholder page. Defines
route, required message, layout requirements, accessibility, and integration
with navigation.

---

## Architecture Decision Records (ADRs)

Documentation of significant architectural decisions.

### [ADR Index and Guidelines](../adr/README.md)

Index and guidelines for Architecture Decision Records (ADRs). Defines when to
create ADRs, ADR format, lifecycle, storage structure, and usage in development.

### [ADR-20250127: Adopt Mobile-Safe Architecture](../adr/ADR-20250127-adopt-mobile-safe-architecture.md)

Documents the architectural decision to adopt the Mobile-Safe Architecture
Guidelines as the authoritative standard for the MRE codebase.

### [ADR-20251228: Allow Sidebar Navigation](../adr/ADR-20251228-allow-sidebar-navigation.md)

Documents the architectural decision to allow sidebar navigation patterns in the
MRE application.

---

## User Stories

User stories documentation organized by feature epics.

### [User Stories Index](../user-stories/README.md)

Overview and navigation for MRE user stories documentation. Defines user types,
story format, and links to related documentation.

### [Authentication Epic](../user-stories/authentication.md)

User stories covering user registration and login functionality.

### [User Management Epic](../user-stories/user-management.md)

User stories covering user experience and welcome pages.

### [Administrator Epic](../user-stories/admin.md)

User stories covering administrator login and console access.

### [LiveRC Integration Epic](../user-stories/liverc-integration.md)

User stories covering LiveRC data discovery, ingestion, and visualization.

### [System Epic](../user-stories/system.md)

User stories covering system-level features and placeholders.

### [User Journeys](../user-stories/user-journeys.md)

Comprehensive end-to-end user journey documentation. Defines complete user
workflows and interaction patterns.

### [Future Features](../user-stories/future-features.md)

Placeholder stories for Beta+ features that are out of scope for Alpha. Includes
telemetry ingestion, analytics, setup sheets, AI coach, and other future
capabilities.

### [Non-Functional Requirements](../user-stories/non-functional-requirements.md)

Non-functional requirements documented as user stories. Covers performance,
security, accessibility, mobile compatibility, and API reliability.

---

## Role Documentation

Engineering role definitions, responsibilities, and collaboration patterns.

### [DevOps & Platform Engineer](../roles/devops-platform-engineer.md)

Infrastructure, CI/CD pipelines, deployment automation, environment
provisioning, and platform engineering responsibilities.

### [Documentation & Knowledge Steward](../roles/documentation-knowledge-steward.md)

Documentation quality, ADR facilitation, knowledge management, cross-linking,
and documentation maintenance responsibilities.

### [Next.js Front-End Engineer](../roles/nextjs-front-end-engineer.md)

UI components, App Router patterns, performance budgets, design token usage, and
front-end development responsibilities.

### [Observability & Incident Response Lead](../roles/observability-incident-response-lead.md)

Structured logging, metrics, tracing, alerting, incident response, and
observability architecture responsibilities.

### [Prisma/PostgreSQL Backend Engineer](../roles/prisma-postgresql-backend-engineer.md)

Database schema, migrations, query performance, data integrity, and backend data
layer responsibilities.

### [Quality & Automation Engineer](../roles/quality-automation-engineer.md)

Testing strategies, CI/CD pipelines, test coverage, quality gates, and quality
assurance responsibilities.

### [Senior UI/UX Expert](../roles/senior-ui-ux-expert.md)

UX principles, design systems, accessibility standards, information
architecture, and user experience design responsibilities.

### [TypeScript Domain Engineer](../roles/typescript-domain-engineer.md)

Domain modeling, business logic, type safety, framework-agnostic design, and
domain layer responsibilities.

---

## Standards

Coding standards and documentation guidelines.

### [Standards Index](../standards/README.md)

Central index for all style guides and coding standards. Provides a single entry
point to all style guides, coding standards, and formatting rules for the MRE
project.

### [File Headers and Code Commenting Guidelines](../standards/file-headers-and-commenting-guidelines.md)

Mandatory standards for file headers and code commenting across all files in the
MRE project. Defines header format by file type, code commenting standards,
maintenance guidelines, and LLM behavior requirements.

### [TypeScript & React Style Guide](../standards/typescript-react-style-guide.md)

Comprehensive coding standards for TypeScript and React development. Defines
naming conventions, code patterns, component structure, and best practices.

---

## Frontend

Frontend-specific workflows and user experience documentation.

### [LiveRC User Workflow](../frontend/liverc/user-workflow.md)

User workflow documentation for LiveRC integration features. Defines the
end-to-end user experience for discovering tracks, selecting events, and viewing
race data.

### [LiveRC Event Search and Analysis User Stories](../frontend/liverc/event-search-and-analysis-user-stories.md)

User stories for event search and analysis features in the LiveRC integration.
Defines search patterns, filtering, and data analysis workflows.

---

## Implementation Plans

Implementation plans for major architectural changes and improvements.

### [Codex Deep Review Remediation Plan](../implimentation_plans/codex-deep-review-remediation-plan.md)

Comprehensive remediation plan based on codex deep review findings. Defines
action items, priorities, and implementation strategies for addressing
identified issues.

### [Redux State Management Migration Plan](../implimentation_plans/redux-state-management-migration-plan.md)

Migration plan for implementing Redux state management. Defines migration
strategy, implementation steps, and transition plan.

### [Practice Day Full Ingestion Implementation Plan](../implimentation_plans/practice-day-full-ingestion-implementation-plan.md)

Phased implementation plan for full practice day ingestion: list + drivers/results
from list + session detail fetch with concurrency + race_metadata, result stats,
and laps. References design doc and covers schema, pipeline, API, docs, and tests.

### [Telemetry MVP Implementation Decisions](../telemetry/Design/Telemetry_MVP_Implementation_Decisions.md)

Authoritative MVP decisions for telemetry: job table (single-table queue), upload/artifact lifecycle, raw file storage path, session time placeholders, fixture files, pyarrow dependency, failure response when session failed, naming convention, and deferral of teams/sharing to v1. Reference when implementing Phase 2–3.

### [Telemetry Implementation Plan](../implimentation_plans/telemetry-implementation-plan.md)

Phased implementation plan for telemetry: prerequisites, phase dependencies,
infrastructure (object storage, job queue, worker), config, MVP task breakdown
(schema, API, parsers, Parquet, session list UI), testing, documentation, and
operations. References Telemetry Implementation Design; v1/v2 scoped in design.

---

## Reviews

Code and architecture review documentation.

### [Dashboard Performance Review](../reviews/dashboard-performance-review.md)

Performance review of the authenticated dashboard page (February 2025).
Identifies performance risks for large LiveRC events, including hero carousel
reprocessing, uncontrolled weather requests, session data recalculation, and
driver membership checks. Provides specific recommendations for memoization,
caching, and optimization.

### [Codex Deep Review](../reviews/Old/codex-deep-review.md)

Comprehensive code review and analysis. Provides detailed assessment of codebase
quality, architecture, and implementation patterns.

### [Implementation Status Analysis](../reviews/Old/implementation-status-analysis.md)

Analysis of implementation status and progress tracking. Documents current
implementation state and identifies gaps.

### [Redux Implementation Deep Review](../reviews/Old/redux-implementation-deep-review.md)

Deep review of Redux implementation patterns and architecture. Analyzes Redux
usage, patterns, and recommendations.

---

## Reports

Operational reports and system status documentation.

### Track Sync Reports

Automated reports generated by the track synchronization process:

- [Track Sync Report - 2025-12-17 07:55:56](../reports/track-sync-2025-12-17-07-55-56.md)
- [Track Sync Report - 2025-12-23 13:55:43](../reports/track-sync-2025-12-23-13-55-43.md)
- [Track Sync Report - 2025-12-23 13:57:13](../reports/track-sync-2025-12-23-13-57-13.md)
- [Track Sync Report - 2025-12-23 13:58:55](../reports/track-sync-2025-12-23-13-58-55.md)
- [Track Sync Report - 2025-12-24 10:50:00](../reports/track-sync-2025-12-24-10-50-00.md)
- [Track Sync Report - 2026-01-02 01:33:00](../reports/track-sync-2026-01-02-01-33-00.md)
- [Track Sync Report - 2026-01-04 23:52:56](../reports/track-sync-2026-01-04-23-52-56.md)

These reports document track synchronization operations, including tracks
discovered, updated, and any errors encountered during the sync process.

---

## Reference Material

Reference HTML files and external documentation samples.

### LiveRC Reference Files

HTML reference files from LiveRC used for parsing and testing:

- [Event Detail Page](../reference_material/Event.detail.page.html)
- [Track Catalogue Page](../reference_material/liverc/Track.catalogue.page.html)
- [Track Events Listing Page](../reference_material/liverc/Track.events.listing.page.html)
- [BBRCC Off-Road's Dashboard](../reference_material/liverc/BBRCC Off-Road's
  Dashboard.html)
- [Thornhill Home Page](../reference_material/liverc/thornhill.home.page.liverc.html)
- [Thunder Alley RC Speedway's Dashboard](../reference_material/liverc/Thunder
  Alley RC Speedway's Dashboard.html)
- [1.8 Nitro Buggy B-Main Results](../reference_material/liverc/1.8 Nitro Buggy
  B-Main Results.html)
- [1.8 Electric Buggy A3-Main
  Results](../reference_material/liverc/1.8.Electric.Buggy.A3-Main Results.html)
- [1.8 Nitro Buggy A-Main Results](../reference_material/liverc/1.8.Nitro.Buggy.A-Main.Results.html)

These HTML files are used as reference material for understanding LiveRC page
structure and for testing parsers.

---

## Prompts

Prompt templates and instructions for AI tools.

### [Prompts Template](../prompts/prompts.txt)

Prompt templates and instructions for AI code generation and documentation
tasks. Defines standard prompts for file output, code generation, and
documentation formatting.

---

## Document Statistics

**Total Documents:** 110+ markdown files  
**Document Categories:** 21+ logical sections  
**Last Updated:** 2026-01-27

---

## Maintenance

This document index is maintained by the **Documentation & Knowledge Steward**
role. See
[Documentation & Knowledge Steward](../roles/documentation-knowledge-steward.md)
for responsibilities.

When adding new documentation:

1. Add entry to appropriate section above
2. Include brief description
3. Update this index's `lastModified` date
4. Ensure the document follows file header standards

---

## Related Documentation

- [Main Documentation Index](../README.md) - Curated documentation index with
  detailed descriptions
- [Standards Index](../standards/README.md) - Coding standards and style guides
- [ADR Index](../adr/README.md) - Architecture Decision Records
- [User Stories Index](../user-stories/README.md) - User stories documentation

---

**End of Document Index**
