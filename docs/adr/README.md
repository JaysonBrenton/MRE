---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Index and guidelines for Architecture Decision Records (ADRs)
purpose: This directory contains all Architecture Decision Records (ADRs) for the My Race
         Engineer (MRE) project. ADRs define and document significant architectural
         decisions, providing a permanent, auditable history of why key technical choices
         were made. This document is the authoritative index and guideline for creating
         and maintaining ADRs.
relatedFiles:
  - docs/adr/ADR-20250127-adopt-mobile-safe-architecture.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/roles/documentation-knowledge-steward.md
---

# Architecture Decision Records (ADR) for My Race Engineer (MRE)

This directory contains all **Architecture Decision Records (ADRs)** for the My Race Engineer (MRE) project.

ADRs define and document significant architectural decisions, providing a permanent, auditable history of why key technical choices were made.

This document is the authoritative index and guideline for creating and maintaining ADRs.

---

# 1. Purpose of ADRs

ADRs serve the following purposes:

* Capture the reasoning behind important technical decisions.
* Provide continuity for future developers and LLM tools.
* Prevent architectural drift.
* Document trade-offs and alternatives considered.
* Support future audits, refactors, and major releases.

Every ADR must be written from the perspective of long-term maintainability.

---

# 2. When to Create an ADR

An ADR **must** be created when any of the following occur:

* A change modifies or affects the system architecture.
* A change impacts API design, versioning, or schema.
* A decision affects multiple areas of the codebase.
* Deviating from the Mobile-Safe Architecture Guidelines.
* Deviating from the Alpha feature scope.
* Adoption of a new library or framework.
* Significant folder structure changes.
* Changes to authentication or security.

Cursor and other LLMs must require an ADR whenever a proposed change meets any of the above criteria.

---

# 3. When NOT to Create an ADR

An ADR is **not required** when:

* Fixing a small bug.
* Refactoring within an existing pattern.
* Updating documentation.
* Adding tests without changing architecture.
* Minor UI adjustments.

If unsure, create an ADR.

---

# 4. ADR Format

All ADRs must follow this exact template:

```
# ADR-YYYYMMDD-title

## Status
Proposed, Accepted, Rejected, Superseded

## Context
Detailed explanation of the situation, including relevant constraints.

## Decision
Clear statement of what is being decided and why.

## Consequences
What happens because of this decision. Positive, negative, and neutral side effects.

## Alternatives Considered
List and briefly discuss other options.
```

Naming rules:

* `YYYYMMDD` must reflect the date the ADR was created.
* Title must be lower case with hyphens.

Example:

```
ADR-20250127-adopt-mobile-safe-architecture.md
```

---

# 5. ADR Storage and Structure

All ADRs must live alongside this README in the same directory:

```
docs/adr/
```

Example structure:

```
docs/adr/
  ├── README.md
  └── ADR-20250127-adopt-mobile-safe-architecture.md
```

---

# 6. ADR Lifecycle

1. **Proposed**
   A new ADR is drafted and awaiting approval.

2. **Accepted**
   The decision is approved and must be implemented.

3. **Rejected**
   The decision is deemed unsuitable for the project.

4. **Superseded**
   An older ADR is replaced by a newer one.

LLMs may not treat a "Proposed" ADR as authoritative.

---

# 7. ADR Usage in Development

### 7.1 Before Writing Code

Developers and LLMs must:

* Check existing ADRs.
* Determine if a new ADR is required.

### 7.2 During Implementation

* Code must follow the ADR exactly.
* If implementation reveals issues, update the ADR.

### 7.3 During Review

* Code reviewers must confirm compliance with ADRs.
* Non-compliant code should be rejected.

---

# 8. ADR Usage by LLMs

LLMs must:

* Read ADRs before generating architecture-level code.
* Refuse speculative architecture changes without an ADR.
* Identify missing ADRs when a change requires one.
* Quote ADR text when making architectural decisions.

Cursor validation must include:

1. Check if ADR is required.
2. Verify ADR status.
3. Validate code aligns with accepted ADRs.

---

# 9. Role Responsibilities for ADRs

Different engineering roles have specific responsibilities related to ADRs:

* **Documentation & Knowledge Steward** (`docs/roles/documentation-knowledge-steward.md`): Facilitates ADR creation and review, maintains ADR index, ensures ADRs are properly cross-referenced with other documentation.

* **TypeScript Domain Engineer** (`docs/roles/typescript-domain-engineer.md`): Creates ADRs for domain modeling decisions, business logic architecture, and cross-cutting domain changes.

* **Prisma/PostgreSQL Backend Engineer** (`docs/roles/prisma-postgresql-backend-engineer.md`): Creates ADRs for database schema changes, migration strategies, and data architecture decisions.

* **Next.js Front-End Engineer** (`docs/roles/nextjs-front-end-engineer.md`): Creates ADRs for UI architecture changes, component patterns, and front-end framework decisions.

* **DevOps & Platform Engineer** (`docs/roles/devops-platform-engineer.md`): Creates ADRs for infrastructure changes, deployment strategies, and platform architecture decisions.

* **Senior UI/UX Expert** (`docs/roles/senior-ui-ux-expert.md`): Creates ADRs for design system changes, UX architecture decisions, and accessibility framework choices.

* **Observability & Incident Response Lead** (`docs/roles/observability-incident-response-lead.md`): Creates ADRs for observability architecture, logging standards, and telemetry infrastructure decisions.

* **Quality & Automation Engineer** (`docs/roles/quality-automation-engineer.md`): Creates ADRs for testing architecture, CI/CD pipeline changes, and quality gate decisions.

All roles should coordinate with the Documentation & Knowledge Steward when creating ADRs to ensure proper documentation and cross-linking.

---

# 10. First ADR Requirement

Before the MRE Beta release, at least one ADR must exist. Recommended first ADRs include:

* ADR adopting the Mobile-Safe Architecture.
* ADR defining the JSON API response format.
* ADR defining the core folder structure (`src/core/...`).

---

# 11. License

Internal use only. This directory governs long-term architectural decision-making for MRE.


