---
created: 2026-04-04
owner: Domain
purpose: Define what “bump-up” means in MRE product and engineering terms.
relatedDocs:
  - docs/reference_material/Racing Rules and
    Regulations/1-8-nitro-off-road-bump-up-rules.md
  - docs/plans/bump-ups-feature-spec.md
  - docs/plans/bump-ups-liverc-main-events-solution.md
  - docs/adr/ADR-20260404-bump-ups-inferred-from-results.md
  - docs/adr/ADR-20260405-bump-ups-liveRC-heat-sheet-ladder-strategy.md
---

# Bump-ups — domain note (MRE)

## Terminology

In radio-controlled off-road racing, **bump-up** usually means a driver **earned
a spot in a higher main or final** from a lower one (sometimes via a
**last-chance / LCQ** race). Sanctioning bodies specify **counts** (e.g. top _n_
from each semi) and special cases (e.g. fastest semi losers). Those rules vary
by body, class, and event.

## What MRE means by “bump-up”

**MRE treats a bump-up as an observed fact in data:** a driver **participated in
race R1** at tier _k_ and **later participated in race R2** at tier _k+1_ (or
otherwise **closer to the A-main**) within the **same class**, where **tiers**
are inferred from **LiveRC session labels and ordering** — not from a rules
engine.

This is **not** a claim that the driver satisfied a specific
IFMAR/ROAR/BRCA/RCRA rule text. It **is** a claim that **results link** that
driver across those sessions.

## LiveRC “Main Events” and schedule

On LiveRC, **Main Events** is presented as a **single heat sheet**: one
**global** run order for mains **across all classes** at the event (e.g. first
scheduled main, second scheduled main, …). In MRE, **`Race.raceOrder`** (with
**`startTime`** as tie-break) is the implementation of that timeline. Bump-up
logic must order a class’s sessions **as they appear** on that timeline, not
using a separate per-class counter.

See **`docs/plans/bump-ups-liverc-main-events-solution.md`** for the full
technical model.

## “Same class” and LCQ

LiveRC may store a last-chance race under **`className`** values such as
**`Last Chance Qualifier`** while related mains use **`EP Buggy`**, **`Buggy`**,
etc. For product purposes, **logical class** may **merge** LCQ rows into the
class whose mains they feed, using **schedule position** and label heuristics
(see **ADR-20260405**). Until merged, LCQ will not appear when filtering
strictly by `EP Buggy` alone.

## Tier strategies (engineering)

**Tiers** are not only “letter + Main” (e.g. `B1-Main`). Events also publish
**`… Final`** without **`… Main`** (e.g. `Buggy 1/4 Odd Final`) and **bracket
fractions** (`1/16` … `1/1`). Robust inference requires **multiple ladder
strategies** mapping labels (+ `sessionType` / `sectionHeader`) to a comparable
rank. Unrecognized labels → **no tier** for that session → possibly **no**
inferred bump-ups (honest empty state).

## Multi-main aggregate results

LiveRC exposes **triple/double main overall** pages; MRE ingests them as
**`multi_main_results`**. They can **corroborate** overall placement and per-leg
results when per-race grids do not show the same driver across every main.
**`EventAnalysisData`** should expose **`driverId`** on multi-main entries (see
solution doc) so joins to **`RaceResult`** are unambiguous.

## Reference rules (non-runtime)

Human-readable **normative reference** for real-world rules lives under:

`docs/reference_material/Racing Rules and Regulations/1-8-nitro-off-road-bump-up-rules.md`

That document must **not** be loaded as machine law for bump-up rows in v1.
Optional future **format packs** could compare observed data to expected counts;
that remains out of scope until explicitly specified.

## UI disclaimer (suggested one sentence)

> Advancements are inferred from published race results; they are not a
> statement of official rules or steward decisions.

Product may shorten further if space is tight; the spec in
`docs/plans/bump-ups-feature-spec.md` owns final copy.
