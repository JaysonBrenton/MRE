---
created: 2026-04-11
creator: Documentation
lastModified: 2026-04-11
description:
  Future product concepts for defining and surfacing top qualifiers and seeding
  rounds from ingested race data
purpose:
  Capture two related ideas so they can be scoped later without losing intent.
relatedFiles:
  - docs/future-ideas/README.md
  - docs/domain/racing-classes.md
  - prisma/schema.prisma
---

# Idea: Top qualifiers and seeding rounds

Two related enhancements: **what counts as a top qualifier** (and how we show
it), and **what counts as a seeding round** (and how we show it).

Nothing here is scoped for implementation; this records product direction only.

## 1. Top qualifiers — definition and surfacing

### Concept

**Top qualifiers** are drivers who achieved the strongest qualifying outcomes
for an event or class—e.g. best single run, best combined qualifying score, or
top-N grid positions—depending on the format the club or series used.

### Why it might be valuable

- Users quickly see who earned the best starting spots without reading every
  qualifying session.
- Highlights and comparisons (event overview, per-class tables) can emphasize
  qualifying performance separately from main-race results.

### Open definition work

- Agree on **rules per format**: single round vs multiple rounds, drops,
  combined points, bump-up from lower mains (may intersect with bump-up logic
  elsewhere).
- Map rules to **ingested structures**: `Race` / `RaceResult` labels, session
  types, ordering within an event, and any metadata LiveRC or other sources
  expose.
- Decide **scope**: per-class only, or also overall event when multi-class
  qualifying exists.

### Surfacing (possible directions)

- Badges or columns on results tables (e.g. “TQ” or “Top qualifier” where
  culturally appropriate).
- Filters or summary rows on event analysis (e.g. “Qualifying leaders”).
- Optional API fields on analysis payloads once definitions are stable.

---

## 2. Seeding rounds — definition and surfacing

### Concept

**Seeding rounds** are races or sessions whose primary purpose is to establish
order or placement for later rounds (e.g. seeding mains, reordering groups), as
opposed to finals or purely informational practice.

### Why it might be valuable

- Clarifies **why** a session exists in the schedule (narrative and analytics).
- Avoids misinterpreting a “lower stakes” round as a primary result when the
  meaningful race is later.

### Open definition work

- Distinguish **seeding** from **qualifying**, **heats**, and **mains** using
  labels, ordering, and rules common in RC programs (may require heuristics or
  source-specific parsing).
- Handle **multi-phase** events where the same driver appears in seeding then in
  a main.

### Surfacing (possible directions)

- Session type or tag in event analysis (timeline, session picker, tables).
- Copy/tooltips that explain seeding vs final results.
- Filters to hide or de-emphasize seeding rounds in certain views (optional,
  user-controlled).

---

## Constraints

- Definitions must remain **explainable** when data is incomplete (missing
  labels, partial ingestion).
- Any UI or API change should stay consistent with existing **session type** and
  **race label** semantics unless a deliberate model extension is approved.

## Implementation sketch (when/if prioritized)

- Discovery: audit LiveRC (and future sources) for how seeding and qualifying
  appear in HTML and structured fields.
- Prototype **deterministic rules** in ingestion or analysis with fixture-backed
  tests before exposing in the product UI.
