/**
 * @fileoverview Overview tab component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-04-06
 *
 * @description Overview tab content for event analysis. Primary sections (Event Overview,
 *            Session Analysis, Event Analysis) use a top toolbar tablist; Bump-Up and Driver
 *            Progression are sub-views under Event Analysis.
 *
 * @purpose Displays event summary statistics and primary highlights chart.
 *          Supports chart type switching and driver selection.
 *
 * @relatedFiles
 * - src/components/event-analysis/ChartControls.tsx (controls)
 * - src/components/event-analysis/BestLapBarChart.tsx (charts)
 */

"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import WeatherCard from "./WeatherCard"
import EventHighlightsSection from "./EventHighlightsSection"
import EventTopFastestLapsPerClassTable from "./EventTopFastestLapsPerClassTable"
import EventTopAverageLapsPerClassTable from "./EventTopAverageLapsPerClassTable"
import EventFastestLapsTable from "./EventFastestLapsTable"
import EventFastestAverageLapsTable from "./EventFastestAverageLapsTable"
import ChartControls from "./ChartControls"
import UnifiedPerformanceChart, { type ChartViewType } from "./UnifiedPerformanceChart"
import ChartSection from "./ChartSection"
import ChartDriverPicker from "./ChartDriverPicker"
import LapByLapTrendChart from "./LapByLapTrendChart"
import type { DriverPerformanceData } from "./UnifiedPerformanceChart"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import type { EventLapTrendResponse } from "@/core/events/get-lap-data"
import { useEventWeather } from "@/hooks/useEventWeather"
import { normalizeDriverName } from "@/core/users/name-normalizer"
import ChartDataNotice from "./ChartDataNotice"
import MultiMainOverallCard from "./MultiMainOverallCard"
import MainBracketResultsTable from "./MainBracketResultsTable"
import SessionRaceResultsTable from "./SessionRaceResultsTable"
import DriverBumpUpsTable, { type BumpUpRowWithClass } from "./sessions/DriverBumpUpsTable"
import DriverProgressionTable from "./DriverProgressionTable"
import { getSessionsForBumpUpInference } from "@/core/events/get-sessions-data"
import { inferBumpUpsFromSessions } from "@/core/events/infer-bump-ups"
import {
  buildDriverMainEventProgressionMatrix,
  getRaceClassNamesForDriverProgressionChips,
} from "@/core/events/driver-main-event-progression"
import {
  getDriversMissingAvgVsFastest,
  getDriversMissingBestLap,
  getUnselectedDriversInClass,
} from "@/core/events/event-analysis-notices"
import { clientLogger } from "@/lib/client-logger"
import { getRaceClassNamesForBumpUpChips, getValidClasses } from "@/core/events/class-validator"
import {
  normalizeRaceSessionType,
  sessionTypeFilterChipLabel,
  sortSessionTypeFilterKeys,
} from "@/core/events/session-type-filter"
import { Facebook, MapPin, Calendar, Phone, Globe, Mail } from "lucide-react"
import { formatDateLong } from "@/lib/date-utils"
import { formatLapTime, formatTimeUTC } from "@/lib/format-session-data"
import Tooltip from "@/components/molecules/Tooltip"
import { computeDriverStatsFromRaces } from "@/core/events/compute-driver-stats-from-races"
import {
  type EventAnalysisSubTabId,
  getSubTabLabel,
  getSubTabOptions,
} from "@/components/organisms/event-analysis/event-analysis-sub-tabs"
import { isPlaceholderClass } from "@/lib/format-class-name"
import {
  UNCLASSIFIED_CLASS_KEY,
  eventHasVehicleDenormalization,
  getSkillTierOptionsForLiveRcClassName,
  type RaceAnalysisRow,
  raceMatchesLiveRcClassAndSkill,
} from "@/core/events/session-analysis-filters"

/** Derived session start, else LiveRC Time Completed (matches formatTimeUTC / LiveRC wall clock). */
function raceScheduleInstant(race: {
  startTime: Date | null
  completedAt?: Date | null
}): Date | null {
  const primary = race.startTime ?? race.completedAt ?? null
  if (primary == null) return null
  return primary instanceof Date ? primary : new Date(primary as unknown as string)
}

/** Sort races by schedule time (derived start, else completion), then race order. */
function sortRacesChronologically<
  T extends { startTime: Date | null; completedAt?: Date | null; raceOrder: number | null },
>(races: T[]): T[] {
  return [...races].sort((a, b) => {
    const ta = raceScheduleInstant(a)?.getTime()
    const tb = raceScheduleInstant(b)?.getTime()
    const hasA = ta != null && !Number.isNaN(ta)
    const hasB = tb != null && !Number.isNaN(tb)
    if (hasA && hasB && ta !== tb) {
      return ta - tb
    }
    if (hasA && !hasB) return -1
    if (!hasA && hasB) return 1
    const orderA = a.raceOrder ?? 0
    const orderB = b.raceOrder ?? 0
    return orderA - orderB
  })
}

/** Strip leading class name from LiveRC race label when the row is already scoped to that class. */
function trimClassPrefixFromRaceLabel(raceLabel: string, className: string): string {
  const t = raceLabel.trimStart()
  const c = className.trim()
  if (!c || !t.startsWith(c)) return raceLabel
  let rest = t.slice(c.length).trimStart()
  if (
    rest.startsWith("—") ||
    rest.startsWith("-") ||
    rest.startsWith("·") ||
    rest.startsWith(":")
  ) {
    rest = rest.slice(1).trimStart()
  }
  return rest || raceLabel
}

type SessionRaceOptionFields = {
  className: string
  raceLabel: string
  startTime: Date | null
  completedAt?: Date | null
  sessionType: string | null
  sectionHeader: string | null
}

/**
 * Richer Session dropdown labels: start time, index within the filtered list, optional type/section
 * when "All types" is selected, and shorter labels when a single class is selected.
 */
function formatSessionAnalysisRaceOptionLabel(
  race: SessionRaceOptionFields,
  index: number,
  totalInScope: number,
  selectedClass: string | null,
  sessionTypeFilter: string | null
): string {
  const coreRaw =
    selectedClass !== null && race.className === selectedClass
      ? trimClassPrefixFromRaceLabel(race.raceLabel, selectedClass)
      : race.raceLabel

  let timeStr: string | null = null
  const schedule = raceScheduleInstant(race)
  if (schedule != null) {
    const t = formatTimeUTC(schedule)
    if (t !== "—") timeStr = t
  }

  const segments: string[] = []

  if (sessionTypeFilter === null) {
    const typeKey = normalizeRaceSessionType(race.sessionType)
    const typeLabel = sessionTypeFilterChipLabel(typeKey)
    segments.push(typeLabel)
    const section = race.sectionHeader?.trim()
    if (section && section.toLowerCase() !== typeLabel.toLowerCase()) {
      segments.push(section)
    }
  }

  if (timeStr) segments.push(timeStr)
  segments.push(coreRaw)
  if (totalInScope > 1) {
    segments.push(`${index + 1} of ${totalInScope}`)
  }

  return segments.join(" · ")
}

export interface OverviewTabProps {
  data: EventAnalysisData
  selectedDriverIds: string[]
  onDriverSelectionChange: (driverIds: string[]) => void
  selectedClass: string | null
  onClassChange: (className: string | null) => void
  /** Top-level dashboard tab: only that section’s content (no inner overview subsection strip). */
  variant?: "default" | "event-overview-only" | "event-analysis-only" | "session-analysis-only"
  /** Controlled sub-view when parent owns toolbar dropdown (`event-analysis-only` / `session-analysis-only`). */
  analysisSubTab?: EventAnalysisSubTabId
  onAnalysisSubTabChange?: (id: EventAnalysisSubTabId) => void
}

type OverviewPrimarySection = "event-overview" | "session-analysis" | "event-analysis"

const overviewPrimarySectionTabs: readonly {
  id: OverviewPrimarySection
  label: string
  headingId: string
}[] = [
  { id: "event-overview", label: "Event Overview", headingId: "event-overview-heading" },
  { id: "session-analysis", label: "Session Analysis", headingId: "session-analysis-heading" },
  { id: "event-analysis", label: "Event Analysis", headingId: "event-analysis-heading" },
]

export default function OverviewTab({
  data,
  selectedDriverIds,
  onDriverSelectionChange,
  selectedClass,
  onClassChange,
  variant = "default",
  analysisSubTab: analysisSubTabProp,
  onAnalysisSubTabChange,
}: OverviewTabProps) {
  const lastLoggedMissingState = useRef<string | null>(null)
  const lastLoggedUnselectedInClassState = useRef<string | null>(null)

  const { weatherByDay, weatherLoading, weatherError } = useEventWeather(data.event.id)
  const [overviewPrimarySection, setOverviewPrimarySection] = useState<OverviewPrimarySection>(
    () => {
      switch (variant) {
        case "event-overview-only":
          return "event-overview"
        case "event-analysis-only":
          return "event-analysis"
        case "session-analysis-only":
          return "session-analysis"
        default:
          return "event-overview"
      }
    }
  )

  const inSessionAnalysisSection =
    variant === "session-analysis-only" || overviewPrimarySection === "session-analysis"
  const [isVenueInfoOpen, setIsVenueInfoOpen] = useState(true)
  const [isEventWeatherDataOpen, setIsEventWeatherDataOpen] = useState(true)
  const isControlledAnalysisSubTab =
    analysisSubTabProp !== undefined && onAnalysisSubTabChange !== undefined
  const [internalAnalysisSubTab, setInternalAnalysisSubTab] =
    useState<EventAnalysisSubTabId>("event-results")
  const eventAnalysisTab = isControlledAnalysisSubTab ? analysisSubTabProp! : internalAnalysisSubTab
  const setEventAnalysisTab = isControlledAnalysisSubTab
    ? onAnalysisSubTabChange!
    : setInternalAnalysisSubTab
  const [eventClassFilter, setEventClassFilter] = useState<string | null>(null)
  const classFilterButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const eventSectionClassFilterButtonRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (isControlledAnalysisSubTab) return
    queueMicrotask(() => setInternalAnalysisSubTab("event-results"))
  }, [data.event.id, isControlledAnalysisSubTab])

  const [paginationState, setPaginationState] = useState({
    page: 1,
    selectionKey: "",
  })
  const [selectAllClickedForCurrentClass, setSelectAllClickedForCurrentClass] = useState(false)
  const [chartViewState, setChartViewState] = useState<ChartViewType>("column")
  const [lapTrendData, setLapTrendData] = useState<EventLapTrendResponse | null>(null)
  const [lapTrendLoading, setLapTrendLoading] = useState(false)
  const [lapTrendError, setLapTrendError] = useState<string | null>(null)
  // Per-chart driver selection for unified chart only; lap trend uses global selection (Actions menu)
  const [unifiedChartDriverIds, setUnifiedChartDriverIds] = useState<string[]>([])
  // Lap-trend chart: which drivers to show (subset of expandedSelectedDriverIds); cap at 8 when many selected
  const [lapTrendChartDriverIds, setLapTrendChartDriverIds] = useState<string[]>([])
  // Lap-trend sort: order drivers in chart/legend by this metric
  const [lapTrendSortBy] = useState<
    "bestLap" | "averageLap" | "consistency" | "gapToFastest" | "averagePosition" | "podiumFinishes"
  >("bestLap")
  const driversPerPage = 25
  const MAX_LAP_TREND_DRIVERS = 8

  /** Session Analysis (vehicle): session type + race scope; drives class chip and driver-analysis charts. */
  const [sessionAnalysisSessionTypeFilter, setSessionAnalysisSessionTypeFilter] = useState<
    string | null
  >(null)
  const [sessionAnalysisSessionRaceId, setSessionAnalysisSessionRaceId] = useState<string | null>(
    null
  )
  const [sessionLapTrendChartDriverIds, setSessionLapTrendChartDriverIds] = useState<string[]>([])
  const [sessionSkillTierFilter, setSessionSkillTierFilter] = useState<string | null>(null)
  /** Default session type to first option once per event when multiple types exist (vehicle Session Analysis). */
  const sessionAnalysisSessionTypeInitRef = useRef<{ eventId: string; applied: boolean }>({
    eventId: "",
    applied: false,
  })

  const eventClassFilterTabs: EventAnalysisSubTabId[] = [
    "event-results",
    "fastest-laps",
    "fastest-average-laps",
  ]

  // Get race classes from entry list
  const validClasses = useMemo(() => getValidClasses(data), [data])

  // Filter races by selected class (legacy Session Analysis when vehicle denorm is absent)
  const filteredRaces = useMemo(() => {
    if (selectedClass === null) {
      return data.races
    }
    return data.races.filter((race) => race.className === selectedClass)
  }, [data.races, selectedClass])

  const vehicleDenormActive = useMemo(() => eventHasVehicleDenormalization(data), [data])

  /** Non-placeholder races for session type keys and session scope (vehicle path). */
  const sessionAnalysisBaseRaces = useMemo(
    () => data.races.filter((r) => !isPlaceholderClass(r.className)),
    [data.races]
  )

  /** Distinct session types across the event (not scoped by class) so session controls work before class pick. */
  const sessionAnalysisSessionTypeKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const r of sessionAnalysisBaseRaces) {
      keys.add(normalizeRaceSessionType(r.sessionType))
    }
    return sortSessionTypeFilterKeys(Array.from(keys))
  }, [sessionAnalysisBaseRaces])

  /** When multiple session types exist, user must pick one before Session / per-chart drivers (no "All types"). */
  const sessionAnalysisRequiresSessionTypeChoice = sessionAnalysisSessionTypeKeys.length > 1

  const sessionSkillTierOptions = useMemo(() => {
    if (!vehicleDenormActive) return [] as string[]
    return getSkillTierOptionsForLiveRcClassName(data, selectedClass)
  }, [data, vehicleDenormActive, selectedClass])

  const sessionClassFilteredRaces = useMemo(() => {
    if (!vehicleDenormActive) return []
    return filteredRaces.filter((race) =>
      raceMatchesLiveRcClassAndSkill(race, selectedClass, sessionSkillTierFilter)
    )
  }, [vehicleDenormActive, filteredRaces, selectedClass, sessionSkillTierFilter])

  const sessionAnalysisRaces = useMemo(() => {
    if (vehicleDenormActive) return sessionClassFilteredRaces
    return filteredRaces
  }, [vehicleDenormActive, sessionClassFilteredRaces, filteredRaces])

  const sessionDriverAnalysisSortedRaces = useMemo(() => {
    const sorted = sortRacesChronologically(sessionAnalysisRaces)
    if (sessionAnalysisSessionTypeFilter === null) return sorted
    return sorted.filter(
      (r) => normalizeRaceSessionType(r.sessionType) === sessionAnalysisSessionTypeFilter
    )
  }, [sessionAnalysisRaces, sessionAnalysisSessionTypeFilter])

  const sessionDriverAnalysisScopedRaces = useMemo(() => {
    if (sessionAnalysisRequiresSessionTypeChoice && sessionAnalysisSessionTypeFilter === null) {
      return []
    }
    return sessionDriverAnalysisSortedRaces
  }, [
    sessionAnalysisRequiresSessionTypeChoice,
    sessionAnalysisSessionTypeFilter,
    sessionDriverAnalysisSortedRaces,
  ])

  const hasBumpUpsClassSelected =
    selectedClass != null && typeof selectedClass === "string" && selectedClass.trim() !== ""

  /** Ladder-eligible classes from race metadata (may still infer zero bump-up rows). */
  const bumpUpClassCandidates = useMemo(() => getRaceClassNamesForBumpUpChips(data), [data])

  /**
   * Classes with at least one inferred bump-up (chip list) and the all-classes table rows,
   * built in one pass so we do not run inference twice per class.
   */
  const { bumpUpClassNames, bumpUpRowsAggregated } = useMemo(() => {
    const names: string[] = []
    const out: BumpUpRowWithClass[] = []
    for (const cn of bumpUpClassCandidates) {
      const sessions = getSessionsForBumpUpInference(data, cn)
      const rows = inferBumpUpsFromSessions(sessions)
      if (rows.length === 0) continue
      names.push(cn)
      for (const r of rows) {
        out.push({ ...r, className: cn })
      }
    }
    out.sort((a, b) => {
      const c = a.className.localeCompare(b.className, undefined, { sensitivity: "base" })
      if (c !== 0) return c
      const n = a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" })
      if (n !== 0) return n
      return a.fromRaceLabel.localeCompare(b.fromRaceLabel, undefined, { numeric: true })
    })
    return { bumpUpClassNames: names, bumpUpRowsAggregated: out }
  }, [data, bumpUpClassCandidates])

  const driverProgressionClassNames = useMemo(
    () => getRaceClassNamesForDriverProgressionChips(data),
    [data]
  )

  const bumpUpRows = useMemo(() => {
    if (!hasBumpUpsClassSelected || !selectedClass) return []
    return inferBumpUpsFromSessions(getSessionsForBumpUpInference(data, selectedClass))
  }, [data, selectedClass, hasBumpUpsClassSelected])

  const driverProgressionMatrix = useMemo(
    () => buildDriverMainEventProgressionMatrix(data, selectedClass),
    [data, selectedClass]
  )

  const hasDriverProgressionClassSelected =
    hasBumpUpsClassSelected &&
    selectedClass != null &&
    driverProgressionClassNames.includes(selectedClass)

  useEffect(() => {
    const inBumpUpsUi = variant === "event-analysis-only" && eventAnalysisTab === "bump-ups"
    if (!inBumpUpsUi) return
    if (bumpUpClassNames.length === 0) return
    if (selectedClass !== null && !bumpUpClassNames.includes(selectedClass)) {
      onClassChange(null)
    }
  }, [variant, eventAnalysisTab, bumpUpClassNames, selectedClass, onClassChange, data.event.id])

  useEffect(() => {
    const inDriverProgressionUi =
      variant === "event-analysis-only" && eventAnalysisTab === "driver-progression"
    if (!inDriverProgressionUi) return
    if (driverProgressionClassNames.length === 0) {
      if (selectedClass !== null) {
        onClassChange(null)
      }
      return
    }
    if (selectedClass !== null && !driverProgressionClassNames.includes(selectedClass)) {
      onClassChange(null)
    }
  }, [
    variant,
    eventAnalysisTab,
    driverProgressionClassNames,
    selectedClass,
    onClassChange,
    data.event.id,
  ])

  const eventLevelFilteredRaces = useMemo(() => {
    if (!eventClassFilter) return data.races
    return data.races.filter((race) => race.className === eventClassFilter)
  }, [data.races, eventClassFilter])

  // Calculate driver stats from ALL races (not filtered by class)
  // This ensures ChartControls always has the complete driver list for correct class counts
  // Exclude non-starting drivers (lapsCompleted === 0) as they have no performance data
  const allDriverStats = useMemo(() => {
    const driverMap = new Map<
      string,
      {
        driverId: string
        driverName: string
        bestLapTime: number | null
        avgLapTimes: number[]
      }
    >()

    // Process ALL races (not filtered by class)
    data.races.forEach((race) => {
      race.results.forEach((result) => {
        // Skip non-starting drivers (0 laps completed) - they have no performance data
        if (result.lapsCompleted === 0) {
          return
        }

        const driverId = result.driverId
        const driverName = result.driverName

        if (!driverMap.has(driverId)) {
          driverMap.set(driverId, {
            driverId,
            driverName,
            bestLapTime: null,
            avgLapTimes: [],
          })
        }

        const driverData = driverMap.get(driverId)!

        // Update best lap time
        if (result.fastLapTime !== null) {
          if (driverData.bestLapTime === null || result.fastLapTime < driverData.bestLapTime) {
            driverData.bestLapTime = result.fastLapTime
          }
        }

        // Collect average lap times
        if (result.avgLapTime !== null) {
          driverData.avgLapTimes.push(result.avgLapTime)
        }
      })
    })

    // Calculate final averages
    return Array.from(driverMap.values()).map((driver) => {
      const avgLapTime =
        driver.avgLapTimes.length > 0
          ? driver.avgLapTimes.reduce((a, b) => a + b, 0) / driver.avgLapTimes.length
          : null

      return {
        driverId: driver.driverId,
        driverName: driver.driverName,
        bestLapTime: driver.bestLapTime,
        avgLapTime,
      }
    })
  }, [data.races])

  // Calculate driver stats from filtered races only (for chart display)
  const driverStatsByClass = useMemo(
    () => computeDriverStatsFromRaces(sessionAnalysisRaces),
    [sessionAnalysisRaces]
  )

  // Prepare unified chart data
  const unifiedChartData = useMemo<DriverPerformanceData[]>(() => {
    return driverStatsByClass.map((d) => ({
      driverId: d.driverId,
      driverName: d.driverName,
      bestLapTime: d.bestLapTime,
      bestLapRaceLabel: d.bestLapRaceLabel,
      averageLapTime: d.avgLapTime,
      consistency: d.averageConsistency ?? null,
      averagePosition: d.averagePosition,
      gapToFastest: d.gapToFastest,
      podiumFinishes: d.podiumFinishes,
      avgTop5: d.avgTop5,
      avgTop10: d.avgTop10,
      avgTop15: d.avgTop15,
      top2Consecutive: d.top2Consecutive,
      top3Consecutive: d.top3Consecutive,
      stdDeviation: d.stdDeviation,
    }))
  }, [driverStatsByClass])

  /** Summary for the compare driver performance chart scope (current class / races). */
  const compareChartSummaryStrip = useMemo(() => {
    const bests = driverStatsByClass
      .map((d) => d.bestLapTime)
      .filter((t): t is number => t !== null && isFinite(t))
    const bestLapSeconds = bests.length > 0 ? Math.min(...bests) : null

    const avgs = driverStatsByClass
      .map((d) => d.avgLapTime)
      .filter((t): t is number => t !== null && isFinite(t))
    const avgLapSeconds = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null

    let lapCount = 0
    for (const race of sessionAnalysisRaces) {
      for (const result of race.results) {
        lapCount += result.lapsCompleted ?? 0
      }
    }

    const driverCount = driverStatsByClass.length

    return { bestLapSeconds, avgLapSeconds, lapCount, driverCount }
  }, [driverStatsByClass, sessionAnalysisRaces])

  /** Driver Analysis charts: effective race in class + session type scope (compare + lap-by-lap share selection). */
  const sessionDriverAnalysisPickedRaceId = useMemo(() => {
    if (!inSessionAnalysisSection || eventAnalysisTab !== "driver-analysis") {
      return null
    }
    if (selectedClass === null || sessionDriverAnalysisScopedRaces.length === 0) return null
    if (
      sessionAnalysisSessionRaceId &&
      sessionDriverAnalysisScopedRaces.some((r) => r.id === sessionAnalysisSessionRaceId)
    ) {
      return sessionAnalysisSessionRaceId
    }
    return sessionDriverAnalysisScopedRaces[0].id
  }, [
    inSessionAnalysisSection,
    eventAnalysisTab,
    selectedClass,
    sessionDriverAnalysisScopedRaces,
    sessionAnalysisSessionRaceId,
  ])

  const sessionDriverAnalysisRace = useMemo(() => {
    if (!sessionDriverAnalysisPickedRaceId) return null
    return sessionAnalysisRaces.find((r) => r.id === sessionDriverAnalysisPickedRaceId) ?? null
  }, [sessionAnalysisRaces, sessionDriverAnalysisPickedRaceId])

  const sessionDriverAnalysisDriverStatsFromRace = useMemo(
    () =>
      sessionDriverAnalysisRace ? computeDriverStatsFromRaces([sessionDriverAnalysisRace]) : [],
    [sessionDriverAnalysisRace]
  )

  const sessionUnifiedChartData = useMemo<DriverPerformanceData[]>(() => {
    return sessionDriverAnalysisDriverStatsFromRace.map((d) => ({
      driverId: d.driverId,
      driverName: d.driverName,
      bestLapTime: d.bestLapTime,
      bestLapRaceLabel: d.bestLapRaceLabel,
      averageLapTime: d.avgLapTime,
      consistency: d.averageConsistency ?? null,
      averagePosition: d.averagePosition,
      gapToFastest: d.gapToFastest,
      podiumFinishes: d.podiumFinishes,
      avgTop5: d.avgTop5,
      avgTop10: d.avgTop10,
      avgTop15: d.avgTop15,
      top2Consecutive: d.top2Consecutive,
      top3Consecutive: d.top3Consecutive,
      stdDeviation: d.stdDeviation,
    }))
  }, [sessionDriverAnalysisDriverStatsFromRace])

  const sessionCompareChartSummaryStrip = useMemo(() => {
    const bests = sessionDriverAnalysisDriverStatsFromRace
      .map((d) => d.bestLapTime)
      .filter((t): t is number => t !== null && isFinite(t))
    const bestLapSeconds = bests.length > 0 ? Math.min(...bests) : null

    const avgs = sessionDriverAnalysisDriverStatsFromRace
      .map((d) => d.avgLapTime)
      .filter((t): t is number => t !== null && isFinite(t))
    const avgLapSeconds = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null

    let lapCount = 0
    if (sessionDriverAnalysisRace) {
      for (const result of sessionDriverAnalysisRace.results) {
        lapCount += result.lapsCompleted ?? 0
      }
    }

    const driverCount = sessionDriverAnalysisDriverStatsFromRace.length

    return { bestLapSeconds, avgLapSeconds, lapCount, driverCount }
  }, [sessionDriverAnalysisDriverStatsFromRace, sessionDriverAnalysisRace])

  const sessionParticipantIds = useMemo(() => {
    if (!sessionDriverAnalysisRace) return new Set<string>()
    return new Set(
      sessionDriverAnalysisRace.results.filter((r) => r.lapsCompleted > 0).map((r) => r.driverId)
    )
  }, [sessionDriverAnalysisRace])

  // Build driver options from allDriverStats (not filtered by class)
  // This ensures ChartControls always has the complete driver list for correct class counts
  // Excludes non-starting drivers (those with 0 laps completed who have no performance data to visualize)
  const driverOptions = useMemo(() => {
    return allDriverStats.map((d) => ({
      driverId: d.driverId,
      driverName: d.driverName,
    }))
  }, [allDriverStats])

  const driverOptionsLookup = useMemo(() => {
    return new Map(driverOptions.map((driver) => [driver.driverId, driver.driverName]))
  }, [driverOptions])

  const driverNameLookup = useMemo(() => {
    const map = new Map<string, string>()
    // First, add all drivers from data.drivers (these are aggregated across all races)
    data.drivers.forEach((driver) => {
      if (driver.driverName) {
        map.set(driver.driverId, driver.driverName)
      }
    })
    // Then, add all drivers from race results (including those with 0 laps)
    // This ensures we have names for all drivers who appear in any race
    data.races.forEach((race) => {
      race.results.forEach((result) => {
        // Only add if we don't already have this driverId, or if the existing entry is empty
        if (result.driverId && result.driverName) {
          const existing = map.get(result.driverId)
          if (!existing || existing.trim() === "") {
            map.set(result.driverId, result.driverName)
          }
        }
      })
    })
    return map
  }, [data.drivers, data.races])

  // Helper: expand driver IDs by normalized name (same logic for overview and per-chart)
  const expandDriverIdsByName = useCallback(
    (seedIds: string[]) => {
      if (seedIds.length === 0) return []
      const selectedNormalizedNames = new Set<string>()
      data.drivers.forEach((driver) => {
        if (seedIds.includes(driver.driverId)) {
          selectedNormalizedNames.add(normalizeDriverName(driver.driverName))
        }
      })
      driverStatsByClass.forEach((driver) => {
        if (seedIds.includes(driver.driverId)) {
          selectedNormalizedNames.add(normalizeDriverName(driver.driverName))
        }
      })
      const expandedIds = new Set<string>(seedIds)
      data.drivers.forEach((driver) => {
        if (selectedNormalizedNames.has(normalizeDriverName(driver.driverName))) {
          expandedIds.add(driver.driverId)
        }
      })
      driverStatsByClass.forEach((driver) => {
        if (selectedNormalizedNames.has(normalizeDriverName(driver.driverName))) {
          expandedIds.add(driver.driverId)
        }
      })
      sessionAnalysisRaces.forEach((race) => {
        race.results.forEach((result) => {
          if (
            result.lapsCompleted > 0 &&
            selectedNormalizedNames.has(normalizeDriverName(result.driverName))
          ) {
            expandedIds.add(result.driverId)
          }
        })
      })
      data.races.forEach((race) => {
        race.results.forEach((result) => {
          if (selectedNormalizedNames.has(normalizeDriverName(result.driverName))) {
            expandedIds.add(result.driverId)
          }
        })
      })
      const driverNameLookupSnapshot = new Map(driverNameLookup)
      return Array.from(expandedIds).filter((id) => driverNameLookupSnapshot.has(id))
    },
    [data.drivers, data.races, driverStatsByClass, sessionAnalysisRaces, driverNameLookup]
  )

  // Expand selectedDriverIds to include all driverIds that match by normalized name
  const expandedSelectedDriverIds = useMemo(
    () => expandDriverIdsByName(selectedDriverIds),
    [expandDriverIdsByName, selectedDriverIds]
  )

  // Per-chart expanded IDs (unified chart only); lap trend uses expandedSelectedDriverIds
  const expandedUnifiedChartDriverIds = useMemo(
    () => expandDriverIdsByName(unifiedChartDriverIds),
    [expandDriverIdsByName, unifiedChartDriverIds]
  )

  const expandedSessionUnifiedChartDriverIds = useMemo(
    () =>
      expandDriverIdsByName(unifiedChartDriverIds).filter((id) => sessionParticipantIds.has(id)),
    [expandDriverIdsByName, unifiedChartDriverIds, sessionParticipantIds]
  )

  const sessionUnifiedChartSelectionKey = expandedSessionUnifiedChartDriverIds.join("|")
  const currentPageSession =
    paginationState.selectionKey === sessionUnifiedChartSelectionKey ? paginationState.page : 1

  const handleSessionPageChange = useCallback(
    (page: number) => {
      setPaginationState({ page, selectionKey: sessionUnifiedChartSelectionKey })
    },
    [sessionUnifiedChartSelectionKey]
  )

  // Pagination for unified chart is keyed by that chart's driver selection
  const unifiedChartSelectionKey = expandedUnifiedChartDriverIds.join("|")
  const currentPage =
    paginationState.selectionKey === unifiedChartSelectionKey ? paginationState.page : 1

  const shouldShowSelectionNotices = expandedSelectedDriverIds.length > 0

  // Sync per-chart driver state from overview when event or class changes (start in sync)
  const prevEventIdRef = useRef<string | null>(null)
  const prevSelectedClassRef = useRef<string | null>(null)
  useEffect(() => {
    const eventChanged = prevEventIdRef.current !== data.event.id
    const classChanged = prevSelectedClassRef.current !== selectedClass
    prevEventIdRef.current = data.event.id
    prevSelectedClassRef.current = selectedClass
    if (eventChanged || classChanged) {
      queueMicrotask(() => setUnifiedChartDriverIds(selectedDriverIds))
    }
  }, [data.event.id, selectedClass, selectedDriverIds])

  // When event changes, reset lap trend state and vehicle session scope
  useEffect(() => {
    queueMicrotask(() => {
      setLapTrendChartDriverIds([])
      setSessionAnalysisSessionTypeFilter(null)
      setSessionAnalysisSessionRaceId(null)
      setSessionLapTrendChartDriverIds([])
      setSessionSkillTierFilter(null)
    })
  }, [data.event.id])

  useEffect(() => {
    if (sessionAnalysisSessionTypeFilter === null) return
    if (!sessionAnalysisSessionTypeKeys.includes(sessionAnalysisSessionTypeFilter)) {
      queueMicrotask(() => setSessionAnalysisSessionTypeFilter(null))
    }
  }, [sessionAnalysisSessionTypeFilter, sessionAnalysisSessionTypeKeys])

  /** Default session type when multiple exist so session scope is non-empty (Session Results, etc.). */
  useEffect(() => {
    const eventId = data.event.id
    if (sessionAnalysisSessionTypeInitRef.current.eventId !== eventId) {
      sessionAnalysisSessionTypeInitRef.current = { eventId, applied: false }
    }
    if (!vehicleDenormActive) return
    if (!sessionAnalysisRequiresSessionTypeChoice) return
    if (sessionAnalysisSessionTypeKeys.length <= 1) return
    if (sessionAnalysisSessionTypeInitRef.current.applied) return
    const first = sessionAnalysisSessionTypeKeys[0]
    if (first == null) return
    sessionAnalysisSessionTypeInitRef.current.applied = true
    queueMicrotask(() => setSessionAnalysisSessionTypeFilter(first))
  }, [
    data.event.id,
    vehicleDenormActive,
    sessionAnalysisRequiresSessionTypeChoice,
    sessionAnalysisSessionTypeKeys,
  ])

  // When class scope changes, clear lap-trend driver selection (user re-picks from filtered list)
  useEffect(() => {
    queueMicrotask(() => setLapTrendChartDriverIds([]))
  }, [selectedClass])

  useEffect(() => {
    queueMicrotask(() => setSessionLapTrendChartDriverIds([]))
  }, [sessionDriverAnalysisPickedRaceId, selectedClass])

  useEffect(() => {
    if (!sessionAnalysisRequiresSessionTypeChoice) return
    if (sessionAnalysisSessionTypeFilter !== null) return
    queueMicrotask(() => setSessionAnalysisSessionRaceId(null))
  }, [sessionAnalysisRequiresSessionTypeChoice, sessionAnalysisSessionTypeFilter])

  // Lap-by-lap trend: Event Analysis → Driver Analysis (event-wide) or Session Analysis → Driver Analysis (one session)
  useEffect(() => {
    const isSessionDriverAnalysis =
      inSessionAnalysisSection && eventAnalysisTab === "driver-analysis"
    const isEventDriverAnalysis =
      eventAnalysisTab === "driver-analysis" &&
      (overviewPrimarySection === "event-analysis" || variant === "event-analysis-only")

    if (!isSessionDriverAnalysis && !isEventDriverAnalysis) {
      queueMicrotask(() => {
        setLapTrendLoading(false)
        setLapTrendData(null)
        setLapTrendError(null)
      })
      return
    }

    if (isSessionDriverAnalysis) {
      if (
        sessionLapTrendChartDriverIds.length === 0 ||
        selectedClass === null ||
        !sessionDriverAnalysisPickedRaceId
      ) {
        queueMicrotask(() => {
          setLapTrendData(null)
          setLapTrendError(null)
          setLapTrendLoading(false)
        })
        return
      }
      queueMicrotask(() => {
        setLapTrendLoading(true)
        setLapTrendError(null)
      })
      const cappedIds = sessionLapTrendChartDriverIds.slice(0, MAX_LAP_TREND_DRIVERS)
      const params = new URLSearchParams({
        driverIds: cappedIds.join(","),
        raceId: sessionDriverAnalysisPickedRaceId,
      })
      const lapTrendClassName =
        vehicleDenormActive && selectedClass
          ? selectedClass !== UNCLASSIFIED_CLASS_KEY
            ? selectedClass
            : null
          : selectedClass
      if (lapTrendClassName) params.set("className", lapTrendClassName)
      const url = `/api/v1/events/${data.event.id}/lap-trend?${params.toString()}`
      fetch(url, { cache: "no-store", credentials: "include" })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            const message = err?.error?.message ?? `Failed to load lap trend (${res.status})`
            throw new Error(message)
          }
          const json = await res.json()
          if (json.success && json.data) {
            setLapTrendData(json.data as EventLapTrendResponse)
          } else {
            setLapTrendData({ drivers: [] })
          }
        })
        .catch((err) => {
          setLapTrendError(err instanceof Error ? err.message : "Failed to load lap trend")
          setLapTrendData(null)
        })
        .finally(() => setLapTrendLoading(false))
      return
    }

    if (lapTrendChartDriverIds.length === 0) {
      queueMicrotask(() => {
        setLapTrendData(null)
        setLapTrendError(null)
        setLapTrendLoading(false)
      })
      return
    }
    queueMicrotask(() => {
      setLapTrendLoading(true)
      setLapTrendError(null)
    })
    const params = new URLSearchParams({
      driverIds: lapTrendChartDriverIds.join(","),
    })
    if (selectedClass) params.set("className", selectedClass)
    const url = `/api/v1/events/${data.event.id}/lap-trend?${params.toString()}`
    fetch(url, { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          const message = err?.error?.message ?? `Failed to load lap trend (${res.status})`
          throw new Error(message)
        }
        const json = await res.json()
        if (json.success && json.data) {
          setLapTrendData(json.data as EventLapTrendResponse)
        } else {
          setLapTrendData({ drivers: [] })
        }
      })
      .catch((err) => {
        setLapTrendError(err instanceof Error ? err.message : "Failed to load lap trend")
        setLapTrendData(null)
      })
      .finally(() => setLapTrendLoading(false))
  }, [
    inSessionAnalysisSection,
    eventAnalysisTab,
    variant,
    data.event.id,
    sessionLapTrendChartDriverIds,
    sessionDriverAnalysisPickedRaceId,
    vehicleDenormActive,
    selectedClass,
    lapTrendChartDriverIds,
  ])

  // Lap-trend driver options: same class scope as Compare chart (`driverStatsByClass`), in global selection
  const lapTrendDriverOptions = useMemo(
    () =>
      driverStatsByClass
        .filter((d) => expandedSelectedDriverIds.includes(d.driverId))
        .map((d) => ({ driverId: d.driverId, driverName: d.driverName })),
    [driverStatsByClass, expandedSelectedDriverIds]
  )

  // Sort lap-trend drivers by selected metric (order in chart/legend)
  const sortedLapTrendDrivers = useMemo(() => {
    if (!lapTrendData?.drivers?.length) return []
    const statsMap = new Map(driverStatsByClass.map((d) => [d.driverId, d]))
    const key =
      lapTrendSortBy === "bestLap"
        ? "bestLapTime"
        : lapTrendSortBy === "averageLap"
          ? "avgLapTime"
          : lapTrendSortBy === "consistency"
            ? "averageConsistency"
            : lapTrendSortBy === "gapToFastest"
              ? "gapToFastest"
              : lapTrendSortBy === "averagePosition"
                ? "averagePosition"
                : "podiumFinishes"
    const ascending =
      lapTrendSortBy === "consistency" || lapTrendSortBy === "podiumFinishes" ? false : true
    return [...lapTrendData.drivers].sort((a, b) => {
      const sa = statsMap.get(a.driverId)
      const sb = statsMap.get(b.driverId)
      const va = sa ? (sa as Record<string, unknown>)[key] : null
      const vb = sb ? (sb as Record<string, unknown>)[key] : null
      const aNum =
        va === null || va === undefined || (typeof va === "number" && !isFinite(va))
          ? ascending
            ? Infinity
            : -Infinity
          : (va as number)
      const bNum =
        vb === null || vb === undefined || (typeof vb === "number" && !isFinite(vb))
          ? ascending
            ? Infinity
            : -Infinity
          : (vb as number)
      if (ascending) return aNum - bNum
      return bNum - aNum
    })
  }, [lapTrendData, driverStatsByClass, lapTrendSortBy])

  const sessionLapTrendDriverOptions = useMemo(
    () =>
      sessionDriverAnalysisDriverStatsFromRace
        .filter((d) => expandedSelectedDriverIds.includes(d.driverId))
        .map((d) => ({ driverId: d.driverId, driverName: d.driverName })),
    [sessionDriverAnalysisDriverStatsFromRace, expandedSelectedDriverIds]
  )

  const sortedSessionLapTrendDrivers = useMemo(() => {
    if (!lapTrendData?.drivers?.length) return []
    const statsMap = new Map(sessionDriverAnalysisDriverStatsFromRace.map((d) => [d.driverId, d]))
    const key =
      lapTrendSortBy === "bestLap"
        ? "bestLapTime"
        : lapTrendSortBy === "averageLap"
          ? "avgLapTime"
          : lapTrendSortBy === "consistency"
            ? "averageConsistency"
            : lapTrendSortBy === "gapToFastest"
              ? "gapToFastest"
              : lapTrendSortBy === "averagePosition"
                ? "averagePosition"
                : "podiumFinishes"
    const ascending =
      lapTrendSortBy === "consistency" || lapTrendSortBy === "podiumFinishes" ? false : true
    return [...lapTrendData.drivers].sort((a, b) => {
      const sa = statsMap.get(a.driverId)
      const sb = statsMap.get(b.driverId)
      const va = sa ? (sa as Record<string, unknown>)[key] : null
      const vb = sb ? (sb as Record<string, unknown>)[key] : null
      const aNum =
        va === null || va === undefined || (typeof va === "number" && !isFinite(va))
          ? ascending
            ? Infinity
            : -Infinity
          : (va as number)
      const bNum =
        vb === null || vb === undefined || (typeof vb === "number" && !isFinite(vb))
          ? ascending
            ? Infinity
            : -Infinity
          : (vb as number)
      if (ascending) return aNum - bNum
      return bNum - aNum
    })
  }, [lapTrendData, sessionDriverAnalysisDriverStatsFromRace, lapTrendSortBy])

  // Only consider selected drivers who are in the current class for "missing best lap" / "missing avg vs fastest"
  // so we don't incorrectly flag drivers from other classes when a class is selected
  const selectedDriverIdsInCurrentClass = useMemo(() => {
    const statsDriverIds = new Set(driverStatsByClass.map((d) => d.driverId))
    return expandedSelectedDriverIds.filter((id) => statsDriverIds.has(id))
  }, [expandedSelectedDriverIds, driverStatsByClass])

  const selectedDriverIdsInSessionRace = useMemo(() => {
    const statsDriverIds = new Set(sessionDriverAnalysisDriverStatsFromRace.map((d) => d.driverId))
    return expandedSelectedDriverIds.filter((id) => statsDriverIds.has(id))
  }, [expandedSelectedDriverIds, sessionDriverAnalysisDriverStatsFromRace])

  const missingBestLapDriverIds = useMemo(() => {
    if (!shouldShowSelectionNotices) {
      return []
    }
    return getDriversMissingBestLap(selectedDriverIdsInCurrentClass, driverStatsByClass)
  }, [shouldShowSelectionNotices, selectedDriverIdsInCurrentClass, driverStatsByClass])

  const missingAvgVsFastestDriverIds = useMemo(() => {
    if (!shouldShowSelectionNotices) {
      return []
    }
    return getDriversMissingAvgVsFastest(selectedDriverIdsInCurrentClass, driverStatsByClass)
  }, [shouldShowSelectionNotices, selectedDriverIdsInCurrentClass, driverStatsByClass])

  const mapDriverIdsToNames = useCallback(
    (driverIds: string[]) => {
      return driverIds.map((driverId) => {
        const name = driverNameLookup.get(driverId) ?? driverOptionsLookup.get(driverId)
        return name ?? "Unknown Driver"
      })
    },
    [driverNameLookup, driverOptionsLookup]
  )

  const missingBestLapDriverNames = useMemo(
    () => mapDriverIdsToNames(missingBestLapDriverIds),
    [mapDriverIdsToNames, missingBestLapDriverIds]
  )

  const missingAvgVsFastestDriverNames = useMemo(
    () => mapDriverIdsToNames(missingAvgVsFastestDriverIds),
    [mapDriverIdsToNames, missingAvgVsFastestDriverIds]
  )

  const sessionMissingBestLapDriverNames = useMemo(() => {
    if (!shouldShowSelectionNotices || sessionDriverAnalysisDriverStatsFromRace.length === 0) {
      return []
    }
    return mapDriverIdsToNames(
      getDriversMissingBestLap(
        selectedDriverIdsInSessionRace,
        sessionDriverAnalysisDriverStatsFromRace
      )
    )
  }, [
    shouldShowSelectionNotices,
    sessionDriverAnalysisDriverStatsFromRace,
    mapDriverIdsToNames,
    selectedDriverIdsInSessionRace,
  ])

  const sessionMissingAvgVsFastestDriverNames = useMemo(() => {
    if (!shouldShowSelectionNotices || sessionDriverAnalysisDriverStatsFromRace.length === 0) {
      return []
    }
    return mapDriverIdsToNames(
      getDriversMissingAvgVsFastest(
        selectedDriverIdsInSessionRace,
        sessionDriverAnalysisDriverStatsFromRace
      )
    )
  }, [
    shouldShowSelectionNotices,
    sessionDriverAnalysisDriverStatsFromRace,
    mapDriverIdsToNames,
    selectedDriverIdsInSessionRace,
  ])

  // Calculate unselected drivers in the selected class
  const unselectedDriversInClassIds = useMemo(() => {
    const classFilter = selectedClass
    if (!classFilter || classFilter === UNCLASSIFIED_CLASS_KEY) {
      return []
    }

    // Get all drivers in the selected class from races data
    // Only include drivers that are in driverOptions (excludes non-starting drivers)
    const driverOptionsSet = new Set(driverOptions.map((d) => d.driverId))
    const classDrivers: Array<{ driverId: string }> = []

    data.races.forEach((race) => {
      if (race.className?.trim() === classFilter) {
        race.results.forEach((result) => {
          // Only include drivers that are in driverOptions (have performance data)
          if (driverOptionsSet.has(result.driverId)) {
            // Avoid duplicates
            if (!classDrivers.some((d) => d.driverId === result.driverId)) {
              classDrivers.push({ driverId: result.driverId })
            }
          }
        })
      }
    })

    if (classDrivers.length === 0) {
      return []
    }

    return getUnselectedDriversInClass(selectedDriverIds, classDrivers)
  }, [selectedClass, data.races, driverOptions, selectedDriverIds])

  const unselectedDriversInClassNames = useMemo(
    () => mapDriverIdsToNames(unselectedDriversInClassIds),
    [mapDriverIdsToNames, unselectedDriversInClassIds]
  )

  const allDriversInClassSelected = useMemo(() => {
    const classScopeActive = selectedClass != null
    if (!classScopeActive || driverStatsByClass.length === 0) {
      return false
    }
    return driverStatsByClass.every((d) => selectedDriverIds.includes(d.driverId))
  }, [selectedClass, driverStatsByClass, selectedDriverIds])

  const allSessionRaceDriversSelected = useMemo(() => {
    if (!sessionDriverAnalysisRace || sessionDriverAnalysisDriverStatsFromRace.length === 0) {
      return false
    }
    return sessionDriverAnalysisDriverStatsFromRace.every((d) =>
      selectedDriverIds.includes(d.driverId)
    )
  }, [sessionDriverAnalysisRace, sessionDriverAnalysisDriverStatsFromRace, selectedDriverIds])

  // Clear "Select All clicked" when user deselects a driver
  // Only clear if we previously had all selected and now we don't (user explicitly deselected)
  const prevAllDriversInClassSelected = useRef(false)
  useEffect(() => {
    if (prevAllDriversInClassSelected.current && !allDriversInClassSelected) {
      queueMicrotask(() => setSelectAllClickedForCurrentClass(false))
    }
    prevAllDriversInClassSelected.current = allDriversInClassSelected
  }, [allDriversInClassSelected])

  const handleSelectAllClick = useCallback(() => {
    setSelectAllClickedForCurrentClass(true)
  }, [])

  // Handle driver toggle from chart click
  const handleSelectionChange = useCallback(
    (driverIds: string[]) => {
      setPaginationState({
        page: 1,
        selectionKey: driverIds.join("|"),
      })
      onDriverSelectionChange(driverIds)
    },
    [onDriverSelectionChange]
  )

  // Per-chart: toggle one driver in the unified chart's selection (legend click)
  const handleUnifiedChartDriverToggle = useCallback((driverId: string) => {
    setUnifiedChartDriverIds((prev) =>
      prev.includes(driverId) ? prev.filter((id) => id !== driverId) : [...prev, driverId]
    )
  }, [])

  const handlePageChange = useCallback(
    (page: number) => {
      setPaginationState({ page, selectionKey: unifiedChartSelectionKey })
    },
    [unifiedChartSelectionKey]
  )

  const handleEventClassFilterClick = useCallback((className: string) => {
    setEventClassFilter((prev) => (prev === className ? null : className))
  }, [])

  const handleEventClassFilterKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLButtonElement>,
      index: number,
      refs: React.MutableRefObject<Array<HTMLButtonElement | null>>
    ) => {
      if (validClasses.length === 0) return
      const totalButtons = validClasses.length + 1
      let nextIndex = index
      if (event.key === "ArrowRight") {
        nextIndex = (index + 1) % totalButtons
      } else if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + totalButtons) % totalButtons
      } else {
        return
      }
      event.preventDefault()
      const nextButton = refs.current[nextIndex]
      nextButton?.focus()
    },
    [validClasses.length]
  )

  const handleEventClassFilterAllClassesClick = useCallback(() => {
    setEventClassFilter(null)
  }, [])

  const handleClassChange = useCallback(
    (className: string | null) => {
      setSelectAllClickedForCurrentClass(false)
      setPaginationState({
        page: 1,
        selectionKey: "",
      })

      // Auto-select all drivers in the selected class (excluding non-starting drivers)
      if (className !== null) {
        // Get all drivers who raced in this class and have completed at least one lap
        const driversInClass = new Set<string>()
        data.races
          .filter((race) => race.className === className)
          .forEach((race) => {
            race.results.forEach((result) => {
              // Only include drivers who have completed at least one lap
              if (result.lapsCompleted > 0) {
                driversInClass.add(result.driverId)
              }
            })
          })

        // Select all drivers in this class
        const driverIdsArray = Array.from(driversInClass)
        handleSelectionChange(driverIdsArray)
      } else {
        // When "All Classes" is selected, select all available drivers
        const allDriverIds = driverOptions.map((driver) => driver.driverId)
        handleSelectionChange(allDriverIds)
      }

      if (!onClassChange) return

      const normalized =
        className && typeof className === "string" && className.trim() !== ""
          ? className.trim()
          : null
      onClassChange(normalized)
    },
    [data.races, driverOptions, handleSelectionChange, onClassChange]
  )

  const handleSessionClassChipClick = useCallback(
    (className: string) => {
      if (selectedClass === className) {
        handleClassChange(null)
      } else {
        handleClassChange(className)
      }
    },
    [selectedClass, handleClassChange]
  )

  const handleSessionClassFilterAllClassesClick = useCallback(() => {
    handleClassChange(null)
  }, [handleClassChange])

  /** LiveRC class scope changed: reset skill tier (tiers are per class). */
  useEffect(() => {
    if (!vehicleDenormActive) return
    queueMicrotask(() => setSessionSkillTierFilter(null))
  }, [selectedClass, vehicleDenormActive])

  /** Keep session race id in sync with class + session type scope (driver-analysis chart headers). */
  useEffect(() => {
    if (!vehicleDenormActive) return
    const sorted = sessionDriverAnalysisSortedRaces
    queueMicrotask(() => {
      if (sessionAnalysisRequiresSessionTypeChoice && sessionAnalysisSessionTypeFilter === null) {
        setSessionAnalysisSessionRaceId(null)
        return
      }
      if (sorted.length === 0) {
        setSessionAnalysisSessionRaceId(null)
        return
      }
      setSessionAnalysisSessionRaceId((prev) => {
        if (prev && sorted.some((r) => r.id === prev)) return prev
        return sorted[0].id
      })
    })
  }, [
    vehicleDenormActive,
    sessionDriverAnalysisSortedRaces,
    sessionAnalysisRequiresSessionTypeChoice,
    sessionAnalysisSessionTypeFilter,
    data.event.id,
  ])

  /** Arrow-key navigation for Bump-Up / Driver Progression class chips (`chipCount` excludes All Classes). */
  const handleSessionToolbarClassKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLButtonElement>,
      index: number,
      refs: React.MutableRefObject<Array<HTMLButtonElement | null>>,
      chipCount: number
    ) => {
      if (chipCount === 0) return
      const totalButtons = chipCount + 1
      let nextIndex = index
      if (event.key === "ArrowRight") {
        nextIndex = (index + 1) % totalButtons
      } else if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + totalButtons) % totalButtons
      } else {
        return
      }
      event.preventDefault()
      const nextButton = refs.current[nextIndex]
      nextButton?.focus()
    },
    []
  )

  /** Default Event Analysis class filter to first entry list class when event (or class list) loads. */
  const eventClassFilterInitRef = useRef<{ eventId: string; applied: boolean }>({
    eventId: "",
    applied: false,
  })
  useEffect(() => {
    const eventId = data.event.id
    if (eventClassFilterInitRef.current.eventId !== eventId) {
      eventClassFilterInitRef.current = { eventId, applied: false }
    }
    if (validClasses.length === 0) return
    if (!eventClassFilterInitRef.current.applied) {
      eventClassFilterInitRef.current.applied = true
      queueMicrotask(() => {
        setEventClassFilter(validClasses[0] ?? null)
      })
    }
  }, [data.event.id, validClasses])

  // Auto-select all drivers when "All Classes" is the default on initial load
  // This ensures charts show all classes data when event is first loaded
  const hasAutoSelectedOnLoad = useRef<string | null>(null)
  useEffect(() => {
    const eventId = data.event.id
    if (
      driverOptions.length > 0 &&
      selectedClass === null &&
      hasAutoSelectedOnLoad.current !== eventId &&
      (selectedDriverIds.length === 0 || selectedDriverIds.length !== driverOptions.length)
    ) {
      const allDriverIds = driverOptions.map((driver) => driver.driverId)
      const allSelected = allDriverIds.every((id) => selectedDriverIds.includes(id))
      if (!allSelected) {
        hasAutoSelectedOnLoad.current = eventId
        queueMicrotask(() => handleSelectionChange(allDriverIds))
      }
    }
  }, [driverOptions, selectedClass, selectedDriverIds, handleSelectionChange, data.event.id])

  // Reset auto-select flag when event changes or when switching to "All Classes"
  const prevSelectedClass = useRef<string | null>(null)
  const prevEventId = useRef<string | null>(null)
  useEffect(() => {
    const eventId = data.event.id
    if (prevEventId.current !== eventId) {
      hasAutoSelectedOnLoad.current = null
      prevEventId.current = eventId
    }
    if (prevSelectedClass.current !== selectedClass && selectedClass === null) {
      hasAutoSelectedOnLoad.current = null
    }
    prevSelectedClass.current = selectedClass
  }, [selectedClass, data.event.id])

  useEffect(() => {
    if (!shouldShowSelectionNotices) {
      lastLoggedMissingState.current = null
      return
    }

    if (missingBestLapDriverIds.length === 0 && missingAvgVsFastestDriverIds.length === 0) {
      lastLoggedMissingState.current = null
      return
    }

    const payload = JSON.stringify({
      missingBestLapDriverIds,
      missingAvgVsFastestDriverIds,
    })

    if (lastLoggedMissingState.current === payload) {
      return
    }

    lastLoggedMissingState.current = payload

    clientLogger.warn("event_analysis_missing_driver_metrics", {
      eventId: data.event.id,
      classFilter: selectedClass ?? "all",
      selectedDriverCount: expandedSelectedDriverIds.length,
      missingBestLapDriverIds,
      missingAvgVsFastestDriverIds,
    })
  }, [
    shouldShowSelectionNotices,
    missingBestLapDriverIds,
    missingAvgVsFastestDriverIds,
    data.event.id,
    selectedClass,
    expandedSelectedDriverIds.length,
  ])

  useEffect(() => {
    if (
      !selectedClass ||
      selectedDriverIds.length === 0 ||
      unselectedDriversInClassIds.length === 0
    ) {
      lastLoggedUnselectedInClassState.current = null
      return
    }

    const payload = JSON.stringify({
      eventId: data.event.id,
      selectedClass,
      unselectedDriverIds: [...unselectedDriversInClassIds].sort(),
    })

    if (lastLoggedUnselectedInClassState.current === payload) {
      return
    }

    lastLoggedUnselectedInClassState.current = payload

    clientLogger.info("event_analysis_unselected_drivers_in_class", {
      eventId: data.event.id,
      selectedClass,
      unselectedDriverIds: unselectedDriversInClassIds,
      unselectedDriverNames: unselectedDriversInClassNames,
    })
  }, [
    selectedClass,
    selectedDriverIds.length,
    unselectedDriversInClassIds,
    unselectedDriversInClassNames,
    data.event.id,
  ])

  const eventOverviewSectionContentId = "event-overview-section-content"
  const sessionAnalysisSectionContentId = "session-analysis-section-content"
  const eventAnalysisSectionContentId = "event-analysis-section-content"
  const bumpUpsSectionContentId = "bump-ups-section-content"
  const driverProgressionSectionContentId = "driver-progression-section-content"

  /** Session Type + Session selects; `scopedRaces` is either all races after type filter or class-scoped races for charts. */
  const renderSessionScopeControls = useCallback(
    (idPrefix: string, scopedRaces: RaceAnalysisRow[], ariaSession: string) => {
      const typeFilter = sessionAnalysisSessionTypeFilter
      const pickedRaceId =
        sessionAnalysisSessionRaceId &&
        scopedRaces.some((r) => r.id === sessionAnalysisSessionRaceId)
          ? sessionAnalysisSessionRaceId
          : (scopedRaces[0]?.id ?? null)

      return (
        <div className="flex min-w-0 flex-wrap items-center gap-3 gap-y-2">
          {sessionAnalysisSessionTypeKeys.length > 1 && (
            <div className="flex min-w-0 items-center gap-2">
              <label
                className="shrink-0 text-sm text-[var(--token-text-secondary)]"
                htmlFor={`${idPrefix}-session-type`}
              >
                Session Type
              </label>
              <select
                id={`${idPrefix}-session-type`}
                value={typeFilter ?? ""}
                onChange={(e) =>
                  setSessionAnalysisSessionTypeFilter(e.target.value ? e.target.value : null)
                }
                className="min-w-0 max-w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-1.5 text-sm text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-accent)]"
                aria-label="Choose session type (required before session and driver selection)"
                required
              >
                <option value="" disabled>
                  Select session type…
                </option>
                {sessionAnalysisSessionTypeKeys.map((typeKey) => (
                  <option key={typeKey} value={typeKey}>
                    {sessionTypeFilterChipLabel(typeKey)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex min-w-0 items-center gap-2">
            <label
              className="shrink-0 text-sm text-[var(--token-text-secondary)]"
              htmlFor={`${idPrefix}-session-race`}
            >
              Session
            </label>
            <select
              id={`${idPrefix}-session-race`}
              value={pickedRaceId ?? ""}
              onChange={(e) => setSessionAnalysisSessionRaceId(e.target.value || null)}
              disabled={sessionAnalysisRequiresSessionTypeChoice && typeFilter === null}
              className="min-w-0 max-w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-1.5 text-sm text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={ariaSession}
            >
              {sessionAnalysisRequiresSessionTypeChoice && typeFilter === null ? (
                <option value="">Select session type first</option>
              ) : scopedRaces.length === 0 ? (
                <option value="">No sessions for this type</option>
              ) : (
                scopedRaces.map((race, index) => (
                  <option key={race.id} value={race.id}>
                    {formatSessionAnalysisRaceOptionLabel(
                      race,
                      index,
                      scopedRaces.length,
                      selectedClass,
                      typeFilter
                    )}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      )
    },
    [
      sessionAnalysisSessionTypeKeys,
      sessionAnalysisSessionTypeFilter,
      sessionAnalysisSessionRaceId,
      sessionAnalysisRequiresSessionTypeChoice,
      selectedClass,
    ]
  )

  const showOtherSections =
    variant !== "event-overview-only" &&
    variant !== "event-analysis-only" &&
    variant !== "session-analysis-only"
  /** Event overview hero/stats: only on the Event Overview top tab, or in default mode when that subsection is active. */
  const showEventOverviewSection =
    variant === "event-overview-only" ||
    (showOtherSections && overviewPrimarySection === "event-overview")

  const showEventAnalysisSectionBlock =
    variant === "event-analysis-only" ||
    (showOtherSections && overviewPrimarySection === "event-analysis")

  const showSessionAnalysisSectionBlock =
    variant === "session-analysis-only" ||
    (showOtherSections && overviewPrimarySection === "session-analysis")

  const ladderInEventAnalysis =
    variant === "event-analysis-only" &&
    (eventAnalysisTab === "bump-ups" || eventAnalysisTab === "driver-progression")

  const overviewPrimarySectionTabsVisible = useMemo(() => {
    if (
      variant === "event-overview-only" ||
      variant === "event-analysis-only" ||
      variant === "session-analysis-only"
    ) {
      return []
    }
    return overviewPrimarySectionTabs
  }, [variant])

  const tabPanelId =
    variant === "event-overview-only"
      ? "tabpanel-event-overview"
      : variant === "event-analysis-only"
        ? "tabpanel-event-analysis"
        : variant === "session-analysis-only"
          ? "tabpanel-session-analysis"
          : "tabpanel-overview"
  const tabAriaLabelledBy =
    variant === "event-overview-only"
      ? "tab-event-overview"
      : variant === "event-analysis-only"
        ? "tab-event-analysis"
        : variant === "session-analysis-only"
          ? "tab-session-analysis"
          : "tab-overview"

  return (
    <div className="space-y-6" role="tabpanel" id={tabPanelId} aria-labelledby={tabAriaLabelledBy}>
      {showOtherSections && overviewPrimarySectionTabsVisible.length > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/80 px-3 py-2 shadow-sm">
          <div className="min-w-0 flex-1 overflow-x-hidden">
            <div className="flex min-w-0 flex-wrap items-end gap-2">
              <div
                className="flex min-w-0 flex-wrap"
                role="tablist"
                aria-label="Overview subsections"
              >
                {overviewPrimarySectionTabsVisible.map((tab) => {
                  const isActive = overviewPrimarySection === tab.id
                  return (
                    <button
                      key={tab.id}
                      id={tab.headingId}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                        isActive
                          ? "border-[var(--token-accent)] text-[var(--token-accent)]"
                          : "border-transparent text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)]"
                      }`}
                      onClick={() => setOverviewPrimarySection(tab.id)}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showEventOverviewSection && (
        <section
          className="space-y-3"
          aria-labelledby={
            variant === "event-overview-only" ? "tab-event-overview" : "event-overview-heading"
          }
        >
          <div
            id={eventOverviewSectionContentId}
            role="tabpanel"
            aria-labelledby={
              variant === "event-overview-only" ? "tab-event-overview" : "event-overview-heading"
            }
            className="space-y-3"
          >
            <div
              className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 px-4 py-4 shadow-sm transition-colors hover:border-[var(--token-accent-soft-border)] hover:bg-[var(--token-surface-elevated)]/80"
              style={{
                backgroundColor: "var(--glass-bg)",
                backdropFilter: "var(--glass-blur)",
                borderRadius: 16,
                border: "1px solid var(--glass-border)",
                boxShadow: "var(--glass-shadow)",
              }}
            >
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mt-1 flex items-center gap-3">
                    <div className="min-w-0 max-w-full">
                      {data.event.eventUrl ? (
                        <Tooltip text="Click to view this event on LiveRC.com" position="top">
                          <a
                            href={data.event.eventUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-w-0 max-w-full items-center gap-1.5 text-base font-semibold text-[var(--token-text-primary)] decoration-[var(--token-accent)]/50 underline-offset-4 transition-colors hover:text-[var(--token-accent)] hover:underline hover:decoration-[var(--token-accent)]"
                            aria-label="View event on LiveRC (opens in new tab)"
                          >
                            <MapPin
                              className="h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                              aria-hidden
                            />
                            <span className="truncate">{data.event.trackName}</span>
                          </a>
                        </Tooltip>
                      ) : (
                        <h2 className="flex min-w-0 items-center gap-1.5 text-base font-semibold text-[var(--token-text-primary)]">
                          <MapPin
                            className="h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                            aria-hidden
                          />
                          <span className="truncate">{data.event.trackName}</span>
                        </h2>
                      )}
                    </div>
                    {(() => {
                      const dr = data.summary.dateRange
                      const hasDateRange = dr && (dr.earliest || dr.latest)
                      if (!hasDateRange) return null
                      const earliestStr = dr.earliest ? formatDateLong(dr.earliest) : ""
                      const latestStr = dr.latest ? formatDateLong(dr.latest) : ""
                      const dateRangeStr =
                        earliestStr && latestStr && earliestStr === latestStr
                          ? earliestStr
                          : `${earliestStr}${earliestStr && latestStr ? " – " : ""}${latestStr}`
                      return (
                        <>
                          <div
                            className="h-4 w-px shrink-0 bg-[var(--token-border-default)]"
                            aria-hidden
                          />
                          <span className="text-sm text-[var(--token-text-secondary)]">
                            {dateRangeStr}
                          </span>
                        </>
                      )
                    })()}
                  </div>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-x-6 gap-y-2 text-right sm:text-left sm:pl-4 sm:border-l sm:border-[var(--token-border-subtle)]">
                  <div className="flex flex-col">
                    <span className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]">
                      Races
                    </span>
                    <span className="text-xl font-semibold text-[var(--token-text-primary)]">
                      {data.summary.totalRaces}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]">
                      Drivers
                    </span>
                    <span className="text-xl font-semibold text-[var(--token-text-primary)]">
                      {data.summary.totalDrivers}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]">
                      Entries
                    </span>
                    <span className="text-xl font-semibold text-[var(--token-text-primary)]">
                      {data.entryList.length}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]">
                      Total Laps
                    </span>
                    <span className="text-xl font-semibold text-[var(--token-text-primary)]">
                      {data.summary.totalLaps.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]">
                      Total Classes
                    </span>
                    <span className="text-xl font-semibold text-[var(--token-text-primary)]">
                      {data.raceClasses.size}
                    </span>
                  </div>
                </div>
              </div>

              {/* Collapsible Venue info */}
              {(() => {
                const dr = data.summary.dateRange
                const hasDateRange = dr && (dr.earliest || dr.latest)
                const hasAddress = !!(
                  data.event.address &&
                  typeof data.event.address === "string" &&
                  data.event.address.trim()
                )
                const hasPhone = !!(
                  data.event.phone &&
                  typeof data.event.phone === "string" &&
                  data.event.phone.trim()
                )
                const hasWebsite = !!(
                  data.event.website &&
                  typeof data.event.website === "string" &&
                  data.event.website.trim()
                )
                const hasEmail = !!(
                  data.event.email &&
                  typeof data.event.email === "string" &&
                  data.event.email.trim()
                )
                const hasFacebook = !!(
                  data.event.facebookUrl &&
                  typeof data.event.facebookUrl === "string" &&
                  data.event.facebookUrl.trim()
                )
                const hasVenueInfo =
                  hasDateRange || hasAddress || hasPhone || hasWebsite || hasEmail || hasFacebook
                if (!hasVenueInfo) return null

                const dateRangeStr = (() => {
                  if (!hasDateRange) return null
                  const earliestStr = dr.earliest ? formatDateLong(dr.earliest) : ""
                  const latestStr = dr.latest ? formatDateLong(dr.latest) : ""
                  if (earliestStr && latestStr && earliestStr === latestStr) return earliestStr
                  return `${earliestStr}${earliestStr && latestStr ? " – " : ""}${latestStr}`
                })()

                const venueInfoContentId = "venue-info-content"
                return (
                  <div className="w-full shrink-0 basis-full border-t border-[var(--token-border-muted)] pt-3">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 text-left text-xs font-medium text-[var(--token-text-muted)] transition-colors hover:text-[var(--token-text-secondary)]"
                      aria-expanded={isVenueInfoOpen}
                      aria-controls={venueInfoContentId}
                      onClick={() => setIsVenueInfoOpen((prev) => !prev)}
                    >
                      <span>Venue info</span>
                      <span
                        className={`shrink-0 transition-transform duration-150 ${
                          isVenueInfoOpen ? "rotate-0" : "-rotate-90"
                        }`}
                        aria-hidden
                      >
                        ▾
                      </span>
                    </button>
                    {isVenueInfoOpen && (
                      <div
                        id={venueInfoContentId}
                        className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2"
                      >
                        {dateRangeStr && (
                          <div className="flex items-start gap-2">
                            <Calendar
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                              aria-hidden
                            />
                            <span className="text-[var(--token-text-primary)]">{dateRangeStr}</span>
                          </div>
                        )}
                        {hasAddress && (
                          <div className="flex items-start gap-2">
                            <MapPin
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                              aria-hidden
                            />
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[var(--token-text-primary)]">
                                {data.event.address}
                              </span>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.event.address!)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--token-accent)] underline-offset-2 hover:underline"
                              >
                                Open in Maps
                              </a>
                            </span>
                          </div>
                        )}
                        {hasPhone && (
                          <div className="flex items-start gap-2">
                            <Phone
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                              aria-hidden
                            />
                            <a
                              href={`tel:${data.event.phone!.replace(/\s/g, "")}`}
                              className="text-[var(--token-text-primary)] text-[var(--token-accent)] underline-offset-2 hover:underline"
                            >
                              {data.event.phone}
                            </a>
                          </div>
                        )}
                        {hasWebsite && (
                          <div className="flex items-start gap-2">
                            <Globe
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                              aria-hidden
                            />
                            <a
                              href={
                                data.event.website!.startsWith("http")
                                  ? data.event.website!
                                  : `https://${data.event.website}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-[var(--token-text-primary)] text-[var(--token-accent)] underline-offset-2 hover:underline"
                            >
                              {data.event.website}
                            </a>
                          </div>
                        )}
                        {hasFacebook && (
                          <div className="flex items-start gap-2">
                            <Facebook
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                              aria-hidden
                            />
                            <a
                              href={data.event.facebookUrl!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-[var(--token-text-primary)] text-[var(--token-accent)] underline-offset-2 hover:underline"
                            >
                              View on Facebook
                            </a>
                          </div>
                        )}
                        {hasEmail && (
                          <div className="flex items-start gap-2">
                            <Mail
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                              aria-hidden
                            />
                            <a
                              href={`mailto:${data.event.email}`}
                              className="truncate text-[var(--token-text-primary)] text-[var(--token-accent)] underline-offset-2 hover:underline"
                            >
                              {data.event.email}
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Collapsible Event Weather Data */}
              <div className="w-full shrink-0 basis-full border-t border-[var(--token-border-muted)] pt-3">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 text-left text-xs font-medium text-[var(--token-text-muted)] transition-colors hover:text-[var(--token-text-secondary)]"
                  aria-expanded={isEventWeatherDataOpen}
                  aria-controls="event-weather-data-content"
                  onClick={() => setIsEventWeatherDataOpen((prev) => !prev)}
                >
                  <span>Event Weather Data</span>
                  <span
                    className={`shrink-0 transition-transform duration-150 ${
                      isEventWeatherDataOpen ? "rotate-0" : "-rotate-90"
                    }`}
                    aria-hidden
                  >
                    ▾
                  </span>
                </button>
                {isEventWeatherDataOpen && (
                  <div id="event-weather-data-content" className="mt-3 flex flex-wrap gap-4">
                    {weatherLoading ? (
                      <WeatherCard weather={null} weatherLoading={true} weatherError={null} />
                    ) : weatherError ? (
                      <WeatherCard
                        weather={null}
                        weatherLoading={false}
                        weatherError={weatherError}
                      />
                    ) : weatherByDay && weatherByDay.length > 0 ? (
                      weatherByDay.map(({ date, weather }) => (
                        <div key={date} className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-[var(--token-text-secondary)]">
                            {formatDateLong(date)}
                          </span>
                          <WeatherCard
                            weather={weather}
                            weatherLoading={false}
                            weatherError={null}
                          />
                        </div>
                      ))
                    ) : null}
                  </div>
                )}
              </div>

              <EventHighlightsSection data={data} />
            </div>
          </div>
        </section>
      )}

      {showEventAnalysisSectionBlock && (
        <section
          className="space-y-4"
          aria-labelledby={
            variant === "event-analysis-only" ? "tab-event-analysis" : "event-analysis-heading"
          }
        >
          <div
            id={eventAnalysisSectionContentId}
            role="tabpanel"
            aria-labelledby={
              variant === "event-analysis-only" ? "tab-event-analysis" : "event-analysis-heading"
            }
            className="space-y-5"
          >
            <h2
              id="event-analysis-subview-heading"
              className="text-xl font-semibold tracking-tight text-[var(--token-text-primary)]"
            >
              {`Event Analysis - ${getSubTabLabel(eventAnalysisTab, "event")}`}
            </h2>
            {!isControlledAnalysisSubTab && !ladderInEventAnalysis && (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)]/35 px-3 py-2 shadow-sm">
                <div className="min-w-0 flex-1 overflow-x-hidden">
                  <div className="flex min-w-0 flex-wrap">
                    {getSubTabOptions("event").map((tab) => {
                      const isActive = eventAnalysisTab === tab.id
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                            isActive
                              ? "border-[var(--token-accent)] text-[var(--token-accent)]"
                              : "border-transparent text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)]"
                          }`}
                          onClick={() => setEventAnalysisTab(tab.id)}
                        >
                          {tab.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
            {ladderInEventAnalysis ? (
              <>
                {eventAnalysisTab === "bump-ups" && (
                  <div
                    id={bumpUpsSectionContentId}
                    role="tabpanel"
                    aria-labelledby="event-analysis-subview-heading"
                    className="space-y-4"
                  >
                    <p className="w-full min-w-0 max-w-full text-sm leading-relaxed text-[var(--token-text-secondary)]">{`Bump-ups are promotions between finals rounds (toward the A-main), not exits from qualifying.`}</p>
                    {bumpUpClassNames.length > 0 && (
                      <div
                        className="mt-2 -mx-1 overflow-x-hidden"
                        role="toolbar"
                        aria-label="Filter bump-ups by racing class (from race data)"
                      >
                        <div className="flex flex-wrap gap-2 px-1 py-1">
                          {bumpUpClassNames.map((className, index) => {
                            const isActive = selectedClass === className
                            return (
                              <button
                                key={className}
                                type="button"
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                                  isActive
                                    ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                                    : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface)]/45"
                                }`}
                                onClick={() => {
                                  handleSessionClassChipClick(className)
                                }}
                                aria-pressed={isActive}
                                onKeyDown={(event) =>
                                  handleSessionToolbarClassKeyDown(
                                    event,
                                    index,
                                    classFilterButtonRefs,
                                    bumpUpClassNames.length
                                  )
                                }
                                ref={(el) => {
                                  classFilterButtonRefs.current[index] = el
                                }}
                              >
                                <span>{className}</span>
                              </button>
                            )
                          })}
                          <button
                            key="__all-classes-bump-ups__"
                            type="button"
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                              selectedClass === null
                                ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                                : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface)]/45"
                            }`}
                            onClick={() => {
                              handleSessionClassFilterAllClassesClick()
                            }}
                            aria-pressed={selectedClass === null}
                            onKeyDown={(event) =>
                              handleSessionToolbarClassKeyDown(
                                event,
                                bumpUpClassNames.length,
                                classFilterButtonRefs,
                                bumpUpClassNames.length
                              )
                            }
                            ref={(el) => {
                              classFilterButtonRefs.current[bumpUpClassNames.length] = el
                            }}
                          >
                            <span>All Classes</span>
                          </button>
                        </div>
                      </div>
                    )}
                    <div
                      className="w-full max-w-full rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 p-4 shadow-sm"
                      aria-live="polite"
                    >
                      {bumpUpClassCandidates.length === 0 ? (
                        <p className="text-sm text-[var(--token-text-primary)]">
                          No racing classes found in session results for this event.
                        </p>
                      ) : bumpUpClassNames.length === 0 ? (
                        <p className="text-sm text-[var(--token-text-primary)]">
                          No bump-up advancements could be inferred from published results for
                          ladder-eligible classes in this event.
                        </p>
                      ) : !hasBumpUpsClassSelected ? (
                        <DriverBumpUpsTable
                          rows={[]}
                          hasSelectedClass={false}
                          aggregatedRows={bumpUpRowsAggregated}
                        />
                      ) : (
                        <DriverBumpUpsTable rows={bumpUpRows} hasSelectedClass />
                      )}
                    </div>
                  </div>
                )}
                {eventAnalysisTab === "driver-progression" && (
                  <div
                    id={driverProgressionSectionContentId}
                    role="tabpanel"
                    aria-labelledby="event-analysis-subview-heading"
                    className="space-y-4"
                  >
                    <p className="w-full min-w-0 max-w-full text-sm leading-relaxed text-[var(--token-text-secondary)]">{`Driver progression shows each driver's finish in every main round, in ladder order from lower mains and LCQs toward the A-main. The class chips match Bump-Up scope (nitro mains only; electric and EP classes are omitted). A class is listed only when there are at least two mains ladder sessions in the results so a path across rounds is visible.`}</p>
                    {driverProgressionClassNames.length > 0 && (
                      <div
                        className="mt-2 -mx-1 overflow-x-hidden"
                        role="toolbar"
                        aria-label="Filter driver progression by racing class (from race data)"
                      >
                        <div className="flex flex-wrap gap-2 px-1 py-1">
                          {driverProgressionClassNames.map((className, index) => {
                            const isActive = selectedClass === className
                            return (
                              <button
                                key={className}
                                type="button"
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                                  isActive
                                    ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                                    : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface)]/45"
                                }`}
                                onClick={() => {
                                  handleSessionClassChipClick(className)
                                }}
                                aria-pressed={isActive}
                                onKeyDown={(event) =>
                                  handleSessionToolbarClassKeyDown(
                                    event,
                                    index,
                                    classFilterButtonRefs,
                                    driverProgressionClassNames.length
                                  )
                                }
                                ref={(el) => {
                                  classFilterButtonRefs.current[index] = el
                                }}
                              >
                                <span>{className}</span>
                              </button>
                            )
                          })}
                          <button
                            key="__all-classes-driver-progression__"
                            type="button"
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                              selectedClass === null
                                ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                                : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface)]/45"
                            }`}
                            onClick={() => {
                              handleSessionClassFilterAllClassesClick()
                            }}
                            aria-pressed={selectedClass === null}
                            onKeyDown={(event) =>
                              handleSessionToolbarClassKeyDown(
                                event,
                                driverProgressionClassNames.length,
                                classFilterButtonRefs,
                                driverProgressionClassNames.length
                              )
                            }
                            ref={(el) => {
                              classFilterButtonRefs.current[driverProgressionClassNames.length] = el
                            }}
                          >
                            <span>All Classes</span>
                          </button>
                        </div>
                      </div>
                    )}
                    <div
                      className="w-full max-w-full rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 p-4 shadow-sm"
                      aria-live="polite"
                    >
                      {driverProgressionClassNames.length === 0 ? (
                        <p className="text-sm text-[var(--token-text-primary)]">
                          No classes with multiple mains-ladder rounds (at least two of semi, LCQ,
                          mains) for driver progression in this event.
                        </p>
                      ) : !hasDriverProgressionClassSelected ? (
                        <p className="text-sm text-[var(--token-text-secondary)]">
                          Select a class above to see each driver&apos;s path through mains-ladder
                          rounds for that class.
                        </p>
                      ) : (
                        <DriverProgressionTable matrix={driverProgressionMatrix} />
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {eventAnalysisTab === "driver-analysis" && validClasses.length > 0 && (
                  <div
                    className="mt-2 -mx-1 overflow-x-hidden"
                    role="toolbar"
                    aria-label="Filter event driver analysis by class. All Classes shows every class; it is the last control."
                  >
                    <div className="flex flex-wrap gap-2 px-1 py-1">
                      {validClasses.map((className, index) => {
                        const isActive = selectedClass === className
                        return (
                          <button
                            key={className}
                            type="button"
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                              isActive
                                ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                                : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface)]/45"
                            }`}
                            onClick={() => {
                              handleSessionClassChipClick(className)
                            }}
                            aria-pressed={isActive}
                            onKeyDown={(event) =>
                              handleEventClassFilterKeyDown(event, index, classFilterButtonRefs)
                            }
                            ref={(el) => {
                              classFilterButtonRefs.current[index] = el
                            }}
                          >
                            <span>{className}</span>
                          </button>
                        )
                      })}
                      <button
                        key="__event-driver-analysis-all-classes__"
                        type="button"
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                          selectedClass === null
                            ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                            : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface)]/45"
                        }`}
                        onClick={() => {
                          handleSessionClassFilterAllClassesClick()
                        }}
                        aria-pressed={selectedClass === null}
                        onKeyDown={(event) =>
                          handleEventClassFilterKeyDown(
                            event,
                            validClasses.length,
                            classFilterButtonRefs
                          )
                        }
                        ref={(el) => {
                          classFilterButtonRefs.current[validClasses.length] = el
                        }}
                      >
                        <span>All Classes</span>
                      </button>
                    </div>
                  </div>
                )}
                {eventAnalysisTab === "driver-analysis" && (
                  <>
                    <section className="space-y-4">
                      <ChartControls
                        drivers={driverOptions}
                        races={data.races}
                        selectedDriverIds={selectedDriverIds}
                        onDriverSelectionChange={handleSelectionChange}
                        onClassChange={handleClassChange}
                        selectedClass={selectedClass}
                        eventId={data.event.id}
                        raceClasses={data.raceClasses}
                        onSelectAllClick={handleSelectAllClick}
                      />
                    </section>
                    <div className="space-y-1.5">
                      <h3
                        id="compare-driver-performance-heading"
                        className="text-lg font-semibold tracking-tight text-[var(--token-text-primary)]"
                      >
                        Compare driver performance
                      </h3>
                      <p className="max-w-3xl text-sm text-[var(--token-text-secondary)]">
                        Best lap, average lap, gap, and related metrics for the class from the chips
                        above and drivers in Actions. Switch column or line view and sort from the
                        chart header.
                      </p>
                    </div>
                    <div className="space-y-4">
                      {missingBestLapDriverNames.length > 0 && (
                        <ChartDataNotice
                          title="Some selected drivers have no recorded best lap"
                          description="LiveRC did not publish a best lap time for these drivers in the selected class, so they are hidden from the chart."
                          driverNames={missingBestLapDriverNames}
                          eventId={data.event.id}
                          noticeType="best-lap"
                        />
                      )}
                      {missingAvgVsFastestDriverNames.length > 0 && (
                        <ChartDataNotice
                          title="Missing average lap telemetry"
                          description="These drivers were selected, but the data feed does not include both best and average lap times for them."
                          driverNames={missingAvgVsFastestDriverNames}
                          eventId={data.event.id}
                          noticeType="avg-vs-fastest"
                        />
                      )}
                      <div
                        className="w-full min-w-0 rounded-lg border border-[var(--token-border-muted)]/90 bg-[var(--token-surface)]/25 px-3 py-2 shadow-sm"
                        style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
                        aria-label="Summary for chart scope"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-[var(--token-text-muted)]">
                              Best lap
                            </span>
                            <span className="font-mono text-sm tabular-nums text-[var(--token-text-secondary)]">
                              {formatLapTime(compareChartSummaryStrip.bestLapSeconds)}
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-[var(--token-text-muted)]">
                              Avg lap
                            </span>
                            <span className="font-mono text-sm tabular-nums text-[var(--token-text-secondary)]">
                              {formatLapTime(compareChartSummaryStrip.avgLapSeconds)}
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-[var(--token-text-muted)]">
                              Laps
                            </span>
                            <span className="text-sm tabular-nums text-[var(--token-text-secondary)]">
                              {compareChartSummaryStrip.lapCount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-[var(--token-text-muted)]">
                              Drivers
                            </span>
                            <span className="text-sm tabular-nums text-[var(--token-text-secondary)]">
                              {compareChartSummaryStrip.driverCount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChartSection>
                        <UnifiedPerformanceChart
                          data={unifiedChartData}
                          selectedDriverIds={expandedUnifiedChartDriverIds}
                          currentPage={currentPage}
                          driversPerPage={driversPerPage}
                          onPageChange={handlePageChange}
                          onDriverToggle={handleUnifiedChartDriverToggle}
                          chartInstanceId={`overview-${data.event.id}-unified`}
                          selectedClass={selectedClass}
                          allDriversInClassSelected={
                            allDriversInClassSelected && selectAllClickedForCurrentClass
                          }
                          chartView={chartViewState}
                          onChartViewChange={setChartViewState}
                          chartDriverOptions={driverStatsByClass.map((d) => ({
                            driverId: d.driverId,
                            driverName: d.driverName,
                          }))}
                          chartSelectedDriverIds={unifiedChartDriverIds}
                          onChartDriverSelectionChange={setUnifiedChartDriverIds}
                        />
                      </ChartSection>
                    </div>
                    <div className="space-y-1.5">
                      <h3
                        id="driver-analysis-overview-heading"
                        className="text-lg font-semibold tracking-tight text-[var(--token-text-primary)]"
                      >
                        Lap-by-lap trend
                      </h3>
                      <p className="max-w-3xl text-sm text-[var(--token-text-secondary)]">
                        Every lap time for the class and driver you pick below. Use{" "}
                        <span className="whitespace-nowrap">Display</span> on the chart for session
                        shading and the regression line.
                      </p>
                    </div>
                    <div id="lap-trend-overview-content" className="space-y-4">
                      <ChartSection>
                        {expandedSelectedDriverIds.length === 0 ? (
                          <div
                            className="flex items-center justify-center text-[var(--token-text-secondary)] rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] min-h-[400px]"
                            style={{
                              minWidth: 0,
                              backgroundColor: "var(--glass-bg)",
                              backdropFilter: "var(--glass-blur)",
                              borderRadius: 16,
                              border: "1px solid var(--glass-border)",
                              boxShadow: "var(--glass-shadow), var(--glass-shadow-lg)",
                            }}
                          >
                            Choose drivers in Actions (class or Select Drivers), then pick a class
                            and driver below to load lap times.
                          </div>
                        ) : (
                          <>
                            {lapTrendDriverOptions.length > MAX_LAP_TREND_DRIVERS &&
                              lapTrendChartDriverIds.length === MAX_LAP_TREND_DRIVERS && (
                                <p className="mb-2 text-sm text-[var(--token-text-secondary)]">
                                  Showing first {MAX_LAP_TREND_DRIVERS} of{" "}
                                  {lapTrendDriverOptions.length} selected. Use Drivers to add or
                                  change.
                                </p>
                              )}
                            <LapByLapTrendChart
                              drivers={
                                lapTrendData?.drivers?.some((d) => d.laps.length > 0)
                                  ? sortedLapTrendDrivers
                                  : []
                              }
                              height={450}
                              chartInstanceId={`overview-${data.event.id}-lap-trend`}
                              chartTitle={
                                selectedClass === null
                                  ? "All Classes"
                                  : (selectedClass ?? "All Classes")
                              }
                              headerControls={
                                <div className="flex flex-wrap items-center gap-4">
                                  {lapTrendDriverOptions.length > 0 && (
                                    <ChartDriverPicker
                                      drivers={lapTrendDriverOptions}
                                      selectedDriverIds={lapTrendChartDriverIds}
                                      onSelectionChange={setLapTrendChartDriverIds}
                                      label="Select Drivers"
                                      singleSelect
                                      disabled={selectedClass === null}
                                      disabledTooltip="Select a class with the chips above to choose drivers"
                                    />
                                  )}
                                </div>
                              }
                              emptyMessage={
                                lapTrendLoading
                                  ? "Loading lap data…"
                                  : (lapTrendError ??
                                    (lapTrendChartDriverIds.length === 0
                                      ? "Select a class with the chips above, then choose a driver from that class to view lap-by-lap data."
                                      : "No lap data for selected drivers."))
                              }
                            />
                          </>
                        )}
                      </ChartSection>
                    </div>
                  </>
                )}
                {eventClassFilterTabs.includes(eventAnalysisTab) && validClasses.length > 0 && (
                  <div
                    className="mt-2 -mx-1 overflow-x-hidden"
                    role="toolbar"
                    aria-label="Filter event analysis by class (event section). All Classes shows every class; it is the last control."
                  >
                    <div className="flex flex-wrap gap-2 px-1 py-1">
                      {validClasses.map((className, index) => {
                        const isActive = eventClassFilter === className
                        return (
                          <button
                            key={className}
                            type="button"
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                              isActive
                                ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                                : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface)]/45"
                            }`}
                            onClick={() => {
                              handleEventClassFilterClick(className)
                            }}
                            aria-pressed={isActive}
                            onKeyDown={(event) =>
                              handleEventClassFilterKeyDown(
                                event,
                                index,
                                eventSectionClassFilterButtonRefs
                              )
                            }
                            ref={(el) => {
                              eventSectionClassFilterButtonRefs.current[index] = el
                            }}
                          >
                            <span>{className}</span>
                          </button>
                        )
                      })}
                      <button
                        key="__event-section-all-classes__"
                        type="button"
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                          eventClassFilter === null
                            ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                            : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface)]/45"
                        }`}
                        onClick={() => {
                          handleEventClassFilterAllClassesClick()
                        }}
                        aria-pressed={eventClassFilter === null}
                        onKeyDown={(event) =>
                          handleEventClassFilterKeyDown(
                            event,
                            validClasses.length,
                            eventSectionClassFilterButtonRefs
                          )
                        }
                        ref={(el) => {
                          eventSectionClassFilterButtonRefs.current[validClasses.length] = el
                        }}
                      >
                        <span>All Classes</span>
                      </button>
                    </div>
                  </div>
                )}
                {eventAnalysisTab === "event-results" && (
                  <div className="space-y-6">
                    <MainBracketResultsTable
                      races={eventClassFilter ? eventLevelFilteredRaces : data.races}
                    />
                    <MultiMainOverallCard
                      multiMainResults={data.multiMainResults}
                      activeClassLabel={eventClassFilter}
                    />
                  </div>
                )}
                {eventAnalysisTab === "fastest-laps" && (
                  <EventTopFastestLapsPerClassTable
                    races={eventClassFilter ? eventLevelFilteredRaces : data.races}
                  />
                )}
                {eventAnalysisTab === "fastest-average-laps" && (
                  <EventTopAverageLapsPerClassTable
                    races={eventClassFilter ? eventLevelFilteredRaces : data.races}
                  />
                )}
              </>
            )}
          </div>

          {!ladderInEventAnalysis && eventAnalysisTab !== "driver-analysis" && (
            <section className="space-y-4">
              <ChartControls
                drivers={driverOptions}
                races={data.races}
                selectedDriverIds={selectedDriverIds}
                onDriverSelectionChange={handleSelectionChange}
                onClassChange={handleClassChange}
                selectedClass={selectedClass}
                eventId={data.event.id}
                raceClasses={data.raceClasses}
                onSelectAllClick={handleSelectAllClick}
              />
            </section>
          )}
        </section>
      )}
      {showSessionAnalysisSectionBlock && (
        <section
          className="space-y-3"
          aria-labelledby={
            variant === "session-analysis-only"
              ? "tab-session-analysis"
              : "session-analysis-heading"
          }
        >
          <div
            id={sessionAnalysisSectionContentId}
            role="tabpanel"
            aria-labelledby="session-analysis-subview-heading"
            className="space-y-3"
          >
            <h2
              id="session-analysis-subview-heading"
              className="text-xl font-semibold tracking-tight text-[var(--token-text-primary)]"
            >
              {`Session Analysis - ${getSubTabLabel(eventAnalysisTab, "session")}`}
            </h2>
            {!isControlledAnalysisSubTab && (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)]/35 px-3 py-2 shadow-sm">
                <div className="min-w-0 flex-1 overflow-x-hidden">
                  <div className="flex min-w-0 flex-wrap">
                    {getSubTabOptions("session").map((tab) => {
                      const isActive = eventAnalysisTab === tab.id
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                            isActive
                              ? "border-[var(--token-accent)] text-[var(--token-accent)]"
                              : "border-transparent text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)]"
                          }`}
                          onClick={() => setEventAnalysisTab(tab.id)}
                        >
                          {tab.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
            {(eventClassFilterTabs.includes(eventAnalysisTab) ||
              eventAnalysisTab === "driver-analysis") &&
              validClasses.length > 0 && (
                <div className="mt-2 space-y-2">
                  <div
                    className="-mx-1 overflow-x-hidden"
                    role="toolbar"
                    aria-label="Filter session analysis by class (charts and driver selection). All Classes shows every class; it is the last control."
                  >
                    <div className="flex flex-wrap gap-2 px-1 py-1">
                      {validClasses.map((className, index) => {
                        const isActive = selectedClass === className
                        return (
                          <button
                            key={className}
                            type="button"
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                              isActive
                                ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                                : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface)]/45"
                            }`}
                            onClick={() => {
                              handleSessionClassChipClick(className)
                            }}
                            aria-pressed={isActive}
                            onKeyDown={(event) =>
                              handleEventClassFilterKeyDown(event, index, classFilterButtonRefs)
                            }
                            ref={(el) => {
                              classFilterButtonRefs.current[index] = el
                            }}
                          >
                            <span>{className}</span>
                          </button>
                        )
                      })}
                      <button
                        key="__all-classes__"
                        type="button"
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                          selectedClass === null
                            ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                            : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface)]/45"
                        }`}
                        onClick={() => {
                          handleSessionClassFilterAllClassesClick()
                        }}
                        aria-pressed={selectedClass === null}
                        onKeyDown={(event) =>
                          handleEventClassFilterKeyDown(
                            event,
                            validClasses.length,
                            classFilterButtonRefs
                          )
                        }
                        ref={(el) => {
                          classFilterButtonRefs.current[validClasses.length] = el
                        }}
                      >
                        <span>All Classes</span>
                      </button>
                    </div>
                  </div>
                  {vehicleDenormActive &&
                    selectedClass !== null &&
                    sessionSkillTierOptions.length > 0 && (
                      <div
                        className="-mx-1 overflow-x-hidden"
                        role="toolbar"
                        aria-label="Filter session analysis by skill tier"
                      >
                        <div className="flex flex-wrap items-center gap-2 px-1 py-1">
                          <span className="text-xs text-[var(--token-text-muted)]">Tier</span>
                          <button
                            type="button"
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                              sessionSkillTierFilter === null
                                ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                                : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface)]/45"
                            }`}
                            onClick={() => setSessionSkillTierFilter(null)}
                            aria-pressed={sessionSkillTierFilter === null}
                          >
                            All
                          </button>
                          {sessionSkillTierOptions.map((tier) => {
                            const isTierActive = sessionSkillTierFilter === tier
                            return (
                              <button
                                key={tier}
                                type="button"
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                                  isTierActive
                                    ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                                    : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface)]/45"
                                }`}
                                onClick={() =>
                                  setSessionSkillTierFilter(isTierActive ? null : tier)
                                }
                                aria-pressed={isTierActive}
                              >
                                {tier}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                </div>
              )}
            {eventAnalysisTab === "driver-analysis" && (
              <>
                <section className="space-y-4">
                  <ChartControls
                    drivers={driverOptions}
                    races={data.races}
                    selectedDriverIds={selectedDriverIds}
                    onDriverSelectionChange={handleSelectionChange}
                    onClassChange={handleClassChange}
                    selectedClass={selectedClass}
                    eventId={data.event.id}
                    raceClasses={data.raceClasses}
                    onSelectAllClick={handleSelectAllClick}
                  />
                </section>
                {selectedClass === null ? (
                  <p className="text-sm text-[var(--token-text-secondary)]">
                    {vehicleDenormActive
                      ? "Select a race class using the chips above (or Actions → Select drivers) to compare drivers within that class."
                      : "Select a class using the chips above or in Actions (Select drivers) to compare drivers within a single session."}
                  </p>
                ) : sessionDriverAnalysisSortedRaces.length === 0 ? (
                  <p className="text-sm text-[var(--token-text-secondary)]">
                    No sessions found for this class.
                  </p>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <h3
                        id="session-compare-driver-performance-heading"
                        className="text-lg font-semibold tracking-tight text-[var(--token-text-primary)]"
                      >
                        Compare driver performance (this session)
                      </h3>
                      <p className="max-w-3xl text-sm text-[var(--token-text-secondary)]">
                        Best lap, average lap, gap, and related metrics for the selected session
                        only. When LiveRC data is ingested, use the{" "}
                        <span className="whitespace-nowrap">LiveRC</span> dropdown or the legend
                        below for Avg Top 5–15, consecutive laps, and std. dev. Class comes from the
                        chips above or Actions; use{" "}
                        <span className="whitespace-nowrap">Session</span> in the chart header to
                        pick the race for this class.
                      </p>
                    </div>
                    <div className="space-y-4">
                      {sessionMissingBestLapDriverNames.length > 0 && (
                        <ChartDataNotice
                          title="Some selected drivers have no recorded best lap"
                          description="LiveRC did not publish a best lap time for these drivers in this session, so they are hidden from the chart."
                          driverNames={sessionMissingBestLapDriverNames}
                          eventId={data.event.id}
                          noticeType="best-lap"
                        />
                      )}
                      {sessionMissingAvgVsFastestDriverNames.length > 0 && (
                        <ChartDataNotice
                          title="Missing average lap telemetry"
                          description="These drivers were selected, but the data feed does not include both best and average lap times for them in this session."
                          driverNames={sessionMissingAvgVsFastestDriverNames}
                          eventId={data.event.id}
                          noticeType="avg-vs-fastest"
                        />
                      )}
                      <div
                        className="w-full min-w-0 rounded-lg border border-[var(--token-border-muted)]/90 bg-[var(--token-surface)]/25 px-3 py-2 shadow-sm"
                        style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
                        aria-label="Summary for session chart scope"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-[var(--token-text-muted)]">
                              Best lap
                            </span>
                            <span className="font-mono text-sm tabular-nums text-[var(--token-text-secondary)]">
                              {formatLapTime(sessionCompareChartSummaryStrip.bestLapSeconds)}
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-[var(--token-text-muted)]">
                              Avg lap
                            </span>
                            <span className="font-mono text-sm tabular-nums text-[var(--token-text-secondary)]">
                              {formatLapTime(sessionCompareChartSummaryStrip.avgLapSeconds)}
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-[var(--token-text-muted)]">
                              Laps
                            </span>
                            <span className="text-sm tabular-nums text-[var(--token-text-secondary)]">
                              {sessionCompareChartSummaryStrip.lapCount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-[var(--token-text-muted)]">
                              Drivers
                            </span>
                            <span className="text-sm tabular-nums text-[var(--token-text-secondary)]">
                              {sessionCompareChartSummaryStrip.driverCount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChartSection>
                        <UnifiedPerformanceChart
                          data={sessionUnifiedChartData}
                          selectedDriverIds={expandedSessionUnifiedChartDriverIds}
                          currentPage={currentPageSession}
                          driversPerPage={driversPerPage}
                          onPageChange={handleSessionPageChange}
                          onDriverToggle={handleUnifiedChartDriverToggle}
                          chartInstanceId={`overview-${data.event.id}-session-unified`}
                          chartTitleOverride=""
                          chartDriverPickerDisabled={
                            sessionAnalysisRequiresSessionTypeChoice &&
                            sessionAnalysisSessionTypeFilter === null
                          }
                          chartDriverPickerDisabledTooltip="Select a session type first"
                          selectedClass={selectedClass}
                          allDriversInClassSelected={
                            allSessionRaceDriversSelected && selectAllClickedForCurrentClass
                          }
                          chartView={chartViewState}
                          onChartViewChange={setChartViewState}
                          chartDriverOptions={sessionDriverAnalysisDriverStatsFromRace.map((d) => ({
                            driverId: d.driverId,
                            driverName: d.driverName,
                          }))}
                          chartSelectedDriverIds={unifiedChartDriverIds}
                          onChartDriverSelectionChange={setUnifiedChartDriverIds}
                          headerAfterClassSelect={renderSessionScopeControls(
                            "session-driver-analysis-compare",
                            sessionDriverAnalysisScopedRaces,
                            "Choose session for compare chart"
                          )}
                          liveRcSessionScope
                        />
                      </ChartSection>
                    </div>
                    <div className="space-y-1.5">
                      <h3
                        id="session-lap-by-lap-heading"
                        className="text-lg font-semibold tracking-tight text-[var(--token-text-primary)]"
                      >
                        Lap-by-lap (this session)
                      </h3>
                      <p className="max-w-3xl text-sm text-[var(--token-text-secondary)]">
                        Lap times for the selected session only. Choose up to{" "}
                        {MAX_LAP_TREND_DRIVERS} drivers to compare; axes use lap number within this
                        session.
                      </p>
                    </div>
                    <div id="session-lap-trend-content" className="space-y-4">
                      <ChartSection>
                        {expandedSelectedDriverIds.length === 0 ? (
                          <div
                            className="flex items-center justify-center text-[var(--token-text-secondary)] rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] min-h-[400px]"
                            style={{
                              minWidth: 0,
                              backgroundColor: "var(--glass-bg)",
                              backdropFilter: "var(--glass-blur)",
                              borderRadius: 16,
                              border: "1px solid var(--glass-border)",
                              boxShadow: "var(--glass-shadow), var(--glass-shadow-lg)",
                            }}
                          >
                            Choose drivers in Actions (class or Select Drivers), then pick drivers
                            below for lap-by-lap data in this session.
                          </div>
                        ) : (
                          <>
                            {sessionLapTrendDriverOptions.length > MAX_LAP_TREND_DRIVERS &&
                              sessionLapTrendChartDriverIds.length === MAX_LAP_TREND_DRIVERS && (
                                <p className="mb-2 text-sm text-[var(--token-text-secondary)]">
                                  Showing first {MAX_LAP_TREND_DRIVERS} of{" "}
                                  {sessionLapTrendDriverOptions.length} eligible. Use Drivers to add
                                  or change.
                                </p>
                              )}
                            <LapByLapTrendChart
                              drivers={
                                lapTrendData?.drivers?.some((d) => d.laps.length > 0)
                                  ? sortedSessionLapTrendDrivers
                                  : []
                              }
                              height={450}
                              chartInstanceId={`overview-${data.event.id}-session-lap-trend`}
                              chartTitle=""
                              headerControls={
                                <>
                                  {renderSessionScopeControls(
                                    "session-lap-trend",
                                    sessionDriverAnalysisScopedRaces,
                                    "Choose session for lap-by-lap chart"
                                  )}
                                  {sessionLapTrendDriverOptions.length > 0 && (
                                    <ChartDriverPicker
                                      drivers={sessionLapTrendDriverOptions}
                                      selectedDriverIds={sessionLapTrendChartDriverIds}
                                      onSelectionChange={(ids) =>
                                        setSessionLapTrendChartDriverIds(
                                          ids.slice(0, MAX_LAP_TREND_DRIVERS)
                                        )
                                      }
                                      label="Select Drivers"
                                      disabled={
                                        sessionAnalysisRequiresSessionTypeChoice &&
                                        sessionAnalysisSessionTypeFilter === null
                                      }
                                      disabledTooltip="Select a session type first"
                                    />
                                  )}
                                </>
                              }
                              emptyMessage={
                                lapTrendLoading
                                  ? "Loading lap data…"
                                  : (lapTrendError ??
                                    (sessionLapTrendChartDriverIds.length === 0
                                      ? "Choose one or more drivers above to view lap-by-lap data for this session."
                                      : "No lap data for selected drivers in this session."))
                              }
                            />
                          </>
                        )}
                      </ChartSection>
                    </div>
                  </>
                )}
              </>
            )}
            {eventAnalysisTab === "event-results" && (
              <SessionRaceResultsTable races={sessionAnalysisRaces} />
            )}
            {eventAnalysisTab === "fastest-laps" && (
              <EventFastestLapsTable
                races={
                  selectedClass && eventClassFilterTabs.includes("fastest-laps")
                    ? sessionAnalysisRaces
                    : data.races
                }
              />
            )}
            {eventAnalysisTab === "fastest-average-laps" && (
              <EventFastestAverageLapsTable
                races={
                  selectedClass && eventClassFilterTabs.includes("fastest-average-laps")
                    ? sessionAnalysisRaces
                    : data.races
                }
              />
            )}
          </div>
        </section>
      )}
    </div>
  )
}
