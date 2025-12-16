---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Central index and navigation for all MRE project documentation
purpose: Provides a comprehensive index of all documentation in the MRE project, organized by
         category with brief descriptions and cross-references. This document serves as the
         entry point for discovering and navigating all project documentation.
relatedFiles:
  - README.md (project root)
  - docs/roles/documentation-knowledge-steward.md
---

# MRE Documentation Index

This document provides a comprehensive index of all documentation in the My Race Engineer (MRE) project. Use this as your starting point for discovering and navigating project documentation.

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

**Authoritative architecture standard** for the MRE application. Defines the complete architectural framework ensuring the system is mobile-safe, API-first, and future-native for iOS/Android clients. All code must follow these guidelines.

**Key Topics:** API-first backend, separation of UI and business logic, folder structure, database rules, authentication, mobile-first UI, performance requirements.

**Related:** See [Role Responsibilities](architecture/mobile-safe-architecture-guidelines.md#13-role-responsibilities) section for role ownership.

### [LiveRC Ingestion Architecture](architecture/liverc-ingestion/01-overview.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Comprehensive architecture documentation for the LiveRC ingestion subsystem. This subsystem provides MRE with the ability to retrieve, normalize, and store race event data from LiveRC. **Status:** This subsystem is in scope for Alpha release (see [MRE Alpha Feature Scope](specs/mre-alpha-feature-scope.md)).

**Key Topics:** Connector architecture, ingestion pipeline, data model, API contracts, admin CLI, state machine, error handling, validation, performance, idempotency, observability, security, testing, fixture management, replay/debugging, recovery procedures, versioning, cross-connector abstractions.

**Document Series:** This is a 26-document series covering all aspects of the ingestion system:
- [01 - Overview](architecture/liverc-ingestion/01-overview.md)
- [02 - Connector Architecture](architecture/liverc-ingestion/02-connector-architecture.md)
- [03 - Ingestion Pipeline](architecture/liverc-ingestion/03-ingestion-pipeline.md)
- [04 - Data Model](architecture/liverc-ingestion/04-data-model.md)
- [05 - API Contracts](architecture/liverc-ingestion/05-api-contracts.md)
- [06 - Admin CLI Specification](architecture/liverc-ingestion/06-admin-cli-spec.md)
- [07-26 - Additional technical specifications](architecture/liverc-ingestion/)

**Related:** See [MRE Alpha Feature Scope](specs/mre-alpha-feature-scope.md) for Alpha feature specifications. See [Mobile-Safe Architecture Guidelines](architecture/mobile-safe-architecture-guidelines.md) for overall architecture principles.

### [Error Handling and Error Codes Catalog](architecture/error-handling.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Comprehensive error handling documentation including error codes, error response formats, HTTP status mappings, and error handling patterns. Provides guidance for consistent error handling across the application.

**Key Topics:** Standard error response format, error code catalog, error handling patterns, client-side and server-side error handling, error logging, user-facing vs technical errors.

**Related:** See [API Reference](api/api-reference.md) for API error documentation. See [LiveRC Ingestion Error Handling](architecture/liverc-ingestion/11-ingestion-error-handling.md) for ingestion-specific errors.

### [Performance Requirements and Benchmarks](architecture/performance-requirements.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Performance requirements and benchmarks for the MRE application. Defines performance goals, performance budgets, database performance requirements, API response time targets, and optimization guidelines.

**Key Topics:** Performance goals, performance budgets, database performance requirements, API response time targets, load testing, performance monitoring, optimization guidelines, scalability considerations.

**Related:** See [Mobile-Safe Architecture Guidelines](architecture/mobile-safe-architecture-guidelines.md) for performance rules. See [Ingestion Performance and Scaling](architecture/liverc-ingestion/13-ingestion-performance-and-scaling.md) for ingestion performance.

---

## API Documentation

API reference documentation and versioning strategy.

### [API Reference](api/api-reference.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Complete API reference documentation for all MRE API endpoints. Provides comprehensive catalog of endpoints, request/response formats, authentication requirements, error codes, and usage examples.

**Key Topics:** Authentication endpoints, LiveRC ingestion endpoints, health check, error handling, authentication requirements, rate limiting, API versioning.

**Related:** See [Mobile-Safe Architecture Guidelines](architecture/mobile-safe-architecture-guidelines.md) for API standards. See [Error Handling](architecture/error-handling.md) for error handling details.

### [API Versioning Strategy](api/versioning-strategy.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

API versioning strategy and deprecation policy. Defines versioning approach, when to create new versions, deprecation timeline, breaking change policy, and migration guide.

**Key Topics:** URL path versioning, deprecation timeline, breaking change policy, backward compatibility, version migration guide, version lifecycle.

**Related:** See [API Reference](api/api-reference.md) for current API endpoints. See [Mobile-Safe Architecture Guidelines](architecture/mobile-safe-architecture-guidelines.md) for API versioning standards.

---

## Database

Database schema and data model documentation.

### [Database Schema Documentation](database/schema.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Human-readable database schema documentation. Provides comprehensive overview of all models, relationships, indexes, constraints, and business rules. Essential reference for developers understanding the data model.

**Key Topics:** Entity relationship diagram, models (User, Track, Event, Race, RaceDriver, RaceResult, Lap), enums, indexes, relationships, data lifecycle, common query patterns, performance considerations.

**Related:** See [Prisma Schema](../prisma/schema.prisma) for source of truth. See [LiveRC Ingestion Data Model](architecture/liverc-ingestion/04-data-model.md) for ingestion-specific models.

---

## Domain

Domain models and business logic documentation.

### [Racing Classes Domain Model](domain/racing-classes.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Authoritative domain model for racing classes in the MRE application. Defines the complete taxonomy of car classes (vehicle types), modification rules (Modified/Stock), and skill groupings (Junior/Pro/Expert). Essential reference for understanding what racing classes mean in the MRE domain and how they are extracted from LiveRC data.

**Key Topics:** Car classes (1/8 buggy, 1/8 truggy, 1/10 2WD/4WD), modification rules (Modified vs Stock), skill groupings, class name extraction, database storage, future normalization considerations.

**Related:** See [Database Schema Documentation](database/schema.md) for `Race.className` field. See [LiveRC Ingestion Data Model](architecture/liverc-ingestion/04-data-model.md) for data model specification.

---

## Design

Visual design, UX principles, and user experience guidelines.

### [MRE UX Principles](design/mre-ux-principles.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Mandatory User Experience principles for all MRE Alpha features. Defines core UX philosophy, laws of UX, foundational layout rules, form patterns, content rules, and mobile-specific requirements.

**Key Topics:** Jakob's Law, Fitts's Law, single-column layouts, form validation, error handling, mobile-first design.

**Related:** See [Role Responsibilities](design/mre-ux-principles.md#12-role-responsibilities) section for UX role ownership.

### [MRE Dark Theme Guidelines](design/mre-dark-theme-guidelines.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Visual standards and token system for MRE dark theme implementation. Defines semantic token naming (`--token-*`), core dark theme rules, typography, spacing, forms, and mobile requirements.

**Key Topics:** Token naming convention, contrast ratios, layered surfaces, typography rules, spacing scale, form styling.

### [MRE Mobile UX Guidelines](design/mre-mobile-ux-guidelines.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Mobile UX guidelines ensuring all screens are touch-friendly and mobile-compliant. Defines mobile-first foundation, viewport breakpoints, touch target requirements, form rules, navigation patterns, and responsive behavior.

**Key Topics:** Mobile-first design, touch targets (44px minimum), single-column layouts, keyboard-friendly behavior, responsive breakpoints.

### [MRE Hero Image Generation](design/mre-hero-image-generation.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Standards and prompts for generating MRE hero images using AI tools. Defines visual style, composition rules, Stable Diffusion prompt structure, and image output requirements.

**Key Topics:** Visual style guidelines, prompt templates, negative prompts, image format requirements, licensing rules.

**Note:** Active but not implemented in Alpha UI.

---

## Development

Development guides, testing strategies, and contributing guidelines.

### [Developer Quick Start Guide](development/quick-start.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Step-by-step developer onboarding guide. Provides prerequisites, setup instructions, first-time workflow, running tests, useful commands, common setup issues, and IDE recommendations.

**Key Topics:** Prerequisites, initial setup, running the application, first-time developer workflow, running tests, useful commands, troubleshooting, IDE recommendations.

**Related:** See [README.md](../README.md) for project overview. See [Environment Variables Reference](operations/environment-variables.md) for configuration.

### [Testing Strategy and Guidelines](development/testing-strategy.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Comprehensive testing strategy for the MRE application. Defines testing pyramid, testing tools, test organization, testing patterns, frontend/backend/integration testing guidelines, and CI/CD requirements.

**Key Topics:** Testing pyramid, testing tools (pytest, Vitest), test organization, testing patterns, frontend testing, backend testing, integration testing, test coverage requirements, CI/CD testing.

**Related:** See [Ingestion Testing Strategy](architecture/liverc-ingestion/18-ingestion-testing-strategy.md) for ingestion-specific testing. See [Integration Testing Guide](development/integration-testing-guide.md) for detailed integration testing.

### [Integration Testing Guide](development/integration-testing-guide.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Detailed integration testing guide. Provides guidance for integration test setup, test data management, mocking strategies, database testing, API integration testing, and CI/CD integration.

**Key Topics:** Integration test setup, test data management, mocking external services, database testing strategies, API integration testing, end-to-end testing, CI/CD integration testing.

**Related:** See [Testing Strategy](development/testing-strategy.md) for overall testing approach. See [Contributing Guidelines](development/CONTRIBUTING.md) for testing requirements.

### [Contributing Guidelines](development/CONTRIBUTING.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Comprehensive contributing guidelines for the MRE project. Includes code of conduct, development workflow, branch naming, commit messages, pull request process, code review guidelines, testing requirements, and release process.

**Key Topics:** Code of conduct, development workflow, branch naming conventions, commit message guidelines, pull request process, code review guidelines, testing requirements, documentation requirements, release process.

**Related:** See [Quick Start Guide](development/quick-start.md) for setup. See [File Headers Standards](standards/file-headers-and-commenting-guidelines.md) for code standards.

### [CHANGELOG](development/CHANGELOG.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Changelog template following Keep a Changelog format. Documents all notable changes to the MRE project, organized by version with categories for Added, Changed, Deprecated, Removed, Fixed, and Security.

**Key Topics:** Version history, change categories, release notes format.

**Related:** See [API Versioning Strategy](api/versioning-strategy.md) for API versioning. See [Contributing Guidelines](development/CONTRIBUTING.md) for release process.

---

## Specifications

Feature specifications and requirements for the Alpha release.

### [MRE Alpha Feature Scope](specs/mre-alpha-feature-scope.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

**Authoritative specification** for the strict, locked-down feature set for the MRE Alpha Release. Defines allowed features (registration, login, welcome pages, admin console) and explicitly forbidden features.

**Key Topics:** Alpha feature list, out-of-scope features, architecture requirements, UI/UX requirements, completion criteria.

**Related:** See [Role Ownership](specs/mre-alpha-feature-scope.md#9-role-ownership) section for feature ownership.

### [MRE Under Development Page Specification](specs/mre-under-development-page.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Complete specification for the `/under-development` placeholder page. Defines route, required message, layout requirements, accessibility, and integration with navigation.

**Key Topics:** Route definition, required message, layout rules, component usage, testing requirements.

---

## Architecture Decision Records (ADRs)

Documentation of significant architectural decisions.

### [ADR Index and Guidelines](adr/README.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Index and guidelines for Architecture Decision Records (ADRs). Defines when to create ADRs, ADR format, lifecycle, storage structure, and usage in development.

**Key Topics:** ADR purpose, when to create ADRs, ADR format template, lifecycle (Proposed/Accepted/Rejected/Superseded), role responsibilities.

**Related:** See [Role Responsibilities for ADRs](adr/README.md#9-role-responsibilities-for-adrs) section.

### [ADR-20250127: Adopt Mobile-Safe Architecture](adr/ADR-20250127-adopt-mobile-safe-architecture.md)

**Status:** Complete (ADR Status: Accepted)  
**Last Updated:** 2025-01-27

Documents the architectural decision to adopt the Mobile-Safe Architecture Guidelines as the authoritative standard for the MRE codebase.

**Key Topics:** Context for mobile-safe architecture, decision rationale, consequences, alternatives considered.

---

## Role Documentation

Engineering role definitions, responsibilities, and collaboration patterns.

### Overview

The MRE project uses a role-based development approach where different engineering roles have specific responsibilities and areas of ownership. Each role document defines:

- Mission statement
- Core responsibilities
- Key handoffs and collaboration
- Success metrics

### Role Documents

- **[DevOps & Platform Engineer](roles/devops-platform-engineer.md)**  
  **Status:** Complete | **Last Updated:** 2025-01-27  
  Infrastructure, CI/CD pipelines, deployment automation, environment provisioning

- **[Documentation & Knowledge Steward](roles/documentation-knowledge-steward.md)**  
  **Status:** Complete | **Last Updated:** 2025-01-27  
  Documentation quality, ADR facilitation, knowledge management, cross-linking

- **[Next.js Front-End Engineer](roles/nextjs-front-end-engineer.md)**  
  **Status:** Complete | **Last Updated:** 2025-01-27  
  UI components, App Router patterns, performance budgets, design token usage

- **[Observability & Incident Response Lead](roles/observability-incident-response-lead.md)**  
  **Status:** Complete | **Last Updated:** 2025-01-27  
  Structured logging, metrics, tracing, alerting, incident response

- **[Prisma/PostgreSQL Backend Engineer](roles/prisma-postgresql-backend-engineer.md)**  
  **Status:** Complete | **Last Updated:** 2025-01-27  
  Database schema, migrations, query performance, data integrity

- **[Quality & Automation Engineer](roles/quality-automation-engineer.md)**  
  **Status:** Complete | **Last Updated:** 2025-01-27  
  Testing strategies, CI/CD pipelines, test coverage, quality gates

- **[Senior UI/UX Expert](roles/senior-ui-ux-expert.md)**  
  **Status:** Complete | **Last Updated:** 2025-01-27  
  UX principles, design systems, accessibility standards, information architecture

- **[TypeScript Domain Engineer](roles/typescript-domain-engineer.md)**  
  **Status:** Complete | **Last Updated:** 2025-01-27  
  Domain modeling, business logic, type safety, framework-agnostic design

**See also:** [README.md](../README.md#9-role-documentation) in project root for role overview.

---

## Standards

Coding standards and documentation guidelines.

### [File Headers and Code Commenting Guidelines](standards/file-headers-and-commenting-guidelines.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Mandatory standards for file headers and code commenting across all files in the MRE project. Defines header format by file type, code commenting standards, maintenance guidelines, and LLM behavior requirements.

**Key Topics:** File header format (TypeScript, Markdown, JSON, YAML, Prisma, CSS), JSDoc comments, inline comments, TODO/FIXME format, maintenance checklist.

---

## Reviews

Infrastructure and environment reviews.

### [Docker Review Report](reviews/DOCKER_REVIEW_REPORT.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Review and guidance for Docker infrastructure and environment setup. Evaluates Docker configuration, container networking, environment variables, and developer workflow.

**Key Topics:** Container architecture, network configuration, database connection, environment variables, recommended improvements, Alpha restrictions.

---

## Operations

Operational documentation for deployment, environment configuration, and observability.

### [Docker User Guide](operations/docker-user-guide.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

**Comprehensive Docker user guide** providing complete Docker architecture documentation, setup instructions, usage guide, development workflow, troubleshooting, and production considerations. This is the authoritative guide for understanding and working with the MRE Docker environment.

**Key Topics:** Docker architecture, container details, network architecture, volume management, environment configuration, initial setup, daily usage, development workflow, troubleshooting, production considerations.

**Related:** See [Docker Review Report](reviews/DOCKER_REVIEW_REPORT.md) for Docker evaluation. See [Quick Start Guide](development/quick-start.md) for developer onboarding. See [Deployment Guide](operations/deployment-guide.md) for deployment procedures.

### [Environment Variables Reference](operations/environment-variables.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Complete reference for all environment variables used in the MRE application. Documents required vs optional variables, default values, validation rules, environment-specific configurations, and security considerations.

**Key Topics:** Variable groups (database, application, authentication, ingestion, system), required vs optional, default values, validation rules, environment-specific values, security considerations, example configurations.

**Related:** See [Docker User Guide](operations/docker-user-guide.md) for Docker setup. See [Deployment Guide](operations/deployment-guide.md) for deployment configuration.

### [Deployment and DevOps Runbook](operations/deployment-guide.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Comprehensive deployment procedures and DevOps runbook. Includes pre-deployment checklists, deployment steps, database migration procedures, rollback procedures, health checks, and post-deployment verification.

**Key Topics:** Deployment architecture, pre-deployment checklist, deployment procedures (development, staging, production), database migrations, rollback procedures, health checks, monitoring and alerting, disaster recovery.

**Related:** See [Docker User Guide](operations/docker-user-guide.md) for Docker architecture and usage. See [Environment Variables Reference](operations/environment-variables.md) for configuration.

### [Monitoring and Observability Guide](operations/observability-guide.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Comprehensive observability guide covering logging, metrics, tracing, alerting, dashboard setup, troubleshooting, and performance monitoring. Ensures consistent observability practices across the application.

**Key Topics:** Logging standards, structured logging, metrics collection, tracing setup, alerting configuration, dashboard setup, troubleshooting workflows, performance monitoring.

**Related:** See [Observability & Incident Response Lead Role](roles/observability-incident-response-lead.md) for role responsibilities. See [Ingestion Observability](architecture/liverc-ingestion/15-ingestion-observability.md) for ingestion-specific observability.

### [LiveRC Operations Guide](operations/liverc-operations-guide.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Operational guide for LiveRC ingestion operations. Provides commands and procedures for managing ingestion operations, track management, and event processing.

**Key Topics:** Ingestion commands, track management, event operations, operational procedures.

**Related:** See [LiveRC Ingestion Architecture](architecture/liverc-ingestion/01-overview.md) for technical details.

---

## Security

Security documentation and best practices.

### [Security Overview](security/security-overview.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

Comprehensive security documentation covering authentication, authorization, password security, session management, API security, data protection, security headers, dependency security, and security best practices.

**Key Topics:** Authentication architecture, authorization model, password security (Argon2id), session management, API security, data protection, security headers, dependency security, security best practices, incident response.

**Related:** See [Mobile-Safe Architecture Guidelines](architecture/mobile-safe-architecture-guidelines.md) for security rules. See [Ingestion Security](architecture/liverc-ingestion/17-ingestion-security.md) for ingestion-specific security.

---

## Frontend

Frontend-specific workflows and user experience documentation.

### [LiveRC User Workflow](frontend/liverc/user-workflow.md)

**Status:** Complete  
**Last Updated:** 2025-01-27

User workflow documentation for LiveRC integration features. Defines the end-to-end user experience for discovering tracks, selecting events, and viewing race data.

**Key Topics:** User journey, track selection, event discovery, date filtering, on-demand ingestion, data visualization.

**Note:** This feature is in scope for Alpha release. See [MRE Alpha Feature Scope](specs/mre-alpha-feature-scope.md) for details.

**Related:** See [LiveRC Ingestion Architecture](architecture/liverc-ingestion/01-overview.md) for technical implementation details.

---

## Documentation Status

Track documentation completion, placeholders, and maintenance in the [Documentation Status](STATUS.md) document.

**Quick Status:**
- ✅ 14/14 recommended documents created
- 📝 ~60 placeholders tracked for future completion
- 🔄 Monthly reviews scheduled

---

## Documentation Maintenance

This documentation index is maintained by the **Documentation & Knowledge Steward** role. See [Documentation & Knowledge Steward](roles/documentation-knowledge-steward.md) for responsibilities.

When adding new documentation:

1. Add entry to appropriate section above
2. Include brief description and key topics
3. Link to related documentation
4. Update this index's `lastModified` date
5. Update [Documentation Status](STATUS.md) with new document

---

## License

Internal use only. This documentation index governs documentation discovery and navigation for the MRE project.

