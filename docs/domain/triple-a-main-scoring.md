---
created: 2026-04-03
creator: Jayson Brenton
lastModified: 2026-04-03
description:
  IFMAR and ROAR rules for triple A-main overall scoring (1/8 and 1/10 electric
  off-road), including tie-breakers and incomplete-finals handling.
purpose:
  Defines how overall results are derived from multiple A-main legs for electric
  off-road classes that use triple mains. Serves as the authoritative reference
  for product logic, data modeling, and UI labels when computing or displaying
  overall standings versus single-leg results.
relatedFiles:
  - docs/domain/racing-classes.md
  - docs/architecture/liverc-ingestion/04-data-model.md
  - src/core/events/multi-main-class-match.ts (class chip vs LiveRC classLabel)
  - src/components/organisms/event-analysis/MultiMainOverallCard.tsx (UI for
    ingested overall)
---

# Triple A-Main Overall Scoring (IFMAR & ROAR)

**Status:** Reference  
**Scope:** Electric off-road classes that use **triple A-mains** (three separate
A-main finals), including **1/8 electric buggy** and **1/10 electric off-road**
(e.g. 2WD / 4WD buggy) at IFMAR World Championship and ROAR National
Championship style events.

This document defines how **overall** (event/championship) results are derived
from **multiple A-main legs**, including **point math**, **tie-breakers**, and
**special cases** (weather, incomplete schedules, ROAR early winner).

---

## 1. Concepts and terminology

| Term                         | Meaning                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Leg / final**              | One complete A-main race (e.g. A1, A2, A3).                                                                                            |
| **Finishing position**       | Place at the end of that leg (1st, 2nd, 3rd, …).                                                                                       |
| **Leg points**               | Points assigned from finishing position in a leg. Lower is better.                                                                     |
| **Counting legs**            | The subset of legs whose scores contribute to the overall result (e.g. **best 2 of 3** when three legs are run).                       |
| **Overall / final standing** | Ranking after applying the counting rule and tie-breakers. This is **not** the same as “winner of one leg” unless only one leg counts. |

**Important:** Overall results for triple mains are **derived** from several
legs. A podium or results table labeled “overall” should reflect this derived
ranking, not a single race unless explicitly stated.

---

## 2. Core scoring method (when all intended A-mains are run)

### 2.1 Leg scoring (position points)

In each leg:

- **1st place** → **1** point
- **2nd place** → **2** points
- **3rd place** → **3** points
- … and so on: **nth place** → **n** points

So **lower points are better** in every leg.

**Field size:** For IFMAR **1/10 off-road electric Worlds**, the A-main final
features the **top 10** qualifiers; positions still score **1 through 10** in
that final. Other events may have different main sizes; the same **position =
points** idea applies to however many positions exist in that leg.

### 2.2 Best-two-of-three (normal triple-main case)

When **three** A-main legs are completed and the format is **best 2 of 3**:

1. For each driver, take the **three** leg point totals from A1, A2, A3.
2. **Discard** the **worst** (highest) of the three leg scores.
3. **Sum** the **two remaining** (best) leg scores.
4. **Overall winner** is the driver with the **lowest** sum.
5. Rank all drivers by this sum (and tie-breakers below).

Equivalently: keep the **two lowest** leg scores (best two finishes); add them;
lowest total wins.

### 2.3 Examples (generic)

**Example A — clear winner**

| Driver | A1  | A2  | A3  | Leg points | Best two sum  |
| ------ | --- | --- | --- | ---------- | ------------- |
| X      | 2nd | 4th | 1st | 2, 4, 1    | 1 + 2 = **3** |
| Y      | 3rd | 2nd | 2nd | 3, 2, 2    | 2 + 2 = **4** |

Driver **X** wins overall (3 &lt; 4).

**Example B — tie on total points; IFMAR-style tie-break**

| Driver | A1  | A2  | A3   | Best two (lowest pair) | Sum   |
| ------ | --- | --- | ---- | ---------------------- | ----- |
| A      | 1st | 3rd | 8th  | 1 + 3                  | **4** |
| B      | 2nd | 2nd | 10th | 2 + 2                  | **4** |

Same sum (**4**). Tie-break: **best single finishing position** among the **two
counting legs** — **1 + 3** beats **2 + 2** because the best single finish is
**1st** vs **2nd**. So **Driver A** wins. This pattern appears explicitly in
IFMAR examples.

---

## 3. Tie-breakers (IFMAR framing)

When two or more drivers are **tied** on the **sum of their counting leg
points**, apply in order:

1. **Best single finishing position** in either of the **two counting finals**
   - Example: **1 + 3** beats **2 + 2** (a win in a counting leg beats two
     seconds).

2. If still tied: compare **laps and time** from the **best finishing counted
   leg** (the leg where the driver achieved their best finish among the counting
   legs, per rulebook wording). **Better laps/time wins.**

3. If still tied: compare the **second-best counted leg** (further comparisons
   as specified in the rulebook).

ROAR states tie-breaks in parallel terms (see §6): e.g. **best single finishing
rank**, then **most laps in the least time** from the driver’s **single fastest
run** of the **two scoring finishes** — align implementation to the exact ROAR
text when claiming “ROAR compliant.”

---

## 4. IFMAR special cases (1/8 and general)

### 4.1 Incomplete finals (weather / cancellation)

If not all scheduled finals are run, IFMAR allows the overall result to be
computed from **however many rounds were actually completed** (e.g. **1 of 1**
or **1 of 2** completed). The **counting rule** must match the number of legs
that exist (see §5 for IFMAR 1/10 explicit schedule).

### 4.2 Drivers missing a leg

If drivers in a final **do not run** a leg, IFMAR may assign **remaining points
in car-number order** (exact procedure is in the full IFMAR rulebook).
Implementations need the **official text** for edge cases.

---

## 5. IFMAR 1/10 electric off-road — exact structure (Worlds-style)

For **IFMAR 1/10 Electric Off-Road** (World Championship final for top
qualifiers):

- The final comprises **three separate races**.
- Each final is **5 minutes** (per IFMAR rules for this class).
- Finishing positions score **1** through **10** for **10th** (field of 10).
- **Best 2 of 3** finals count when **3** finals are completed.
- Lowest total from those **two** counting finals wins overall.

### 5.1 IFMAR reduced-finals rule (1/10 explicit)

If weather or interruption means **not all** A-mains are completed:

| Finals completed | What counts                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| **3**            | Best **2** of 3                                                                                        |
| **2**            | Best **1** of 2 (only **one** leg counts toward the total — not “sum of best two” when only two exist) |
| **1**            | That **single** final counts                                                                           |
| **0**            | **No** A-main finals completed → **qualifying order** determines the final result                      |

The **“0 mains → qual order”** rule is a distinct fallback for software: you
cannot compute a main-based overall if there is no main result.

---

## 6. ROAR — triple A-main (national championship electric classes)

ROAR uses a **Triple A Main** system for **National Championship electric
classes** (includes **1/10 off-road electric** and aligns with how **1/8
electric** nationals are described).

- **ROAR Qual-Points system:** lower finishing **ranks** across counting mains
  are better (consistent with 1, 2, 3, … position points).
- **Tie-breakers (ROAR wording):**
  1. **Best single finishing rank**
  2. **Most laps in the least time** from the driver’s **single fastest run** of
     the **two scoring finishes**

### 6.1 ROAR early winner (sit out A3)

**If a driver wins the first two A-mains (1st in A1 and 1st in A2), they are
already the overall winner** under ROAR and **must sit out the third A-main.**

Implications:

- Overall standing is **decided** without a third leg for that driver.
- Data models must allow **missing A3** for that driver **by rule**, not only by
  DNF.
- Competitors still run A3 for positions behind the champion; pairing/UX should
  not assume every driver has three leg rows.

### 6.2 ROAR session lengths (1/10 electric off-road)

ROAR specifies (for relevant national championship classes):

- **Qualifiers:** 5 minutes
- **A mains:** 5 minutes
- **Other mains:** 5 minutes

---

## 7. Practical algorithm (normative summary)

**Inputs (per class, per driver):**

- Finishing **position** (or DNF/DNS handling per rulebook) in **A1, A2, A3**
  when those legs exist.
- **Laps/time** per leg for tie-breaks.
- Metadata: which races are **A-mains**, **order** (1/2/3), and whether **ROAR
  early winner** applies.

**When 3 legs are completed (standard triple main):**

1. Convert each leg finish to **leg points** (1st = 1, 2nd = 2, …).
2. For each driver, sum the **two smallest** leg point values (**best 2 of 3**).
3. Sort by **lowest sum first**.
4. Break ties using **IFMAR** or **ROAR** ladder as required for the event.

**When fewer than 3 legs are completed:** use **§5.1** for IFMAR 1/10 (and
parallel logic for other formats per that event’s rulebook).

**When ROAR early winner applies:** after A2, if one driver has **two 1st-place
finishes**, assign **overall 1st** per ROAR and mark them **not competing in
A3** for overall purposes.

---

## 8. Differences to keep straight (checklist)

| Topic                     | Note                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Overall vs single leg** | Copy must distinguish **overall (triple main)** vs **A3 only** if both are shown.                         |
| **2 of 3 vs 1 of 2**      | With **only 2 finals run**, IFMAR 1/10 says **best 1 counts**, not sum of two.                            |
| **0 finals**              | Fall back to **qualifying order** (IFMAR 1/10).                                                           |
| **ROAR A3**               | Double winner may **skip A3** — not an error in data.                                                     |
| **Sanctioning body**      | Tie-break **wording** differs slightly (IFMAR vs ROAR); use the body that governs the event for disputes. |

---

## 9. Suggested implementation notes (software)

1. **Store per-leg results** with stable **leg index** (1/2/3) and **position**,
   **laps**, **time**.
2. **Compute overall** in a **pure function**: inputs → ordered standings +
   **audit trail** (which legs counted, why tie-break won).
3. **Unit tests** from published examples: **1+3 vs 2+2** on totals; **1+3 beats
   2+2** on tie-break; **3-leg vs 2-leg vs 1-leg** counting rules.
4. **ROAR flag:** if **A1 & A2** are both wins for one driver, **short-circuit**
   overall #1 and exclude them from A3 start list in **overall** logic.
5. **Display:** label tables **“Overall (IFMAR/ROAR triple main)”** when the
   data source or event exposes that tie-break mode (as on real results pages).

---

## 10. References (conceptual)

- **IFMAR:** 1/8 E-buggy Worlds / 1/10 Electric Off-Road Worlds rules — triple
  finals, position points, best **n** of **m**, tie-break order, reduced finals.
- **ROAR:** National Championship electric classes — Triple A Main, Qual-Points,
  tie-breaks, **win A1+A2 → skip A3**, session lengths for 1/10 electric
  off-road.
- **LiveRC-style results:** Events may show **“Tie Breaker: IFMAR/ROAR”** and
  overall rows derived from the three legs.

---

_This document summarizes rules as described in product requirements; for
protests and official standings, always use the current published rulebook for
the sanctioning body and event._
