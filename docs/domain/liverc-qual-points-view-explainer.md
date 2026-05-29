---
created: 2026-05-20
owner: Domain / LiveRC interpretation
lastModified: 2026-05-20
description:
  Human-readable reference for LiveRC “Qual Points” (view_points) pages—columns,
  IFMAR-style points, best-N-of-M drops, tie cells, lap/time format, DNS/DNF,
  and a worked example (2025 RCRA Nationals Buggy, best 3 of 5).
purpose:
  Future reference when interpreting LiveRC qualification summaries, seeding,
  and UI copy—not normative MRE implementation unless product adopts the same
  rules.
relatedFiles:
  - docs/architecture/top-qualifiers.md
  - docs/domain/triple-a-main-scoring.md
  - docs/frontend/liverc/user-workflow.md
---

# LiveRC “Qual Points” page — interpretation reference

This document explains what LiveRC shows on a **Qual Points** page (e.g.
`?p=view_points&id=…`) for a concrete configuration used as a **reference
example**:

| Attribute                 | Reference example                                          |
| ------------------------- | ---------------------------------------------------------- |
| Event                     | **2025 RCRA Nationals**                                    |
| Class                     | **Buggy** (LiveRC labels the class explicitly)             |
| Format                    | **Qual Points (best 3 of 5)** — page title / panel heading |
| Tie breaker label on page | **IFMAR (All Classes)**                                    |

**Important:** Different events may use **best 2 of 4**, **best 3 of 5**, or
other rules. Always read the **page title** and per-class panel heading for the
active **N of M** rule.

**Scope:** This is **descriptive** documentation of LiveRC’s published
qual-points UX and IFMAR-style scoring as understood from that page. MRE does
not yet mirror every rule in-app; see
[Top qualifiers (TQ)](../architecture/top-qualifiers.md) for product direction.

---

## 1. What the page is showing

- This is the **overall qualifying points ranking** for the class (e.g. Buggy).
- It is **not** a single race result.
- For this example: **five** qualifying rounds; each driver’s **best three**
  point scores count toward **Result**; the **worst two** are dropped.
- **Lower total points wins** (sum of the three counting scores).
- If drivers are tied on **Result**, LiveRC applies the **IFMAR** tie breaker
  (as labeled on the page).

---

## 2. Column meanings

| Column                | Meaning                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `#`                   | Final qualifying rank in the class after points and tie breakers.                                                                   |
| `Driver`              | Driver name.                                                                                                                        |
| `Result`              | Sum of the driver’s **best N** qualifying point scores (here **3**). Lower is better.                                               |
| `Tie Breaker`         | The **N counting point scores** in square brackets, then the **best counted lap/time performances** used to separate ties (see §6). |
| `Round 1` … `Round M` | Each round: **points** and **laps/time**, sometimes with **DNS** or **DNF**.                                                        |

---

## 3. Round cell format (`points : laps/time`)

**Example:** `2 : 18/10:25.638`

| Element          | Meaning                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `2`              | Qualifying **points** earned in that round (IFMAR-style table in §4).                         |
| `18`             | **Laps completed** in that round.                                                             |
| `10:25.638`      | **Total elapsed time** for the run (**not** an average lap time): 10 minutes, 25.638 seconds. |
| **Full meaning** | That round’s result was **18 laps** in **10:25.638**, worth **2 points**.                     |

**Ordering races (lap/time):**

- **More laps** is better.
- If laps are equal, **lower time** is better.

So `19/10:33.238` **beats** `18/10:15.386` because **19 laps** beats **18
laps**, even though the elapsed time is longer.

---

## 4. IFMAR-style qualifying points (typical LiveRC table)

Round finishing position → points (as used on this style of page):

| Round position       | Points |
| -------------------- | ------ |
| Fastest in the round | **0**  |
| 2nd fastest          | **2**  |
| 3rd fastest          | **3**  |
| 4th fastest          | **4**  |
| 5th fastest          | **5**  |
| …                    | …      |

There is **normally no 1-point** score: the round winner gets **0**, second gets
**2**, then the sequence continues upward.

With **best 3 of 5**, a driver’s three **lowest** point totals (best
performances) are summed into **Result**; higher point scores from other rounds
are **dropped**.

---

## 5. Worked example: Caleb Noble (2025 RCRA Nationals Buggy)

**Original row (abbreviated for reference):**

`1` · **CALEB NOBLE** · Result **`0`** · Tie breaker **`[0,0,0]`** ·
`19/10:26.339 (4)` · `19/10:33.238 (5)` · rounds include  
`2 : 18/10:25.638`, `0 : 18/10:15.386`, `2 : 18/10:09.010`, `0 : 19/10:26.339`,
`0 : 19/10:33.238`

### Column-by-column

| Data                       | Meaning                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `1`                        | 1st overall in Buggy qualifying.                                                   |
| `CALEB NOBLE`              | Driver name.                                                                       |
| Result `0`                 | Best **three** point scores sum to **0**.                                          |
| `[0,0,0]`                  | All three counting rounds were **0-point** round wins.                             |
| `19/10:26.339 (4)`         | Tie-break display: strong counted performance (**Round 4**), 19 laps in 10:26.339. |
| `19/10:33.238 (5)`         | Tie-break display: strong counted performance (**Round 5**), 19 laps in 10:33.238. |
| Round 1 `2 : 18/10:25.638` | **2 points** → **dropped** (three 0s are better).                                  |
| Round 2 `0 : 18/10:15.386` | **0 points** → **counted**.                                                        |
| Round 3 `2 : 18/10:09.010` | **2 points** → **dropped**.                                                        |
| Round 4 `0 : 19/10:26.339` | **0 points** → **counted**.                                                        |
| Round 5 `0 : 19/10:33.238` | **0 points** → **counted**.                                                        |

### Counted vs dropped

| Round | Points | Laps/time    | Counted? | Why                                      |
| ----- | ------ | ------------ | -------- | ---------------------------------------- |
| 1     | 2      | 18/10:25.638 | No       | Dropped: three **0**-point rounds exist. |
| 2     | 0      | 18/10:15.386 | Yes      | One of the three best scores.            |
| 3     | 2      | 18/10:09.010 | No       | Dropped: three **0**-point rounds exist. |
| 4     | 0      | 19/10:26.339 | Yes      | One of the three best scores.            |
| 5     | 0      | 19/10:33.238 | Yes      | One of the three best scores.            |

**Final Result:** `0 + 0 + 0 = 0` (best possible).

---

## 6. Why the Tie Breaker cell may not list every counted round

Caleb’s **three** counted rounds include **Round 2** (`0 : 18/10:15.386`),
**Round 4**, and **Round 5**.

The **Tie Breaker** cell may show only **`[0,0,0]`** plus **two** lap/time
lines, e.g. **`19/10:26.339 (4)`** and **`19/10:33.238 (5)`**, and **omit**
Round 2’s `18/10:15.386`.

**Interpretation (UI behaviour):** the bracketed triple is the **counting point
scores**. The lap/time values after the brackets are the **strongest counted
race performances** used for tie comparison — here both shown runs are
**19-lap** results, which **outrank** the **18-lap** Round 2 win on laps. LiveRC
appears to surface the **most relevant** performances for tie-break display,
**not necessarily every** counted round’s lap/time line.

---

## 7. Top of field snapshot (illustrates counting + ties)

| Rank | Driver         | Result | Counting scores | Notes                            |
| ---- | -------------- | ------ | --------------- | -------------------------------- |
| 1    | Caleb Noble    | 0      | `[0,0,0]`       | Three round wins; clear TQ.      |
| 2    | Alex Bernadzik | 5      | `[0,2,3]`       | One win + two strong rounds.     |
| 3    | Jayden Edmunds | 8      | `[0,4,4]`       | One win; beats Ari on tie.       |
| 4    | Ari Bakla      | 8      | `[2,3,3]`       | No 0-point round; behind Jayden. |

**Jayden vs Ari (both Result 8):** Jayden **`[0,4,4]`** ranks ahead of Ari
**`[2,3,3]`** because Jayden’s **best** counted score is **0**, vs Ari’s **2**.

---

## 8. Full Buggy field reference table (2025 RCRA Nationals)

Ordering and narrative as recorded from the LiveRC Buggy section (Caleb Noble
through Justin Page).

| Rank | Driver                 | Result | Counted scores | Story                                                                |
| ---- | ---------------------- | ------ | -------------- | -------------------------------------------------------------------- |
| 1    | Caleb Noble            | 0      | `[0,0,0]`      | Dominated qualifying with three 0-point round wins.                  |
| 2    | Alex Bernadzik         | 5      | `[0,2,3]`      | One round win plus two strong podium-level round scores.             |
| 3    | Jayden Edmunds         | 8      | `[0,4,4]`      | One round win was enough to win the tie over Ari.                    |
| 4    | Ari Bakla              | 8      | `[2,3,3]`      | Very consistent, but no 0-point round, so behind Jayden.             |
| 5    | Aaron Dexter           | 10     | `[2,3,5]`      | Strong top-five qualifying despite poor R3 and R5 drops.             |
| 6    | Christian Wolhuter     | 14     | `[3,5,6]`      | Consistent top-six counted rounds.                                   |
| 7    | Jarod Ment             | 15     | `[4,4,7]`      | Two 4-point rounds kept him high.                                    |
| 8    | Felix Koegler          | 21     | `[6,7,8]`      | Solid top-ten consistency.                                           |
| 9    | Jackson Beale          | 22     | `[5,8,9]`      | Best round was Round 5 with 5 points.                                |
| 10   | Zac Foster             | 23     | `[5,7,11]`     | Strong R3 and R5 offset a very poor R4.                              |
| 11   | Josh Pain              | 24     | `[7,7,10]`     | Very consistent, but no low single-digit score.                      |
| 12   | Craig Laughton         | 29     | `[9,10,10]`    | Around tenth-best pace in his counted rounds.                        |
| 13   | Andrew Gillott         | 33     | `[9,12,12]`    | Best score was a 9, then two 12s.                                    |
| 14   | Zac Ryan               | 35     | `[11,11,13]`   | Two 11s made the result stable.                                      |
| 15   | Ben Cribbin            | 38     | `[12,13,13]`   | Consistent mid-pack counting scores.                                 |
| 16   | Ben Panic              | 42     | `[13,14,15]`   | Consistent, with R4 his best counted round.                          |
| 17   | Peter Seckold          | 43     | `[13,14,16]`   | Very close to Ben Panic, one point behind.                           |
| 18   | Ryan Reynolds          | 51     | `[15,18,18]`   | Two zero-lap rounds were dropped.                                    |
| 19   | Liam Jones             | 53     | `[17,18,18]`   | Three useful counted rounds, one poor R5 dropped.                    |
| 20   | Dallas Gardiner        | 54     | `[15,19,20]`   | Best score was 15 from Round 1.                                      |
| 21   | Simon Roberts          | 61     | `[17,21,23]`   | Round 5 was his standout, 17 points.                                 |
| 22   | Simon Healy            | 62     | `[18,19,25]`   | Best two were R5 and R4.                                             |
| 23   | Jimmy Horne            | 63     | `[17,22,24]`   | R3 was his best counted round.                                       |
| 24   | Aaron Griffis          | 64     | `[20,22,22]`   | Three roughly similar counted scores.                                |
| 25   | Joel Power             | 67     | `[19,22,26]`   | R3 and R4 were his useful rounds.                                    |
| 26   | Gavin White            | 70     | `[23,23,24]`   | Very even counted results.                                           |
| 27   | Connor Laughton        | 72     | `[21,21,30]`   | Two 21s helped, R4 DNF still counted as third-best.                  |
| 28   | Darren Cains           | 74     | `[19,26,29]`   | R5 was his best score.                                               |
| 29   | Sam Carstairs          | 78     | `[24,26,28]`   | Best score was R4.                                                   |
| 30   | Michael Matheson       | 79     | `[23,28,28]`   | R1 DNS-marked result still produced his best points score.           |
| 31   | Phoenix Eggleton       | 82     | `[17,17,48]`   | Two excellent 17s, but no third strong score.                        |
| 32   | Riley Lander-West      | 84     | `[25,27,32]`   | R4 DNF was still his best score.                                     |
| 33   | Gavin Webb             | 86     | `[26,30,30]`   | R3 was best with 26 points.                                          |
| 34   | Scott Hill             | 87     | `[21,31,35]`   | R4 DNF was still strong enough to be his best score.                 |
| 35   | Stephen Snedden        | 87     | `[25,29,33]`   | Same Result as Scott Hill, but worse tie-break score set.            |
| 36   | Lindsay Frost          | 90     | `[24,29,37]`   | R5 and R4 were his strongest rounds.                                 |
| 37   | Tanner White           | 92     | `[29,31,32]`   | Three close counted scores.                                          |
| 38   | Scott Elkins           | 95     | `[28,29,38]`   | R5 and R3 were his best.                                             |
| 39   | Cary Davies            | 96     | `[24,32,40]`   | R1 was his standout.                                                 |
| 40   | Harrison Turner        | 99     | `[30,33,36]`   | R5 and R4 were strongest.                                            |
| 41   | Daniel Morgan          | 104    | `[33,35,36]`   | R5 was his best counted score.                                       |
| 42   | Richard Leitis         | 105    | `[31,36,38]`   | R4 was best.                                                         |
| 43   | Tyron Powles           | 106    | `[34,34,38]`   | Two matching 34s helped.                                             |
| 44   | Chris Burke            | 108    | `[31,38,39]`   | R1 was his best round.                                               |
| 45   | Zac Panic              | 110    | `[34,37,39]`   | R5 and R4 were strongest.                                            |
| 46   | Austin McMahon         | 111    | `[27,42,42]`   | Excellent R5 compared with his other counted rounds.                 |
| 47   | Daniel Quinton         | 124    | `[35,43,46]`   | R1 was his best.                                                     |
| 48   | Jaxon Handley Durbidge | 124    | `[36,37,51]`   | Same Result as Daniel Quinton, but worse tie-break set.              |
| 49   | Nick McMurtrie         | 126    | `[35,45,46]`   | R5 was best.                                                         |
| 50   | Elliot Grierson        | 127    | `[36,42,49]`   | R4 was best.                                                         |
| 51   | Robert Rutledge        | 128    | `[40,43,45]`   | R5 was best.                                                         |
| 52   | Jordan Van             | 129    | `[34,37,58]`   | Two decent scores, third score much weaker.                          |
| 53   | Nicholas Tsiaousis     | 132    | `[40,44,48]`   | R4 was best.                                                         |
| 54   | Jordan Blanchard       | 133    | `[39,47,47]`   | R4 was best.                                                         |
| 55   | Kohen Mould            | 139    | `[44,45,50]`   | R5 and R4 were best.                                                 |
| 56   | Carl Nadfalusi         | 140    | `[39,49,52]`   | R5 was best.                                                         |
| 57   | Nathan Williams        | 140    | `[45,47,48]`   | Same Result as Carl, but worse tie-break set.                        |
| 58   | Oliver Highton         | 149    | `[46,50,53]`   | R5 was best.                                                         |
| 59   | Bernard McMahon        | 149    | `[47,49,53]`   | Same Result as Oliver, but Oliver’s 46 beats Bernard’s 47.           |
| 60   | Jason Williams         | 150    | `[50,50,50]`   | Three identical counted point scores.                                |
| 61   | Brendon Cassidy        | 157    | `[51,53,53]`   | R3 was best.                                                         |
| 62   | Simon Petrusevski      | 162    | `[54,54,54]`   | Three equal counted scores.                                          |
| 63   | Will Haines            | 163    | `[46,57,60]`   | One good R4 score, two weaker counted scores.                        |
| 64   | Tony Roberts           | 186    | `[61,62,63]`   | Mostly zero-lap results, but still ranked ahead of Justin on points. |
| 65   | Justin Page            | 194    | `[64,65,65]`   | Last in Buggy qualifying, all zero-lap results.                      |

---

## 9. Tie examples (same Result)

| Pair | Result | Driver A (wins tie) | Counted A    | Driver B               | Counted B    | Why A ranks higher                 |
| ---- | ------ | ------------------- | ------------ | ---------------------- | ------------ | ---------------------------------- |
| A    | 8      | Jayden Edmunds      | `[0,4,4]`    | Ari Bakla              | `[2,3,3]`    | Best counted score **0** vs **2**. |
| B    | 87     | Scott Hill          | `[21,31,35]` | Stephen Snedden        | `[25,29,33]` | Best counted **21** vs **25**.     |
| C    | 124    | Daniel Quinton      | `[35,43,46]` | Jaxon Handley Durbidge | `[36,37,51]` | Best counted **35** vs **36**.     |
| D    | 140    | Carl Nadfalusi      | `[39,49,52]` | Nathan Williams        | `[45,47,48]` | Best counted **39** vs **45**.     |
| E    | 149    | Oliver Highton      | `[46,50,53]` | Bernard McMahon        | `[47,49,53]` | Best counted **46** vs **47**.     |

---

## 10. DNS and DNF on this page

| Flag    | Meaning        | How it appears                                                          |
| ------- | -------------- | ----------------------------------------------------------------------- |
| **DNS** | Did not start  | Row may still show laps/time and points; run marked **DNS**.            |
| **DNF** | Did not finish | Partial laps/time may still earn points if the run counted in the heat. |

**Examples (from the same reference event narrative):**

- **Connor Laughton** Round 4: `30 : 16/10:20.540 (DNF)` — still part of
  best-three set `[21,21,30]`.
- **Riley Lander-West** Round 4: DNF line was actually a **counted** “best”
  score.
- **Scott Hill** Round 4: DNF was still **best** counted score for him.

So **DNF ≠ automatically dropped**: if the partial run yields one of the **best
N** point totals, it can still count.

---

## 11. Plain-English summary (Caleb)

Caleb was **Top Qualifier** in Buggy because he had the only **perfect**
qualifying score: three counting rounds at **0** points (Rounds **2, 4, 5**).
Two **2-point** rounds were dropped.

In the **Tie Breaker** cell, the two highlighted lap/time performances (**19**
laps each) are **stronger** than his counted **18**-lap Round 2 win for
**tie-break display**, because **more laps** beats fewer when comparing those
race performances.

---

## See also

- [Top qualifiers (TQ) — MRE product direction](../architecture/top-qualifiers.md)
- [Triple A-Main overall scoring (IFMAR & ROAR)](triple-a-main-scoring.md)
- [Mains ladder (event analysis)](../architecture/event-analysis-mains-ladder.md)
  — bracket `From Round` / N/A semantics come from **main session rows**, not
  from this qual-points page.
