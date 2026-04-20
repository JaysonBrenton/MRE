---
created: 2026-04-19
creator: Documentation
lastModified: 2026-04-19
description:
  Future product concept for grouping multiple events into a user-defined
  "series" for navigation and cross-event context
purpose:
  Capture intent for linking events that belong to the same championship or
  recurring program without committing to data model or roadmap placement.
relatedFiles:
  - docs/future-ideas/README.md
  - prisma/schema.prisma
---

# Idea: Event series (linking related events)

## Concept

Allow users to **link two or more events** in MRE into a **series**: a logical
grouping that represents a multi-round championship, club program, or any
sequence of race days that should be understood together.

A series is not assumed to exist in source data (e.g. LiveRC) as a first-class
object; this idea covers **explicit linking** (and optionally later: suggestions
from naming or schedule patterns).

## Example

**The Hills Holeshot Series** could be represented as two linked events:

1. The Hills Holeshot Series Round 1 — 21 March 2026
2. The Hills Holeshot Series Round 2 — 4 April 2026

Users (or admins) would attach both events to the same series record and see
them in a shared context (order by date, shared title/branding, cross-event
navigation).

## Why it might be valuable

- **Orientation:** Makes it obvious which race days belong to the same program.
- **Navigation:** Jump between rounds without treating each event as isolated.
- **Future analytics:** Enables series-level views (cumulative points, best
  finishes across rounds, attendance) if product scope expands later.

## Open questions (not decisions)

- **Ownership:** Per-user private groupings vs org-wide vs global curated
  series.
- **Creation:** Manual linking only at first vs heuristics (name similarity,
  same track, date proximity).
- **Ordering:** Explicit round number vs sort by event date only.
- **Identity:** Display name, slug, optional external reference (club website).
- **Overlap:** Relationship to tracks, clubs, or future “championship” entities
  if those appear in the domain model.

Nothing here is scoped for implementation. When this matures, promote it to
`docs/plans/` or `docs/implimentation_plans/`, an ADR if persistence and APIs
are contentious, and/or `docs/user-stories/future-features.md` as a formal epic.
