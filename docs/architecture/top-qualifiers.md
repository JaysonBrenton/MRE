---
created: 2026-04-12
owner: Platform / Event Analysis
lastModified: 2026-04-12
description:
  Normative design for defining and surfacing top qualifiers (TQ) in MRE from
  ingested race data.
purpose:
  Single source of truth for definitions, data inputs, v1 rules, edge cases,
  persistence options, and relationships to bump-ups and ingestion.
relatedFiles:
  - docs/future-ideas/top-qualifiers-and-seeding-rounds.md
  - docs/implimentation_plans/top-qualifiers-2026-04.md
  - prisma/schema.prisma
  - src/core/events/get-event-analysis-data.ts
  - docs/architecture/liverc-ingestion/04-data-model.md
  - ingestion/connectors/liverc/parsers/race_results_parser.py
---

# Top qualifiers (TQ)

## Problem

Users want to see **who earned the best qualifying performance** for an event
class without manually comparing every qualifying session. RC programs vary
(single round, multiple rounds, combined points, drops), but a **minimal,
explainable** rule set can still add value when data is present.

This document is **normative** for how MRE should define and derive top
qualifiers once implemented. Product background and UX brainstorming remain in
[top-qualifiers-and-seeding-rounds.md](../future-ideas/top-qualifiers-and-seeding-rounds.md).

## Definitions

| Term                                     | Meaning in MRE                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Top qualifier (TQ)**                   | The driver(s) with the **strongest qualifying outcome** for a given **event race class** (see scope below), derived from ingested sessions—not a separate trophy row from LiveRC unless we add one later.                                                                                                                      |
| **Qualifying session**                   | A `Race` whose `sessionType` is `qualifying` (after ingestion normalization), optionally corroborated by `raceLabel` / `sectionHeader` text (e.g. “Qualifier Round 1”).                                                                                                                                                        |
| **`qualifyingPosition` on `RaceResult`** | Parsed from LiveRC result tables: the **Qual** column for **that result row**—often **starting grid position for the race that row belongs to** (e.g. main), not automatically “position in a qualifying race.” See [LiveRC parser](#liverc-ingestion-and-qual-column). **Do not** assume it equals “TQ rank” without context. |
| **Position in a qualifying race**        | `RaceResult.positionFinal` for a row where the parent `Race` is a qualifying session. Primary signal for “who won / placed in Q1, Q2, …”.                                                                                                                                                                                      |

**Scope (intended v1):** **Per `EventRaceClass` (class)** only. Event-wide or
multi-class “overall TQ” is out of scope unless explicitly added later.

**Seeding rounds** (sessions whose purpose is to seed later rounds) are **out of
scope** for this document; see section 2 of
[top-qualifiers-and-seeding-rounds.md](../future-ideas/top-qualifiers-and-seeding-rounds.md).

## Data inputs

Derivation should use data already loaded for event analysis (see
`getEventAnalysisData` and `EventAnalysisData`):

| Input                                                       | Use                                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Race.sessionType`                                          | Filter to `qualifying` for primary TQ logic.                                                                                    |
| `Race.raceLabel`, `Race.sectionHeader`                      | Disambiguation, display, debugging; optional heuristics when `sessionType` is missing or wrong.                                 |
| `Race.eventRaceClassId` / class grouping                    | Bucket results **per class** for TQ.                                                                                            |
| `RaceResult` in qualifying races                            | `positionFinal`, `fastLapTime`, `totalTimeSeconds`, `lapsCompleted` for ordering and tie-breaks.                                |
| `RaceResult.qualifyingPosition` on **non-qualifying** races | May represent grid into mains; use only when explicitly justified (e.g. corroborating narrative), not as the default TQ signal. |

Indexes and shapes are defined in [Prisma schema](../../prisma/schema.prisma)
(`Race`, `RaceResult`, `EventRaceClass`, `SessionType`).

### LiveRC ingestion and “Qual” column

The LiveRC race results parser reads a **Qual** column into
`qualifying_position` (see
`ingestion/connectors/liverc/parsers/race_results_parser.py`). Semantics depend
on **which race** the HTML table represents. TQ derivation should prefer **rows
whose parent race is a qualifying session** and use **`positionFinal`** there,
unless product later defines a different rule.

Ingestion contracts and labels:
[04-data-model.md](./liverc-ingestion/04-data-model.md).

## v1 rules (proposed — lock in implementation plan)

Until implementation, treat the following as **defaults**; change only via
explicit product decision and doc update.

1. **Eligibility:** Consider only `Race` rows with `sessionType === qualifying`
   and a non-null `eventRaceClassId` matching the class under analysis.
2. **Metric:** Among qualifying sessions for that class, each driver’s **best**
   (minimum) **finishing position** `positionFinal` across those races. Lower is
   better. Skip drivers with no valid position in any qualifying race.
3. **TQ set:** All drivers tied for that **best** position (co–top qualifiers)
   unless UI prefers a single winner (product choice).
4. **Tie-break (optional v1):** If product requires a single TQ, prefer the
   driver with the **better (lower) `fastLapTime`** among races that produced
   the tied best position; if still tied, retain tie or use second-best finish
   (document final choice in implementation plan).

**Explicit non-goals for v1 (unless added later):**

- Drop rounds, combined points across three qualifiers, or series-specific
  points tables (e.g. ROAR/FMAR) unless sourced as explicit metadata.
- Inferring TQ from **main** or **heat** results alone.
- Persisted `TopQualifier` rows (see
  [Persistence options](#persistence-options)); v1 may be **compute-only**.

## Incomplete or ambiguous data

Rules must stay **explainable** when ingestion is partial:

- Missing or incorrect `sessionType`: optionally fall back to label heuristics
  (e.g. `raceLabel` contains “Qualifier”)—document any heuristic and add tests.
- No qualifying races for a class: return **no TQ** for that class (empty /
  `null`), not a guess.
- Multiple classes merged incorrectly: fix classing / taxonomy separately; TQ
  follows `eventRaceClassId` as stored.

## Relationship to bump-ups and domain docs

- **Bump-ups / LCQ:** Language overlaps (“qualifier”, “Last Chance Qualifier”)
  but bump-up inference is a **different** graph problem. Cross-read
  [bump-ups-inference.md](../domain/bump-ups-inference.md) and bump-up ADRs to
  avoid conflating **LCQ mains** with **qualifying session TQ**. No requirement
  that TQ logic call bump-up code.
- **Triple-A scoring:**
  [triple-a-main-scoring.md](../domain/triple-a-main-scoring.md) discusses “top
  N qualifiers” in a **scoring** context; align wording in UI so users do not
  confuse **series rules** with **MRE’s TQ badge**.

## Persistence options

| Approach                                                         | Pros                                                                      | Cons                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Compute in `getEventAnalysisData` (or pure helpers it calls)** | No migration; always consistent with current rules; easy to change rules. | CPU per request; must keep logic deterministic.           |
| **Materialized rows / cache table**                              | Faster reads; historical snapshot if rules change.                        | Migrations; invalidation when events re-ingest.           |
| **Async job**                                                    | Offloads work from request path.                                          | Complexity; still needs source of truth for invalidation. |

**Recommendation:** Start with **compute-only** in core + analysis payload; add
an ADR if product requires **materialized** TQ or ingestion-time writes.

When a durable choice is locked, record it here or in a dedicated ADR per
[docs/adr/README.md](../adr/README.md).

## API and UI direction (non-binding)

- Extend **`EventAnalysisData`** (and JSON types in
  `src/types/event-analysis-api.ts`) with a stable DTO, e.g. per-class:
  `topQualifiers: { eventRaceClassId, driverIds, optional tie metadata }[]` or a
  map keyed by `eventRaceClassId`.
- **UI:** Badges on results tables, summary strip on Overview, or session list
  chips—follow [atomic-design-system.md](./atomic-design-system.md).

## References

- Future ideas (product):
  [top-qualifiers-and-seeding-rounds.md](../future-ideas/top-qualifiers-and-seeding-rounds.md)
- Implementation checklist:
  [top-qualifiers-2026-04.md](../implimentation_plans/top-qualifiers-2026-04.md)
- Event analysis assembly: `src/core/events/get-event-analysis-data.ts`
- Agents / Docker verification: [AGENTS.md](../AGENTS.md)
