---
created: 2026-05-16
description: Index for implementation and remediation plan documents
purpose:
  Clarifies the role of this directory and avoids confusion about its name
  relative to other docs trees.
---

# Implementation plans (`docs/implimentation_plans/`)

This directory holds **time-bound implementation, migration, and remediation
plans** (telemetry, performance, UI refactors, domain features). Files here are
**planning artifacts**: they may lag the shipped codebase. For behaviour of the
running application, treat **`docker-compose.yml`**, **`src/`**,
**`ingestion/`**, and **`docs/operations/build-runtime-reference.md`** as
primary evidence.

## Directory name

The directory is spelled **`implimentation_plans`** (historical layout in this
repository). Internal and external links use that path; renaming would require a
coordinated move and link update across `docs/`.

## Related

- [MRE Documentation Index](../README.md)
- [Architecture docs](../architecture/) — normative system design
- [ADRs](../adr/) — accepted architectural decisions
