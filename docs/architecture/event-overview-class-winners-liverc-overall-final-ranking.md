---
created: 2026-04-19
creator: Architecture
lastModified: 2026-04-20
description:
  Authoritative semantics for LiveRC “Overall Final Ranking” and how MRE Event
  Overview “Class Winners” should relate to that page; includes UX placement for
  per-main (A/B Main) race winners vs overall class winners.
purpose:
  Defines the LiveRC final-results page (`p=event_overall_ranking`), column
  meanings, result-string formats, and the intended source of truth for
  per-class event winners. Specifies that A Main / B Main **race** winners are
  surfaced as **race results**, not as duplicate “class winner” tiles. Documents
  current MRE implementation and known gaps.
relatedFiles:
  - src/core/events/build-event-highlights.ts
  - src/core/events/class-winners-multi-main.ts
  - src/core/events/multi-main-participation.ts
  - src/components/organisms/event-analysis/EventOverviewTopQualifiers.tsx
  - ingestion/connectors/liverc/parsers/multi_main_result_parser.py
  - ingestion/connectors/liverc/connector.py
  - docs/frontend/liverc/user-workflow.md
---

# Event Overview: Class Winners and LiveRC Overall Final Ranking

## 1. Intended product meaning

In **Event Analysis → Overview**, the **Class Winners** sub-tab (component
`EventOverviewTopQualifiers`, variant `overviewCards`, tab id
`event-overview-highlights-tab-cw`) should show **the official winner of each
race class for the event**: the driver at **Pos 1** on LiveRC’s **Overall Final
Ranking** for that event, **per class**.

That LiveRC page answers: _“What was the final classified outcome of the event
after finals?”_ It is **not** qualifying, a single heat, or lap-by-lap detail.

**Canonical LiveRC URL pattern (per track + event):**

`https://{trackSlug}.liverc.com/results/?p=event_overall_ranking&id={sourceEventId}`

**Example (Pine Hills Dirt Racing, “The Hills Holeshot Series Round 1
(21/03/2026)”):**

[Overall Final Ranking on LiveRC](https://phdr.liverc.com/results/?p=event_overall_ranking&id=499423)

The query parameter `id` matches MRE’s stored `Event.sourceEventId` for LiveRC
imports (same id as on the track’s results site).

---

## 2. How LiveRC organizes the page

- The page is split **by class**. Class names appear as **tabs** (e.g. nav
  pills), e.g. “Ep Buggy”, “Ic Buggy”.
- Each class has one **final ranking table** after finals are complete.
- Rows are the **official overall finishing order** for that class (not merely
  one main’s finishing order unless the event structure reduces to that).

---

## 3. Table columns (LiveRC)

The per-class table uses these columns (see thead on the LiveRC page):

| Column      | Meaning                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pos**     | Overall finishing position **for that class** after event finals are resolved. **Pos 1 = class winner** (the primary value for MRE “Class Winners”). |
| **Brand**   | Intended for manufacturer/brand; often **empty** on this page.                                                                                       |
| **Country** | Intended for country; often **empty** on this page.                                                                                                  |
| **Driver**  | Competitor name.                                                                                                                                     |
| **Result**  | Compact performance summary for that row (see §4).                                                                                                   |
| **Race**    | Which final grouping the driver competed in for standings purposes (e.g. **A Main**, **B Main**).                                                    |

---

## 4. The **Result** field (dense; two common shapes)

LiveRC packs timing and (sometimes) finals metadata into **Result**. MRE does
not need to parse every nuance for a “winner name only” card, but **display and
future detail views** should treat this field consistently with LiveRC.

### 4.1 Laps / time tail (common to both shapes)

The trailing portion is standard RC-style notation:

`{laps}/{elapsed time}`

Examples:

- `17/10:02.843` → 17 laps in 10:02.843
- `45/30:01.668` → 45 laps in 30:01.668

**Abnormal markers** (may appear in or after the result text):

- **DNF** — Did Not Finish (partial laps/time before retirement).
- **DNS** — Did Not Start (e.g. `0/0.000` with DNS).

### 4.2 Single-main style (one bracket + laps/time)

When the class is resolved from **one final main** (no triple-/double-main
combined encoding on this page — example pattern from **Ic Buggy**):

`[n] {laps}/{time}`

- **`[n]`** — Finishing **place in that single final main** (e.g. A Main). So
  **`[1]`** means **1st in that main**; **`[4]`** means 4th in that main.
- **`{laps}/{time}`** — That main’s laps and elapsed time for this row.

Example: `ZAC RYAN` with Result `[1] 50/30:07.805`, Race A Main — **1st in A
Main**, 50 laps in 30:07.805. Overall **Pos** for the class aligns with that
main for drivers in that main, because there is only one such final to classify.

### 4.3 Multi-main / combined style (two brackets + laps/time)

When multiple mains are folded into **one overall class ranking** (example
pattern from **Ep Buggy** triple A-main):

`[x] [y] {laps}/{time}`

MRE does not ingest `event_overall_ranking` HTML today, but
**`p=view_multi_main_result`** for the same class exposes the same scoring idea
explicitly: a **Points** column plus per-main cells like
`1st (1pts) : 16/10:01.133` (see `MultiMainResultParser` in
`ingestion/connectors/liverc/parsers/multi_main_result_parser.py`). There, each
main’s **pts** matches **finishing place** in that main (1st → 1, 2nd → 2, …).
The **Points** column is the **aggregate** LiveRC uses for the combined
standings row.

**First bracket `[x]` (multi-main)** — Treat as the same quantity as the
**Points** column on **`view_multi_main_result`**: the **combined multi-main
score** after all configured mains (subject to LiveRC DNF/DNS rules not fully
documented here). It answers: _“How did this driver rank cumulatively across the
mains?”_ **Lower is better:** per-main “points” behave like **place numbers**,
so a smaller **total** means **better finishes on average** (e.g. total **2**
outranks total **3**). This is **not** the same as **Pos** on Overall Final
Ranking: two drivers can share the same first bracket (e.g. both **`[5]`**)
while **Pos** differs (3 vs 4) after tie-breakers.

**Second bracket `[y]` (multi-main)** — Strongest **informed** reading from row
patterns: **best** finishing place in **any one** main the driver ran (e.g.
**`[1]`** = won at least one main). Useful when comparing rows with similar
**Points** totals.

The **laps/time** segment is still the **displayed run summary** for that row
(often one main’s laps/time).

**Caveat:** LiveRC does **not** print labels for `[x]` and `[y]` on Overall
Final Ranking. The mapping above is **inferred** from LiveRC’s multi-main page
and table behaviour. Anything MRE shows in UI should phrase brackets as
**interpretation**, not as a published LiveRC spec.

### 4.4 **Race** column vs **Pos**

- **Race** identifies the **tier** of final the driver was in (e.g. A Main vs B
  Main). That value refers to a **specific race** (a final grouping), not to the
  whole-class story by itself.
- **Pos** is the **overall class position** after LiveRC’s final rules. A B Main
  driver can appear **below** all A Main finishers **even if** they had a strong
  result within the B Main — depends on event rules and how LiveRC combines
  mains.
- **Winner of the A Main** (or **B Main**) as a **race** means **P1 in that
  race’s results** — a **session / main outcome**. That is **not** the same
  thing as **Pos 1** on the Overall Final Ranking table unless the event
  structure makes them coincide (e.g. single A Main only).

---

## 5. MRE UX: overall class winners vs main-race winners

This section is **normative** for product behaviour: it ties LiveRC columns to
**where** MRE should show each concept.

### 5.1 Class Winners (Event Overview highlights)

- **Class Winners** should reflect **only** the **Overall Final Ranking**
  notion: **one winner per class tab** on `p=event_overall_ranking` — i.e. the
  driver at **Pos 1** in that class’s final ranking table.
- Do **not** add separate “class winner” tiles for **Ep Buggy Triple A-Main** /
  **Ep Buggy Triple B-Main** (or similar) when those are **per-main**
  breakdowns: they are not additional **classes** on the overall ranking page.

### 5.2 A Main / B Main — present as **race results**

- The **Race** column on Overall Final Ranking (A Main, B Main, …) labels which
  final each **row** belonged to. The people who **won** those finals (first
  place **in that race**) should appear in MRE as **race results** — the same
  surfaces used for session/main results (e.g. per-race results tables, main
  bracket views), with clear **race/session** context (label, class, main
  letter).
- **Example:** A driver may be **14th overall** in the class but **win the B
  Main**. Their **overall** standing belongs in the **overall final ranking**
  story; their **B Main win** belongs in **B Main race results**, not as the
  **class champion** tile.

### 5.3 Summary table

| Concept                              | LiveRC signal                                | MRE placement (intent)                                                        |
| ------------------------------------ | -------------------------------------------- | ----------------------------------------------------------------------------- |
| Official class champion after finals | **Pos 1** per class on Overall Final Ranking | **Class Winners** tab (one card per class on that page)                       |
| Winner of A Main / B Main / …        | **P1** in **that** main’s race result        | **Race / session results** UI, not an extra “class winner” for the same class |

---

## 6. Plain-language examples (same event family as §1)

**Ep Buggy — overall winner (Pos 1):**

- Row: Pos 1, Driver DARREN PERRY, Result `[2] [1] 17/10:02.843`, Race A Main.
- Reading: Official **1st overall** in Ep Buggy; raced **A Main**; **combined
  multi-main Points = 2** (first bracket; lower is better — see §4.3); **best
  single-main finish = 1st** (second bracket, inferred); displayed run **17 laps
  / 10:02.843** for the laps/time tail.

**Ep Buggy — B Main driver (still overall ranked):**

- Pos 14, BEN YARNOLD, …, B Main.
- Reading: **14th overall** in the class; **B Main** assignment; overall order
  is not “winner of B Main only”.

**Ic Buggy — typical single-main style:**

- Pos 1, ZAC RYAN, `[1] 50/30:07.805`, A Main.
- Reading: **1st overall**; sole bracket **`[1]`** = **finish position in that
  single A Main** (see §4.2); 50 laps in 30:07.805.

**DNF / DNS:**

- DNF: partial laps/time, did not finish.
- DNS: did not start (often zero laps).

---

## 7. MRE implementation (current, as of this document)

### 7.1 Where “class winners” are computed

- **`buildClassWinners`** in `src/core/events/build-event-highlights.ts`
  (helpers in `src/core/events/class-winners-multi-main.ts`):
  - **Class list:** **`registrationClassNames`** when non-empty (entry-list /
    program order); otherwise unique **base** class names derived from
    multi-main labels (suffixes like `Triple A-Main` stripped) and main-session
    races.
  - **Multi-main:** For each canonical class, all **`multiMainResults`** rows
    whose **base label** matches that class are considered. **B-main-only** link
    labels (`Triple B-Main`, etc.) are **excluded** from picking the overall
    champion. Among the remainder, the block with the **largest entry count** is
    used (combined overall table), then tie-break on exact label match to the
    canonical class. Winner = **minimum `position`** in that block.
  - **Fallback:** **P1 (`positionFinal === 1`)** of the **featured main** for
    that class (`pickFeaturedMainRace`) when no qualifying multi-main block
    exists.

### 7.2 Where that data is loaded and shown

- **`getEventAnalysisData`** loads `event.multiMainResults` (Prisma) into
  `EventAnalysisData.multiMainResults`.
- **Event Overview** passes `races`, `multiMainResults`, and
  **`registrationClassNames`** into `EventOverviewTopQualifiers`
  (`variant="overviewCards"`), which calls `buildClassWinners`.
- Copy in the class-winner modal (`EventOverviewTopQualifiers`) describes
  multi-main vs featured-main fallback in plain language.

### 7.3 What ingestion actually stores today

- Multi-main blocks are ingested from LiveRC pages with
  **`p=view_multi_main_result`** (see
  `ingestion/connectors/liverc/connector.py`, `MultiMainResultParser`, pipeline
  `_process_multi_main_results`).
- MRE does **not** currently run a dedicated parser for
  **`p=event_overall_ranking`** into a first-class “overall final ranking”
  table. The event detail HTML may **link** to `event_overall_ranking` (see
  fixtures under `ingestion/tests/fixtures/`), but **Class Winners** logic is
  **not** defined as “read Pos 1 from that HTML table” in code.

### 7.4 Alignment gap (normative for future work)

To **strictly** match the **Overall Final Ranking** page for every event:

1. Ingestion (or verified equivalence rules) must ensure the **same rows and Pos
   ordering** as `p=event_overall_ranking&id={sourceEventId}` **per class**,
   **or**
2. Prove that **`view_multi_main_result` + per-race mains** always reproduce Pos
   1 for each class identically to that page (including single-main-only classes
   and B Main / DNF edge cases), and document that proof here.

Until then, **Class Winners** in MRE are “**multi-main overall when ingested,
else featured main P1**”, which is **close** to the user-facing LiveRC summary
for many events but is **not** byte-identical to scraping
**`event_overall_ranking`**.

### 7.5 Class winner modal: event mains vs this driver’s mains

LiveRC multi-main pages expose **two different ideas** that are easy to
conflate:

| Concept                    | Source                                                                                                         | Meaning                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Class schedule / event** | `completedMains` / `totalMains` on the ingested multi-main block (LiveRC sub-header, e.g. “Completed: 3 of 3”) | How many mains were **run for the class** on the schedule — **not** per driver. |
| **This driver**            | Derived in MRE from each **per-main cell** in `mainBreakdown`                                                  | How many mains this driver **actually ran** (non–sit-out).                      |

**Sit-out / DNS (common in RC):** Once the **overall** championship is
mathematically decided (often after A1+A2 in a triple), a driver may **skip**
the last main (e.g. A3). LiveRC still runs A3 for the field; the class remains
“3 of 3” mains **completed**. For that driver, the A3 cell is often
**`0/0.000`** or empty — **did not start** that main — not a DNF mid-race.

MRE labels the modal accordingly:

- **Class schedule: X of Y mains run (event)** — unchanged semantics from
  ingestion.
- **This driver: A of Y mains** — `A` = count of main columns where the
  laps/time cell is **not** treated as sit-out/DNS
  (`src/core/events/multi-main-participation.ts`, `isMultiMainCellSitOut`).

When `A < Y`, the modal adds a short note explaining sit-out and `0/0.000`.
**DNF** (partial laps/time) still counts as having **run** that main.

---

## 8. Related UX (other Overview highlights)

- **Top Qualifiers** tab uses **`qualPointsTopQualifiers`** (qual points
  standings), which is a **different** LiveRC concept from Overall Final
  Ranking.
- **Lap Heroes** uses aggregated laps from imported session results, not the
  Overall Final Ranking table.
- **Main / session results** elsewhere in Event Analysis (not listed
  exhaustively here) are the appropriate place for **per-main race winners**
  (§5.2).

---

## 9. Changelog

| Date       | Change                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-19 | Initial document: LiveRC semantics, URL pattern, MRE implementation and ingestion gap.                                                                     |
| 2026-04-19 | §5 MRE UX: overall class winners vs A/B Main race winners; §4.4 race vs P1 in main; renumber sections.                                                     |
| 2026-04-19 | §7.1: implementation — `registrationClassNames`, `class-winners-multi-main`, exclude B-main-only blocks, prefer largest combined table.                    |
| 2026-04-19 | §4: clarify Result brackets — link first bracket to `view_multi_main_result` Points; why lower is better; single-bracket = main finish place; tie example. |
| 2026-04-20 | §7.5: event vs per-driver mains completed; sit-out / `0/0.000`; `multi-main-participation.ts` and modal copy.                                              |
