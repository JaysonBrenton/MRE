---
created: 2026-04-04
owner: Product / Frontend
purpose: Product specification for bump-up surfacing before implementation.
status:
  v1 implemented (Sessions tab — `inferBumpUpsFromSessions`,
  `DriverBumpUpsTable`)
relatedDocs:
  - docs/domain/bump-ups-inference.md
  - docs/plans/bump-ups-liverc-main-events-solution.md
  - docs/adr/ADR-20260404-bump-ups-inferred-from-results.md
  - docs/adr/ADR-20260405-bump-ups-liveRC-heat-sheet-ladder-strategy.md
  - docs/plans/bump-ups-test-plan.md
---

# Bump-ups feature — product specification

## Problem

Drivers and viewers care whether someone **advanced** from a lower main or semi
into a higher round (colloquially “bump-up”). The **Driver bump-ups** tab in
session analysis (`SessionChartTabs`) is reserved for nitro classes but
currently shows a placeholder. We need a clear, honest feature that works from
**ingested LiveRC data**, not from sanctioning-body PDFs.

## Goals

1. Show **who advanced** between observable **race tiers** for a selected
   **class**, when the data supports it.
2. Keep copy and behaviour aligned with **inference from results** (see domain
   note).
3. Ship first in the **Sessions** flow (existing tab), with room to link from
   Overview later.

## In scope (v1)

- **Nitro classes only** for the dedicated tab (consistent with existing
  `isNitroClass` gating in `SessionChartTabs`).
- **Per-class** bump-up list: driver, from-race label, to-race label, positions
  when available.
- **LCQ** (or similarly labelled last-chance race) surfaced as a distinct
  **kind** when the session label matches heuristics.
- **Empty and partial states:** only A-main, missing lower mains, or unparseable
  labels — explain briefly, do not fabricate advancement.

## Out of scope (v1)

- Encoding **IFMAR Christmas tree**, **ROAR §3.11**, or **BRCA hierarchical**
  rules as runtime **source of truth** (reference material remains human-facing
  only).
- Inferring **“next two fastest”** semi transfers without reliable cross-semi
  time data and explicit design.
- **Electric** bump-up tab (may remain hidden or copy-only “not applicable” if
  product prefers).

## User-facing success criteria

- A user selecting a nitro class with B-main → A-main (or semi → main) sees **at
  least one** advancement row that matches manual inspection of LiveRC results.
- Switching class or event does not leak stale rows.
- UI includes a **short disclaimer** (see domain note) without blocking the
  flow.

## Non-goals

- Legal or rules compliance certification for any sanctioning body.
- Replacing LiveRC as the authority on official results.

## UX surfacing (wireframes + layout)

Detailed placement, ASCII wireframes, and component notes:
**`docs/plans/bump-ups-ux-surfacing.md`**

## References

- Domain model: `docs/domain/bump-ups-inference.md`
- LiveRC-aligned solution (technical):
  `docs/plans/bump-ups-liverc-main-events-solution.md`
- Technical decisions:
  `docs/adr/ADR-20260404-bump-ups-inferred-from-results.md`,
  `docs/adr/ADR-20260405-bump-ups-liveRC-heat-sheet-ladder-strategy.md`
- QA: `docs/plans/bump-ups-test-plan.md`
- UX: `docs/plans/bump-ups-ux-surfacing.md`
