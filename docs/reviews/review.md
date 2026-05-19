---
created: 2026-05-19
purpose:
  Bug and logic review of the Event Analysis mains ladder (bracket model,
  layout, panel UI) and related documentation. No code changes in this pass.
scope:
  - src/core/events/main-bracket-ladder-model.ts
  - src/core/events/main-bracket-ladder-layout.ts
  - src/components/organisms/event-analysis/MainBracketLadderPanel.tsx
  - src/core/events/infer-bump-ups.ts (shared ladder helpers)
  - src/core/events/driver-main-event-progression.ts (round labels)
  - docs/architecture/event-analysis-mains-ladder.md
  - docs/user-guides/event-analysis.md (mains ladder excerpts)
relatedArchitecture:
  - docs/architecture/event-analysis-mains-ladder.md
---

# Review: Mains ladder implementation & docs

## Summary

The ladder pipeline is coherent end-to-end (sessions →
`buildMainBracketLadderModel` → `assignCenterYBySessionId` → SVG). Vitest
coverage exercises progression tagging, odd/even columns, LCQ bridging, and
mixed LCQ/direct paths. Several **documentation vs UI gaps**, **semantic
mismatches with Bump-Up inference**, and one **large unused computation path**
stand out.

---

## High severity

### 1. Edge “counts” are modeled but never painted

`computeBracketLayout` computes `labelX` / `labelY`, avoids overlaps with nodes
and other badges, and adjusts LCQ stacks (`MIN_LCQ_LABEL_GAP`). The rendered SVG
only draws `<path>` elements for edges—**no `<text>` (or similar) uses
`driverCount`, `labelX`, or `labelY`.**

Impact: Users cannot see advancement volumes on the diagram; docs that promise
counts are inaccurate.

Evidence:

- Architecture doc (`event-analysis-mains-ladder.md`): “advancement edges with
  counts / LCQ paths”.
- `MainBracketLadderPanel.tsx`: `layout.edges.map` renders paths only (no
  labels).

### 2. “Progressed from earlier rounds” ≠ Bump-Up–style advancement

Per-driver flags are driven by **`lastRoundLabelByDriver`** while iterating
sessions in **`sortSessionsForLadder` order** (`main-bracket-ladder-model.ts`).
Any driver who appeared in an earlier ladder session gets
`advancedFromPriorRound`, with **`progressedFromRoundLabel` set to that earlier
round’s label**.

That differs from **`inferBumpUpsFromSessions`**, which only emits a bump-up
when consecutive appearances have **strictly increasing** `getLadderRank`
(`from.rank >= to.rank` → skip).

Impact:

- A driver who **skips** an intermediate mains round but reappears later still
  looks “progressed” from the **last round where they appeared**, even though
  they did not literally advance through every intervening tier.
- **Bump-Up** and **Mains Ladder** can disagree on whether a promotion exists;
  docs imply aligned “inferred rules,” which is only loosely true (same session
  pool, different predicates).

Recommendation for docs/product: Either tighten copy to “appeared in an earlier
modeled ladder round” or align semantics with bump-up rank checks (explicit
trade-off).

---

## Medium severity

### 3. Structural fallback edges are all-or-nothing

When **`buildTransitionEdgesFromDriverPaths`** returns **no** edges, the model
fills gaps by linking each node to **`tierIndex + 1`**
(`main-bracket-ladder-model.ts`). If driver-derived edges exist **but omit parts
of the bracket** (e.g. sparse overlap), **no fallback runs**, leaving
disconnected tiers while still showing nodes.

### 4. Edge filtering uses visual columns, not ladder rank

Driver-path edges skip pairs when **`fromNode.tierIndex >= toNode.tierIndex`**.
`tierIndex` is layout-oriented (`displayColumnForSession`). If column assignment
ever diverges from true ladder depth, valid paths could be dropped or invalid
paths retained—rank is not used here (contrast bump-ups).

### 5. `describeMainLadderRound` often degrades to `"Round"` for standard bracket finals

For typical labels such as `Buggy 1/8 Odd Final`, **`getLadderRank`** returns
**`getBracketFinalLadderRank`** values (~60–100), not `6`, `7`, or `8`.
`describeMainLadderRound` only treats **`rank === 8 | 7 | 6`** as A-main / LCQ /
Semi before falling through; bracket fractions usually miss **`/\bmain\b/i`** as
well.

Impact: **`roundKind`** on nodes (and anything relying on it) often reads
**`"Round"`** instead of a bracket-aware label—weak semantics anywhere that
field is surfaced (e.g. modal context).

### 6. PNG export failures are swallowed

`exportPng` catches errors and sets exporting state without user-visible
feedback (`MainBracketLadderPanel.tsx`). Failures present as “nothing happened.”

### 7. Keyboard / overflow interaction: first activate may only scroll

`handleNodeClick`: when the bracket overflows and the node is out of view, the
handler **`scrollToNode`** and **returns without opening** the details modal.
Pointer clicks call the same helper—first click may only scroll; a **second**
interaction is needed to open the modal. Easy to interpret as a broken control.

---

## Low severity / polish

### 8. Tooltip duplicate tables vs accessibility

Hover/focus uses a portal tooltip marked **`aria-hidden="true"`** with
**`role="presentation"`**—expected for decorative hover, but
**`ProgressedDriversProgressTableHTML`** is duplicated per node in **`sr-only`**
regions. Docs acknowledge duplicate captions for SRs; worth verifying this
matches desired UX.

### 9. Horizontal bracket columns use raw `tierIndex`

`computeBracketLayout` uses **`maxTier`** from node **`tierIndex`** values.
Non-contiguous indices (gaps in column assignment) waste horizontal canvas
space; not wrong logically, but sparse events look odd.

### 10. LCQ labeling regex duplication

LCQ detection exists as **`labelLooksLikeLcq`** in `infer-bump-ups.ts` and ad
hoc **`/\blcq\b|last\s*chance/i`** in `MainBracketLadderPanel.tsx`. Small
divergence risk long-term; currently broadly aligned.

---

## Documentation gaps

| Topic              | Issue                                                                          |
| ------------------ | ------------------------------------------------------------------------------ |
| Edge annotations   | Docs describe counts on edges; UI does not render them (see finding 1).        |
| Progressed drivers | Copy suggests alignment with bump-up inference; semantics differ (finding 2).  |
| PNG export         | Guide/architecture mention export path but not failure modes or silent errors. |

`docs/architecture/event-analysis-mains-ladder.md` is otherwise accurate on file
touchpoints, routing, and distinction vs Bump-Up / Driver Progression panels.

---

## Positive observations

- **`parseBracketFinalDenominator`** restricts denominators to powers of two
  (`{1,2,4,8,16,32}`), so **`log2IntPow2`** is safe for typical bracket math
  despite using **`Math.round(Math.log2(d))`**.
- LCQ **bridge column** logic is documented in code and covered by tests
  (`places LCQ before 1/1 finals`, mixed LCQ/direct paths).
- **`assignCenterYBySessionId`** handles odd/even lane inversion when
  **`raceOrder`** lists even before odd (explicit test).
- Model tests explicitly guard against **odd/even sibling edges** (`16o→16e`
  absent).

---

## Suggested follow-ups (for implementers)

1. Render edge labels when `driverCount` is non-null, or remove unused layout
   logic and revise docs.
2. Align user-facing “progressed” wording with actual predicates—or align
   predicates with Bump-Up rank rules.
3. Consider hybrid edge completion: fallback only for nodes with zero incident
   driver-path edges.
4. Teach **`describeMainLadderRound`** about **`getBracketFinalLadderRank`**
   outcomes (or derive round kind from fraction denominator).
5. Surface PNG export errors (toast or inline message) and revisit modal open vs
   scroll precedence.
