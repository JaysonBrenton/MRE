/**
 * @fileoverview Build per-class “top qualifier” card models: leader from qual points + their
 *              finishes in qualifying-ladder sessions (non-mains) from race results.
 */

import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { isEventMainSession } from "@/core/events/main-bracket-overall"
import { isPlaceholderClass } from "@/lib/format-class-name"

export interface QualifierSessionFinish {
  raceId: string
  raceLabel: string
  positionFinal: number
}

export interface TopQualifierCardModel {
  className: string
  driverId: string
  driverDisplayName: string
  points: number
  sessions: QualifierSessionFinish[]
}

type RaceRow = EventAnalysisData["races"][number]

/** Non–main-event sessions that are not unstructured open practice. */
function isQualifyingLadderSession(race: Pick<RaceRow, "sessionType" | "raceLabel">): boolean {
  const st = (race.sessionType ?? "").toLowerCase()
  if (st === "practiceday") return false
  const label = race.raceLabel ?? ""
  const L = label.toLowerCase()
  if (st === "practice") {
    if (/\bsemi\b/i.test(label)) return true
    if (/\blcq\b/i.test(label) || /last\s*chance/i.test(L)) return true
    if (/qualif/i.test(L) && !/\bfinal\b/i.test(L)) return true
    return false
  }
  return true
}

function raceOrderForSort(race: RaceRow): number {
  return race.raceOrder ?? Number.MAX_SAFE_INTEGER
}

/**
 * For each class, take qual-points position 1 and attach session finishes (non-mains on the
 * qualifying ladder) for that driver. Class order follows `standings` order (same as table).
 */
export function buildTopQualifierOverviewCards(
  qualPoints: NonNullable<EventAnalysisData["qualPointsTopQualifiers"]>,
  races: EventAnalysisData["races"]
): TopQualifierCardModel[] {
  const standings = qualPoints.standings
  const classOrder: string[] = []
  const seenClass = new Set<string>()
  for (const row of standings) {
    const cn = row.className.trim()
    if (!cn || seenClass.has(cn)) continue
    seenClass.add(cn)
    classOrder.push(cn)
  }

  const cards: TopQualifierCardModel[] = []

  for (const className of classOrder) {
    const leader = standings.find((r) => r.className.trim() === className && r.position === 1)
    if (!leader) continue

    const sessions: QualifierSessionFinish[] = []
    const classRaces = races.filter(
      (r) => r.className.trim() === className && !isPlaceholderClass(r.className)
    )

    for (const race of classRaces) {
      if (isEventMainSession(race)) continue
      if (!isQualifyingLadderSession(race)) continue
      const res = race.results.find((x) => x.driverId === leader.driverId)
      if (!res) continue
      sessions.push({
        raceId: race.raceId,
        raceLabel: race.raceLabel,
        positionFinal: res.positionFinal,
      })
    }

    sessions.sort((a, b) => {
      const ra = classRaces.find((x) => x.raceId === a.raceId)
      const rb = classRaces.find((x) => x.raceId === b.raceId)
      const oa = ra ? raceOrderForSort(ra) : Number.MAX_SAFE_INTEGER
      const ob = rb ? raceOrderForSort(rb) : Number.MAX_SAFE_INTEGER
      if (oa !== ob) return oa - ob
      return a.raceLabel.localeCompare(b.raceLabel, undefined, { numeric: true })
    })

    cards.push({
      className,
      driverId: leader.driverId,
      driverDisplayName: leader.driverDisplayName,
      points: leader.points,
      sessions,
    })
  }

  return cards
}
