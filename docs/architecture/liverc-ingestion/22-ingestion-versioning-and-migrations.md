---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Versioning and migration procedures for LiveRC ingestion subsystem
purpose:
  Defines version control, schema evolution, backward compatibility guarantees,
  and migration procedures for the LiveRC ingestion subsystem. Ensures explicit,
  predictable, and reversible versioning for a long-lived subsystem tightly
  coupled to upstream LiveRC HTML and internal canonical models.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/04-data-model.md
  - docs/architecture/liverc-ingestion/07-ingestion-state-machine.md
  - docs/architecture/liverc-ingestion/14-ingestion-idempotency-design.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 22. Ingestion Versioning and Migrations (LiveRC Ingestion Subsystem)

This document defines version control, schema evolution, backward compatibility
guarantees, and migration procedures for the LiveRC ingestion subsystem in My
Race Engineer (MRE). Because ingestion is a long-lived subsystem tightly coupled
to upstream LiveRC HTML and internal canonical models, versioning must be
explicit, predictable, and reversible.

This document governs:

- ingestion version identifiers
- backward compatibility guarantees
- parser and normaliser evolution
- fixture version evolution
- schema migrations and DB compatibility
- upgrading ingestion logic
- long-term maintainability across connector versions

---

## 1. Principles of Ingestion Versioning

1. Ingestion is a versioned subsystem; every compatible set of parsers,
   normalisers, and schemas has a version.
2. DB schema changes must never break existing ingestion runs.
3. New ingestion versions must preserve deterministic output for existing
   fixtures unless explicitly version-bumped.
4. Fixtures and ingestion logic evolve together.
5. No ingestion version may silently alter canonical output.
6. Ingestion logic must always be backward-compatible with historical fixture
   replays when possible.
7. Breaking changes require explicit migrations.

---

## 2. Ingestion Version Identifier (IVI)

The ingestion system tracks its version via:

- `ingestion_version` (global constant in codebase)
- `ingested_with_version` (per-event metadata field)

Example:

ingestion_version = "1.3.0"

Events store:

ingested_with_version = "1.2.1"

This allows deterministic replay of older events.

### 2.1 Why IVI Matters

- ensures stability
- prevents accidental cross-version inconsistencies
- supports fixture-based regression testing
- enables predictable updates
- allows multiple ingestion versions to coexist during transitions

---

## 3. Fixture Versioning

Fixtures have their own version number stored in metadata.json:

fixture_version: 1

Fixtures must be versioned independently from ingestion logic because:

- upstream HTML may change
- parser and normaliser may adopt new required fields
- canonical JSON snapshots may evolve

### 3.1 Rules

1. fixture_version increments when fixture structure changes.
2. fixture_version increments when fixture metadata changes in a way that
   affects tests.
3. fixture_version is stable across ingestion versions unless fixture content
   itself changes.

---

## 4. Schema Versioning

Database schema versions must follow:

schema_version = <integer>

Schema migrations MUST:

- never break existing ingestion data
- be backward-compatible where possible
- be forward-compatible when deterministic
- include migration scripts or auto-migrators

### 4.1 Additive Changes Preferred

Prefer:

- adding columns
- adding tables
- adding nullable fields

Avoid:

- changing semantics of existing fields
- removing fields without full migration
- altering data types unless safe

---

## 5. Backward Compatibility Guarantees

Backward compatibility ensures:

- historical events remain queryable
- ingestion replays of historical fixtures match expected output
- older ingestion outputs remain valid for analysis tools

The system must maintain compatibility for:

- canonical JSON output
- API responses
- lap, race, and event schemas

If compatibility cannot be preserved, a new ingestion version must be
introduced.

---

## 6. Breaking Changes Require Major Version Increment

The ingestion version must increment MAJOR (X.0.0) when:

- canonical schema changes
- lap schema changes
- race schema changes
- event schema changes
- ingestion logic produces different results for existing fixtures
- ingestion stops supporting older fixtures

Breaking changes MUST:

- update ingestion_version
- update schema_version
- require fixture regeneration or upgrade
- require migration scripts

---

## 7. Migration Types

There are four types of ingestion migrations.

### 7.1 Logic Migrations

Upgrading parsing or normalisation logic:

- must pass all fixture tests
- must not change canonical output unless version-bumped
- must update ingestion_version when semantics change

### 7.2 Schema Migrations

DB-level operations:

- adding new lap-level fields
- adding new race-level fields
- adding ingestion_status or metadata fields
- adding new connector tables

Schema migrations require:

- SQL migration scripts
- backward compatibility
- upgrade safe reenforcement

### 7.3 Fixture Migrations

When upstream HTML changes:

- fixtures must be regenerated
- snapshots must be updated
- fixture_version increments
- tests must be updated accordingly

### 7.4 Canonical Snapshot Migrations

Canonical JSON snapshots used for determinism tests may require updates when:

- ingestion logic evolves legitimately
- schema changes introduce new fields
- ordering rules become stricter

Snapshot migrations must be peer-reviewed.

---

## 8. Migration Workflow

### Step 1 — Identify Breaking vs Non-Breaking Change

Determine whether:

- canonical output changes
- schema interpretation changes
- fixture content changes

### Step 2 — Update Versions

Adjust:

- ingestion_version
- schema_version
- fixture_version

### Step 3 — Apply Schema Migrations

Run SQL migration scripts, such as:

- adding nullable fields
- adding new tables
- adding indexes

### Step 4 — Update Ingestion Logic

Modify:

- parser
- normaliser
- connector logic

### Step 5 — Regenerate Fixtures (if required)

Regenerate:

- event fixtures
- race fixtures
- lap fixtures
- metadata.json

### Step 6 — Update Canonical Snapshots

Run snapshot tests and regenerate stable canonical outputs.

### Step 7 — Replay All Fixtures

Ensure:

- determinism
- consistency
- backward compatibility

### Step 8 — Deploy Ingestion Update

Deployment must not begin until:

- all fixtures pass
- all snapshots match expected output
- CI ingestion suite is fully green

---

## 9. Multi-Version Compatibility

Some deployments may temporarily require:

- supporting ingestion_version 1.x and 2.x
- ingesting events under new logic but replaying old ones under old logic
- using version-specific parsers or normalisers

Rules:

- ingestion must respect ingested_with_version when interpreting stored data
- backend API outputs must remain stable for all versions
- connectors may require version-specific behaviour

This avoids breaking historical analytics.

---

## 10. Migration Safety and Rollback

### 10.1 Rollback Requirements

Rolling back ingestion logic must be possible without:

- corrupting DB state
- erasing data
- breaking fixture consistency

### 10.2 Safe Schema Migrations

All schema migrations must be:

- forward-compatible
- reversible (where feasible)
- reveal DB state clearly

### 10.3 Rollback Workflow

1. revert code to prior ingestion_version
2. ensure DB schema is still compatible
3. run fixture replay tests
4. re-enable ingestion

Rollback must not require new migrations unless unavoidable.

---

## 11. Long-Term Versioning Strategy

Future evolution of ingestion should include:

- automatic schema migration generator
- ingestion version registry per connector
- historical fixture indexing
- ingestion-version-aware diff tools
- semantic versioning enforcement in CI
- automated detection of unintended canonical output drift
- separate tracks for experimental and stable ingestion pipelines

These measures ensure MRE supports LiveRC for years, regardless of upstream
evolution.

---

End of 22-ingestion-versioning-and-migrations.md.
