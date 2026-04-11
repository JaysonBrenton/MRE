---
created: 2026-04-04
status: Accepted
deciders: Engineering
---

# ADR-20260404 — Bump-ups inferred from LiveRC results (not from rulebooks)

## Context

MRE surfaces event and session analysis from **ingested LiveRC data**.
“Bump-ups” are a racing concept with **body-specific** rules (IFMAR, ROAR, BRCA,
RCRA, event supplements). The repository holds a **reference** compilation of
those rules under `docs/reference_material/`, but LiveRC does not emit a
structured “bump-up” verdict per driver.

Implementing bump-ups requires a **technical definition** that is implementable,
testable, and honest when labels are ambiguous.

## Decision

1. **Compute bump-ups as graph inference on sessions and results** for a given
   class:
   - Assign each relevant race a **tier rank** (ordered from earliest / lowest
     ladder step toward the A-main) using **heuristics** on `raceLabel`,
     `sectionHeader`, `sessionType`, and schedule order.
   - A **bump-up edge** for a driver is: they have a result in tier _t_ and a
     later result in tier _t+1_ (strictly moving “up” the ladder), or an
     equivalent well-defined jump when labels encode LCQ → A-main.

2. **Place core logic** in **`src/core/events/`** as pure functions (e.g. input:
   races + results for one class; output: list of advancement records). Reuse or
   align with existing main/session helpers such as `main-bracket-overall.ts`
   and session ordering from `get-sessions-data` / `get-event-analysis-data`
   types — avoid duplicating inconsistent label parsing.

3. **Do not** embed PDF rule tables (IFMAR §3.5, ROAR §3.11, etc.) as runtime
   logic in v1.

4. **Surface LCQ** (and similar) by **label matching** (`LCQ`, `Last Chance`,
   etc.) as metadata on a race node, not as a separate product unless data
   supports it.

## Consequences

**Positive**

- Ship value without a rules maintenance burden.
- Unit-testable with **string fixtures** from LiveRC labels.
- Aligns with “descriptive docs match the build” — behaviour is defined by
  code + ADR.

**Negative**

- Heuristics can fail on unusual host naming; empty states and disclaimers are
  required.
- Cannot automatically validate “top _n_ bump” against the rulebook without a
  future **optional** rules pack.

## Alternatives considered

1. **Rulebook-first engine** — Rejected for v1: high maintenance, easy to be
   wrong vs actual event format.
2. **Manual curator flags per event** — Deferred: operational cost; could layer
   on later.
3. **Ingestion-time bump flags from LiveRC** — Rejected unless upstream provides
   explicit fields; not assumed available.

## Related documents

- `docs/plans/bump-ups-feature-spec.md`
- `docs/plans/bump-ups-liverc-main-events-solution.md`
- `docs/domain/bump-ups-inference.md`
- `docs/adr/ADR-20260405-bump-ups-liveRC-heat-sheet-ladder-strategy.md`
- `docs/plans/bump-ups-test-plan.md`

## Implementation notes (for developers)

- **UI:**
  `src/components/organisms/event-analysis/sessions/SessionChartTabs.tsx` —
  replace bump-ups placeholder when core API is ready.
- **Ordering:** Use the same temporal ordering as the rest of event analysis
  (race start times or LiveRC order index).
- **Electric vs nitro:** Product spec gates the tab to nitro for v1; core
  functions may still be class-agnostic for reuse.
