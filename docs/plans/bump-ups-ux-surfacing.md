---
created: 2026-04-04
owner: Product / Frontend
purpose:
  UX placement, layout, and wireframe-level notes for bump-ups (complements
  feature spec).
relatedDocs:
  - docs/plans/bump-ups-feature-spec.md
  - docs/domain/bump-ups-inference.md
---

# Bump-ups — UX surfacing (wireframe-level)

This document **extends** `docs/plans/bump-ups-feature-spec.md` with **where**
and **how** the UI is composed. It is not pixel design; use the atomic design
system and existing event-analysis tables for final styling.

## Placement (v1)

| Surface                                             | Role                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| **Sessions → Session chart tabs → Driver bump-ups** | Primary: full table + disclaimer + empty state.                           |
| **Overview**                                        | Not in v1 per feature spec; optional later: one summary line + deep link. |

**Gating:** Nitro classes only — reuse existing `isNitroClass` behaviour in
`SessionChartTabs` (tab hidden for electric).

## Wireframe — Sessions area (nitro class selected)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sessions                                                           │
│  [Class: 1/8 Nitro Buggy ▼]                                         │
│                                                                     │
│  Switch between the race grid, lap analysis, and driver bump-ups…   │
│                                                                     │
│  [ Race grid ]  [ Lap analysis ]  [ Driver bump-ups ]  ← active       │
├─────────────────────────────────────────────────────────────────────┤
│  Advancements are inferred from published race results; they are   │
│  not a statement of official rules or steward decisions.             │
│  (short disclaimer — copy from docs/domain/bump-ups-inference.md)   │
├─────────────────────────────────────────────────────────────────────┤
│  Driver          │ From          │ To        │ From │ To │ Kind    │
│  ────────────────┼───────────────┼───────────┼──────┼────┼──────── │
│  Jane Driver     │ B-Main        │ A-Main    │  3   │ 8  │ —       │
│  Alex Racer      │ Semi A        │ A-Main    │  4   │ 10 │ —       │
│  Sam Pilot       │ LCQ           │ A-Main    │  1   │ 12 │ LCQ     │
└─────────────────────────────────────────────────────────────────────┘
```

**Empty state (same tab):**

```
┌─────────────────────────────────────────────────────────────────────┐
│  [ Driver bump-ups ]                                                │
├─────────────────────────────────────────────────────────────────────┤
│  [disclaimer as above]                                              │
├─────────────────────────────────────────────────────────────────────┤
│  No advancements inferred for this class.                          │
│  This can happen if only a single main exists or session names     │
│  could not be matched to a ladder.                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Component notes

- **Table:** Reuse patterns from `SessionsTableResults` / other event-analysis
  tables (header row, zebra optional, same token usage).
- **Kind column:** Show badge or text only when `LCQ` (or similar) is inferred;
  use `—` or blank for normal advance.
- **Disclaimer:** Single paragraph, `text-sm`, `text-secondary` — must not push
  primary content below the fold on small screens.
- **Responsive:** On narrow viewports, allow horizontal scroll for the table or
  stack **From / To** into two lines per row (implementation choice; document
  final choice in PR).

## Optional v2 (not committed)

- **Single-driver filter** dropdown on the bump-ups tab (requires driver list
  for class).
- **Overview** strip: “N advancements inferred” + link to Sessions with class
  query.

## References

- Feature scope: `docs/plans/bump-ups-feature-spec.md`
- Disclaimer wording: `docs/domain/bump-ups-inference.md`
- Implementation hook:
  `src/components/organisms/event-analysis/sessions/SessionChartTabs.tsx`
