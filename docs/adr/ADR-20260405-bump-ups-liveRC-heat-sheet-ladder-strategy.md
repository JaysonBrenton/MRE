---
created: 2026-04-04
status: Accepted
deciders: Engineering
---

# ADR-20260405 — Bump-ups: LiveRC heat-sheet ladder strategy and analysis data

## Context

ADR-20260404 established bump-ups as **inference on ingested results** using
**tier ranks** from labels and **schedule order**. Production events (e.g.
[RCRA 2026 Nationals Main Events](https://rcra.liverc.com/results/?p=view_event&id=491882))
show that:

1. **Main Events** is a **single ordered heat sheet** across classes;
   **`Race.raceOrder`** is the correct global timeline for “later” vs “earlier.”
2. **Labels are heterogeneous**: lettered mains (`EP Buggy A1-Main`),
   **bracket-style finals** (`Buggy 1/4 Odd Final` with **`Final`** not
   **`Main`**), and **LCQ** rows that may use
   **`className: "Last Chance Qualifier"`** instead of the class being
   contested.
3. A **single** `parseMainBracketLeg` path leaves **no ladder rank** for
   `… Final` rows and **`sessionType: race`**, so entire classes can disappear
   from bump-up output despite being real mains.
4. **`MultiMainResultEntry`** is ingested with **`driverId`**, but
   **`getEventAnalysisData`** historically mapped multi-main entries **without**
   `driverId`, blocking robust joins to per-race results for validation or
   enrichment.

## Decision

1. **Schedule source of truth** — For bump-up ordering, use **`raceOrder` then
   `startTime` then label** on the **full** `Race` set (already aligned with
   ingestion rules). When filtering to a **logical class**, preserve **relative
   order** of that class’s sessions as they appear in the global schedule.

2. **Multi-strategy ladder (layer B)** — Introduce **explicit strategies**
   (lettered mains, bracket fraction finals, LCQ, semi) that map a session to a
   **numeric or ordered tier** for comparison. Strategies may share helpers;
   **unknown** labels → **no rank** for that session (may yield empty
   inference).

3. **LCQ association** — Do **not** require a new LiveRC API field. **Merge**
   LCQ sessions into the target class’s inference input using **heuristics**:
   schedule neighbours, label tokens, and documented edge cases. LCQ remains
   **`kind: lcq`** on emitted edges when the lower session is LCQ-labelled.

4. **Multi-main enrichment** — Treat **`MultiMainResult` + entries** as
   **optional corroboration** for standings and per-leg positions. **Expose
   `driverId`** on each multi-main entry in **`EventAnalysisData`** (in addition
   to existing display fields) so code can join to `Driver` and race results
   without ambiguous name matching.

5. **Schema** — **No** new Prisma models for v1 of this ADR; use existing
   `Race`, `RaceResult`, `MultiMainResult`, `MultiMainResultEntry`.

## Consequences

**Positive**

- Bump-ups can be **correct** for RCRA-style **Final** naming and **LCQ** rows
  without pretending LiveRC emits structured bump flags.
- Multi-main data already paid for in ingestion becomes **usable** for product
  and tests once **`driverId`** is exposed.

**Negative**

- Heuristic LCQ→class mapping can **mis-associate** on unusual schedules;
  mitigations: tests, manual event list, future optional metadata if LiveRC ever
  exposes it.
- More branches in ladder logic → **more unit tests** and maintenance.

## Alternatives considered

1. **Ingestion-time rewrite of `className` for LCQ** — Deferred: would simplify
   queries but risks diverging from LiveRC source strings; heuristics keep raw
   data faithful.

2. **Require full lap ingest for bump-ups** — Rejected: bump-ups need
   **positions and identity**, not laps.

3. **Name-only join to multi-main** — Rejected for robustness: homonyms and
   formatting differ across pages.

## Related documents

- `docs/plans/bump-ups-liverc-main-events-solution.md`
- `docs/domain/bump-ups-inference.md`
- `docs/adr/ADR-20260404-bump-ups-inferred-from-results.md`
