---
created: 2026-04-04
owner: Engineering / Product
purpose: End-to-end technical solution for robust bump-up inference aligned with LiveRC Main Events and existing ingestion.
status: implemented (core: bracket ladder ranks, LCQ schedule merge, multi-main `driverId` on analysis)
relatedDocs:
  - docs/domain/bump-ups-inference.md
  - docs/adr/ADR-20260404-bump-ups-inferred-from-results.md
  - docs/adr/ADR-20260405-bump-ups-liveRC-heat-sheet-ladder-strategy.md
  - docs/plans/bump-ups-feature-spec.md
  - docs/plans/bump-ups-test-plan.md
  - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md
---

# Bump-ups — LiveRC Main Events solution (technical specification)

This document defines the **target behaviour**, **data contracts**,
**implementation phases**, and **verification** for bump-up inference that
matches how
[LiveRC publishes Main Events](https://rcra.liverc.com/results/?p=view_event&id=491882)
(single heat-sheet schedule, multiple label schemes, LCQ rows, multi-main
aggregates). It extends the original v1 approach in `infer-bump-ups.ts` without
changing the core product definition in `docs/domain/bump-ups-inference.md`.

---

## 1. Goals

1. **Schedule fidelity** — Treat **global event order** (`Race.raceOrder` /
   `startTime`) as the Main Events timeline when filtering to a class; document
   this explicitly and validate against obvious LiveRC ordering drift.
2. **Tier coverage** — Support **multiple label families** on the same event:
   lettered mains (`EP Buggy B1-Main`), **bracket finals**
   (`Buggy 1/4 Odd Final`), **LCQ** (`Last Chance Qualifier A-Main`), and
   existing semi/LCQ heuristics.
3. **LCQ association** — Where LiveRC stores LCQ under a **different
   `className`** than the class mains, **merge** LCQ into the logical class
   ladder using **schedule position** and/or label hints (no new connector field
   required for v1).
4. **Optional enrichment** — Use ingested **`MultiMainResult` /
   `MultiMainResultEntry`** (including `mainBreakdownJson`) to corroborate or
   explain standings when per-race grids do not show the same driver across B
   and A; requires **`driverId`** on analysis entries (see §4).
5. **Honest empty states** — When labels are ambiguous or results do not link
   drivers across sessions, surface empty/partial states per existing spec.

Non-goals remain per **ADR-20260404** (no rulebook engine).

---

## 2. LiveRC model (authoritative mental model)

| Concept                | Meaning in MRE                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Event page**         | Lists rounds; **Main Events** links to a **heat sheet** of scheduled mains.                                                           |
| **Heat sheet order**   | One **global** sequence of mains across **all classes** for that day (e.g. row 1 = first main run, row 2 = second).                   |
| **`Race.raceOrder`**   | Ingestion assigns a **global** order index per race; must mirror heat sheet order (see ingestion validation rules).                   |
| **Row title**          | Combines **display class** + **session identity** (e.g. `EP Buggy E1-Main`, `Buggy 1/2 Even Final`).                                  |
| **Multi-main overall** | LiveRC exposes separate “Triple A-Main Results” / “Double B-Main Results” pages; MRE ingests these as `multi_main_results` + entries. |

Bump-up **inference** uses: **(schedule × tier rank × same driverId)**. It does
**not** require a separate “heat sheet id” column if `raceOrder` is correct.

---

## 3. Architecture (three layers)

| Layer                | Responsibility                                                                                       | Primary inputs                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **A. Schedule**      | Order sessions for the event (or for a class subset) on the global timeline                          | `raceOrder`, `startTime`                                  |
| **B. Tier / ladder** | Assign each session a **comparable rank** toward the championship final (higher = closer to A / 1/1) | `raceLabel`, `sessionType`, `sectionHeader`, strategy key |
| **C. Advancement**   | Emit edges where the **same `driverId`** has strictly **increasing** tier rank along schedule order  | `RaceResult` rows; optional `MultiMainResultEntry`        |

Current code implements A+C for **one ladder strategy** (lettered `Main` +
LCQ/semi). This solution adds **pluggable strategies** for layer B and **LCQ
injection** for layer A (per **ADR-20260405**).

---

## 4. Data inventory

### 4.1 Already ingested (sufficient for per-race inference)

| Data                    | Schema / source                                                          | Notes                         |
| ----------------------- | ------------------------------------------------------------------------ | ----------------------------- |
| Per-race results        | `Race`, `RaceResult`, `RaceDriver`, `Driver`                             | Positions, `driverId`, labels |
| Global order            | `Race.raceOrder`, `Race.startTime`                                       | Heat sheet order              |
| Labels & session typing | `raceLabel`, `className`, `sessionType`, `sectionHeader`, `raceMetadata` | Tier parsing                  |
| Multi-main aggregate    | `MultiMainResult`, `MultiMainResultEntry`, `mainBreakdownJson`           | Fetched in ingestion pipeline |

### 4.2 Exposed to analysis (`getEventAnalysisData`) — gap

| Need                            | In DB                                 | In `EventAnalysisData` today                               |
| ------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Multi-main entry **`driverId`** | Yes (`MultiMainResultEntry.driverId`) | **Missing** — entries only expose `driverName` + breakdown |

**Required change:** extend `multiMainResults[].entries[]` to include
**`driverId`** (and keep `mainBreakdown`) so advancement logic and UI can join
multi-main standings to `Driver` / per-race results without name ambiguity.

### 4.3 Not ingested as explicit fields (heuristics instead)

- **LCQ → class** foreign key — infer from **neighbouring races** on the
  schedule and title patterns.
- **LiveRC heat sheet page id** — optional future validation only.

---

## 5. Implementation phases

### Phase 1 — Ladder strategies (pure functions)

- **Lettered mains** — Keep / align `parseMainBracketLeg` + ranks (A > B > …;
  triple A legs same rank → no inter-leg bump unless product changes).
- **Bracket finals** — Parse `Buggy 1/n [Even|Odd] Final`: map `n` to depth
  (e.g. 16 → 8 → 4 → 2 → 1); define tie-breaking for Even vs Odd branches.
- **Final without “Main”** — Under `sectionHeader` / `sessionType` consistent
  with mains, treat **`Final`** in Main Events as a main-tier session when
  lettered parser does not apply (avoid double-counting practice rows).

**Files (target):** `src/core/events/infer-bump-ups.ts` (split helpers), new
`src/core/events/bump-up-ladder-strategies.ts` (or similar), unit tests under
`src/__tests__/core/events/`.

### Phase 2 — LCQ injection

- Build a **per-event ordered list** of candidate mains + LCQ rows.
- For each LCQ race (`className` or label matches LCQ), associate **target
  class** using:
  - **Next following main** rows whose label/class matches EP Buggy / Buggy / …
    heuristics, or
  - **Explicit product map** for known patterns (`Last Chance Qualifier` →
    following `EP Buggy` A stack).
- Run inference on **merged session list** for that logical class.

### Phase 3 — Analysis API

- Add **`driverId`** to `EventAnalysisData.multiMainResults[].entries[]`.
- Optionally add **`sourceMultiMainId`** if UI needs deep links (already on DB
  row).

### Phase 4 — UI and copy

- Overview / Sessions bump-up surfaces: consume merged inference; show
  disclaimer from domain doc.
- Empty states when **tier parse** returns no ranked sessions or **no driver
  overlap** between tiers.

### Phase 5 — Optional multi-main corroboration

- If per-race bump list is empty but multi-main breakdown shows progression,
  show **informational** copy or secondary table (product decision) —
  **requires** `driverId` on multi-main entries.

---

## 6. Testing and fixtures

- Extend **`docs/plans/bump-ups-test-plan.md`** checklists with: bracket-final
  labels, LCQ merge, `raceOrder` ordering.
- Fixtures: strings from LiveRC (e.g. RCRA Nationals Main Events list) and
  minimal synthetic `EventAnalysisData` in unit tests.
- Regression: **2026 RCRA Nationals** (`sourceEventId=491882`) as manual
  acceptance when ingest is full.

---

## 7. Operational requirements

- Events must be ingested with **races and results** for relevant mains
  (`ingestDepth` sufficient for results). Missing races → missing bump-ups
  (operational, not schema).

---

## 8. References

- Domain: [bump-ups-inference.md](../domain/bump-ups-inference.md)
- ADRs: [ADR-20260404](../adr/ADR-20260404-bump-ups-inferred-from-results.md),
  [ADR-20260405](../adr/ADR-20260405-bump-ups-liveRC-heat-sheet-ladder-strategy.md)
- Product: [bump-ups-feature-spec.md](./bump-ups-feature-spec.md)
- QA: [bump-ups-test-plan.md](./bump-ups-test-plan.md)
- Ingestion: `ingestion/ingestion/pipeline.py` (`_process_multi_main_results`),
  `docs/architecture/liverc-ingestion/03-ingestion-pipeline.md`
