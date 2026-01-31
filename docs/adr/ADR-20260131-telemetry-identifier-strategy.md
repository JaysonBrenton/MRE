---
created: 2026-01-31
creator: Architecture
lastModified: 2026-01-31
description: Telemetry entity identifier format (UUID)
purpose:
  Resolves conflict between API contract examples (prefixed ULID-style IDs) and
  concrete data model (UUIDs). Single identifier strategy for telemetry.
relatedFiles:
  - docs/telemetry/Design/API_Contract_Telemetry.md
  - docs/telemetry/Design/Telemetry - Concrete Data Model And Contracts.md
  - docs/telemetry/reviews/telemetry_design_review.md
---

# ADR-20260131-telemetry-identifier-strategy

## Status

Accepted

## Context

API contract examples used prefixed ULID-style IDs (e.g. ses_01H...,
prun_01H...); the concrete data model uses UUIDs throughout. This causes schema,
URL, and client confusion.

## Decision

Use **UUIDs** for all telemetry entities (sessions, processing runs, artifacts,
datasets, etc.). Store and expose UUIDs without type prefixes in the API. Schema
and API examples must use UUIDs only. No ULID or prefixed-ID scheme.

## Consequences

- API contract doc and all examples must use UUIDs (e.g. standard UUID format).
- URLs and request/response bodies use UUIDs. Sort order is by created_at or
  explicit sort fields, not by ID time.
- Aligns with existing Postgres/Prisma UUID usage and the concrete data model.

## Alternatives Considered

- **Prefixed ULID (ses*..., prun*...):** Rejected to match current data model
  and avoid schema drift; UUID is sufficient and already used.
