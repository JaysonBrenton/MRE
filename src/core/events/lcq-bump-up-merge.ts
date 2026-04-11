/**
 * @fileoverview Merge LiveRC LCQ rows (often `className` "Last Chance Qualifier") into the
 * logical class whose next ladder race follows LCQ on the global schedule.
 *
 * @see docs/plans/bump-ups-liverc-main-events-solution.md
 */

import type { EventAnalysisData } from "./get-event-analysis-data"
import type { SessionData } from "./get-sessions-data"
import { isPlaceholderClass } from "@/lib/format-class-name"
import { labelLooksLikeLcq, raceMightBeBumpUpLadderRace } from "./infer-bump-ups"

function raceIsLcqRow(race: EventAnalysisData["races"][number]): boolean {
  const cn = (race.className ?? "").trim().toLowerCase()
  if (cn.includes("last chance")) return true
  return labelLooksLikeLcq(race.raceLabel)
}

function sortedScheduleRaces(data: EventAnalysisData): EventAnalysisData["races"] {
  return [...data.races]
    .filter((r) => !isPlaceholderClass(r.className))
    .sort((a, b) => {
      const oa = a.raceOrder
      const ob = b.raceOrder
      if (oa != null && ob != null && oa !== ob) return oa - ob
      if (oa != null && ob == null) return -1
      if (oa == null && ob != null) return 1
      const ta = a.startTime?.getTime() ?? 0
      const tb = b.startTime?.getTime() ?? 0
      if (ta !== tb) return ta - tb
      return a.raceLabel.localeCompare(b.raceLabel, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    })
}

/**
 * If the next mains-ladder race after this LCQ is `targetClassName`, LCQ feeds that class.
 */
export function getLcqMergeTargetClassName(
  lcqRace: EventAnalysisData["races"][number],
  schedule: EventAnalysisData["races"]
): string | null {
  const idx = schedule.findIndex((r) => r.id === lcqRace.id)
  if (idx === -1) return null
  for (let j = idx + 1; j < schedule.length; j++) {
    const r = schedule[j]!
    if (isPlaceholderClass(r.className)) continue
    if (!raceMightBeBumpUpLadderRace(r)) continue
    if (raceIsLcqRow(r)) continue
    const cn = r.className?.trim()
    if (!cn) continue
    return cn
  }
  return null
}

/**
 * Append LCQ sessions that belong to `targetClassName` (schedule heuristic) to the class session list.
 * De-duplicates by session id.
 */
export function mergeLcqSessionsForClass(
  data: EventAnalysisData,
  targetClassName: string,
  classSessions: SessionData[],
  allSessions: SessionData[]
): SessionData[] {
  const trimmed = targetClassName.trim()
  if (!trimmed) return classSessions

  const schedule = sortedScheduleRaces(data)
  const sessionByRaceId = new Map(allSessions.map((s) => [s.raceId, s]))
  const seen = new Set(classSessions.map((s) => s.id))
  const out = [...classSessions]

  for (const race of data.races) {
    if (!raceIsLcqRow(race)) continue
    const mergeInto = getLcqMergeTargetClassName(race, schedule)
    if (mergeInto !== trimmed) continue
    const s = sessionByRaceId.get(race.id)
    if (!s) continue
    if (seen.has(s.id)) continue
    seen.add(s.id)
    out.push(s)
  }

  return out
}
