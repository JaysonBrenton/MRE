---
created: 2026-04-05
creator: Documentation
lastModified: 2026-04-05
description:
  Idea for a chart-driven “replay” of a race session using ingested lap data
purpose:
  Record a plausible future feature so it can be revisited without losing
  context from informal discussion.
relatedFiles:
  - src/core/events/get-lap-data.ts (getEventLapTrend, LapTrendPoint)
  - src/app/api/v1/events/[eventId]/lap-trend/route.ts
  - src/components/organisms/event-analysis/LapByLapTrendChart.tsx
  - docs/future-ideas/README.md
---

# Idea: Graph-based race replay

## Concept

Offer a **replay** experience where the “race” is represented primarily by
**interactive charts** rather than video or a 2D track map. The user could scrub
or play forward through lap index (or approximate wall-clock time) and see how
lap times, running order, and gaps evolved.

This is **replay of results and timing** from stored data, not a physics
simulator or broadcast sync.

## Why it might be valuable

- LiveRC-backed events already expose per-lap times and lap positions in
  analysis.
- Many users will never have onboard video in MRE; a strong chart narrative
  still tells the story of who gained or lost time and when order changed.

## Data the product already has (relevant)

The lap trend pipeline returns ordered points per driver, including:

- Lap time (`lapTimeSeconds`)
- Position on that lap (`positionOnLap`), when present
- Session metadata where available (`raceStartTime`, `durationSeconds`)

See `getEventLapTrend` in `src/core/events/get-lap-data.ts` and the
`/api/v1/events/[eventId]/lap-trend` route. The UI already charts lap-by-lap
trends via `LapByLapTrendChart`.

## Possible UX directions (not prescriptive)

- **Playhead + play/pause** on the existing lap trend chart, or a dedicated
  “replay” panel for one session (`raceId`).
- **Secondary views** derived from the same series: running order by lap, gap to
  leader, cumulative time vs a reference driver.
- **Speed controls** for playback (e.g. 1×, 2×, pause on lap N).

## Constraints and caveats

- Quality depends on ingestion completeness (missing laps or positions degrade
  the narrative; UI should handle gaps gracefully).
- **Track map / car animation** would require data not implied by the current
  lap table (e.g. layout, sectors, or telemetry). That would be a separate,
  larger effort.
- Wall-clock alignment is approximate unless richer timing metadata exists per
  lap or segment.

## Implementation sketch (when/if prioritized)

- Mostly **presentation and interaction** on top of existing lap-trend APIs; new
  backend only if new derived series (e.g. gap-to-leader) should be
  server-computed for consistency or performance.
