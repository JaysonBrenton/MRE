---
created: 2026-04-04
owner: QA / Engineering
purpose: Test plan for bump-ups inference and UI (pre-implementation baseline).
relatedDocs:
  - docs/plans/bump-ups-feature-spec.md
  - docs/plans/bump-ups-liverc-main-events-solution.md
  - docs/adr/ADR-20260404-bump-ups-inferred-from-results.md
  - docs/adr/ADR-20260405-bump-ups-liveRC-heat-sheet-ladder-strategy.md
  - docs/domain/bump-ups-inference.md
---

# Bump-ups — test plan

## Unit tests (`src/core/events/`)

### Tier parsing

- [ ] **B-Main** label maps to a **lower** tier than **A-Main** for the same
      class.
- [ ] **Semi-final** / **Semi** labels map between lower mains and A-main when
      present (exact policy per ADR heuristics).
- [ ] **LCQ** / **Last Chance** labels receive `kind: lcq` (or equivalent) when
      matched.
- [ ] **Triple A** legs (`A1-Main`, `A2-Main`) do not count as bump-ups
      **between** legs unless product spec explicitly extends (v1: likely **no**
      inter-leg “bump”; document outcome in implementation).
- [ ] **Bracket finals** — `Buggy 1/n [Even|Odd] Final` maps to increasing tier
      as _n_ decreases (16 → … → 1) per
      `bump-ups-liverc-main-events-solution.md`.
- [ ] **`Final` without `Main`** under Main Events — tier rank assigned when
      appropriate (not dropped as unknown).
- [ ] **LCQ merge** — LCQ row with `className` `Last Chance Qualifier`
      participates in inference for the correct logical class when schedule
      heuristics apply.

### Advancement edges

- [ ] Driver with result in **B-Main** and later in **A-Main** → **one**
      advancement row.
- [ ] Driver only in **A-Main** → **no** advancement row.
- [ ] Driver in **B-Main** but not in **A-Main** → **no** upward edge (or
      optional “attempted” out of scope for v1).
- [ ] **DNS / DQ** handling: define expected behaviour (likely **no** bump edge
      if they did not complete the lower race — align with implementation).

### Ordering

- [ ] Races ordered by **event schedule** (start time or index) so “later” tier
      is not misclassified.

### Regression

- [ ] **Electric** class: core may return empty list; UI hides tab per existing
      nitro gate.

## Fixture sources

- Prefer strings copied from **LiveRC** results labels in
  `ingestion/tests/fixtures/liverc/` or real event snapshots (anonymised) once
  available.
- Add **minimal** inline fixtures in `src/__tests__/` for tier parser edge
  cases.

## UI / integration (manual or E2E when applicable)

- [ ] Nitro class with B → A shows rows in **Driver bump-ups** tab.
- [ ] Electric class: tab **not** shown (or disabled) per
      `bump-ups-feature-spec.md`.
- [ ] Empty state when no inferable advancement.
- [ ] Disclaimer text visible (short form acceptable).

## Out of scope for QA in v1

- Pixel-perfect match to IFMAR §3.5 grid.
- Validating **fastest semi** transfer slots without dedicated data contract.

## Analysis / API

- [ ] **`EventAnalysisData.multiMainResults[].entries`** include **`driverId`**
      when present in DB (see solution doc).

## References

- `docs/plans/bump-ups-feature-spec.md`
- `docs/plans/bump-ups-liverc-main-events-solution.md`
- `docs/adr/ADR-20260404-bump-ups-inferred-from-results.md`
- `docs/adr/ADR-20260405-bump-ups-liveRC-heat-sheet-ladder-strategy.md`
