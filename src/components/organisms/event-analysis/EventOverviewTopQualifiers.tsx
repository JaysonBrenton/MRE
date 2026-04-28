/**
 * @fileoverview LiveRC qual points: full standings table (Event Analysis) or Event Overview
 *             highlights: class winners (registration classes + combined multi-main standings),
 *             per-class top qualifiers, “Lap Heroes” volume leaders (most laps; ties by shortest
 *             combined session time), per-class most consistent drivers (mean session score), and
 *             per-class fastest lap (best single lap time in the class for the event), each
 *             class winner’s mean session average lap (same winners as Class Winners), and
 *             Lap Stats (placeholder tab until content is defined),
 *             closest battles (tightest P1–P2 per class on mains; per-driver adjacent gaps in modal).
 *             Event weather and Event mix live under Event details.
 */

"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  computeClosestP1P2PerClass,
  computeDriverClosestBattles,
  formatGapSecondsLabel,
} from "@/core/events/event-closest-battles"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import {
  compareLapHeroEntries,
  computeLapTotalsRankedForClass,
  computeMostLapsLeadersPerClass,
} from "@/core/events/event-most-laps-per-class"
import {
  computeConsistencyRankedForClass,
  computeMostConsistentLeadersPerClass,
} from "@/core/events/event-most-consistent-per-class"
import {
  computeFastestLapLeadersPerClass,
  computeFastestLapRankedForClass,
} from "@/core/events/event-fastest-lap-per-class"
import { computeClassWinnerMeanAvgLapCards } from "@/core/events/event-class-winner-mean-avg-lap"
import type { ClassWinnerHighlight } from "@/core/events/build-event-highlights"
import { isEventMainSession } from "@/core/events/main-bracket-overall"
import {
  buildClassWinners,
  resolveClassWinnerModalDetail,
} from "@/core/events/build-event-highlights"
import {
  buildTopQualifierOverviewCards,
  type TopQualifierCardModel,
} from "@/core/events/top-qualifier-overview-cards"
import Modal from "@/components/molecules/Modal"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"
import { DataTableFrame } from "@/components/organisms/event-analysis/DataPanelSurface"
import {
  OVERVIEW_GLASS_SURFACE_CLASS,
  OVERVIEW_GLASS_SURFACE_STYLE,
} from "@/components/organisms/event-analysis/overview-glass-surface"
import { formatClassName } from "@/lib/format-class-name"
import { formatPlaceOrdinal } from "@/lib/date-utils"
import { formatLapTime, formatTotalTime } from "@/lib/format-session-data"
import { DEFAULT_TABLE_ROWS_PER_PAGE, normalizeTableRowsPerPage } from "@/lib/table-pagination"
import { typography } from "@/lib/typography"
import ListPagination from "./ListPagination"
import {
  EventOverviewHighlightsTabList,
  HIGHLIGHT_TAB_META,
  type EventHighlightsSubTab,
} from "./EventOverviewHighlightsTabs"

type QualPayload = EventAnalysisData["qualPointsTopQualifiers"]

/** One-line podium name: native `title` + help cursor when CSS truncation hides the full string. */
function HighlightPodiumName({ name, className }: { name: string; className: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [truncated, setTruncated] = useState(false)
  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    setTruncated(el.scrollWidth > el.clientWidth + 0.5)
  }, [])

  useLayoutEffect(() => {
    measure()
  }, [name, measure])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      measure()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  return (
    <span
      ref={ref}
      className={truncated ? `${className} cursor-help` : className}
      title={truncated ? name : undefined}
    >
      {name}
    </span>
  )
}

/** 2nd/3rd slots: driver name or em dash when standings have no row (keeps podium height consistent). */
function PodiumSlotName({
  name,
  filledClassName,
  emptyHint,
}: {
  name: string | null
  filledClassName: string
  emptyHint: string
}) {
  if (name) {
    return <HighlightPodiumName name={name} className={filledClassName} />
  }
  return (
    <span
      className="min-w-0 text-xs font-medium leading-tight text-[var(--token-text-tertiary)] sm:text-sm"
      title={emptyHint}
      aria-label={emptyHint}
    >
      —
    </span>
  )
}

const LAP_HEROES_INFO_TEXT = "Most laps · shortest combined time wins ties"

const MOST_CONSISTENT_INFO_TEXT =
  "Mean session consistency score per class (higher is better). More sessions with data wins ties."

const FASTEST_LAPS_INFO_TEXT =
  "Best single lap in each class across all sessions (lower time is faster). Same time: more sessions with a recorded fast lap wins ties."

const FASTEST_AVG_LAPS_INFO_TEXT =
  "Overall class winner from Class Winners, with their mean session average lap in that class (lower time is faster). Same drivers as the Class Winners tab."

const CLOSEST_BATTLES_INFO_TEXT =
  "Main events only. Each card is the tightest P1–P2 finish on total time in that class. Open a card to see every driver’s tightest adjacent gap in a main (vs the next car ahead or behind in the results)."

/** Initial resizable panel size for Closest battles (header + body area from layout tuning). */
const CLOSEST_BATTLES_MODAL_DEFAULT_SIZE = { width: "927px", height: "705px" } as const

/** Class winner: default width; height follows content (capped by viewport) unless the user resizes. */
const CLASS_WINNER_MODAL_RESIZABLE_DEFAULT = { width: "48rem" } as const

const CLASS_WINNERS_EMPTY_TEXT =
  "No overall class winners to show yet. They appear after final results are imported for this event."

/** Shown in Event Highlights tabs that require a main except Top Qualifiers (qual-only data allowed). */
const HIGHLIGHTS_NEED_MAIN_TEXT =
  "Main event results aren’t available for this event yet. This highlight appears after at least one main or final is imported."

const QUAL_STANDINGS_UNAVAILABLE_TEXT =
  "Qual points standings are not available for this event yet. Re-run ingestion after qual results are published, or open the event on LiveRC to view qual standings."

const TQ_CARDS_UNRESOLVED_TEXT = "Could not resolve top qualifiers per class from the current data."

const SEEDING_PLACEHOLDER_TEXT = "We're in the garage working on this feature right now!!"

/** Shrink-to-content width for short single-line messages (caps at parent width, scroll if needed). */
const OVERVIEW_INFO_BOX_INLINE_CLASS =
  "mx-auto w-fit max-w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 px-3 py-2 shadow-sm"

function formatLapHeroCardLapsLine(
  totalLaps: number,
  hasRaceTimeData: boolean,
  totalRaceTimeSeconds: number
): string {
  const n = totalLaps.toLocaleString()
  const lapWord = totalLaps === 1 ? "lap" : "laps"
  if (hasRaceTimeData) {
    return `${n} ${lapWord} completed in a time of ${formatTotalTime(totalRaceTimeSeconds)}`
  }
  return `${n} ${lapWord} completed`
}

function formatMostConsistentCardLine(
  avgConsistency: number,
  sessionsWithConsistency: number
): string {
  const sessWord = sessionsWithConsistency === 1 ? "session" : "sessions"
  return `${avgConsistency.toFixed(1)}% avg · ${sessionsWithConsistency} ${sessWord}`
}

function formatFastestLapCardLine(bestFastLapSeconds: number, sessionsWithFastLap: number): string {
  const sessWord = sessionsWithFastLap === 1 ? "session" : "sessions"
  return `${formatLapTime(bestFastLapSeconds)} · ${sessionsWithFastLap} ${sessWord}`
}

function formatWinnerMeanAvgLapLine(
  meanAvgLapSeconds: number | null,
  sessionsWithAvgLap: number
): string {
  if (meanAvgLapSeconds === null) {
    return "No average lap data yet"
  }
  const sessWord = sessionsWithAvgLap === 1 ? "session" : "sessions"
  return `${formatLapTime(meanAvgLapSeconds)} mean · ${sessionsWithAvgLap} ${sessWord}`
}

export type EventOverviewTopQualifiersProps =
  | { qualPoints: QualPayload; variant?: "table" }
  | {
      qualPoints: QualPayload
      variant: "overviewCards"
      races: EventAnalysisData["races"]
      multiMainResults: EventAnalysisData["multiMainResults"]
      /** Distinct entry-list classes; drives one class-winner card per class (see buildClassWinners). */
      registrationClassNames?: string[]
      /** When non-empty, Class Winners and Top Qualifiers card order: most class entries first. */
      entryList?: EventAnalysisData["entryList"]
    }

export default function EventOverviewTopQualifiers(props: EventOverviewTopQualifiersProps) {
  if (props.variant === "overviewCards") {
    return (
      <EventOverviewTopQualifiersCards
        qualPoints={props.qualPoints}
        races={props.races}
        multiMainResults={props.multiMainResults}
        registrationClassNames={props.registrationClassNames}
        entryList={props.entryList}
      />
    )
  }
  return <EventOverviewTopQualifiersTable qualPoints={props.qualPoints} />
}

function EventOverviewTopQualifiersCards({
  qualPoints,
  races,
  multiMainResults,
  registrationClassNames,
  entryList,
}: {
  qualPoints: QualPayload
  races: EventAnalysisData["races"]
  multiMainResults: EventAnalysisData["multiMainResults"]
  registrationClassNames?: string[]
  entryList?: EventAnalysisData["entryList"]
}) {
  const [detailCard, setDetailCard] = useState<TopQualifierCardModel | null>(null)
  const [lapHeroDetailClass, setLapHeroDetailClass] = useState<string | null>(null)
  const [mostConsistentDetailClass, setMostConsistentDetailClass] = useState<string | null>(null)
  const [fastestLapDetailClass, setFastestLapDetailClass] = useState<string | null>(null)
  const [winnerMeanAvgLapDetailClass, setWinnerMeanAvgLapDetailClass] = useState<string | null>(
    null
  )
  const [classWinnerDetail, setClassWinnerDetail] = useState<ClassWinnerHighlight | null>(null)
  const [classWinnerStandingsPage, setClassWinnerStandingsPage] = useState(1)
  const [classWinnerStandingsRowsPerPage, setClassWinnerStandingsRowsPerPage] = useState(
    DEFAULT_TABLE_ROWS_PER_PAGE
  )
  const [closestBattlesModalOpen, setClosestBattlesModalOpen] = useState(false)
  /** Raw class from the Closest Battles card; scopes the modal table to that class. */
  const [closestBattlesModalClass, setClosestBattlesModalClass] = useState<string | null>(null)
  const [closestBattlesDriverFilter, setClosestBattlesDriverFilter] = useState("")
  const [closestBattlesRowsPerPage, setClosestBattlesRowsPerPage] = useState(
    DEFAULT_TABLE_ROWS_PER_PAGE
  )
  const [highlightsTab, setHighlightsTab] = useState<EventHighlightsSubTab>("classWinners")
  const defaultHighlightsTabApplied = useRef(false)

  const eventHasMain = useMemo(() => races.some((r) => isEventMainSession(r)), [races])

  const cards = useMemo(() => {
    if (!qualPoints || (qualPoints.standings?.length ?? 0) === 0) return []
    return buildTopQualifierOverviewCards(qualPoints, races, {
      entryList,
      multiMainResults,
      registrationClassNames,
    })
  }, [qualPoints, races, entryList, multiMainResults, registrationClassNames])

  const hasQualStandings = Boolean(qualPoints?.standings?.length)

  useEffect(() => {
    if (defaultHighlightsTabApplied.current) return
    if (eventHasMain) {
      defaultHighlightsTabApplied.current = true
      return
    }
    if (qualPoints === null) {
      defaultHighlightsTabApplied.current = true
      return
    }
    const hasTq = (qualPoints.standings?.length ?? 0) > 0 || cards.length > 0
    if (hasTq) {
      queueMicrotask(() => setHighlightsTab("topQualifiers"))
    }
    defaultHighlightsTabApplied.current = true
  }, [eventHasMain, qualPoints, cards.length])

  /** Class cards: most laps completed first (class lap hero), then fewer. */
  const lapHeroPerClass = useMemo(() => {
    const groups = computeMostLapsLeadersPerClass(races)
    if (groups.length === 0) return []
    const rows = groups.map((g) => {
      const L = g.leader
      return {
        className: g.className,
        driverName: L.driverName,
        totalLaps: L.totalLaps,
        totalRaceTimeSeconds: L.totalRaceTimeSeconds,
        hasRaceTimeData: L.hasRaceTimeData,
      }
    })
    return [...rows].sort((a, b) =>
      compareLapHeroEntries(
        {
          driverId: a.className,
          driverName: a.driverName,
          totalLaps: a.totalLaps,
          totalRaceTimeSeconds: a.totalRaceTimeSeconds,
          hasRaceTimeData: a.hasRaceTimeData,
        },
        {
          driverId: b.className,
          driverName: b.driverName,
          totalLaps: b.totalLaps,
          totalRaceTimeSeconds: b.totalRaceTimeSeconds,
          hasRaceTimeData: b.hasRaceTimeData,
        }
      )
    )
  }, [races])

  const lapHeroModalRows = useMemo(() => {
    if (!lapHeroDetailClass) return []
    return computeLapTotalsRankedForClass(races, lapHeroDetailClass)
  }, [lapHeroDetailClass, races])

  /** Class cards: most consistent class first (leader’s mean session score), then descending. */
  const mostConsistentPerClass = useMemo(() => {
    const groups = computeMostConsistentLeadersPerClass(races)
    if (groups.length === 0) return []
    const rows = groups.map((g) => ({
      className: g.className,
      driverName: g.leader.driverName,
      avgConsistency: g.leader.avgConsistency,
      sessionsWithConsistency: g.leader.sessionsWithConsistency,
    }))
    return [...rows].sort((a, b) => {
      if (b.avgConsistency !== a.avgConsistency) return b.avgConsistency - a.avgConsistency
      if (b.sessionsWithConsistency !== a.sessionsWithConsistency) {
        return b.sessionsWithConsistency - a.sessionsWithConsistency
      }
      return a.className.localeCompare(b.className, undefined, { sensitivity: "base" })
    })
  }, [races])

  const mostConsistentModalRows = useMemo(() => {
    if (!mostConsistentDetailClass) return []
    return computeConsistencyRankedForClass(races, mostConsistentDetailClass)
  }, [mostConsistentDetailClass, races])

  /** Class cards: fastest class leader lap first (lowest time), then slower. */
  const fastestLapPerClass = useMemo(() => {
    const groups = computeFastestLapLeadersPerClass(races)
    if (groups.length === 0) return []
    const rows = groups.map((g) => ({
      className: g.className,
      driverName: g.leader.driverName,
      bestFastLapSeconds: g.leader.bestFastLapSeconds,
      sessionsWithFastLap: g.leader.sessionsWithFastLap,
    }))
    return [...rows].sort((a, b) => {
      if (a.bestFastLapSeconds !== b.bestFastLapSeconds) {
        return a.bestFastLapSeconds - b.bestFastLapSeconds
      }
      if (b.sessionsWithFastLap !== a.sessionsWithFastLap) {
        return b.sessionsWithFastLap - a.sessionsWithFastLap
      }
      return a.className.localeCompare(b.className, undefined, { sensitivity: "base" })
    })
  }, [races])

  const fastestLapModalRows = useMemo(() => {
    if (!fastestLapDetailClass) return []
    return computeFastestLapRankedForClass(races, fastestLapDetailClass)
  }, [fastestLapDetailClass, races])

  const classWinnerRows = useMemo(() => {
    return buildClassWinners({ races, multiMainResults, registrationClassNames, entryList })
  }, [races, multiMainResults, registrationClassNames, entryList])

  const classWinnerModalResolved = useMemo(() => {
    if (!classWinnerDetail) return null
    return resolveClassWinnerModalDetail(classWinnerDetail, { races, multiMainResults })
  }, [classWinnerDetail, races, multiMainResults])

  const classWinnerStandingsCount = useMemo(() => {
    if (classWinnerModalResolved?.kind === "multiMain")
      return classWinnerModalResolved.standingsRows.length
    if (classWinnerModalResolved?.kind === "featuredMain")
      return classWinnerModalResolved.standingsRows.length
    return 0
  }, [classWinnerModalResolved])

  const classWinnerStandingsTotalPages = Math.max(
    1,
    Math.ceil(classWinnerStandingsCount / classWinnerStandingsRowsPerPage)
  )
  const classWinnerStandingsEffectivePage = Math.min(
    Math.max(1, classWinnerStandingsPage),
    classWinnerStandingsTotalPages
  )
  const classWinnerMultiMainPageRows = useMemo(() => {
    if (classWinnerModalResolved?.kind !== "multiMain") return []
    const start = (classWinnerStandingsEffectivePage - 1) * classWinnerStandingsRowsPerPage
    return classWinnerModalResolved.standingsRows.slice(
      start,
      start + classWinnerStandingsRowsPerPage
    )
  }, [classWinnerModalResolved, classWinnerStandingsEffectivePage, classWinnerStandingsRowsPerPage])
  const classWinnerFeaturedPageRows = useMemo(() => {
    if (classWinnerModalResolved?.kind !== "featuredMain") return []
    const start = (classWinnerStandingsEffectivePage - 1) * classWinnerStandingsRowsPerPage
    return classWinnerModalResolved.standingsRows.slice(
      start,
      start + classWinnerStandingsRowsPerPage
    )
  }, [classWinnerModalResolved, classWinnerStandingsEffectivePage, classWinnerStandingsRowsPerPage])

  useEffect(() => {
    queueMicrotask(() => setClassWinnerStandingsPage(1))
  }, [classWinnerDetail])

  /** Same class order as Top Qualifiers / Lap Heroes when possible. */
  const closestBattleSummaries = useMemo(() => computeClosestP1P2PerClass(races), [races])

  const driverClosestBattleRows = useMemo(() => computeDriverClosestBattles(races), [races])

  const closestBattleCardsOrdered = useMemo(() => {
    if (closestBattleSummaries.length === 0) return []
    const byClass = new Map(closestBattleSummaries.map((c) => [c.className.trim(), c]))
    const ordered: (typeof closestBattleSummaries)[number][] = []
    const seen = new Set<string>()
    for (const card of cards) {
      const cn = card.className.trim()
      const row = byClass.get(cn)
      if (row && !seen.has(cn)) {
        ordered.push(row)
        seen.add(cn)
      }
    }
    for (const c of closestBattleSummaries) {
      const cn = c.className.trim()
      if (!seen.has(cn)) {
        ordered.push(c)
        seen.add(cn)
      }
    }
    return ordered
  }, [cards, closestBattleSummaries])

  const closestBattlesClassScopedRows = useMemo(() => {
    const cn = closestBattlesModalClass?.trim()
    if (!cn) return driverClosestBattleRows
    return driverClosestBattleRows.filter((r) => r.className.trim() === cn)
  }, [driverClosestBattleRows, closestBattlesModalClass])

  const filteredDriverClosestRows = useMemo(() => {
    const q = closestBattlesDriverFilter.trim().toLowerCase()
    if (!q) return closestBattlesClassScopedRows
    return closestBattlesClassScopedRows.filter((r) => r.driverName.toLowerCase().includes(q))
  }, [closestBattlesClassScopedRows, closestBattlesDriverFilter])

  const closestBattlesTotalPages = Math.max(
    1,
    Math.ceil(filteredDriverClosestRows.length / closestBattlesRowsPerPage)
  )

  const closestBattlesEpochKey = `${closestBattlesDriverFilter}|${closestBattlesRowsPerPage}|${filteredDriverClosestRows.length}|${closestBattlesModalClass ?? ""}`

  const [closestBattlesPagination, setClosestBattlesPagination] = useState<{
    key: string
    page: number
  }>(() => ({ key: "", page: 1 }))

  if (closestBattlesPagination.key !== closestBattlesEpochKey) {
    setClosestBattlesPagination({ key: closestBattlesEpochKey, page: 1 })
  }

  const closestBattlesPage =
    closestBattlesPagination.key === closestBattlesEpochKey
      ? Math.min(Math.max(1, closestBattlesPagination.page), closestBattlesTotalPages)
      : 1

  const paginatedDriverClosestRows = useMemo(() => {
    const start = (closestBattlesPage - 1) * closestBattlesRowsPerPage
    return filteredDriverClosestRows.slice(start, start + closestBattlesRowsPerPage)
  }, [filteredDriverClosestRows, closestBattlesPage, closestBattlesRowsPerPage])

  /** Close other highlight modals so e.g. Class winner cannot stack above Closest battles. */
  const openClosestBattlesModalForClass = useCallback((className: string) => {
    setDetailCard(null)
    setLapHeroDetailClass(null)
    setMostConsistentDetailClass(null)
    setFastestLapDetailClass(null)
    setWinnerMeanAvgLapDetailClass(null)
    setClassWinnerDetail(null)
    setClosestBattlesModalClass(className)
    setClosestBattlesModalOpen(true)
  }, [])

  const classWinnerCardsOrdered = useMemo(() => {
    if (classWinnerRows.length === 0) return []
    const byClass = new Map(classWinnerRows.map((w) => [w.className.trim(), w]))
    const ordered: ClassWinnerHighlight[] = []
    const seen = new Set<string>()
    for (const card of cards) {
      const cn = card.className.trim()
      const w = byClass.get(cn)
      if (w && !seen.has(cn)) {
        ordered.push(w)
        seen.add(cn)
      }
    }
    for (const w of classWinnerRows) {
      const cn = w.className.trim()
      if (!seen.has(cn)) {
        ordered.push(w)
        seen.add(cn)
      }
    }
    return ordered
  }, [cards, classWinnerRows])

  /** Class winners: fastest mean session average lap first; no-data cards last. */
  const winnerMeanAvgLapCards = useMemo(() => {
    const rows = computeClassWinnerMeanAvgLapCards(classWinnerCardsOrdered, races)
    return [...rows].sort((a, b) => {
      const aHas = a.meanAvgLapSeconds != null
      const bHas = b.meanAvgLapSeconds != null
      if (aHas && bHas) {
        if (a.meanAvgLapSeconds! !== b.meanAvgLapSeconds!) {
          return a.meanAvgLapSeconds! - b.meanAvgLapSeconds!
        }
        if (b.sessionsWithAvgLap !== a.sessionsWithAvgLap) {
          return b.sessionsWithAvgLap - a.sessionsWithAvgLap
        }
      } else if (aHas && !bHas) {
        return -1
      } else if (!aHas && bHas) {
        return 1
      }
      return a.className.localeCompare(b.className, undefined, { sensitivity: "base" })
    })
  }, [classWinnerCardsOrdered, races])

  const winnerMeanAvgLapModalDetail = useMemo(() => {
    if (!winnerMeanAvgLapDetailClass) return null
    return winnerMeanAvgLapCards.find((c) => c.className === winnerMeanAvgLapDetailClass) ?? null
  }, [winnerMeanAvgLapDetailClass, winnerMeanAvgLapCards])

  const selectHighlightsTab = (next: EventHighlightsSubTab) => {
    setHighlightsTab(next)
    setDetailCard(null)
    setLapHeroDetailClass(null)
    setMostConsistentDetailClass(null)
    setFastestLapDetailClass(null)
    setWinnerMeanAvgLapDetailClass(null)
    setClassWinnerDetail(null)
    setClosestBattlesModalOpen(false)
    setClosestBattlesModalClass(null)
    setClosestBattlesDriverFilter("")
  }

  const {
    classWinners: { tabId: cwTabId, panelId: cwPanelId },
    topQualifiers: { tabId: tqTabId, panelId: tqPanelId },
    seeding: { tabId: seedingTabId, panelId: seedingPanelId },
    lapHeroes: { tabId: lhTabId, panelId: lhPanelId },
    mostConsistentDrivers: { tabId: mcTabId, panelId: mcPanelId },
    fastestLaps: { tabId: flTabId, panelId: flPanelId },
    fastestAverageLaps: { tabId: falTabId, panelId: falPanelId },
    lapStats: { tabId: lsTabId, panelId: lsPanelId },
    closestBattles: { tabId: cbTabId, panelId: cbPanelId },
  } = HIGHLIGHT_TAB_META

  return (
    <div className="space-y-3">
      <EventOverviewHighlightsTabList selected={highlightsTab} onSelect={selectHighlightsTab} />

      {highlightsTab === "lapHeroes" && eventHasMain ? (
        <div
          id="event-overview-lap-heroes-info"
          className="w-fit max-w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 px-3 py-2 shadow-sm"
          aria-label={LAP_HEROES_INFO_TEXT}
        >
          <p
            className={`whitespace-nowrap text-xs text-[var(--token-text-secondary)] ${typography.bodySecondary}`}
          >
            {LAP_HEROES_INFO_TEXT}
          </p>
        </div>
      ) : null}

      {highlightsTab === "mostConsistentDrivers" && eventHasMain ? (
        <div
          id="event-overview-most-consistent-info"
          className="w-fit max-w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 px-3 py-2 shadow-sm"
          aria-label={MOST_CONSISTENT_INFO_TEXT}
        >
          <p
            className={`max-w-full text-xs text-[var(--token-text-secondary)] ${typography.bodySecondary}`}
          >
            {MOST_CONSISTENT_INFO_TEXT}
          </p>
        </div>
      ) : null}

      {highlightsTab === "fastestLaps" && eventHasMain ? (
        <div
          id="event-overview-fastest-laps-info"
          className="w-fit max-w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 px-3 py-2 shadow-sm"
          aria-label={FASTEST_LAPS_INFO_TEXT}
        >
          <p
            className={`max-w-full text-xs text-[var(--token-text-secondary)] ${typography.bodySecondary}`}
          >
            {FASTEST_LAPS_INFO_TEXT}
          </p>
        </div>
      ) : null}

      {highlightsTab === "fastestAverageLaps" && eventHasMain ? (
        <div
          id="event-overview-fastest-avg-laps-info"
          className="w-fit max-w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 px-3 py-2 shadow-sm"
          aria-label={FASTEST_AVG_LAPS_INFO_TEXT}
        >
          <p
            className={`max-w-full text-xs text-[var(--token-text-secondary)] ${typography.bodySecondary}`}
          >
            {FASTEST_AVG_LAPS_INFO_TEXT}
          </p>
        </div>
      ) : null}

      {highlightsTab === "closestBattles" && eventHasMain ? (
        <div
          id="event-overview-closest-battles-info"
          className="w-fit max-w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 px-3 py-2 shadow-sm"
          aria-label={CLOSEST_BATTLES_INFO_TEXT}
        >
          <p
            className={`max-w-full text-xs text-[var(--token-text-secondary)] ${typography.bodySecondary}`}
          >
            {CLOSEST_BATTLES_INFO_TEXT}
          </p>
        </div>
      ) : null}

      {highlightsTab === "classWinners" ? (
        <div id={cwPanelId} role="tabpanel" aria-labelledby={cwTabId} className="space-y-3">
          {!eventHasMain ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              {HIGHLIGHTS_NEED_MAIN_TEXT}
            </p>
          ) : classWinnerCardsOrdered.length === 0 ? (
            <div
              id="event-overview-class-winners-empty"
              className={OVERVIEW_INFO_BOX_INLINE_CLASS}
              aria-label={CLASS_WINNERS_EMPTY_TEXT}
            >
              <p
                className={`whitespace-nowrap text-sm text-[var(--token-text-secondary)] ${typography.body}`}
              >
                {CLASS_WINNERS_EMPTY_TEXT}
              </p>
            </div>
          ) : (
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-5">
              {classWinnerCardsOrdered.map((cw) => {
                const isOpen =
                  classWinnerDetail?.className === cw.className &&
                  classWinnerDetail?.winnerName === cw.winnerName
                return (
                  <li key={cw.className}>
                    <button
                      type="button"
                      className={`flex min-h-0 min-w-0 w-full flex-col items-stretch p-3 text-left transition-colors sm:p-3.5 ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/90`}
                      style={OVERVIEW_GLASS_SURFACE_STYLE}
                      onClick={() => setClassWinnerDetail(cw)}
                      aria-haspopup="dialog"
                      aria-expanded={isOpen}
                      aria-label={`Open class results: 1st ${cw.winnerName}${
                        cw.secondPlaceName ? `, 2nd ${cw.secondPlaceName}` : ""
                      }${cw.thirdPlaceName ? `, 3rd ${cw.thirdPlaceName}` : ""} · ${cw.classDisplay}`}
                    >
                      <div className="flex min-w-0 w-full flex-col">
                        <p
                          className={`w-full text-center text-[0.7rem] font-medium uppercase leading-snug tracking-wide text-[var(--token-text-tertiary)]`}
                        >
                          {cw.classDisplay}
                        </p>
                        <div className="mt-2.5 w-full min-w-0 rounded-xl border border-[var(--token-border-default)]/70 bg-[var(--token-surface)]/35 px-2 py-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:px-2.5 sm:py-2.5">
                          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
                            <li className="grid min-h-0 min-w-0 grid-cols-[2.5rem_1fr] items-center gap-x-2.5 sm:grid-cols-[2.75rem_1fr]">
                              <span
                                className="inline-flex h-6 w-full shrink-0 items-center justify-center rounded-md bg-[var(--token-status-warning-bg)] text-[0.65rem] font-bold leading-none tabular-nums tracking-tight text-[var(--token-status-warning-text)] ring-1 ring-inset ring-[var(--token-status-warning-text)]/20"
                                aria-hidden
                              >
                                1st
                              </span>
                              <HighlightPodiumName
                                name={cw.winnerName}
                                className="min-w-0 truncate text-sm font-semibold leading-tight text-[var(--token-text-primary)] sm:text-[0.95rem]"
                              />
                            </li>
                            <li className="grid min-h-0 min-w-0 grid-cols-[2.5rem_1fr] items-center gap-x-2.5 sm:grid-cols-[2.75rem_1fr]">
                              <span
                                className="inline-flex h-6 w-full shrink-0 items-center justify-center rounded-md bg-[var(--token-surface-raised)]/80 text-[0.65rem] font-bold leading-none tabular-nums tracking-tight text-[var(--token-text-secondary)] ring-1 ring-inset ring-[var(--token-border-default)]/80"
                                aria-hidden
                              >
                                2nd
                              </span>
                              <PodiumSlotName
                                name={cw.secondPlaceName}
                                filledClassName="min-w-0 truncate text-xs font-medium leading-tight text-[var(--token-text-primary)] sm:text-sm"
                                emptyHint="No 2nd place in imported results for this class"
                              />
                            </li>
                            <li className="grid min-h-0 min-w-0 grid-cols-[2.5rem_1fr] items-center gap-x-2.5 sm:grid-cols-[2.75rem_1fr]">
                              <span
                                className="inline-flex h-6 w-full shrink-0 items-center justify-center rounded-md bg-[var(--token-surface-raised)]/60 text-[0.65rem] font-bold leading-none tabular-nums tracking-tight text-[var(--token-text-secondary)] ring-1 ring-inset ring-[var(--token-border-default)]/80"
                                aria-hidden
                              >
                                3rd
                              </span>
                              <PodiumSlotName
                                name={cw.thirdPlaceName}
                                filledClassName="min-w-0 truncate text-xs font-medium leading-tight text-[var(--token-text-primary)]/95 sm:text-sm"
                                emptyHint="No 3rd place in imported results for this class"
                              />
                            </li>
                          </ol>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}

      {highlightsTab === "topQualifiers" ? (
        <div id={tqPanelId} role="tabpanel" aria-labelledby={tqTabId} className="space-y-3">
          {!hasQualStandings ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              {QUAL_STANDINGS_UNAVAILABLE_TEXT}
            </p>
          ) : cards.length === 0 ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              {TQ_CARDS_UNRESOLVED_TEXT}
            </p>
          ) : (
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-5">
              {cards.map((card) => {
                const isOpen = detailCard?.className === card.className
                const tqClassLine = formatClassName(card.className)
                return (
                  <li key={card.className}>
                    <button
                      type="button"
                      className={`flex min-h-0 min-w-0 w-full flex-col items-stretch p-3 text-left transition-colors sm:p-3.5 ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/90`}
                      style={OVERVIEW_GLASS_SURFACE_STYLE}
                      onClick={() => setDetailCard(card)}
                      aria-haspopup="dialog"
                      aria-expanded={isOpen}
                      aria-label={`Open qualifying details: 1st ${card.driverDisplayName}${
                        card.secondPlaceName ? `, 2nd ${card.secondPlaceName}` : ""
                      }${card.thirdPlaceName ? `, 3rd ${card.thirdPlaceName}` : ""} · ${tqClassLine}`}
                    >
                      <div className="flex min-w-0 w-full flex-col">
                        <p
                          className={`w-full text-center text-[0.7rem] font-medium uppercase leading-snug tracking-wide text-[var(--token-text-tertiary)]`}
                        >
                          {tqClassLine}
                        </p>
                        <div className="mt-2.5 w-full min-w-0 rounded-xl border border-[var(--token-border-default)]/70 bg-[var(--token-surface)]/35 px-2 py-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:px-2.5 sm:py-2.5">
                          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
                            <li className="grid min-h-0 min-w-0 grid-cols-[2.5rem_1fr] items-center gap-x-2.5 sm:grid-cols-[2.75rem_1fr]">
                              <span
                                className="inline-flex h-6 w-full shrink-0 items-center justify-center rounded-md bg-[var(--token-status-warning-bg)] text-[0.65rem] font-bold leading-none tabular-nums tracking-tight text-[var(--token-status-warning-text)] ring-1 ring-inset ring-[var(--token-status-warning-text)]/20"
                                aria-hidden
                              >
                                1st
                              </span>
                              <HighlightPodiumName
                                name={card.driverDisplayName}
                                className="min-w-0 truncate text-sm font-semibold leading-tight text-[var(--token-text-primary)] sm:text-[0.95rem]"
                              />
                            </li>
                            <li className="grid min-h-0 min-w-0 grid-cols-[2.5rem_1fr] items-center gap-x-2.5 sm:grid-cols-[2.75rem_1fr]">
                              <span
                                className="inline-flex h-6 w-full shrink-0 items-center justify-center rounded-md bg-[var(--token-surface-raised)]/80 text-[0.65rem] font-bold leading-none tabular-nums tracking-tight text-[var(--token-text-secondary)] ring-1 ring-inset ring-[var(--token-border-default)]/80"
                                aria-hidden
                              >
                                2nd
                              </span>
                              <PodiumSlotName
                                name={card.secondPlaceName}
                                filledClassName="min-w-0 truncate text-xs font-medium leading-tight text-[var(--token-text-primary)] sm:text-sm"
                                emptyHint="No 2nd place in qual standings for this class"
                              />
                            </li>
                            <li className="grid min-h-0 min-w-0 grid-cols-[2.5rem_1fr] items-center gap-x-2.5 sm:grid-cols-[2.75rem_1fr]">
                              <span
                                className="inline-flex h-6 w-full shrink-0 items-center justify-center rounded-md bg-[var(--token-surface-raised)]/60 text-[0.65rem] font-bold leading-none tabular-nums tracking-tight text-[var(--token-text-secondary)] ring-1 ring-inset ring-[var(--token-border-default)]/80"
                                aria-hidden
                              >
                                3rd
                              </span>
                              <PodiumSlotName
                                name={card.thirdPlaceName}
                                filledClassName="min-w-0 truncate text-xs font-medium leading-tight text-[var(--token-text-primary)]/95 sm:text-sm"
                                emptyHint="No 3rd place in qual standings for this class"
                              />
                            </li>
                          </ol>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}

      {highlightsTab === "seeding" ? (
        <div id={seedingPanelId} role="tabpanel" aria-labelledby={seedingTabId} className="min-w-0">
          <div
            className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 px-3 py-3 text-sm leading-relaxed text-[var(--token-text-secondary)] shadow-sm"
            role="status"
          >
            {SEEDING_PLACEHOLDER_TEXT}
          </div>
        </div>
      ) : null}

      {highlightsTab === "lapHeroes" ? (
        <div id={lhPanelId} role="tabpanel" aria-labelledby={lhTabId} className="space-y-3">
          {!eventHasMain ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              {HIGHLIGHTS_NEED_MAIN_TEXT}
            </p>
          ) : lapHeroPerClass.length === 0 ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              No lap counts are available yet for this event. They appear after session results with
              laps completed are ingested.
            </p>
          ) : (
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-5">
              {lapHeroPerClass.map(
                ({ className, driverName, totalLaps, hasRaceTimeData, totalRaceTimeSeconds }) => {
                  const isOpen = lapHeroDetailClass === className
                  const lapsTimeLine = formatLapHeroCardLapsLine(
                    totalLaps,
                    hasRaceTimeData,
                    totalRaceTimeSeconds
                  )
                  return (
                    <li key={className}>
                      <button
                        type="button"
                        className={`flex min-h-0 min-w-0 w-full flex-col items-center justify-center gap-2 p-4 text-center transition-colors ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/90`}
                        style={OVERVIEW_GLASS_SURFACE_STYLE}
                        onClick={() => setLapHeroDetailClass(className)}
                        aria-haspopup="dialog"
                        aria-expanded={isOpen}
                        aria-label={`Open lap totals for ${formatClassName(className)}`}
                      >
                        <div className="flex min-w-0 w-full flex-col items-center">
                          <p
                            className={`w-fit max-w-full text-center text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]`}
                          >
                            {formatClassName(className)}
                          </p>
                          <p
                            className={`mt-1 w-full max-w-full truncate text-center text-base font-semibold text-[var(--token-text-primary)]`}
                          >
                            {driverName}
                          </p>
                          <p className="mt-0.5 text-center text-sm font-semibold leading-snug text-[var(--token-text-primary)]">
                            {lapsTimeLine}
                          </p>
                        </div>
                      </button>
                    </li>
                  )
                }
              )}
            </ul>
          )}
        </div>
      ) : null}

      {highlightsTab === "mostConsistentDrivers" ? (
        <div id={mcPanelId} role="tabpanel" aria-labelledby={mcTabId} className="space-y-3">
          {!eventHasMain ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              {HIGHLIGHTS_NEED_MAIN_TEXT}
            </p>
          ) : mostConsistentPerClass.length === 0 ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              No consistency scores are available yet for this event. They appear after session
              results with consistency data are ingested.
            </p>
          ) : (
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-5">
              {mostConsistentPerClass.map(
                ({ className, driverName, avgConsistency, sessionsWithConsistency }) => {
                  const isOpen = mostConsistentDetailClass === className
                  const line = formatMostConsistentCardLine(avgConsistency, sessionsWithConsistency)
                  return (
                    <li key={className}>
                      <button
                        type="button"
                        className={`flex min-h-0 min-w-0 w-full flex-col items-center justify-center gap-2 p-4 text-center transition-colors ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/90`}
                        style={OVERVIEW_GLASS_SURFACE_STYLE}
                        onClick={() => setMostConsistentDetailClass(className)}
                        aria-haspopup="dialog"
                        aria-expanded={isOpen}
                        aria-label={`Open consistency ranking for ${formatClassName(className)}`}
                      >
                        <div className="flex min-w-0 w-full flex-col items-center">
                          <p
                            className={`w-fit max-w-full text-center text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]`}
                          >
                            {formatClassName(className)}
                          </p>
                          <p
                            className={`mt-1 w-full max-w-full truncate text-center text-base font-semibold text-[var(--token-text-primary)]`}
                          >
                            {driverName}
                          </p>
                          <p className="mt-0.5 text-center text-sm font-semibold leading-snug text-[var(--token-text-primary)]">
                            {line}
                          </p>
                        </div>
                      </button>
                    </li>
                  )
                }
              )}
            </ul>
          )}
        </div>
      ) : null}

      {highlightsTab === "fastestLaps" ? (
        <div id={flPanelId} role="tabpanel" aria-labelledby={flTabId} className="space-y-3">
          {!eventHasMain ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              {HIGHLIGHTS_NEED_MAIN_TEXT}
            </p>
          ) : fastestLapPerClass.length === 0 ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              No fast lap times are available yet for this event. They appear after session results
              with fast lap data are ingested.
            </p>
          ) : (
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-5">
              {fastestLapPerClass.map(
                ({ className, driverName, bestFastLapSeconds, sessionsWithFastLap }) => {
                  const isOpen = fastestLapDetailClass === className
                  const line = formatFastestLapCardLine(bestFastLapSeconds, sessionsWithFastLap)
                  return (
                    <li key={className}>
                      <button
                        type="button"
                        className={`flex min-h-0 min-w-0 w-full flex-col items-center justify-center gap-2 p-4 text-center transition-colors ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/90`}
                        style={OVERVIEW_GLASS_SURFACE_STYLE}
                        onClick={() => setFastestLapDetailClass(className)}
                        aria-haspopup="dialog"
                        aria-expanded={isOpen}
                        aria-label={`Open fastest lap ranking for ${formatClassName(className)}`}
                      >
                        <div className="flex min-w-0 w-full flex-col items-center">
                          <p
                            className={`w-fit max-w-full text-center text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]`}
                          >
                            {formatClassName(className)}
                          </p>
                          <p
                            className={`mt-1 w-full max-w-full truncate text-center text-base font-semibold text-[var(--token-text-primary)]`}
                          >
                            {driverName}
                          </p>
                          <p className="mt-0.5 text-center text-sm font-semibold leading-snug text-[var(--token-text-primary)]">
                            {line}
                          </p>
                        </div>
                      </button>
                    </li>
                  )
                }
              )}
            </ul>
          )}
        </div>
      ) : null}

      {highlightsTab === "fastestAverageLaps" ? (
        <div id={falPanelId} role="tabpanel" aria-labelledby={falTabId} className="space-y-3">
          {!eventHasMain ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              {HIGHLIGHTS_NEED_MAIN_TEXT}
            </p>
          ) : winnerMeanAvgLapCards.length === 0 ? (
            <div
              id="event-overview-fastest-avg-laps-empty"
              className={OVERVIEW_INFO_BOX_INLINE_CLASS}
              aria-label={CLASS_WINNERS_EMPTY_TEXT}
            >
              <p
                className={`whitespace-nowrap text-sm text-[var(--token-text-secondary)] ${typography.body}`}
              >
                {CLASS_WINNERS_EMPTY_TEXT}
              </p>
            </div>
          ) : (
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-5">
              {winnerMeanAvgLapCards.map((c) => {
                const isOpen = winnerMeanAvgLapDetailClass === c.className
                const line = formatWinnerMeanAvgLapLine(c.meanAvgLapSeconds, c.sessionsWithAvgLap)
                return (
                  <li key={c.className}>
                    <button
                      type="button"
                      className={`flex min-h-0 min-w-0 w-full flex-col items-center justify-center gap-2 p-4 text-center transition-colors ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/90`}
                      style={OVERVIEW_GLASS_SURFACE_STYLE}
                      onClick={() => setWinnerMeanAvgLapDetailClass(c.className)}
                      aria-haspopup="dialog"
                      aria-expanded={isOpen}
                      aria-label={`Open session average laps for ${c.winnerName} in ${c.classDisplay}`}
                    >
                      <div className="flex min-w-0 w-full flex-col items-center">
                        <p
                          className={`w-fit max-w-full text-center text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]`}
                        >
                          {c.classDisplay}
                        </p>
                        <p
                          className={`mt-1 w-full max-w-full truncate text-center text-base font-semibold text-[var(--token-text-primary)]`}
                        >
                          {c.winnerName}
                        </p>
                        <p className="mt-0.5 text-center text-sm font-semibold leading-snug text-[var(--token-text-primary)]">
                          {line}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}

      {highlightsTab === "lapStats" ? (
        <div id={lsPanelId} role="tabpanel" aria-labelledby={lsTabId} className="min-w-0">
          {!eventHasMain ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              {HIGHLIGHTS_NEED_MAIN_TEXT}
            </p>
          ) : null}
        </div>
      ) : null}

      {highlightsTab === "closestBattles" ? (
        <div id={cbPanelId} role="tabpanel" aria-labelledby={cbTabId} className="space-y-3">
          {!eventHasMain ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              {HIGHLIGHTS_NEED_MAIN_TEXT}
            </p>
          ) : closestBattleCardsOrdered.length === 0 ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              No main-event results with P1 and P2 times are available yet. Closest battles appear
              after total race times are imported for mains.
            </p>
          ) : (
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-5">
              {closestBattleCardsOrdered.map((c) => {
                const isOpen =
                  closestBattlesModalOpen && closestBattlesModalClass?.trim() === c.className.trim()
                const gapLine = `${c.gapDisplay} · ${c.raceLabel}`
                return (
                  <li key={c.className}>
                    <button
                      type="button"
                      className={`flex min-h-0 min-w-0 w-full flex-col items-center justify-center gap-2 p-4 text-center transition-colors ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/90`}
                      style={OVERVIEW_GLASS_SURFACE_STYLE}
                      onClick={() => openClosestBattlesModalForClass(c.className)}
                      aria-haspopup="dialog"
                      aria-expanded={isOpen}
                      aria-label={`Open closest battles table: ${c.classDisplay} ${c.p1Name} vs ${c.p2Name}`}
                    >
                      <div className="flex min-w-0 w-full flex-col items-center">
                        <p
                          className={`w-fit max-w-full text-center text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]`}
                        >
                          {c.classDisplay}
                        </p>
                        <p
                          className={`mt-1 w-full max-w-full truncate text-center text-base font-semibold text-[var(--token-text-primary)]`}
                        >
                          {c.p1Name}
                          <span className="text-[var(--token-text-muted)]"> vs </span>
                          {c.p2Name}
                        </p>
                        <p className="mt-0.5 text-center text-sm font-semibold leading-snug text-[var(--token-text-primary)]">
                          {gapLine}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}

      <Modal
        isOpen={detailCard !== null}
        onClose={() => setDetailCard(null)}
        title={detailCard?.driverDisplayName ?? "Top qualifier"}
        subtitle={
          detailCard
            ? `${formatClassName(detailCard.className)} · ${detailCard.points} qual points`
            : undefined
        }
        maxWidth="md"
        resizable={false}
      >
        {detailCard && detailCard.sessions.length === 0 ? (
          <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
            No qualifying-session rows found for this driver in imported race results.
          </p>
        ) : detailCard ? (
          <ul className="flex list-none flex-col gap-2 p-0">
            {detailCard.sessions.map((s) => (
              <li
                key={`${detailCard.className}-${s.raceId}`}
                className="flex min-w-0 items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 flex-1 break-words text-[var(--token-text-secondary)]">
                  {s.raceLabel}
                </span>
                <span className="shrink-0 tabular-nums font-medium text-[var(--token-text-primary)]">
                  {formatPlaceOrdinal(s.positionFinal)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Modal>

      <Modal
        isOpen={closestBattlesModalOpen}
        onClose={() => {
          setClosestBattlesModalOpen(false)
          setClosestBattlesModalClass(null)
          setClosestBattlesDriverFilter("")
        }}
        title="Closest battles"
        subtitle={
          closestBattlesModalClass
            ? `${formatClassName(closestBattlesModalClass)} · Main events · each driver’s tightest adjacent gap on total time`
            : "Main events · each driver’s tightest adjacent gap on total time"
        }
        maxWidth="lg"
        resizableDefaultSize={CLOSEST_BATTLES_MODAL_DEFAULT_SIZE}
      >
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="closest-battles-driver-filter"
              className="text-xs font-medium text-[var(--token-text-secondary)]"
            >
              Driver
            </label>
            <input
              id="closest-battles-driver-filter"
              type="search"
              value={closestBattlesDriverFilter}
              onChange={(e) => setClosestBattlesDriverFilter(e.target.value)}
              placeholder="Filter by driver name"
              autoComplete="off"
              className="min-w-[12rem] max-w-full rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-sm text-[var(--token-text-primary)] placeholder:text-[var(--token-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
            />
          </div>
          {filteredDriverClosestRows.length === 0 ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              {driverClosestBattleRows.length === 0
                ? "No adjacent-gap battles could be computed from main results."
                : closestBattlesClassScopedRows.length === 0
                  ? "No closest-battle rows for this class in imported main results."
                  : "No drivers match this filter."}
            </p>
          ) : (
            <>
              <DataTableFrame>
                <StandardTable>
                  <StandardTableHeader>
                    <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-alt)]">
                      <StandardTableCell header>Driver</StandardTableCell>
                      <StandardTableCell header>Class</StandardTableCell>
                      <StandardTableCell header>Race</StandardTableCell>
                      <StandardTableCell header>Finish</StandardTableCell>
                      <StandardTableCell header>vs</StandardTableCell>
                      <StandardTableCell header>Gap</StandardTableCell>
                    </tr>
                  </StandardTableHeader>
                  <tbody>
                    {paginatedDriverClosestRows.map((row) => (
                      <StandardTableRow
                        key={`${row.driverId}-${row.className}-${row.raceLabel}-${row.positionFinal}`}
                      >
                        <StandardTableCell>{row.driverName}</StandardTableCell>
                        <StandardTableCell>{row.classDisplay}</StandardTableCell>
                        <StandardTableCell className="max-w-[12rem]">
                          <span className="line-clamp-2 break-words">{row.raceLabel}</span>
                        </StandardTableCell>
                        <StandardTableCell className="tabular-nums">
                          P{row.positionFinal}
                        </StandardTableCell>
                        <StandardTableCell>
                          {row.opponentName}{" "}
                          <span className="text-[var(--token-text-muted)]">
                            (P{row.opponentPosition})
                          </span>
                        </StandardTableCell>
                        <StandardTableCell className="tabular-nums font-medium text-[var(--token-text-primary)]">
                          {formatGapSecondsLabel(row.gapSeconds)}
                        </StandardTableCell>
                      </StandardTableRow>
                    ))}
                  </tbody>
                </StandardTable>
              </DataTableFrame>
              <ListPagination
                embedded
                currentPage={closestBattlesPage}
                totalPages={closestBattlesTotalPages}
                onPageChange={(page) =>
                  setClosestBattlesPagination({ key: closestBattlesEpochKey, page })
                }
                itemsPerPage={closestBattlesRowsPerPage}
                totalItems={filteredDriverClosestRows.length}
                itemLabel="drivers"
                onRowsPerPageChange={(n) => {
                  setClosestBattlesRowsPerPage(normalizeTableRowsPerPage(n))
                }}
              />
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={mostConsistentDetailClass !== null}
        onClose={() => setMostConsistentDetailClass(null)}
        title={
          mostConsistentDetailClass ? formatClassName(mostConsistentDetailClass) : "Consistency"
        }
        subtitle="Mean session score · higher is better · more sessions wins ties"
        maxWidth="md"
        resizable={false}
      >
        {mostConsistentDetailClass && mostConsistentModalRows.length === 0 ? (
          <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
            No consistency data found for this class.
          </p>
        ) : mostConsistentDetailClass ? (
          <ul className="flex list-none flex-col gap-2 p-0">
            {mostConsistentModalRows.map((row, index) => (
              <li
                key={`${mostConsistentDetailClass}-${row.driverId}`}
                className="flex min-w-0 items-baseline justify-between gap-3 text-sm"
              >
                <span className="shrink-0 tabular-nums text-[var(--token-text-tertiary)]">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 break-words font-medium text-[var(--token-text-primary)]">
                  {row.driverName}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums text-right text-sm font-medium text-[var(--token-text-primary)]">
                  <span>{row.avgConsistency.toFixed(1)}%</span>
                  <span className="text-xs font-normal text-[var(--token-text-tertiary)]">
                    {row.sessionsWithConsistency}{" "}
                    {row.sessionsWithConsistency === 1 ? "session" : "sessions"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Modal>

      <Modal
        isOpen={fastestLapDetailClass !== null}
        onClose={() => setFastestLapDetailClass(null)}
        title={fastestLapDetailClass ? formatClassName(fastestLapDetailClass) : "Fastest laps"}
        subtitle="Best lap per driver in class · lower is faster · more sessions wins ties"
        maxWidth="md"
        resizable={false}
      >
        {fastestLapDetailClass && fastestLapModalRows.length === 0 ? (
          <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
            No fast lap data found for this class.
          </p>
        ) : fastestLapDetailClass ? (
          <ul className="flex list-none flex-col gap-2 p-0">
            {fastestLapModalRows.map((row, index) => (
              <li
                key={`${fastestLapDetailClass}-${row.driverId}`}
                className="flex min-w-0 items-baseline justify-between gap-3 text-sm"
              >
                <span className="shrink-0 tabular-nums text-[var(--token-text-tertiary)]">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 break-words font-medium text-[var(--token-text-primary)]">
                  {row.driverName}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums text-right text-sm font-medium text-[var(--token-text-primary)]">
                  <span>{formatLapTime(row.bestFastLapSeconds)}</span>
                  <span className="text-xs font-normal text-[var(--token-text-tertiary)]">
                    {row.sessionsWithFastLap}{" "}
                    {row.sessionsWithFastLap === 1 ? "session" : "sessions"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Modal>

      <Modal
        isOpen={winnerMeanAvgLapDetailClass !== null}
        onClose={() => setWinnerMeanAvgLapDetailClass(null)}
        title={winnerMeanAvgLapModalDetail?.winnerName ?? "Class winner"}
        subtitle={
          winnerMeanAvgLapModalDetail
            ? `${winnerMeanAvgLapModalDetail.classDisplay} · session average laps (mean ${winnerMeanAvgLapModalDetail.meanAvgLapSeconds != null ? formatLapTime(winnerMeanAvgLapModalDetail.meanAvgLapSeconds) : "—"})`
            : undefined
        }
        maxWidth="md"
        resizable={false}
      >
        {winnerMeanAvgLapModalDetail && winnerMeanAvgLapModalDetail.sessionRows.length === 0 ? (
          <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
            No per-session average lap data for this winner in imported results.
          </p>
        ) : winnerMeanAvgLapModalDetail ? (
          <ul className="flex list-none flex-col gap-2 p-0">
            {winnerMeanAvgLapModalDetail.sessionRows.map((row) => (
              <li
                key={`${winnerMeanAvgLapModalDetail.className}-${row.raceId}`}
                className="flex min-w-0 items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 flex-1 break-words text-[var(--token-text-secondary)]">
                  {row.raceLabel}
                </span>
                <span className="shrink-0 tabular-nums font-medium text-[var(--token-text-primary)]">
                  {formatLapTime(row.avgLapTimeSeconds)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Modal>

      <Modal
        isOpen={lapHeroDetailClass !== null}
        onClose={() => setLapHeroDetailClass(null)}
        title={lapHeroDetailClass ? formatClassName(lapHeroDetailClass) : "Lap heroes"}
        subtitle="Ranked by total laps, then shortest combined session time"
        maxWidth="md"
        resizable={false}
      >
        {lapHeroDetailClass && lapHeroModalRows.length === 0 ? (
          <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
            No lap data found for this class.
          </p>
        ) : lapHeroDetailClass ? (
          <ul className="flex list-none flex-col gap-2 p-0">
            {lapHeroModalRows.map((row, index) => (
              <li
                key={`${lapHeroDetailClass}-${row.driverId}`}
                className="flex min-w-0 items-baseline justify-between gap-3 text-sm"
              >
                <span className="shrink-0 tabular-nums text-[var(--token-text-tertiary)]">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 break-words font-medium text-[var(--token-text-primary)]">
                  {row.driverName}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums text-right text-sm font-medium text-[var(--token-text-primary)]">
                  <span>
                    {row.totalLaps.toLocaleString()} {row.totalLaps === 1 ? "lap" : "laps"}
                  </span>
                  <span className="text-xs font-normal text-[var(--token-text-tertiary)]">
                    {formatTotalTime(row.hasRaceTimeData ? row.totalRaceTimeSeconds : null)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Modal>

      <Modal
        isOpen={classWinnerDetail !== null}
        onClose={() => setClassWinnerDetail(null)}
        title={classWinnerDetail?.winnerName ?? "Class winner"}
        subtitle={
          classWinnerDetail
            ? `${classWinnerDetail.classDisplay} · ${classWinnerDetail.raceLabel}`
            : undefined
        }
        maxWidth="lg"
        resizable
        resizableDefaultSize={CLASS_WINNER_MODAL_RESIZABLE_DEFAULT}
      >
        {classWinnerDetail ? (
          <div
            className={`space-y-4 text-sm text-[var(--token-text-secondary)] ${typography.body}`}
            style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
          >
            {!classWinnerModalResolved ? (
              <p className="text-[var(--token-text-secondary)]">
                Detailed result breakdown is not available for this import.
              </p>
            ) : classWinnerModalResolved.kind === "multiMain" ? (
              <div className="flex min-w-0 flex-col gap-3">
                <div
                  className="rounded-lg border border-[var(--token-border-default)]/80 bg-[var(--token-surface)]/30 px-3 py-2.5 text-xs leading-relaxed"
                  role="status"
                >
                  <p className="text-[var(--token-text-primary)]">
                    <span
                      className={`font-medium text-[var(--token-text-tertiary)] ${typography.bodySecondary}`}
                    >
                      Schedule:{" "}
                    </span>
                    {classWinnerModalResolved.completedMains} of{" "}
                    {classWinnerModalResolved.totalMains} mains in this class (event). Combined
                    points: lower is better.
                  </p>
                  {classWinnerModalResolved.tieBreaker ? (
                    <p
                      className={`mt-1.5 text-[var(--token-text-primary)] ${typography.bodySecondary}`}
                    >
                      <span className="font-medium text-[var(--token-text-tertiary)]">
                        Tie-break:{" "}
                      </span>
                      {classWinnerModalResolved.tieBreaker}
                    </p>
                  ) : null}
                </div>
                {classWinnerModalResolved.standingsRows.length === 0 ? (
                  <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
                    No standings rows in the imported multi-main table for this class.
                  </p>
                ) : (
                  <>
                    <DataTableFrame className="max-w-full overflow-x-auto">
                      <StandardTable>
                        <StandardTableHeader>
                          <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-alt)]">
                            <StandardTableCell header className="w-10 whitespace-nowrap">
                              Pl.
                            </StandardTableCell>
                            <StandardTableCell header>Driver</StandardTableCell>
                            <StandardTableCell
                              header
                              className="w-12 whitespace-nowrap text-right tabular-nums"
                            >
                              Pts
                            </StandardTableCell>
                            <StandardTableCell
                              header
                              className="w-12 whitespace-nowrap text-right tabular-nums"
                            >
                              Sd
                            </StandardTableCell>
                            {classWinnerModalResolved.mainColumnLabels.map((label) => (
                              <StandardTableCell
                                key={label}
                                header
                                className="min-w-[6.5rem] max-w-[10rem] whitespace-nowrap"
                              >
                                {label}
                              </StandardTableCell>
                            ))}
                          </tr>
                        </StandardTableHeader>
                        <tbody>
                          {classWinnerMultiMainPageRows.map((row) => (
                            <StandardTableRow
                              key={`${row.position}-${row.driverName}`}
                              className={
                                row.highlight ? "bg-[var(--token-accent-soft-bg)]/50" : undefined
                              }
                            >
                              <StandardTableCell className="tabular-nums text-[var(--token-text-secondary)]">
                                {row.position}
                              </StandardTableCell>
                              <StandardTableCell className="min-w-0 break-words font-medium text-[var(--token-text-primary)]">
                                {row.driverName}
                              </StandardTableCell>
                              <StandardTableCell className="text-right tabular-nums text-[var(--token-text-primary)]">
                                {row.points}
                              </StandardTableCell>
                              <StandardTableCell className="text-right tabular-nums text-[var(--token-text-secondary)]">
                                {row.seededPosition != null ? row.seededPosition : "—"}
                              </StandardTableCell>
                              {row.mainCells.map((cell, i) => (
                                <StandardTableCell
                                  key={classWinnerModalResolved.mainColumnLabels[i]!}
                                  className="min-w-0 max-w-[10rem] break-all font-mono text-xs text-[var(--token-text-primary)]"
                                >
                                  {cell}
                                </StandardTableCell>
                              ))}
                            </StandardTableRow>
                          ))}
                        </tbody>
                      </StandardTable>
                    </DataTableFrame>
                    <ListPagination
                      embedded
                      currentPage={classWinnerStandingsEffectivePage}
                      totalPages={classWinnerStandingsTotalPages}
                      onPageChange={setClassWinnerStandingsPage}
                      itemsPerPage={classWinnerStandingsRowsPerPage}
                      totalItems={classWinnerStandingsCount}
                      itemLabel="drivers"
                      onRowsPerPageChange={(n) => {
                        setClassWinnerStandingsRowsPerPage(normalizeTableRowsPerPage(n))
                      }}
                    />
                  </>
                )}
              </div>
            ) : classWinnerModalResolved.kind === "featuredMain" ? (
              <div className="flex min-w-0 flex-col gap-3">
                <div
                  className="rounded-lg border border-[var(--token-border-default)]/80 bg-[var(--token-surface)]/30 px-3 py-2.5 text-xs leading-relaxed"
                  role="status"
                >
                  <p className="text-[var(--token-text-primary)]">
                    <span
                      className={`font-medium text-[var(--token-text-tertiary)] ${typography.bodySecondary}`}
                    >
                      Final:{" "}
                    </span>
                    {classWinnerModalResolved.sessionRaceLabel}
                    <span className="text-[var(--token-text-tertiary)]">
                      {" "}
                      — full finishing order for this class (imported main).
                    </span>
                  </p>
                </div>
                {classWinnerModalResolved.standingsRows.length === 0 ? (
                  <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
                    No result rows in this main for the class.
                  </p>
                ) : (
                  <>
                    <DataTableFrame className="max-w-full overflow-x-auto">
                      <StandardTable>
                        <StandardTableHeader>
                          <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-alt)]">
                            <StandardTableCell header className="w-10 whitespace-nowrap">
                              Pl.
                            </StandardTableCell>
                            <StandardTableCell header>Driver</StandardTableCell>
                            <StandardTableCell header className="min-w-[5rem]">
                              Laps / time
                            </StandardTableCell>
                            <StandardTableCell header className="min-w-[4rem] whitespace-nowrap">
                              Fast lap
                            </StandardTableCell>
                          </tr>
                        </StandardTableHeader>
                        <tbody>
                          {classWinnerFeaturedPageRows.map((row) => (
                            <StandardTableRow
                              key={`${row.position}-${row.driverName}`}
                              className={
                                row.highlight ? "bg-[var(--token-accent-soft-bg)]/50" : undefined
                              }
                            >
                              <StandardTableCell className="tabular-nums text-[var(--token-text-secondary)]">
                                {row.position}
                              </StandardTableCell>
                              <StandardTableCell className="min-w-0 break-words font-medium text-[var(--token-text-primary)]">
                                {row.driverName}
                              </StandardTableCell>
                              <StandardTableCell className="min-w-0 break-words font-mono text-xs text-[var(--token-text-primary)]">
                                {row.lapsTimeLine ?? "—"}
                              </StandardTableCell>
                              <StandardTableCell className="tabular-nums text-xs text-[var(--token-text-primary)]">
                                {row.fastLapFormatted ?? "—"}
                              </StandardTableCell>
                            </StandardTableRow>
                          ))}
                        </tbody>
                      </StandardTable>
                    </DataTableFrame>
                    <ListPagination
                      embedded
                      currentPage={classWinnerStandingsEffectivePage}
                      totalPages={classWinnerStandingsTotalPages}
                      onPageChange={setClassWinnerStandingsPage}
                      itemsPerPage={classWinnerStandingsRowsPerPage}
                      totalItems={classWinnerStandingsCount}
                      itemLabel="drivers"
                      onRowsPerPageChange={(n) => {
                        setClassWinnerStandingsRowsPerPage(normalizeTableRowsPerPage(n))
                      }}
                    />
                  </>
                )}
              </div>
            ) : null}
            <p className={`text-xs text-[var(--token-text-tertiary)] ${typography.bodySecondary}`}>
              For each final (A Main, B Main, …), open{" "}
              <span className="font-medium text-[var(--token-text-primary)]">Event analysis</span> →{" "}
              <span className="font-medium text-[var(--token-text-primary)]">Event results</span>.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function EventOverviewTopQualifiersTable({ qualPoints }: { qualPoints: QualPayload }) {
  const [classFilter, setClassFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)

  const standings = useMemo(() => qualPoints?.standings ?? [], [qualPoints])

  const classOptions = useMemo(() => {
    const seen = new Set<string>()
    const names: string[] = []
    for (const row of standings) {
      const t = row.className.trim()
      if (!t || seen.has(t)) continue
      seen.add(t)
      names.push(t)
    }
    return names.sort((a, b) => a.localeCompare(b))
  }, [standings])

  /** Ignore stale filter when options change (no setState-in-effect). */
  const resolvedClassFilter = classFilter && classOptions.includes(classFilter) ? classFilter : ""

  const filteredRows = useMemo(() => {
    if (!resolvedClassFilter) return standings
    return standings.filter((q) => q.className.trim() === resolvedClassFilter)
  }, [standings, resolvedClassFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage))
  const effectivePage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = (effectivePage - 1) * itemsPerPage
  const paginatedRows = filteredRows.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    const id = window.setTimeout(() => {
      setCurrentPage(1)
    }, 0)
    return () => window.clearTimeout(id)
  }, [resolvedClassFilter, itemsPerPage, filteredRows.length])

  const handleRowsPerPageChange = (next: number) => {
    setItemsPerPage(next)
    setCurrentPage(1)
  }

  if (!qualPoints || standings.length === 0) {
    return (
      <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
        Qual points standings are not available for this event yet. Re-run ingestion after qual
        results are published, or open the event on LiveRC to view qual standings.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className={typography.h6}>Top Qualifiers</h3>

      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor="top-qualifiers-class-filter"
          className="text-xs font-medium text-[var(--token-text-secondary)]"
        >
          Class
        </label>
        <select
          id="top-qualifiers-class-filter"
          value={resolvedClassFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
          aria-label="Filter qual points standings by class"
        >
          <option value="">All classes</option>
          {classOptions.map((c) => (
            <option key={c} value={c}>
              {formatClassName(c)}
            </option>
          ))}
        </select>
      </div>

      {filteredRows.length === 0 ? (
        <div className="flex min-h-[8rem] items-center justify-center rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)]/40 text-sm text-[var(--token-text-secondary)]">
          No rows match the selected class.
        </div>
      ) : (
        <>
          <DataTableFrame>
            <StandardTable>
              <StandardTableHeader>
                <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-alt)]">
                  <StandardTableCell header className="min-w-[5.5rem] whitespace-nowrap">
                    Position
                  </StandardTableCell>
                  {resolvedClassFilter ? null : <StandardTableCell header>Class</StandardTableCell>}
                  <StandardTableCell header>Driver</StandardTableCell>
                  <StandardTableCell header className="w-24 whitespace-nowrap text-right">
                    Points
                  </StandardTableCell>
                </tr>
              </StandardTableHeader>
              <tbody>
                {paginatedRows.map((row) => (
                  <StandardTableRow key={`${row.className}-${row.position}-${row.driverId}`}>
                    <StandardTableCell className="tabular-nums text-[var(--token-text-secondary)]">
                      {row.position}
                    </StandardTableCell>
                    {resolvedClassFilter ? null : (
                      <StandardTableCell className="text-[var(--token-text-secondary)]">
                        {formatClassName(row.className)}
                      </StandardTableCell>
                    )}
                    <StandardTableCell className="font-medium text-[var(--token-text-primary)]">
                      {row.driverDisplayName}
                    </StandardTableCell>
                    <StandardTableCell className="tabular-nums text-right text-[var(--token-text-secondary)]">
                      {row.points}
                    </StandardTableCell>
                  </StandardTableRow>
                ))}
              </tbody>
            </StandardTable>
          </DataTableFrame>

          <ListPagination
            embedded
            currentPage={effectivePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filteredRows.length}
            itemLabel="drivers"
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        </>
      )}
    </div>
  )
}
