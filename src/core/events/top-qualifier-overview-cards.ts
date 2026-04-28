/**
 * @fileoverview Build per-class “top qualifier” card models: leader from qual points + their
 *              finishes in qualifying-ladder sessions (non-mains) from race results.
 *
 * Card list matches **Class Winners** (registration / canonical vehicle classes). When qual
 * standings use other keys (e.g. bracket labels) and registration is known, those rows are
 * omitted until standings align. `sessionType === "practice"` races are excluded from ladder
 * session rows (non-qualifying practice, including “Semi … Practice” labels).
 */

import {
  canonicalClassesForClassWinners,
  classEntryCountByClassName,
} from "@/core/events/build-event-highlights"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { isEventMainSession } from "@/core/events/main-bracket-overall"
import { formatClassName, isPlaceholderClass } from "@/lib/format-class-name"

export interface QualifierSessionFinish {
  raceId: string
  raceLabel: string
  positionFinal: number
}

export interface TopQualifierCardModel {
  className: string
  driverId: string
  driverDisplayName: string
  /** P2 in qual points for this class (null if not in standings). */
  secondPlaceName: string | null
  /** P3 in qual points for this class (null if not in standings). */
  thirdPlaceName: string | null
  points: number
  sessions: QualifierSessionFinish[]
}

type RaceRow = EventAnalysisData["races"][number]

/**
 * Non-main sessions on the official qualifying ladder (qual / heat / etc.), excluding
 * `sessionType === "practice"` so “Semi … Practice” schedule rows do not appear as TQ rounds.
 */
function isQualifyingLadderSession(race: Pick<RaceRow, "sessionType" | "raceLabel">): boolean {
  const st = (race.sessionType ?? "").toLowerCase()
  if (st === "practiceday") return false
  if (st === "practice") return false
  return true
}

function raceOrderForSort(race: RaceRow): number {
  return race.raceOrder ?? Number.MAX_SAFE_INTEGER
}

function uniqueClassNamesInStandings(
  standings: NonNullable<EventAnalysisData["qualPointsTopQualifiers"]>["standings"]
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const row of standings) {
    const cn = row.className.trim()
    if (!cn || seen.has(cn)) continue
    seen.add(cn)
    out.push(cn)
  }
  return out
}

/**
 * For each class, take the top qual driver ( best rank in `standings` for that class ) and attach
 * session finishes (non-mains on the qualifying ladder) for that driver. 2nd/3rd names are the
 * next two rows in **rank order** (sorted by LiveRC `#` position), not `position === 2|3` only—
 * the `#` column can skip numbers or tie.
 *
 * **Class list** matches Class Winners when `registrationClassNames` / races / multi-main allow
 * `canonicalClassesForClassWinners` to resolve; only classes with qual standing rows are shown.
 * If that intersection is empty but registration is set, returns no cards (avoid bracket-only
 * labels). Otherwise falls back to distinct `className`s from standings (qual-only events).
 */
export function buildTopQualifierOverviewCards(
  qualPoints: NonNullable<EventAnalysisData["qualPointsTopQualifiers"]>,
  races: EventAnalysisData["races"],
  options?: {
    entryList?: EventAnalysisData["entryList"]
    registrationClassNames?: string[]
    multiMainResults?: EventAnalysisData["multiMainResults"]
  }
): TopQualifierCardModel[] {
  const standings = qualPoints.standings
  const multiMainResults = options?.multiMainResults ?? []

  const canonical = canonicalClassesForClassWinners({
    races,
    multiMainResults,
    registrationClassNames: options?.registrationClassNames,
  })

  const hasStandingsFor = (className: string) =>
    standings.some((r) => r.className.trim() === className)

  let classOrder = canonical.filter(hasStandingsFor)

  if (classOrder.length === 0 && standings.length > 0) {
    const hasRegistration = (options?.registrationClassNames?.length ?? 0) > 0
    if (!hasRegistration) {
      classOrder = uniqueClassNamesInStandings(standings)
    }
  }

  if (options?.entryList && options.entryList.length > 0) {
    const counts = classEntryCountByClassName(options.entryList)
    if (counts.size > 0) {
      classOrder = [...classOrder].sort((a, b) => {
        const ca = counts.get(a.trim()) ?? 0
        const cb = counts.get(b.trim()) ?? 0
        if (cb !== ca) return cb - ca
        return formatClassName(a).localeCompare(formatClassName(b), undefined, {
          sensitivity: "base",
        })
      })
    }
  }

  const cards: TopQualifierCardModel[] = []

  for (const className of classOrder) {
    const classRows = standings
      .filter((r) => r.className.trim() === className)
      .sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position
        return a.driverId.localeCompare(b.driverId)
      })
    if (classRows.length === 0) continue
    const leader = classRows[0]!
    const second = classRows[1] ?? null
    const third = classRows[2] ?? null

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
      secondPlaceName: second?.driverDisplayName ?? null,
      thirdPlaceName: third?.driverDisplayName ?? null,
      points: leader.points,
      sessions,
    })
  }

  return cards
}
