/**
 * @fileoverview LiveRC qual points: full standings table (Event Analysis) or Event Overview
 *             highlights: class winners (registration classes + combined multi-main standings),
 *             per-class top qualifiers, “Lap Heroes” volume leaders (most laps; ties by shortest
 *             combined session time), per-class most consistent drivers (mean session score), and
 *             per-class fastest lap (best single lap time in the class for the event), each
 *             class winner’s mean session average lap (same winners as Class Winners), and
 *             per-class biggest movers (first-to-last session gains; shared math with Top improved),
 *             closest battles (tightest P1–P2 per class on mains; per-driver adjacent gaps in modal),
 *             and event mix (stacked session-type chart plus class mix by entries or laps; same
 *             as the former Event highlights mix chart), and event weather (per-day venue forecast).
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import {
  computeMostImprovedPerClass,
  type ClassMostImprovedGroup,
  type EventMostImprovedEntry,
} from "@/core/events/event-most-improved-per-class"
import type { ClassWinnerHighlight, SessionMixSegment } from "@/core/events/build-event-highlights"
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
import {
  formatDateLong,
  formatPositionImprovement,
  formatLapTimeImprovement,
} from "@/lib/date-utils"
import { formatClassName } from "@/lib/format-class-name"
import { formatLapTime, formatTotalTime } from "@/lib/format-session-data"
import { DEFAULT_TABLE_ROWS_PER_PAGE, normalizeTableRowsPerPage } from "@/lib/table-pagination"
import { typography } from "@/lib/typography"
import ListPagination from "./ListPagination"
import { EventHighlightsMixFilteredChart } from "./EventHighlightsMixCharts"
import WeatherCard from "./WeatherCard"
import type { WeatherDayRow } from "@/hooks/useEventWeather"

type QualPayload = EventAnalysisData["qualPointsTopQualifiers"]

/** Ingestion uses LiveRC phrasing ("Qual Points (2 of 4)"); overview shows "Best (2 of 4)". */
function formatOverviewQualPointsCaption(label: string): string {
  return label.replace(/^Qual\s+Points\s*/i, "Best ")
}

type EventHighlightsSubTab =
  | "classWinners"
  | "topQualifiers"
  | "lapHeroes"
  | "mostConsistentDrivers"
  | "fastestLaps"
  | "fastestAverageLaps"
  | "biggestMovers"
  | "eventMix"
  | "podiums"
  | "closestBattles"
  | "eventWeather"

const HIGHLIGHTS_TAB_BTN =
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
const HIGHLIGHTS_TAB_BTN_ACTIVE =
  "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
const HIGHLIGHTS_TAB_BTN_IDLE =
  "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface)]/45"

const LAP_HEROES_INFO_TEXT = "Most laps · shortest combined time wins ties"

const MOST_CONSISTENT_INFO_TEXT =
  "Mean session consistency score per class (higher is better). More sessions with data wins ties."

const FASTEST_LAPS_INFO_TEXT =
  "Best single lap in each class across all sessions (lower time is faster). Same time: more sessions with a recorded fast lap wins ties."

const FASTEST_AVG_LAPS_INFO_TEXT =
  "Overall class winner from Class Winners, with their mean session average lap in that class (lower time is faster). Same drivers as the Class Winners tab."

const BIGGEST_MOVERS_INFO_TEXT =
  "Largest gains from a driver's first session to their last in each class. Race days blend finishing position and fast lap; practice days use fast lap only. Open a class for the top three movers."

const EVENT_MIX_INFO_TEXT =
  "Session mix (percent of sessions by type) and class share by entry count or laps completed. Use the toggles on the chart to switch metrics. Main events are detected from labels as well as session type."

const EVENT_WEATHER_INFO_TEXT =
  "Forecast and conditions for the event venue by calendar day, when available from the weather service."

const CLOSEST_BATTLES_INFO_TEXT =
  "Main events only. Each card is the tightest P1–P2 finish on total time in that class. Open a card to see every driver’s tightest adjacent gap in a main (vs the next car ahead or behind in the results)."

/** Initial resizable panel size for Closest battles (header + body area from layout tuning). */
const CLOSEST_BATTLES_MODAL_DEFAULT_SIZE = { width: "927px", height: "705px" } as const

/** Visible + aria: plain-language; avoid “multi-main”, “P1”, “featured main”. */
const CLASS_WINNERS_INFO_TEXT =
  "These names are the overall winners for each class after all finals. Winners of each separate final, for example the A Main or B Main, are not listed here. To see those, open Event Analysis and use the Event Results tab."

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

function formatBiggestMoverCardLine(e: EventMostImprovedEntry, isPracticeDay?: boolean): string {
  if (isPracticeDay) {
    return e.lapTimeImprovement != null && e.lapTimeImprovement > 0
      ? formatLapTimeImprovement(e.lapTimeImprovement)
      : formatPositionImprovement(e.firstRacePosition, e.lastRacePosition)
  }
  const pos = formatPositionImprovement(e.firstRacePosition, e.lastRacePosition)
  if (e.lapTimeImprovement != null && e.lapTimeImprovement > 0) {
    return `${pos} · ${formatLapTimeImprovement(e.lapTimeImprovement)}`
  }
  return pos
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
      isPracticeDay?: boolean
      /** From `buildEventHighlights`; powers Event Mix tab chart. */
      eventMixChart?: {
        sessionMix: SessionMixSegment[]
        classMixByDrivers: SessionMixSegment[]
        classMixByLaps: SessionMixSegment[]
      }
      /** From `useEventWeather` in Overview; powers Event Weather tab. */
      eventWeather?: {
        weatherByDay: WeatherDayRow[] | null
        weatherLoading: boolean
        weatherError: string | null
      }
    }

export default function EventOverviewTopQualifiers(props: EventOverviewTopQualifiersProps) {
  if (props.variant === "overviewCards") {
    return (
      <EventOverviewTopQualifiersCards
        qualPoints={props.qualPoints}
        races={props.races}
        multiMainResults={props.multiMainResults}
        registrationClassNames={props.registrationClassNames}
        isPracticeDay={props.isPracticeDay}
        eventMixChart={props.eventMixChart}
        eventWeather={props.eventWeather}
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
  isPracticeDay = false,
  eventMixChart,
  eventWeather,
}: {
  qualPoints: QualPayload
  races: EventAnalysisData["races"]
  multiMainResults: EventAnalysisData["multiMainResults"]
  registrationClassNames?: string[]
  isPracticeDay?: boolean
  eventMixChart?: {
    sessionMix: SessionMixSegment[]
    classMixByDrivers: SessionMixSegment[]
    classMixByLaps: SessionMixSegment[]
  }
  eventWeather?: {
    weatherByDay: WeatherDayRow[] | null
    weatherLoading: boolean
    weatherError: string | null
  }
}) {
  const [detailCard, setDetailCard] = useState<TopQualifierCardModel | null>(null)
  const [lapHeroDetailClass, setLapHeroDetailClass] = useState<string | null>(null)
  const [mostConsistentDetailClass, setMostConsistentDetailClass] = useState<string | null>(null)
  const [fastestLapDetailClass, setFastestLapDetailClass] = useState<string | null>(null)
  const [winnerMeanAvgLapDetailClass, setWinnerMeanAvgLapDetailClass] = useState<string | null>(
    null
  )
  const [biggestMoversDetailClass, setBiggestMoversDetailClass] = useState<string | null>(null)
  const [classWinnerDetail, setClassWinnerDetail] = useState<ClassWinnerHighlight | null>(null)
  const [closestBattlesModalOpen, setClosestBattlesModalOpen] = useState(false)
  /** Raw class from the Closest Battles card; scopes the modal table to that class. */
  const [closestBattlesModalClass, setClosestBattlesModalClass] = useState<string | null>(null)
  const [closestBattlesDriverFilter, setClosestBattlesDriverFilter] = useState("")
  const [closestBattlesRowsPerPage, setClosestBattlesRowsPerPage] = useState(
    DEFAULT_TABLE_ROWS_PER_PAGE
  )
  const [highlightsTab, setHighlightsTab] = useState<EventHighlightsSubTab>("classWinners")

  const cards = useMemo(() => {
    if (!qualPoints || (qualPoints.standings?.length ?? 0) === 0) return []
    return buildTopQualifierOverviewCards(qualPoints, races)
  }, [qualPoints, races])

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
    return buildClassWinners({ races, multiMainResults, registrationClassNames })
  }, [races, multiMainResults, registrationClassNames])

  const classWinnerModalResolved = useMemo(() => {
    if (!classWinnerDetail) return null
    return resolveClassWinnerModalDetail(classWinnerDetail, { races, multiMainResults })
  }, [classWinnerDetail, races, multiMainResults])

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
    setBiggestMoversDetailClass(null)
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

  const biggestMoversPerClass = useMemo(
    () => computeMostImprovedPerClass(races, isPracticeDay),
    [races, isPracticeDay]
  )

  const biggestMoversOrdered = useMemo(() => {
    if (biggestMoversPerClass.length === 0) return []
    const byClass = new Map(biggestMoversPerClass.map((g) => [g.className.trim(), g]))
    const ordered: ClassMostImprovedGroup[] = []
    const seen = new Set<string>()
    for (const card of cards) {
      const cn = card.className.trim()
      const g = byClass.get(cn)
      if (g && !seen.has(cn)) {
        ordered.push(g)
        seen.add(cn)
      }
    }
    for (const g of biggestMoversPerClass) {
      const cn = g.className.trim()
      if (!seen.has(cn)) {
        ordered.push(g)
        seen.add(cn)
      }
    }
    return ordered
  }, [cards, biggestMoversPerClass])

  const biggestMoversModalGroup = useMemo(() => {
    if (!biggestMoversDetailClass) return null
    return biggestMoversPerClass.find((g) => g.className === biggestMoversDetailClass) ?? null
  }, [biggestMoversDetailClass, biggestMoversPerClass])

  const selectHighlightsTab = (next: EventHighlightsSubTab) => {
    setHighlightsTab(next)
    setDetailCard(null)
    setLapHeroDetailClass(null)
    setMostConsistentDetailClass(null)
    setFastestLapDetailClass(null)
    setWinnerMeanAvgLapDetailClass(null)
    setBiggestMoversDetailClass(null)
    setClassWinnerDetail(null)
    setClosestBattlesModalOpen(false)
    setClosestBattlesModalClass(null)
    setClosestBattlesDriverFilter("")
  }

  if (!qualPoints || (qualPoints.standings?.length ?? 0) === 0) {
    return (
      <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
        Qual points standings are not available for this event yet. Re-run ingestion after qual
        results are published, or open the event on LiveRC to view qual standings.
      </p>
    )
  }

  if (cards.length === 0) {
    return (
      <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
        Could not resolve top qualifiers per class from the current data.
      </p>
    )
  }

  const cwTabId = "event-overview-highlights-tab-cw"
  const tqTabId = "event-overview-highlights-tab-tq"
  const lhTabId = "event-overview-highlights-tab-lh"
  const mcTabId = "event-overview-highlights-tab-mc"
  const flTabId = "event-overview-highlights-tab-fl"
  const falTabId = "event-overview-highlights-tab-fal"
  const bmTabId = "event-overview-highlights-tab-bm"
  const emTabId = "event-overview-highlights-tab-em"
  const pdTabId = "event-overview-highlights-tab-pd"
  const cbTabId = "event-overview-highlights-tab-cb"
  const ewTabId = "event-overview-highlights-tab-ew"
  const cwPanelId = "event-overview-highlights-panel-cw"
  const tqPanelId = "event-overview-highlights-panel-tq"
  const lhPanelId = "event-overview-highlights-panel-lh"
  const mcPanelId = "event-overview-highlights-panel-mc"
  const flPanelId = "event-overview-highlights-panel-fl"
  const falPanelId = "event-overview-highlights-panel-fal"
  const bmPanelId = "event-overview-highlights-panel-bm"
  const emPanelId = "event-overview-highlights-panel-em"
  const pdPanelId = "event-overview-highlights-panel-pd"
  const cbPanelId = "event-overview-highlights-panel-cb"
  const ewPanelId = "event-overview-highlights-panel-ew"
  const topQualifiersInfoCaption = qualPoints.label
    ? formatOverviewQualPointsCaption(qualPoints.label)
    : null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Event overview highlights">
        <button
          id={cwTabId}
          type="button"
          role="tab"
          aria-selected={highlightsTab === "classWinners"}
          aria-controls={cwPanelId}
          className={`${HIGHLIGHTS_TAB_BTN} ${
            highlightsTab === "classWinners" ? HIGHLIGHTS_TAB_BTN_ACTIVE : HIGHLIGHTS_TAB_BTN_IDLE
          }`}
          onClick={() => selectHighlightsTab("classWinners")}
        >
          Class Winners
        </button>
        <button
          id={tqTabId}
          type="button"
          role="tab"
          aria-selected={highlightsTab === "topQualifiers"}
          aria-controls={tqPanelId}
          className={`${HIGHLIGHTS_TAB_BTN} ${
            highlightsTab === "topQualifiers" ? HIGHLIGHTS_TAB_BTN_ACTIVE : HIGHLIGHTS_TAB_BTN_IDLE
          }`}
          onClick={() => selectHighlightsTab("topQualifiers")}
        >
          Top Qualifiers
        </button>
        <button
          id={lhTabId}
          type="button"
          role="tab"
          aria-selected={highlightsTab === "lapHeroes"}
          aria-controls={lhPanelId}
          className={`${HIGHLIGHTS_TAB_BTN} ${
            highlightsTab === "lapHeroes" ? HIGHLIGHTS_TAB_BTN_ACTIVE : HIGHLIGHTS_TAB_BTN_IDLE
          }`}
          onClick={() => selectHighlightsTab("lapHeroes")}
        >
          Lap Heroes
        </button>
        <button
          id={mcTabId}
          type="button"
          role="tab"
          aria-selected={highlightsTab === "mostConsistentDrivers"}
          aria-controls={mcPanelId}
          className={`${HIGHLIGHTS_TAB_BTN} ${
            highlightsTab === "mostConsistentDrivers"
              ? HIGHLIGHTS_TAB_BTN_ACTIVE
              : HIGHLIGHTS_TAB_BTN_IDLE
          }`}
          onClick={() => selectHighlightsTab("mostConsistentDrivers")}
        >
          Most Consistent Drivers
        </button>
        <button
          id={flTabId}
          type="button"
          role="tab"
          aria-selected={highlightsTab === "fastestLaps"}
          aria-controls={flPanelId}
          className={`${HIGHLIGHTS_TAB_BTN} ${
            highlightsTab === "fastestLaps" ? HIGHLIGHTS_TAB_BTN_ACTIVE : HIGHLIGHTS_TAB_BTN_IDLE
          }`}
          onClick={() => selectHighlightsTab("fastestLaps")}
        >
          Fastest Laps
        </button>
        <button
          id={falTabId}
          type="button"
          role="tab"
          aria-selected={highlightsTab === "fastestAverageLaps"}
          aria-controls={falPanelId}
          className={`${HIGHLIGHTS_TAB_BTN} ${
            highlightsTab === "fastestAverageLaps"
              ? HIGHLIGHTS_TAB_BTN_ACTIVE
              : HIGHLIGHTS_TAB_BTN_IDLE
          }`}
          onClick={() => selectHighlightsTab("fastestAverageLaps")}
        >
          Fastest Average Laps
        </button>
        <button
          id={bmTabId}
          type="button"
          role="tab"
          aria-selected={highlightsTab === "biggestMovers"}
          aria-controls={bmPanelId}
          className={`${HIGHLIGHTS_TAB_BTN} ${
            highlightsTab === "biggestMovers" ? HIGHLIGHTS_TAB_BTN_ACTIVE : HIGHLIGHTS_TAB_BTN_IDLE
          }`}
          onClick={() => selectHighlightsTab("biggestMovers")}
        >
          Biggest Movers
        </button>
        <button
          id={emTabId}
          type="button"
          role="tab"
          aria-selected={highlightsTab === "eventMix"}
          aria-controls={emPanelId}
          className={`${HIGHLIGHTS_TAB_BTN} ${
            highlightsTab === "eventMix" ? HIGHLIGHTS_TAB_BTN_ACTIVE : HIGHLIGHTS_TAB_BTN_IDLE
          }`}
          onClick={() => selectHighlightsTab("eventMix")}
        >
          Event Mix
        </button>
        <button
          id={pdTabId}
          type="button"
          role="tab"
          aria-selected={highlightsTab === "podiums"}
          aria-controls={pdPanelId}
          className={`${HIGHLIGHTS_TAB_BTN} ${
            highlightsTab === "podiums" ? HIGHLIGHTS_TAB_BTN_ACTIVE : HIGHLIGHTS_TAB_BTN_IDLE
          }`}
          onClick={() => selectHighlightsTab("podiums")}
        >
          Podiums
        </button>
        <button
          id={cbTabId}
          type="button"
          role="tab"
          aria-selected={highlightsTab === "closestBattles"}
          aria-controls={cbPanelId}
          className={`${HIGHLIGHTS_TAB_BTN} ${
            highlightsTab === "closestBattles" ? HIGHLIGHTS_TAB_BTN_ACTIVE : HIGHLIGHTS_TAB_BTN_IDLE
          }`}
          onClick={() => selectHighlightsTab("closestBattles")}
        >
          Closest Battles
        </button>
        <button
          id={ewTabId}
          type="button"
          role="tab"
          aria-selected={highlightsTab === "eventWeather"}
          aria-controls={ewPanelId}
          className={`${HIGHLIGHTS_TAB_BTN} ${
            highlightsTab === "eventWeather" ? HIGHLIGHTS_TAB_BTN_ACTIVE : HIGHLIGHTS_TAB_BTN_IDLE
          }`}
          onClick={() => selectHighlightsTab("eventWeather")}
        >
          Event Weather
        </button>
      </div>

      {highlightsTab === "classWinners" ? (
        <div
          id="event-overview-class-winners-info"
          className="w-full max-w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 px-3 py-2 shadow-sm"
          aria-label={CLASS_WINNERS_INFO_TEXT}
        >
          <p className={`max-w-full leading-relaxed ${typography.bodySecondary}`}>
            {CLASS_WINNERS_INFO_TEXT}
          </p>
        </div>
      ) : null}

      {highlightsTab === "topQualifiers" && topQualifiersInfoCaption ? (
        <div
          id="event-overview-top-qualifiers-info"
          className="w-fit max-w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 px-3 py-2 shadow-sm"
          aria-label={topQualifiersInfoCaption}
        >
          <p
            className={`whitespace-nowrap text-xs text-[var(--token-text-secondary)] ${typography.bodySecondary}`}
          >
            {topQualifiersInfoCaption}
          </p>
        </div>
      ) : null}

      {highlightsTab === "lapHeroes" ? (
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

      {highlightsTab === "mostConsistentDrivers" ? (
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

      {highlightsTab === "fastestLaps" ? (
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

      {highlightsTab === "fastestAverageLaps" ? (
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

      {highlightsTab === "biggestMovers" ? (
        <div
          id="event-overview-biggest-movers-info"
          className="w-fit max-w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 px-3 py-2 shadow-sm"
          aria-label={BIGGEST_MOVERS_INFO_TEXT}
        >
          <p
            className={`max-w-full text-xs text-[var(--token-text-secondary)] ${typography.bodySecondary}`}
          >
            {BIGGEST_MOVERS_INFO_TEXT}
          </p>
        </div>
      ) : null}

      {highlightsTab === "eventMix" ? (
        <div
          id="event-overview-event-mix-info"
          className="w-fit max-w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 px-3 py-2 shadow-sm"
          aria-label={EVENT_MIX_INFO_TEXT}
        >
          <p
            className={`max-w-full text-xs text-[var(--token-text-secondary)] ${typography.bodySecondary}`}
          >
            {EVENT_MIX_INFO_TEXT}
          </p>
        </div>
      ) : null}

      {highlightsTab === "eventWeather" ? (
        <div
          id="event-overview-event-weather-info"
          className="w-fit max-w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 px-3 py-2 shadow-sm"
          aria-label={EVENT_WEATHER_INFO_TEXT}
        >
          <p
            className={`max-w-full text-xs text-[var(--token-text-secondary)] ${typography.bodySecondary}`}
          >
            {EVENT_WEATHER_INFO_TEXT}
          </p>
        </div>
      ) : null}

      {highlightsTab === "closestBattles" ? (
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
          {classWinnerCardsOrdered.length === 0 ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              No overall class winners to show yet. They appear after final results are imported for
              this event.
            </p>
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
                      className={`flex min-h-0 min-w-0 w-full flex-col items-center justify-center gap-3 p-4 text-center transition-colors ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/75`}
                      style={OVERVIEW_GLASS_SURFACE_STYLE}
                      onClick={() => setClassWinnerDetail(cw)}
                      aria-haspopup="dialog"
                      aria-expanded={isOpen}
                      aria-label={`Open details: overall class winner ${cw.winnerName} in ${cw.classDisplay}`}
                    >
                      <div className="flex min-w-0 w-full flex-col items-center">
                        <p
                          className={`w-fit max-w-full text-center text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]`}
                        >
                          {cw.classDisplay}
                        </p>
                        <p
                          className={`mt-1 w-fit max-w-full truncate text-center text-base font-semibold text-[var(--token-text-primary)]`}
                        >
                          {cw.winnerName}
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

      {highlightsTab === "topQualifiers" ? (
        <div id={tqPanelId} role="tabpanel" aria-labelledby={tqTabId} className="space-y-3">
          <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-5">
            {cards.map((card) => {
              const isOpen = detailCard?.className === card.className
              return (
                <li key={card.className}>
                  <button
                    type="button"
                    className={`flex min-h-0 min-w-0 w-full flex-col items-center justify-center gap-3 p-4 text-center transition-colors ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/75`}
                    style={OVERVIEW_GLASS_SURFACE_STYLE}
                    onClick={() => setDetailCard(card)}
                    aria-haspopup="dialog"
                    aria-expanded={isOpen}
                    aria-label={`Open qualifying session list for ${card.driverDisplayName} in ${formatClassName(card.className)}`}
                  >
                    <div className="flex min-w-0 w-full flex-col items-center">
                      <p
                        className={`w-fit max-w-full text-center text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]`}
                      >
                        {formatClassName(card.className)}
                      </p>
                      <p
                        className={`mt-1 w-fit max-w-full truncate text-center text-base font-semibold text-[var(--token-text-primary)]`}
                      >
                        {card.driverDisplayName}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {highlightsTab === "lapHeroes" ? (
        <div id={lhPanelId} role="tabpanel" aria-labelledby={lhTabId} className="space-y-3">
          {lapHeroPerClass.length === 0 ? (
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
                        className={`flex min-h-0 min-w-0 w-full flex-col items-center justify-center gap-2 p-4 text-center transition-colors ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/75`}
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
          {mostConsistentPerClass.length === 0 ? (
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
                        className={`flex min-h-0 min-w-0 w-full flex-col items-center justify-center gap-2 p-4 text-center transition-colors ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/75`}
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
          {fastestLapPerClass.length === 0 ? (
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
                        className={`flex min-h-0 min-w-0 w-full flex-col items-center justify-center gap-2 p-4 text-center transition-colors ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/75`}
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
          {winnerMeanAvgLapCards.length === 0 ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              No overall class winners to show yet. They appear after final results are imported for
              this event.
            </p>
          ) : (
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-5">
              {winnerMeanAvgLapCards.map((c) => {
                const isOpen = winnerMeanAvgLapDetailClass === c.className
                const line = formatWinnerMeanAvgLapLine(c.meanAvgLapSeconds, c.sessionsWithAvgLap)
                return (
                  <li key={c.className}>
                    <button
                      type="button"
                      className={`flex min-h-0 min-w-0 w-full flex-col items-center justify-center gap-2 p-4 text-center transition-colors ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/75`}
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

      {highlightsTab === "biggestMovers" ? (
        <div id={bmPanelId} role="tabpanel" aria-labelledby={bmTabId} className="space-y-3">
          {biggestMoversOrdered.length === 0 ? (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              No mover data yet. It appears when a driver has at least two sessions in a class and
              improves their finish or fast lap from the first to the last.
            </p>
          ) : (
            <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-5">
              {biggestMoversOrdered.map((group) => {
                const top = group.entries[0]
                if (!top) return null
                const isOpen = biggestMoversDetailClass === group.className
                const line = formatBiggestMoverCardLine(top, isPracticeDay)
                return (
                  <li key={group.className}>
                    <button
                      type="button"
                      className={`flex min-h-0 min-w-0 w-full flex-col items-center justify-center gap-2 p-4 text-center transition-colors ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/75`}
                      style={OVERVIEW_GLASS_SURFACE_STYLE}
                      onClick={() => setBiggestMoversDetailClass(group.className)}
                      aria-haspopup="dialog"
                      aria-expanded={isOpen}
                      aria-label={`Open biggest movers for ${formatClassName(group.className)}`}
                    >
                      <div className="flex min-w-0 w-full flex-col items-center">
                        <p
                          className={`w-fit max-w-full text-center text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]`}
                        >
                          {formatClassName(group.className)}
                        </p>
                        <p
                          className={`mt-1 w-full max-w-full truncate text-center text-base font-semibold text-[var(--token-text-primary)]`}
                        >
                          {top.driverName}
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

      {highlightsTab === "eventMix" ? (
        <div id={emPanelId} role="tabpanel" aria-labelledby={emTabId} className="min-w-0 w-full">
          {eventMixChart &&
          (eventMixChart.sessionMix.length > 0 ||
            eventMixChart.classMixByDrivers.length > 0 ||
            eventMixChart.classMixByLaps.length > 0) ? (
            <div className="min-w-0 w-full max-w-full">
              <EventHighlightsMixFilteredChart
                sessionMix={eventMixChart.sessionMix}
                classMixByDrivers={eventMixChart.classMixByDrivers}
                classMixByLaps={eventMixChart.classMixByLaps}
              />
            </div>
          ) : (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              No session or class mix data is available for this event yet.
            </p>
          )}
        </div>
      ) : null}

      {highlightsTab === "podiums" ? (
        <div id={pdPanelId} role="tabpanel" aria-labelledby={pdTabId} className="min-w-0 w-full">
          <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
            Podium details will appear here.
          </p>
        </div>
      ) : null}

      {highlightsTab === "closestBattles" ? (
        <div id={cbPanelId} role="tabpanel" aria-labelledby={cbTabId} className="space-y-3">
          {closestBattleCardsOrdered.length === 0 ? (
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
                      className={`flex min-h-0 min-w-0 w-full flex-col items-center justify-center gap-2 p-4 text-center transition-colors ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/75`}
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

      {highlightsTab === "eventWeather" ? (
        <div id={ewPanelId} role="tabpanel" aria-labelledby={ewTabId} className="min-w-0 w-full">
          {eventWeather ? (
            <div id="event-weather-data-content" className="flex flex-wrap gap-4">
              {eventWeather.weatherLoading ? (
                <WeatherCard weather={null} weatherLoading={true} weatherError={null} />
              ) : eventWeather.weatherError ? (
                <WeatherCard
                  weather={null}
                  weatherLoading={false}
                  weatherError={eventWeather.weatherError}
                />
              ) : eventWeather.weatherByDay && eventWeather.weatherByDay.length > 0 ? (
                eventWeather.weatherByDay.map(({ date, weather }) => (
                  <div key={date} className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-[var(--token-text-secondary)]">
                      {formatDateLong(date)}
                    </span>
                    <WeatherCard weather={weather} weatherLoading={false} weatherError={null} />
                  </div>
                ))
              ) : (
                <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
                  No weather data is available for this event yet.
                </p>
              )}
            </div>
          ) : (
            <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
              Weather is not configured for this view.
            </p>
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
                  P{s.positionFinal}
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
        isOpen={biggestMoversDetailClass !== null}
        onClose={() => setBiggestMoversDetailClass(null)}
        title={
          biggestMoversDetailClass ? formatClassName(biggestMoversDetailClass) : "Biggest movers"
        }
        subtitle="First vs last session · top three in class"
        maxWidth="md"
        resizable={false}
      >
        {biggestMoversModalGroup && biggestMoversModalGroup.entries.length === 0 ? (
          <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
            No mover data for this class.
          </p>
        ) : biggestMoversModalGroup ? (
          <ul className="flex list-none flex-col gap-3 p-0">
            {biggestMoversModalGroup.entries.map((e) => (
              <li
                key={`${biggestMoversModalGroup.className}-${e.driverId}-${e.rank}`}
                className="flex min-w-0 items-start justify-between gap-3 text-sm"
              >
                <span className="shrink-0 tabular-nums text-[var(--token-text-tertiary)]">
                  {e.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[var(--token-text-primary)]">{e.driverName}</p>
                  <p className="mt-0.5 text-xs text-[var(--token-text-secondary)]">
                    {e.firstRaceLabel} → {e.lastRaceLabel}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-[var(--token-text-secondary)]">
                    <span>
                      Position: {formatPositionImprovement(e.firstRacePosition, e.lastRacePosition)}
                    </span>
                    <span>
                      Lap Δ:{" "}
                      {e.lapTimeImprovement != null
                        ? formatLapTimeImprovement(e.lapTimeImprovement)
                        : "—"}
                    </span>
                  </div>
                </div>
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
        maxWidth="md"
        resizable={false}
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
              <>
                {classWinnerModalResolved.resultSummaryLine ? (
                  <div>
                    <p
                      className={`text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)] ${typography.bodySecondary}`}
                    >
                      Result (summary)
                    </p>
                    <p className="mt-1 break-all font-mono text-sm text-[var(--token-text-primary)]">
                      {classWinnerModalResolved.resultSummaryLine}
                    </p>
                    <p
                      className={`mt-1 text-xs text-[var(--token-text-tertiary)] ${typography.bodySecondary}`}
                    >
                      Same style as LiveRC overall final ranking when per-main laps and times are
                      imported.
                    </p>
                  </div>
                ) : null}
                <div>
                  <p
                    className={`text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)] ${typography.bodySecondary}`}
                  >
                    Combined points
                  </p>
                  <p className="mt-1 tabular-nums text-[var(--token-text-primary)]">
                    {classWinnerModalResolved.combinedPoints}
                    <span
                      className={`ml-2 font-normal text-[var(--token-text-tertiary)] ${typography.bodySecondary}`}
                    >
                      Lower is better (sum of finishing places across mains).
                    </span>
                  </p>
                  <p
                    className={`mt-0.5 text-xs text-[var(--token-text-tertiary)] ${typography.bodySecondary}`}
                  >
                    <span className="font-medium text-[var(--token-text-primary)]">
                      Class schedule:{" "}
                    </span>
                    {classWinnerModalResolved.completedMains} of{" "}
                    {classWinnerModalResolved.totalMains} mains run
                    <span className="text-[var(--token-text-tertiary)]"> (event)</span>
                  </p>
                  {classWinnerModalResolved.mainRows.length > 0 ? (
                    <>
                      <p
                        className={`mt-1 text-xs text-[var(--token-text-tertiary)] ${typography.bodySecondary}`}
                      >
                        <span className="font-medium text-[var(--token-text-primary)]">
                          This driver:{" "}
                        </span>
                        {classWinnerModalResolved.driverMainsParticipated} of{" "}
                        {classWinnerModalResolved.totalMains} mains
                      </p>
                      {classWinnerModalResolved.driverMainsParticipated <
                      classWinnerModalResolved.totalMains ? (
                        <p
                          className={`mt-1 text-xs text-[var(--token-text-tertiary)] ${typography.bodySecondary}`}
                        >
                          The overall title can be decided before every main is run; a driver may
                          sit out a later main. A cell such as{" "}
                          <span className="font-mono text-[var(--token-text-primary)]">
                            0/0.000
                          </span>{" "}
                          usually means they did not start that main.
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
                {classWinnerModalResolved.mainRows.length > 0 ? (
                  <div>
                    <p
                      className={`text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)] ${typography.bodySecondary}`}
                    >
                      Per main
                    </p>
                    <table className="mt-2 w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--token-border-subtle)]">
                          <th className="py-1.5 pr-3 font-medium text-[var(--token-text-tertiary)]">
                            Main
                          </th>
                          <th className="py-1.5 pr-3 font-medium text-[var(--token-text-tertiary)]">
                            Finish
                          </th>
                          <th className="py-1.5 font-medium text-[var(--token-text-tertiary)]">
                            Laps / time
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {classWinnerModalResolved.mainRows.map((row) => (
                          <tr
                            key={row.label}
                            className="border-b border-[var(--token-border-subtle)]/60"
                          >
                            <td className="py-1.5 pr-3 text-[var(--token-text-primary)]">
                              {row.label}
                            </td>
                            <td className="py-1.5 pr-3 tabular-nums text-[var(--token-text-primary)]">
                              {row.position}
                            </td>
                            <td className="py-1.5 font-mono text-xs text-[var(--token-text-primary)]">
                              {row.lapsTime}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {classWinnerModalResolved.tieBreaker ? (
                  <p
                    className={`text-xs text-[var(--token-text-secondary)] ${typography.bodySecondary}`}
                  >
                    <span className="font-medium text-[var(--token-text-primary)]">
                      Tie-break:{" "}
                    </span>
                    {classWinnerModalResolved.tieBreaker}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <div>
                  <p
                    className={`text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)] ${typography.bodySecondary}`}
                  >
                    Session
                  </p>
                  <p className="mt-1 text-[var(--token-text-primary)]">
                    {classWinnerModalResolved.raceLabel}
                  </p>
                </div>
                <div>
                  <p
                    className={`text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)] ${typography.bodySecondary}`}
                  >
                    Finish
                  </p>
                  <p className="mt-1 tabular-nums text-[var(--token-text-primary)]">
                    P{classWinnerModalResolved.positionFinal}
                  </p>
                </div>
                {classWinnerModalResolved.lapsTimeLine ? (
                  <div>
                    <p
                      className={`text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)] ${typography.bodySecondary}`}
                    >
                      Result (laps / time)
                    </p>
                    <p className="mt-1 font-mono text-sm text-[var(--token-text-primary)]">
                      [{classWinnerModalResolved.positionFinal}]{" "}
                      {classWinnerModalResolved.lapsTimeLine}
                    </p>
                  </div>
                ) : null}
                {classWinnerModalResolved.fastLapFormatted ? (
                  <p
                    className={`text-xs text-[var(--token-text-secondary)] ${typography.bodySecondary}`}
                  >
                    <span className="font-medium text-[var(--token-text-primary)]">Fast lap: </span>
                    {classWinnerModalResolved.fastLapFormatted}
                  </p>
                ) : null}
              </>
            )}
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
