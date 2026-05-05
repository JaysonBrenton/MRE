/**
 * @fileoverview Overview tab component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-04-24
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

import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react"
import EventOverviewTopQualifiers from "./EventOverviewTopQualifiers"
import {
  EventOverviewVenueHostTabList,
  type VenueHostSubTab,
} from "./EventOverviewVenueHostTabList"
import { OverviewEventDetailsSectionHeading } from "./OverviewEventDetailsSectionHeading"
import { OverviewTriColumnSummary } from "./OverviewTriColumnSummary"
import { OverviewVenueContactFields, OverviewVenueDetailPanel } from "./OverviewVenueDetailPanel"
import { MapSearchAddressLink } from "@/components/molecules/MapSearchAddressLink"
import WeatherCard from "./WeatherCard"
import { EventWeatherAtAGlance } from "./EventWeatherAtAGlance"
import { EventHighlightsMixFilteredChart } from "./EventHighlightsMixCharts"
import EventTopFastestLapsPerClassTable from "./EventTopFastestLapsPerClassTable"
import EventTopAverageLapsPerClassTable from "./EventTopAverageLapsPerClassTable"
import EventFastestLapsTable from "./EventFastestLapsTable"
import EventFastestAverageLapsTable from "./EventFastestAverageLapsTable"
import ChartControls from "./ChartControls"
import UnifiedPerformanceChart, { type ChartViewType } from "./UnifiedPerformanceChart"
import ChartSection from "./ChartSection"
import ChartDriverPicker from "./ChartDriverPicker"
import EventAnalysisScopeFilters from "./EventAnalysisScopeFilters"
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
import { splitAddressForDisplay } from "@/lib/address-normalization"
import { formatDateLong } from "@/lib/date-utils"
import { formatLapTime } from "@/lib/format-session-data"
import { typography } from "@/lib/typography"
import { computeDriverStatsFromRaces } from "@/core/events/compute-driver-stats-from-races"
import {
  EVENT_DETAILS_EMPTY_STATE_CLASS,
  EVENT_DETAILS_SECTION_SURFACE_CLASS,
  EVENT_DETAILS_STATS_GRID_CLASS,
  EVENT_DETAILS_STATS_STRIP_WELL_CLASS,
  EVENT_DETAILS_TAB_PANEL_WELL_CLASS,
  EVENT_DETAILS_WEATHER_INFO_CALLOUT_CLASS,
  OVERVIEW_GLASS_SURFACE_STYLE,
  OVERVIEW_SECTION_SURFACE_CLASS,
} from "@/components/organisms/event-analysis/overview-glass-surface"
import {
  type EventAnalysisSubTabId,
  getSubTabLabel,
  getSubTabOptions,
} from "@/components/organisms/event-analysis/event-analysis-sub-tabs"
import { isPlaceholderClass, isSchedulePlaceholderLiveRcRow } from "@/lib/format-class-name"
import {
  UNCLASSIFIED_CLASS_KEY,
  eventHasVehicleDenormalization,
  type RaceAnalysisRow,
} from "@/core/events/session-analysis-filters"
import { getSessionAnalysisNavClassOptions } from "@/core/events/entry-list-class-options"
import { isEventMainSession } from "@/core/events/main-bracket-overall"
import { buildEventHighlights } from "@/core/events/build-event-highlights"

/** Shared chrome for Host / Track / Weather / Mix tab panels in Event details. */
const EVENT_DETAILS_TABPANEL_CHROME = [
  "min-w-0 w-full max-w-full text-sm",
  EVENT_DETAILS_TAB_PANEL_WELL_CLASS,
].join(" ")

/** Sub-tabs whose tables share Session / Type scope filters (race class + taxonomy). */
const EVENT_CLASS_FILTER_SUB_TABS: EventAnalysisSubTabId[] = [
  "event-results",
  "fastest-laps",
  "fastest-average-laps",
]

/** Sub-tabs that show LiveRC program-bucket class nav in Session Analysis (includes driver-analysis). */
const EVENT_CLASS_SESSION_NAV_TABS: EventAnalysisSubTabId[] = [
  ...EVENT_CLASS_FILTER_SUB_TABS,
  "driver-analysis",
]

/** Derived session start, else LiveRC Time Completed (LiveRC wall clock). */
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

/** LiveRC-style session title only (no time / index), for nav and chart pills. */
function liveRcCompactRaceLabel(
  race: SessionRaceOptionFields,
  selectedClass: string | null
): string {
  const core =
    selectedClass !== null && race.className === selectedClass
      ? trimClassPrefixFromRaceLabel(race.raceLabel, selectedClass)
      : race.raceLabel
  return core.trim()
}

export interface OverviewTabProps {
  data: EventAnalysisData
  selectedDriverIds: string[]
  onDriverSelectionChange: (driverIds: string[]) => void
  selectedClass: string | null
  onClassChange: (className: string | null) => void
  /** Top-level dashboard tab: only that section’s content (no inner overview subsection strip). */
  variant?:
    | "default"
    | "event-overview-minimal"
    | "event-overview-only"
    | "event-analysis-only"
    | "session-analysis-only"
  /** Controlled sub-view when parent owns toolbar dropdown (`event-analysis-only` / `session-analysis-only`). */
  analysisSubTab?: EventAnalysisSubTabId
  onAnalysisSubTabChange?: (id: EventAnalysisSubTabId) => void
  /** Renders above the “Event details” heading (e.g. dashboard tab strip for Event Overview tabs). */
  toolbarAboveEventDetails?: ReactNode
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

const EVENT_OVERVIEW_WEATHER_INFO_TEXT =
  "Forecast and conditions for the event venue by calendar day, when available from the weather service."

export default function OverviewTab({
  data,
  selectedDriverIds,
  onDriverSelectionChange,
  selectedClass,
  onClassChange,
  variant = "default",
  analysisSubTab: analysisSubTabProp,
  onAnalysisSubTabChange,
  toolbarAboveEventDetails,
}: OverviewTabProps) {
  const lastLoggedMissingState = useRef<string | null>(null)
  const lastLoggedUnselectedInClassState = useRef<string | null>(null)

  const { weatherByDay, weatherLoading, weatherError } = useEventWeather(
    data.event.id,
    data.userHostTrack?.trackId ?? null
  )
  const [overviewPrimarySection, setOverviewPrimarySection] = useState<OverviewPrimarySection>(
    () => {
      switch (variant) {
        case "event-overview-minimal":
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
  const [venueHostTab, setVenueHostTab] = useState<VenueHostSubTab>("eventHost")
  const isControlledAnalysisSubTab =
    analysisSubTabProp !== undefined && onAnalysisSubTabChange !== undefined
  const [internalAnalysisSubTab, setInternalAnalysisSubTab] =
    useState<EventAnalysisSubTabId>("event-results")
  const eventAnalysisTab = isControlledAnalysisSubTab ? analysisSubTabProp! : internalAnalysisSubTab
  const setEventAnalysisTab = isControlledAnalysisSubTab
    ? onAnalysisSubTabChange!
    : setInternalAnalysisSubTab
  const [eventClassFilter, setEventClassFilter] = useState<string | null>(null)
  /** Car taxonomy leaf id when user selects a mapping chip (event-scoped: only nodes that appear on this event's races). */
  const [eventTaxonomyNodeFilter, setEventTaxonomyNodeFilter] = useState<string | null>(null)
  /** Session/Type scope for Event Analysis → compare chart only (independent of lap-trend + tables). */
  const [driverCompareEventClassFilter, setDriverCompareEventClassFilter] = useState<string | null>(
    null
  )
  const [driverCompareEventTaxonomyNodeFilter, setDriverCompareEventTaxonomyNodeFilter] = useState<
    string | null
  >(null)
  /** Session/Type scope for Event Analysis → lap-by-lap chart only. */
  const [driverLapTrendEventClassFilter, setDriverLapTrendEventClassFilter] = useState<
    string | null
  >(null)
  const [driverLapTrendEventTaxonomyNodeFilter, setDriverLapTrendEventTaxonomyNodeFilter] =
    useState<string | null>(null)
  const classFilterButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const liveRcSessionNavChipRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (isControlledAnalysisSubTab) return
    queueMicrotask(() => setInternalAnalysisSubTab("event-results"))
  }, [data.event.id, isControlledAnalysisSubTab])

  useEffect(() => {
    queueMicrotask(() => setEventTaxonomyNodeFilter(null))
  }, [data.event.id])

  useEffect(() => {
    queueMicrotask(() => {
      setDriverCompareEventClassFilter(null)
      setDriverCompareEventTaxonomyNodeFilter(null)
      setDriverLapTrendEventClassFilter(null)
      setDriverLapTrendEventTaxonomyNodeFilter(null)
    })
  }, [data.event.id])

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

  const [sessionAnalysisSessionRaceId, setSessionAnalysisSessionRaceId] = useState<string | null>(
    null
  )
  const [sessionLapTrendChartDriverIds, setSessionLapTrendChartDriverIds] = useState<string[]>([])

  const eventClassFilterTabs = EVENT_CLASS_SESSION_NAV_TABS

  // Get race classes from entry list
  const validClasses = useMemo(() => getValidClasses(data), [data])

  const totalClassesCount = useMemo(
    () =>
      data.registrationClassNames && data.registrationClassNames.length > 0
        ? data.registrationClassNames.length
        : validClasses.length > 0
          ? validClasses.length
          : data.raceClasses.size,
    [data.registrationClassNames, data.raceClasses, validClasses]
  )

  /** Full-width persistent summary under Event details tabs (same metrics on every tab). */
  const eventDetailsPersistentStatsStrip = useMemo(
    () => (
      <div
        className={`min-w-0 w-full shrink-0 ${EVENT_DETAILS_STATS_STRIP_WELL_CLASS}`}
        role="region"
        aria-labelledby="overview-event-summary-title"
      >
        <span id="overview-event-summary-title" className="sr-only">
          Event summary
        </span>
        <div
          className={[
            "grid min-w-0 w-full max-w-full justify-items-start text-left",
            "grid-cols-2 gap-x-4 gap-y-3",
            "sm:grid-cols-3 sm:gap-x-5",
            "md:grid-cols-5 md:gap-x-4 md:gap-y-2",
            EVENT_DETAILS_STATS_GRID_CLASS,
          ].join(" ")}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={typography.overviewMetricLabel}>Races</span>
            <span className={typography.overviewMetricValue}>
              {data.summary.totalRaces.toLocaleString()}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={typography.overviewMetricLabel}>Drivers</span>
            <span className={typography.overviewMetricValue}>
              {data.summary.totalDrivers.toLocaleString()}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={typography.overviewMetricLabel}>Entries</span>
            <span className={typography.overviewMetricValue}>
              {data.entryList.length.toLocaleString()}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={typography.overviewMetricLabel}>Total Laps</span>
            <span className={typography.overviewMetricValue}>
              {data.summary.totalLaps.toLocaleString()}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={typography.overviewMetricLabel}>Total Classes</span>
            <span className={typography.overviewMetricValue}>
              {totalClassesCount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    ),
    [
      data.summary.totalRaces,
      data.summary.totalDrivers,
      data.summary.totalLaps,
      data.entryList.length,
      totalClassesCount,
    ]
  )

  const eventHighlightsModel = useMemo(() => buildEventHighlights(data), [data])

  const venueHostSection = useMemo(() => {
    const e = data.event
    const hasAddress = !!(e.address && typeof e.address === "string" && e.address.trim())
    const hasPhone = !!(e.phone && typeof e.phone === "string" && e.phone.trim())
    const hasWebsite = !!(e.website && typeof e.website === "string" && e.website.trim())
    const hasEmail = !!(e.email && typeof e.email === "string" && e.email.trim())
    const hasFacebook = !!(
      e.facebookUrl &&
      typeof e.facebookUrl === "string" &&
      e.facebookUrl.trim()
    )
    const hasVenueInfo = hasAddress || hasPhone || hasWebsite || hasEmail || hasFacebook

    const h = data.userHostTrack
    let hasHostBlock = false
    let hostHasAddress = false
    let hostHasPhone = false
    let hostHasWebsite = false
    let hostHasEmail = false
    let hostHasFacebook = false
    if (h) {
      hostHasAddress = !!(h.address && typeof h.address === "string" && h.address.trim())
      hostHasPhone = !!(h.phone && typeof h.phone === "string" && h.phone.trim())
      hostHasWebsite = !!(h.website && typeof h.website === "string" && h.website.trim())
      hostHasEmail = !!(h.email && typeof h.email === "string" && h.email.trim())
      hostHasFacebook = !!(
        h.facebookUrl &&
        typeof h.facebookUrl === "string" &&
        h.facebookUrl.trim()
      )
      hasHostBlock = !!(
        h.trackName ||
        hostHasAddress ||
        hostHasPhone ||
        hostHasWebsite ||
        hostHasEmail ||
        hostHasFacebook
      )
    }

    if (!hasVenueInfo && !hasHostBlock) return null

    return {
      hasVenueInfo,
      hasHostBlock,
      venue: {
        hasAddress,
        hasPhone,
        hasWebsite,
        hasEmail,
        hasFacebook,
        event: e,
      },
      host:
        hasHostBlock && h
          ? {
              h,
              hostHasAddress,
              hostHasPhone,
              hostHasWebsite,
              hostHasEmail,
              hostHasFacebook,
            }
          : null,
    }
  }, [data.event, data.userHostTrack])

  /** Contact lines for minimal event overview tri-column (event host preferred, then host track). */
  const eventOverviewMinimalContactSlot = useMemo(() => {
    const livercTrackUrl = data.event.trackDashboardUrl?.trim() || null

    const fieldsWithLiverc = (params: {
      phone?: string | null
      website?: string | null
      email?: string | null
      facebookUrl?: string | null
    }) => (
      <OverviewVenueContactFields
        phone={params.phone}
        website={params.website}
        email={params.email}
        facebookUrl={params.facebookUrl}
        livercTrackUrl={livercTrackUrl}
      />
    )

    const v = venueHostSection
    if (!v) {
      if (!livercTrackUrl) return null
      return fieldsWithLiverc({})
    }

    const e = v.venue.event
    const hasEventContact =
      v.venue.hasPhone || v.venue.hasWebsite || v.venue.hasEmail || v.venue.hasFacebook
    if (hasEventContact) {
      return fieldsWithLiverc({
        phone: v.venue.hasPhone ? e.phone : null,
        website: v.venue.hasWebsite ? e.website : null,
        email: v.venue.hasEmail ? e.email : null,
        facebookUrl: v.venue.hasFacebook ? e.facebookUrl : null,
      })
    }

    const host = v.host
    if (!host) {
      if (!livercTrackUrl) return null
      return fieldsWithLiverc({})
    }

    const hasHostContact =
      host.hostHasPhone || host.hostHasWebsite || host.hostHasEmail || host.hostHasFacebook
    if (!hasHostContact) {
      if (!livercTrackUrl) return null
      return fieldsWithLiverc({})
    }

    const h = host.h
    return fieldsWithLiverc({
      phone: host.hostHasPhone ? h.phone : null,
      website: host.hostHasWebsite ? h.website : null,
      email: host.hostHasEmail ? h.email : null,
      facebookUrl: host.hostHasFacebook ? h.facebookUrl : null,
    })
  }, [venueHostSection, data.event.trackDashboardUrl])

  const visibleVenueHostWeatherTabs = useMemo(() => {
    const tabs: VenueHostSubTab[] = []
    if (venueHostSection?.hasVenueInfo) tabs.push("eventHost")
    if (venueHostSection?.hasHostBlock) tabs.push("hostTrack")
    tabs.push("eventWeather")
    tabs.push("eventMix")
    return tabs
  }, [venueHostSection])

  const resolvedVenueHostTab = useMemo((): VenueHostSubTab => {
    const tabs = visibleVenueHostWeatherTabs
    if (tabs.length === 0) return "eventHost"
    if (tabs.includes(venueHostTab)) return venueHostTab
    return tabs[0]!
  }, [visibleVenueHostWeatherTabs, venueHostTab])

  const venueHostShowsTabStrip = visibleVenueHostWeatherTabs.length >= 2

  /** Distinct user car taxonomy targets that appear on this event (mains scope matches validClasses). */
  const eventTaxonomyMappingChips = useMemo(() => {
    const scopeMainsOnly = data.isPracticeDay !== true
    const candidates = scopeMainsOnly ? data.races.filter((r) => isEventMainSession(r)) : data.races
    const byNode = new Map<string, string>()
    for (const r of candidates) {
      const t = r.userCarTaxonomy
      if (!t) continue
      if (!byNode.has(t.taxonomyNodeId)) {
        byNode.set(t.taxonomyNodeId, t.pathLabel)
      }
    }
    return Array.from(byNode.entries())
      .map(([taxonomyNodeId, label]) => ({ taxonomyNodeId, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
  }, [data.races, data.isPracticeDay])

  useEffect(() => {
    if (eventTaxonomyNodeFilter == null) return
    if (!eventTaxonomyMappingChips.some((c) => c.taxonomyNodeId === eventTaxonomyNodeFilter)) {
      queueMicrotask(() => setEventTaxonomyNodeFilter(null))
    }
  }, [eventTaxonomyNodeFilter, eventTaxonomyMappingChips])

  useEffect(() => {
    if (driverCompareEventTaxonomyNodeFilter == null) return
    if (
      !eventTaxonomyMappingChips.some(
        (c) => c.taxonomyNodeId === driverCompareEventTaxonomyNodeFilter
      )
    ) {
      queueMicrotask(() => setDriverCompareEventTaxonomyNodeFilter(null))
    }
  }, [driverCompareEventTaxonomyNodeFilter, eventTaxonomyMappingChips])

  useEffect(() => {
    if (driverLapTrendEventTaxonomyNodeFilter == null) return
    if (
      !eventTaxonomyMappingChips.some(
        (c) => c.taxonomyNodeId === driverLapTrendEventTaxonomyNodeFilter
      )
    ) {
      queueMicrotask(() => setDriverLapTrendEventTaxonomyNodeFilter(null))
    }
  }, [driverLapTrendEventTaxonomyNodeFilter, eventTaxonomyMappingChips])

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

  const sessionClassFilteredRaces = useMemo(() => {
    if (!vehicleDenormActive) return []
    return filteredRaces
  }, [vehicleDenormActive, filteredRaces])

  const sessionAnalysisRaces = useMemo(() => {
    if (vehicleDenormActive) return sessionClassFilteredRaces
    return filteredRaces
  }, [vehicleDenormActive, sessionClassFilteredRaces, filteredRaces])

  /** All classes: LiveRC race numbers within each round for session name labels when a class is selected. */
  const sessionAnalysisRaceLabelContextRaces = useMemo(
    () =>
      sessionAnalysisBaseRaces.filter(
        (r) => !isSchedulePlaceholderLiveRcRow(r.className, r.raceLabel)
      ),
    [sessionAnalysisBaseRaces]
  )

  const sessionDriverAnalysisSortedRaces = useMemo(
    () =>
      sortRacesChronologically(sessionAnalysisRaces).filter(
        (r) => !isSchedulePlaceholderLiveRcRow(r.className, r.raceLabel)
      ),
    [sessionAnalysisRaces]
  )

  /** Program bucket pills (LiveRC session types); `programBucketOrder` when ingested, else entry list. */
  const sessionAnalysisNavClassOptions = useMemo(
    () => getSessionAnalysisNavClassOptions(data),
    [data]
  )

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
    const scopeMainsOnly = data.isPracticeDay !== true
    const mainsScoped = scopeMainsOnly
      ? data.races.filter((r) => isEventMainSession(r))
      : data.races
    if (eventTaxonomyNodeFilter != null) {
      return mainsScoped.filter(
        (race) => race.userCarTaxonomy?.taxonomyNodeId === eventTaxonomyNodeFilter
      )
    }
    if (!eventClassFilter) return mainsScoped
    return mainsScoped.filter((race) => race.className === eventClassFilter)
  }, [data.races, data.isPracticeDay, eventClassFilter, eventTaxonomyNodeFilter])

  /** Event Analysis → Driver Analysis: Session/Type/class chip scope (charts use all session types; tables use mains). */
  const isEventDriverAnalysisContext = useMemo(
    () =>
      eventAnalysisTab === "driver-analysis" &&
      (overviewPrimarySection === "event-analysis" || variant === "event-analysis-only"),
    [eventAnalysisTab, overviewPrimarySection, variant]
  )

  /**
   * Compare chart: Session/Type scope is independent of lap-trend and event tables. When unset, Actions
   * class applies (same as before for charts). Event tables use {@link eventClassFilter} only.
   */
  const driverCompareDriverAnalysisRaces = useMemo(() => {
    let races = data.races
    if (driverCompareEventTaxonomyNodeFilter != null) {
      races = races.filter(
        (race) => race.userCarTaxonomy?.taxonomyNodeId === driverCompareEventTaxonomyNodeFilter
      )
    } else {
      const effectiveClassScope = driverCompareEventClassFilter ?? selectedClass
      if (effectiveClassScope) {
        races = races.filter((race) => race.className === effectiveClassScope)
      }
    }
    return races
  }, [
    data.races,
    driverCompareEventTaxonomyNodeFilter,
    driverCompareEventClassFilter,
    selectedClass,
  ])

  const driverCompareDriverStatsByClass = useMemo(
    () => computeDriverStatsFromRaces(driverCompareDriverAnalysisRaces),
    [driverCompareDriverAnalysisRaces]
  )

  /** Lap-by-lap chart: Session/Type only (no Actions fallback). */
  const driverLapTrendDriverAnalysisRaces = useMemo(() => {
    let races = data.races
    if (driverLapTrendEventTaxonomyNodeFilter != null) {
      races = races.filter(
        (race) => race.userCarTaxonomy?.taxonomyNodeId === driverLapTrendEventTaxonomyNodeFilter
      )
    } else if (driverLapTrendEventClassFilter) {
      races = races.filter((race) => race.className === driverLapTrendEventClassFilter)
    }
    return races
  }, [data.races, driverLapTrendEventTaxonomyNodeFilter, driverLapTrendEventClassFilter])

  const driverLapTrendDriverStatsByClass = useMemo(
    () => computeDriverStatsFromRaces(driverLapTrendDriverAnalysisRaces),
    [driverLapTrendDriverAnalysisRaces]
  )

  /** Multi-main card: single class string, or all class names under the active taxonomy chip. */
  const multiMainEventSectionClassFilter = useMemo(() => {
    if (eventTaxonomyNodeFilter != null) {
      const scopeMainsOnly = data.isPracticeDay !== true
      const mains = scopeMainsOnly ? data.races.filter((r) => isEventMainSession(r)) : data.races
      const names = new Set<string>()
      for (const r of mains) {
        if (r.userCarTaxonomy?.taxonomyNodeId === eventTaxonomyNodeFilter) {
          const cn = r.className?.trim()
          if (cn) names.add(cn)
        }
      }
      return Array.from(names)
    }
    return eventClassFilter
  }, [data.races, data.isPracticeDay, eventTaxonomyNodeFilter, eventClassFilter])

  const eventResultsTaxonomyTitle = useMemo(() => {
    if (eventTaxonomyNodeFilter == null) return null
    const chip = eventTaxonomyMappingChips.find((c) => c.taxonomyNodeId === eventTaxonomyNodeFilter)
    return chip?.label ?? null
  }, [eventTaxonomyNodeFilter, eventTaxonomyMappingChips])

  const driverLapTrendChartTitle = useMemo(() => {
    if (driverLapTrendEventTaxonomyNodeFilter != null) {
      const chip = eventTaxonomyMappingChips.find(
        (c) => c.taxonomyNodeId === driverLapTrendEventTaxonomyNodeFilter
      )
      return chip?.label ?? "Type"
    }
    if (driverLapTrendEventClassFilter) return driverLapTrendEventClassFilter
    return "All classes"
  }, [
    driverLapTrendEventTaxonomyNodeFilter,
    driverLapTrendEventClassFilter,
    eventTaxonomyMappingChips,
  ])

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

  /** Stats for compare chart notices + “all drivers selected” (compare scope, not lap-trend). */
  const statsForCompareScope = useMemo(
    () => (isEventDriverAnalysisContext ? driverCompareDriverStatsByClass : driverStatsByClass),
    [isEventDriverAnalysisContext, driverCompareDriverStatsByClass, driverStatsByClass]
  )

  // Prepare unified chart data (Event Analysis driver charts: scoped races + Session/Type filters)
  const unifiedChartData = useMemo<DriverPerformanceData[]>(() => {
    return driverCompareDriverStatsByClass.map((d) => ({
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
  }, [driverCompareDriverStatsByClass])

  /** Session Analysis → Driver Analysis: picked session race for lap trend (event-wide charts use compare vs lap scopes above). */
  const sessionDriverAnalysisPickedRaceId = useMemo(() => {
    if (!inSessionAnalysisSection || eventAnalysisTab !== "driver-analysis") {
      return null
    }
    if (sessionDriverAnalysisSortedRaces.length === 0) return null
    if (
      sessionAnalysisSessionRaceId &&
      sessionDriverAnalysisSortedRaces.some((r) => r.id === sessionAnalysisSessionRaceId)
    ) {
      return sessionAnalysisSessionRaceId
    }
    return sessionDriverAnalysisSortedRaces[0].id
  }, [
    inSessionAnalysisSection,
    eventAnalysisTab,
    sessionDriverAnalysisSortedRaces,
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
      const statsForExpand = isEventDriverAnalysisContext
        ? driverCompareDriverStatsByClass
        : driverStatsByClass
      const racesForExpand = isEventDriverAnalysisContext
        ? driverCompareDriverAnalysisRaces
        : sessionAnalysisRaces
      const selectedNormalizedNames = new Set<string>()
      data.drivers.forEach((driver) => {
        if (seedIds.includes(driver.driverId)) {
          selectedNormalizedNames.add(normalizeDriverName(driver.driverName))
        }
      })
      statsForExpand.forEach((driver) => {
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
      statsForExpand.forEach((driver) => {
        if (selectedNormalizedNames.has(normalizeDriverName(driver.driverName))) {
          expandedIds.add(driver.driverId)
        }
      })
      racesForExpand.forEach((race) => {
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
    [
      data.drivers,
      data.races,
      isEventDriverAnalysisContext,
      driverCompareDriverStatsByClass,
      driverStatsByClass,
      driverCompareDriverAnalysisRaces,
      sessionAnalysisRaces,
      driverNameLookup,
    ]
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
  }, [
    data.event.id,
    selectedClass,
    selectedDriverIds,
    driverCompareEventClassFilter,
    driverCompareEventTaxonomyNodeFilter,
  ])

  // When event changes, reset lap trend state and vehicle session scope
  useEffect(() => {
    queueMicrotask(() => {
      setLapTrendChartDriverIds([])
      setSessionAnalysisSessionRaceId(null)
      setSessionLapTrendChartDriverIds([])
    })
  }, [data.event.id])

  // When class or event Session/Type scope changes, clear lap-trend driver selection
  useEffect(() => {
    queueMicrotask(() => setLapTrendChartDriverIds([]))
  }, [driverLapTrendEventClassFilter, driverLapTrendEventTaxonomyNodeFilter])

  useEffect(() => {
    queueMicrotask(() => setSessionLapTrendChartDriverIds([]))
  }, [sessionDriverAnalysisPickedRaceId, selectedClass])

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
      if (sessionLapTrendChartDriverIds.length === 0 || !sessionDriverAnalysisPickedRaceId) {
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
    const effectiveClassForEventLapTrend =
      driverLapTrendEventTaxonomyNodeFilter != null ? null : driverLapTrendEventClassFilter
    if (effectiveClassForEventLapTrend) {
      params.set("className", effectiveClassForEventLapTrend)
    }
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
    overviewPrimarySection,
    data.event.id,
    sessionLapTrendChartDriverIds,
    sessionDriverAnalysisPickedRaceId,
    vehicleDenormActive,
    selectedClass,
    driverLapTrendEventClassFilter,
    driverLapTrendEventTaxonomyNodeFilter,
    lapTrendChartDriverIds,
  ])

  /** When Session/Type scope narrows races, drop laps from sessions outside scope (API returns all class races). */
  const eventScopedLapTrendData = useMemo((): EventLapTrendResponse | null => {
    if (!lapTrendData?.drivers?.length) return lapTrendData
    if (!isEventDriverAnalysisContext) return lapTrendData
    const allowed = new Set(driverLapTrendDriverAnalysisRaces.map((r) => r.id))
    return {
      ...lapTrendData,
      drivers: lapTrendData.drivers.map((d) => ({
        ...d,
        laps: d.laps.filter((lap) => allowed.has(lap.raceId)),
      })),
    }
  }, [lapTrendData, isEventDriverAnalysisContext, driverLapTrendDriverAnalysisRaces])

  const lapTrendStatsForEventCharts = useMemo(
    () => (isEventDriverAnalysisContext ? driverLapTrendDriverStatsByClass : driverStatsByClass),
    [isEventDriverAnalysisContext, driverLapTrendDriverStatsByClass, driverStatsByClass]
  )

  // Lap-trend driver options: same class scope as Compare chart, in global selection
  const lapTrendDriverOptions = useMemo(
    () =>
      lapTrendStatsForEventCharts
        .filter((d) => expandedSelectedDriverIds.includes(d.driverId))
        .map((d) => ({ driverId: d.driverId, driverName: d.driverName })),
    [lapTrendStatsForEventCharts, expandedSelectedDriverIds]
  )

  // Sort lap-trend drivers by selected metric (order in chart/legend)
  const sortedLapTrendDrivers = useMemo(() => {
    const dataForSort = isEventDriverAnalysisContext ? eventScopedLapTrendData : lapTrendData
    if (!dataForSort?.drivers?.length) return []
    const statsMap = new Map(lapTrendStatsForEventCharts.map((d) => [d.driverId, d]))
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
    return [...dataForSort.drivers].sort((a, b) => {
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
  }, [
    lapTrendData,
    eventScopedLapTrendData,
    isEventDriverAnalysisContext,
    lapTrendStatsForEventCharts,
    lapTrendSortBy,
  ])

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
    const statsDriverIds = new Set(statsForCompareScope.map((d) => d.driverId))
    return expandedSelectedDriverIds.filter((id) => statsDriverIds.has(id))
  }, [expandedSelectedDriverIds, statsForCompareScope])

  const selectedDriverIdsInSessionRace = useMemo(() => {
    const statsDriverIds = new Set(sessionDriverAnalysisDriverStatsFromRace.map((d) => d.driverId))
    return expandedSelectedDriverIds.filter((id) => statsDriverIds.has(id))
  }, [expandedSelectedDriverIds, sessionDriverAnalysisDriverStatsFromRace])

  const missingBestLapDriverIds = useMemo(() => {
    if (!shouldShowSelectionNotices) {
      return []
    }
    return getDriversMissingBestLap(selectedDriverIdsInCurrentClass, statsForCompareScope)
  }, [shouldShowSelectionNotices, selectedDriverIdsInCurrentClass, statsForCompareScope])

  const missingAvgVsFastestDriverIds = useMemo(() => {
    if (!shouldShowSelectionNotices) {
      return []
    }
    return getDriversMissingAvgVsFastest(selectedDriverIdsInCurrentClass, statsForCompareScope)
  }, [shouldShowSelectionNotices, selectedDriverIdsInCurrentClass, statsForCompareScope])

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
    if (!classScopeActive || statsForCompareScope.length === 0) {
      return false
    }
    return statsForCompareScope.every((d) => selectedDriverIds.includes(d.driverId))
  }, [selectedClass, statsForCompareScope, selectedDriverIds])

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
  const handleUnifiedChartDriverToggle = useCallback(
    (driverId: string) => {
      setUnifiedChartDriverIds((prev) =>
        prev.includes(driverId) ? prev.filter((id) => id !== driverId) : [...prev, driverId]
      )
    },
    [setUnifiedChartDriverIds]
  )

  const handlePageChange = useCallback(
    (page: number) => {
      setPaginationState({ page, selectionKey: unifiedChartSelectionKey })
    },
    [unifiedChartSelectionKey]
  )

  const handleTablesEventClassFilterSelect = useCallback((className: string | null) => {
    setEventTaxonomyNodeFilter(null)
    setEventClassFilter(className)
  }, [])

  const handleTablesEventTaxonomyFilterSelect = useCallback((taxonomyNodeId: string | null) => {
    setEventClassFilter(null)
    setEventTaxonomyNodeFilter(taxonomyNodeId)
  }, [])

  const handleDriverCompareClassFilterSelect = useCallback(
    (className: string | null) => {
      setDriverCompareEventTaxonomyNodeFilter(null)
      setDriverCompareEventClassFilter(className)
      onClassChange(className)
    },
    [onClassChange]
  )

  const handleDriverCompareTaxonomyFilterSelect = useCallback(
    (taxonomyNodeId: string | null) => {
      setDriverCompareEventClassFilter(null)
      setDriverCompareEventTaxonomyNodeFilter(taxonomyNodeId)
      if (taxonomyNodeId != null) {
        onClassChange(null)
      }
    },
    [onClassChange]
  )

  const handleDriverLapTrendClassFilterSelect = useCallback((className: string | null) => {
    setDriverLapTrendEventTaxonomyNodeFilter(null)
    setDriverLapTrendEventClassFilter(className)
  }, [])

  const handleDriverLapTrendTaxonomyFilterSelect = useCallback((taxonomyNodeId: string | null) => {
    setDriverLapTrendEventClassFilter(null)
    setDriverLapTrendEventTaxonomyNodeFilter(taxonomyNodeId)
  }, [])

  const eventResultsScopeFilterToolbar = useMemo(() => {
    if (
      !EVENT_CLASS_FILTER_SUB_TABS.includes(eventAnalysisTab) ||
      (validClasses.length === 0 && eventTaxonomyMappingChips.length === 0)
    ) {
      return null
    }
    return (
      <EventAnalysisScopeFilters
        validClasses={validClasses}
        eventClassFilter={eventClassFilter}
        eventTaxonomyNodeFilter={eventTaxonomyNodeFilter}
        taxonomyOptions={eventTaxonomyMappingChips}
        onClassFilterChange={handleTablesEventClassFilterSelect}
        onTaxonomyFilterChange={handleTablesEventTaxonomyFilterSelect}
      />
    )
  }, [
    eventAnalysisTab,
    validClasses,
    eventClassFilter,
    eventTaxonomyNodeFilter,
    eventTaxonomyMappingChips,
    handleTablesEventClassFilterSelect,
    handleTablesEventTaxonomyFilterSelect,
  ])

  const driverCompareScopeFilterToolbar = useMemo(() => {
    if (
      eventAnalysisTab !== "driver-analysis" ||
      (validClasses.length === 0 && eventTaxonomyMappingChips.length === 0)
    ) {
      return null
    }
    return (
      <EventAnalysisScopeFilters
        validClasses={validClasses}
        eventClassFilter={driverCompareEventClassFilter}
        eventTaxonomyNodeFilter={driverCompareEventTaxonomyNodeFilter}
        taxonomyOptions={eventTaxonomyMappingChips}
        onClassFilterChange={handleDriverCompareClassFilterSelect}
        onTaxonomyFilterChange={handleDriverCompareTaxonomyFilterSelect}
      />
    )
  }, [
    eventAnalysisTab,
    validClasses,
    driverCompareEventClassFilter,
    driverCompareEventTaxonomyNodeFilter,
    eventTaxonomyMappingChips,
    handleDriverCompareClassFilterSelect,
    handleDriverCompareTaxonomyFilterSelect,
  ])

  const driverLapTrendScopeFilterToolbar = useMemo(() => {
    if (
      eventAnalysisTab !== "driver-analysis" ||
      (validClasses.length === 0 && eventTaxonomyMappingChips.length === 0)
    ) {
      return null
    }
    return (
      <EventAnalysisScopeFilters
        validClasses={validClasses}
        eventClassFilter={driverLapTrendEventClassFilter}
        eventTaxonomyNodeFilter={driverLapTrendEventTaxonomyNodeFilter}
        taxonomyOptions={eventTaxonomyMappingChips}
        onClassFilterChange={handleDriverLapTrendClassFilterSelect}
        onTaxonomyFilterChange={handleDriverLapTrendTaxonomyFilterSelect}
      />
    )
  }, [
    eventAnalysisTab,
    validClasses,
    driverLapTrendEventClassFilter,
    driverLapTrendEventTaxonomyNodeFilter,
    eventTaxonomyMappingChips,
    handleDriverLapTrendClassFilterSelect,
    handleDriverLapTrendTaxonomyFilterSelect,
  ])

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

  const handleSessionAnalysisSessionChipSelect = useCallback(
    (race: RaceAnalysisRow) => {
      setSessionAnalysisSessionRaceId(race.id)
      const raw = race.className?.trim()
      if (!raw || isPlaceholderClass(race.className)) {
        handleClassChange(null)
      } else {
        handleClassChange(raw)
      }
    },
    [handleClassChange]
  )

  const handleLiveRcClassNavSelect = useCallback(
    (className: string) => {
      const inClass = sessionAnalysisBaseRaces.filter((r) => r.className?.trim() === className)
      if (inClass.length === 0) {
        setSessionAnalysisSessionRaceId(null)
        handleClassChange(className)
        return
      }
      const sorted = sortRacesChronologically(inClass)
      const mainPick = sorted.find((r) => isEventMainSession(r)) ?? sorted[0]
      setSessionAnalysisSessionRaceId(mainPick.id)
      handleClassChange(className)
    },
    [sessionAnalysisBaseRaces, handleClassChange]
  )

  const handleLiveRcSessionNavChipKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const n = sessionAnalysisNavClassOptions.length
      if (n === 0) return
      if (event.key === "ArrowRight") {
        event.preventDefault()
        liveRcSessionNavChipRefs.current[(index + 1) % n]?.focus()
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        liveRcSessionNavChipRefs.current[(index - 1 + n) % n]?.focus()
      }
    },
    [sessionAnalysisNavClassOptions.length]
  )

  /** Keep session race id in sync with class scope (Actions, LiveRC nav). */
  useEffect(() => {
    const sorted = sessionDriverAnalysisSortedRaces
    queueMicrotask(() => {
      if (sorted.length === 0) {
        setSessionAnalysisSessionRaceId(null)
        return
      }
      setSessionAnalysisSessionRaceId((prev) => {
        if (prev && sorted.some((r) => r.id === prev)) return prev
        return sorted[0].id
      })
    })
  }, [sessionDriverAnalysisSortedRaces, data.event.id])

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

  /** Session scope for chart headers: compact LiveRC-style race labels. */
  const renderSessionScopeControls = useCallback(
    (idPrefix: string, scopedRaces: RaceAnalysisRow[], ariaSession: string) => {
      const pickedRaceId =
        sessionAnalysisSessionRaceId &&
        scopedRaces.some((r) => r.id === sessionAnalysisSessionRaceId)
          ? sessionAnalysisSessionRaceId
          : (scopedRaces[0]?.id ?? null)

      if (scopedRaces.length === 0) {
        return (
          <p className="text-sm text-[var(--token-text-secondary)]">
            No sessions in the current class scope.
          </p>
        )
      }

      return (
        <div
          className="flex min-w-0 max-w-full flex-wrap gap-2"
          role="toolbar"
          aria-label={ariaSession}
        >
          {scopedRaces.map((race) => {
            const isActive = pickedRaceId === race.id
            const chipLabel = liveRcCompactRaceLabel(race, selectedClass)
            return (
              <button
                key={race.id}
                type="button"
                id={`${idPrefix}-session-${race.id}`}
                title={chipLabel}
                className={`inline-flex max-w-[min(100%,18rem)] items-center rounded-full border px-3 py-1 text-xs font-medium text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                  isActive
                    ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                    : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface)]/45"
                }`}
                onClick={() => handleSessionAnalysisSessionChipSelect(race)}
                aria-pressed={isActive}
              >
                <span className="min-w-0 truncate">{chipLabel}</span>
              </button>
            )
          })}
        </div>
      )
    },
    [sessionAnalysisSessionRaceId, selectedClass, handleSessionAnalysisSessionChipSelect]
  )

  const showOtherSections =
    variant !== "event-overview-minimal" &&
    variant !== "event-overview-only" &&
    variant !== "event-analysis-only" &&
    variant !== "session-analysis-only"
  const isEventOverviewMinimal = variant === "event-overview-minimal"
  /** Event overview hero/stats: only on the Event Overview top tab, or in default mode when that subsection is active. */
  const showEventOverviewSection =
    variant === "event-overview-minimal" ||
    variant === "event-overview-only" ||
    (showOtherSections && overviewPrimarySection === "event-overview")

  /** Track/venue line when event name and track name differ (e.g. series vs host). */
  const eventOverviewTrackSubline = useMemo(() => {
    const en = data.event.eventName?.trim() ?? ""
    const tn = data.event.trackName?.trim() ?? ""
    return en && tn && tn !== en ? tn : null
  }, [data.event.eventName, data.event.trackName])

  const trackDashboardUrl = data.event.trackDashboardUrl?.trim() || null

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
      variant === "event-overview-minimal" ||
      variant === "event-overview-only" ||
      variant === "event-analysis-only" ||
      variant === "session-analysis-only"
    ) {
      return []
    }
    return overviewPrimarySectionTabs
  }, [variant])

  const eventOverviewToolbarTabId =
    variant === "event-overview-minimal"
      ? "tab-event-overview"
      : variant === "event-overview-only"
        ? "tab-event-overview-old"
        : null

  const tabPanelId =
    variant === "event-overview-minimal"
      ? "tabpanel-event-overview"
      : variant === "event-overview-only"
        ? "tabpanel-event-overview-old"
        : variant === "event-analysis-only"
          ? "tabpanel-event-analysis"
          : variant === "session-analysis-only"
            ? "tabpanel-session-analysis"
            : "tabpanel-overview"
  const tabAriaLabelledBy =
    variant === "event-overview-minimal"
      ? "tab-event-overview"
      : variant === "event-overview-only"
        ? "tab-event-overview-old"
        : variant === "event-analysis-only"
          ? "tab-event-analysis"
          : variant === "session-analysis-only"
            ? "tab-session-analysis"
            : "tab-overview"

  return (
    <div
      className="flex min-h-0 w-full min-w-full shrink-0 flex-col items-stretch gap-6"
      role="tabpanel"
      id={tabPanelId}
      aria-labelledby={tabAriaLabelledBy}
    >
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
          className="flex min-h-0 w-full min-w-full flex-col items-stretch gap-4"
          aria-labelledby={eventOverviewToolbarTabId ?? "event-overview-heading"}
        >
          <div
            id={eventOverviewSectionContentId}
            role="tabpanel"
            aria-labelledby={eventOverviewToolbarTabId ?? "event-overview-heading"}
            className={`flex min-h-0 w-full min-w-full flex-col items-stretch ${toolbarAboveEventDetails ? "gap-3" : "gap-5"}`}
          >
            {toolbarAboveEventDetails ? (
              <div className="flex min-w-0 w-full flex-col gap-3">{toolbarAboveEventDetails}</div>
            ) : null}
            <div className={toolbarAboveEventDetails ? "min-w-0 w-full" : "w-full min-w-0"}>
              <div
                className={`grid w-full min-w-0 grid-cols-1 gap-5${
                  toolbarAboveEventDetails
                    ? ""
                    : " mx-auto max-w-[min(100%,80rem)] xl:max-w-[90rem]"
                }`}
              >
                {!isEventOverviewMinimal ? <OverviewEventDetailsSectionHeading /> : null}
                {isEventOverviewMinimal ? (
                  <OverviewTriColumnSummary
                    trackLocationSlot={
                      venueHostSection?.venue.hasAddress &&
                      typeof data.event.address === "string" &&
                      data.event.address.trim().length > 0 ? (
                        <MapSearchAddressLink
                          address={data.event.address.trim()}
                          showMapLink={false}
                          linkFullAddress
                          linkClassName="text-sm font-normal leading-snug"
                        />
                      ) : null
                    }
                    contactDetailsSlot={eventOverviewMinimalContactSlot}
                  />
                ) : null}
                {!isEventOverviewMinimal ? (
                  <div
                    className={`grid min-h-0 w-full min-w-0 grid-cols-1 gap-4 px-5 py-5 sm:gap-5 sm:px-6 sm:py-6 ${EVENT_DETAILS_SECTION_SURFACE_CLASS}`}
                    aria-labelledby="event-overview-event-details-heading"
                    aria-describedby="event-overview-event-details-subtitle"
                  >
                    <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5">
                      {venueHostShowsTabStrip ? (
                        <div className="grid min-w-0 grid-cols-1 gap-4">
                          <div className="min-w-0 w-full shrink-0">
                            <EventOverviewVenueHostTabList
                              selected={resolvedVenueHostTab}
                              onSelect={setVenueHostTab}
                              showEventHostTab={!!venueHostSection?.hasVenueInfo}
                              showHostTrackTab={!!venueHostSection?.hasHostBlock}
                              showEventWeatherTab
                              showEventMixTab
                            />
                          </div>
                          <div
                            className="h-px w-full shrink-0 bg-[var(--token-border-muted)] lg:hidden"
                            aria-hidden
                          />
                        </div>
                      ) : null}
                      {eventDetailsPersistentStatsStrip}
                      {venueHostSection?.hasVenueInfo &&
                        (!venueHostShowsTabStrip || resolvedVenueHostTab === "eventHost") && (
                          <div
                            id={
                              venueHostShowsTabStrip
                                ? "overview-venue-host-panel-event-host"
                                : undefined
                            }
                            role={venueHostShowsTabStrip ? "tabpanel" : "region"}
                            aria-labelledby={
                              venueHostShowsTabStrip
                                ? "overview-venue-host-tab-event-host"
                                : undefined
                            }
                            aria-label={venueHostShowsTabStrip ? undefined : "Event host"}
                            className={EVENT_DETAILS_TABPANEL_CHROME}
                          >
                            <OverviewVenueDetailPanel
                              idPrefix="event-host"
                              variant="host"
                              primaryTitle={
                                eventOverviewTrackSubline ??
                                venueHostSection.venue.event.trackName?.trim() ??
                                null
                              }
                              primaryDashboardUrl={trackDashboardUrl}
                              address={venueHostSection.venue.event.address}
                              phone={venueHostSection.venue.event.phone}
                              website={venueHostSection.venue.event.website}
                              email={venueHostSection.venue.event.email}
                              facebookUrl={venueHostSection.venue.event.facebookUrl}
                            />
                          </div>
                        )}
                      {venueHostSection?.host &&
                        (!venueHostShowsTabStrip || resolvedVenueHostTab === "hostTrack") && (
                          <div
                            id={
                              venueHostShowsTabStrip
                                ? "overview-venue-host-panel-host-track"
                                : undefined
                            }
                            role={venueHostShowsTabStrip ? "tabpanel" : "region"}
                            aria-labelledby={
                              venueHostShowsTabStrip
                                ? "overview-venue-host-tab-host-track"
                                : undefined
                            }
                            aria-label={venueHostShowsTabStrip ? undefined : "Host track"}
                            className={EVENT_DETAILS_TABPANEL_CHROME}
                          >
                            {(() => {
                              const host = venueHostSection.host
                              const h = host.h
                              const hostClubName =
                                h.trackName?.trim() ||
                                (host.hostHasAddress && h.address?.trim()
                                  ? (splitAddressForDisplay(h.address!)[0]?.trim() ?? null)
                                  : null)
                              const hostTrackNameRedundantWithAddress =
                                Boolean(h.trackName?.trim()) &&
                                host.hostHasAddress &&
                                Boolean(h.address?.trim()) &&
                                (() => {
                                  const first = splitAddressForDisplay(h.address!)[0]
                                    ?.trim()
                                    .toLowerCase()
                                  if (!first) return false
                                  return first === h.trackName!.trim().toLowerCase()
                                })()
                              return (
                                <OverviewVenueDetailPanel
                                  idPrefix="host-track"
                                  variant="track"
                                  primaryTitle={hostClubName}
                                  primaryDashboardUrl={h.trackDashboardUrl?.trim() || null}
                                  address={host.hostHasAddress ? h.address : null}
                                  locationTrackName={h.trackName?.trim() || null}
                                  showLocationTrackName={
                                    Boolean(h.trackName?.trim()) &&
                                    !hostTrackNameRedundantWithAddress
                                  }
                                  phone={host.hostHasPhone ? h.phone : null}
                                  website={host.hostHasWebsite ? h.website : null}
                                  email={host.hostHasEmail ? h.email : null}
                                  facebookUrl={host.hostHasFacebook ? h.facebookUrl : null}
                                />
                              )
                            })()}
                          </div>
                        )}
                      {(!venueHostShowsTabStrip || resolvedVenueHostTab === "eventWeather") && (
                        <div
                          id={
                            venueHostShowsTabStrip
                              ? "overview-venue-host-panel-event-weather"
                              : undefined
                          }
                          role={venueHostShowsTabStrip ? "tabpanel" : "region"}
                          aria-labelledby={
                            venueHostShowsTabStrip
                              ? "overview-venue-host-tab-event-weather"
                              : undefined
                          }
                          aria-label={venueHostShowsTabStrip ? undefined : "Event weather"}
                          aria-busy={weatherLoading}
                          className={EVENT_DETAILS_TABPANEL_CHROME}
                        >
                          {resolvedVenueHostTab === "eventWeather" ? (
                            <div
                              id="event-overview-event-weather-info"
                              className={`mb-4 w-full max-w-2xl ${EVENT_DETAILS_WEATHER_INFO_CALLOUT_CLASS}`}
                              aria-label={EVENT_OVERVIEW_WEATHER_INFO_TEXT}
                            >
                              <p className="text-sm leading-relaxed text-[var(--token-text-secondary)]">
                                {EVENT_OVERVIEW_WEATHER_INFO_TEXT}
                              </p>
                            </div>
                          ) : null}
                          <div
                            id="event-weather-data-content"
                            className="grid min-w-0 w-full grid-cols-1 gap-4"
                            aria-live="polite"
                          >
                            {weatherLoading ? (
                              <WeatherCard
                                weather={null}
                                weatherLoading={true}
                                weatherError={null}
                              />
                            ) : weatherError ? (
                              <WeatherCard
                                weather={null}
                                weatherLoading={false}
                                weatherError={weatherError}
                              />
                            ) : weatherByDay && weatherByDay.length > 0 ? (
                              <>
                                <EventWeatherAtAGlance weatherByDay={weatherByDay} />
                                <div className="grid min-h-0 min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                  {weatherByDay.map(({ date, weather }) => (
                                    <div key={date} className="flex h-full min-h-[16.5rem] min-w-0">
                                      <WeatherCard
                                        weather={weather}
                                        weatherLoading={false}
                                        weatherError={null}
                                        headingDate={formatDateLong(date)}
                                        className="h-full w-full min-w-0"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <p className={EVENT_DETAILS_EMPTY_STATE_CLASS} role="status">
                                No weather data is available for this event yet.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      {(!venueHostShowsTabStrip || resolvedVenueHostTab === "eventMix") && (
                        <div
                          id={
                            venueHostShowsTabStrip
                              ? "overview-venue-host-panel-event-mix"
                              : undefined
                          }
                          role={venueHostShowsTabStrip ? "tabpanel" : "region"}
                          aria-labelledby={
                            venueHostShowsTabStrip ? "overview-venue-host-tab-event-mix" : undefined
                          }
                          aria-label={venueHostShowsTabStrip ? undefined : "Event mix"}
                          className={EVENT_DETAILS_TABPANEL_CHROME}
                        >
                          {eventHighlightsModel.sessionMix.length > 0 ||
                          eventHighlightsModel.classMixByDrivers.length > 0 ||
                          eventHighlightsModel.classMixByLaps.length > 0 ? (
                            <div className="min-w-0 w-full">
                              <EventHighlightsMixFilteredChart
                                sessionMix={eventHighlightsModel.sessionMix}
                                classMixByDrivers={eventHighlightsModel.classMixByDrivers}
                                classMixByLaps={eventHighlightsModel.classMixByLaps}
                                embeddedInEventDetails
                              />
                            </div>
                          ) : (
                            <p className={EVENT_DETAILS_EMPTY_STATE_CLASS} role="status">
                              No session or class mix data is available for this event yet.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {!isEventOverviewMinimal ? (
              <div className="space-y-4">
                <header className="space-y-1">
                  <h3
                    id="event-overview-highlights-section-heading"
                    className={`min-w-0 ${typography.h3} tracking-tight text-[var(--token-text-primary)]`}
                  >
                    Event highlights
                  </h3>
                </header>
                <div
                  className={`flex min-w-0 flex-col gap-5 px-5 py-5 sm:px-6 sm:py-6 ${OVERVIEW_SECTION_SURFACE_CLASS}`}
                  aria-labelledby="event-overview-highlights-section-heading"
                >
                  <div id="overview-event-highlights-content" className="min-w-0 w-full">
                    <EventOverviewTopQualifiers
                      variant="overviewCards"
                      qualPoints={data.qualPointsTopQualifiers}
                      races={data.races}
                      multiMainResults={data.multiMainResults}
                      registrationClassNames={data.registrationClassNames}
                      entryList={data.entryList}
                    />
                  </div>
                </div>
              </div>
            ) : null}
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
            <h2 id="event-analysis-subview-heading" className={typography.h4}>
              {getSubTabLabel(eventAnalysisTab, "event")}
            </h2>
            {eventAnalysisTab === "event-results" && !ladderInEventAnalysis && (
              <div
                className="w-full max-w-full rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)]/35 px-3 py-3 text-sm leading-relaxed text-[var(--token-text-secondary)]"
                role="note"
              >
                Overall podium finishers for main&apos;s results. Expand a row for full standings
                when multiple legs feed that main.
              </div>
            )}
            {eventAnalysisTab === "fastest-laps" && (
              <div
                className="w-full max-w-full rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)]/35 px-3 py-3 text-sm leading-relaxed text-[var(--token-text-secondary)]"
                role="note"
              >
                The table lists the top three distinct lap times per class (ties included). Click a
                row to see every driver&apos;s best lap in that class.
              </div>
            )}
            {eventAnalysisTab === "fastest-average-laps" && (
              <div
                className="w-full max-w-full rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)]/35 px-3 py-3 text-sm leading-relaxed text-[var(--token-text-secondary)]"
                role="note"
              >
                The table lists the top three distinct event-wide averages per class (ties
                included). Click a row to see every driver in that class.
              </div>
            )}
            {eventAnalysisTab === "qualification-results" && (
              <div
                className="w-full max-w-full rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)]/35 px-3 py-3 text-sm leading-relaxed text-[var(--token-text-secondary)]"
                role="note"
              >
                Qual points order per class from LiveRC (same source as Event Overview → Event
                Highlights). Open the LiveRC link below the table when you need the full page on
                LiveRC.com.
              </div>
            )}
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
                        className={`${typography.h4} tracking-tight`}
                      >
                        Compare driver performance
                      </h3>
                      <div
                        className="w-full max-w-full rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)]/35 px-3 py-3 text-sm leading-relaxed text-[var(--token-text-secondary)]"
                        role="note"
                      >
                        Best lap, average lap, gap, and related metrics for the scope you set with
                        Session and Type on the compare chart, and drivers in Actions. Switch column
                        or line view and sort from the chart header.
                      </div>
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
                          chartDriverOptions={driverCompareDriverStatsByClass.map((d) => ({
                            driverId: d.driverId,
                            driverName: d.driverName,
                          }))}
                          chartSelectedDriverIds={unifiedChartDriverIds}
                          onChartDriverSelectionChange={setUnifiedChartDriverIds}
                          headerAfterClassSelect={
                            driverCompareScopeFilterToolbar ? (
                              <div className="flex flex-wrap items-center gap-3">
                                {driverCompareScopeFilterToolbar}
                              </div>
                            ) : null
                          }
                        />
                      </ChartSection>
                    </div>
                    <div className="space-y-1.5">
                      <h3
                        id="driver-analysis-overview-heading"
                        className={`${typography.h4} tracking-tight`}
                      >
                        Lap-by-lap trend
                      </h3>
                      <p className="max-w-3xl text-sm text-[var(--token-text-secondary)]">
                        Every lap time for the scope you set on the lap chart (Session and Type) and
                        the driver you pick below. Use{" "}
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
                              ...OVERVIEW_GLASS_SURFACE_STYLE,
                              boxShadow: "var(--glass-shadow-stack)",
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
                                (isEventDriverAnalysisContext
                                  ? eventScopedLapTrendData
                                  : lapTrendData
                                )?.drivers?.some((d) => d.laps.length > 0)
                                  ? sortedLapTrendDrivers
                                  : []
                              }
                              height={450}
                              chartInstanceId={`overview-${data.event.id}-lap-trend`}
                              chartTitle={driverLapTrendChartTitle}
                              headerControls={
                                <div className="flex flex-wrap items-center gap-4">
                                  {driverLapTrendScopeFilterToolbar ? (
                                    <div className="flex flex-wrap items-center gap-3">
                                      {driverLapTrendScopeFilterToolbar}
                                    </div>
                                  ) : null}
                                  {lapTrendDriverOptions.length > 0 && (
                                    <ChartDriverPicker
                                      drivers={lapTrendDriverOptions}
                                      selectedDriverIds={lapTrendChartDriverIds}
                                      onSelectionChange={setLapTrendChartDriverIds}
                                      label="Select Drivers"
                                      singleSelect
                                      disabled={
                                        driverLapTrendEventTaxonomyNodeFilter == null &&
                                        driverLapTrendEventClassFilter == null
                                      }
                                      disabledTooltip="Choose Session or Type with the lap chart filters to pick a driver"
                                    />
                                  )}
                                </div>
                              }
                              emptyMessage={
                                lapTrendLoading
                                  ? "Loading lap data…"
                                  : (lapTrendError ??
                                    (lapTrendChartDriverIds.length === 0
                                      ? "Choose Session or Type on the lap chart, then pick a driver to view lap-by-lap data."
                                      : "No lap data for selected drivers."))
                              }
                            />
                          </>
                        )}
                      </ChartSection>
                    </div>
                  </>
                )}
                {eventAnalysisTab === "event-results" && (
                  <div className="space-y-6">
                    <MainBracketResultsTable
                      races={eventLevelFilteredRaces}
                      eventResultsTitleOverride={eventResultsTaxonomyTitle}
                      headerToolbar={eventResultsScopeFilterToolbar}
                    />
                    <MultiMainOverallCard
                      multiMainResults={data.multiMainResults}
                      activeClassLabel={multiMainEventSectionClassFilter}
                    />
                  </div>
                )}
                {eventAnalysisTab === "qualification-results" && (
                  <div className="w-full min-w-0 max-w-full">
                    <EventOverviewTopQualifiers qualPoints={data.qualPointsTopQualifiers} />
                  </div>
                )}
                {eventAnalysisTab === "fastest-laps" && (
                  <EventTopFastestLapsPerClassTable
                    races={eventLevelFilteredRaces}
                    eventScopeFilters={eventResultsScopeFilterToolbar}
                  />
                )}
                {eventAnalysisTab === "fastest-average-laps" && (
                  <EventTopAverageLapsPerClassTable
                    races={eventLevelFilteredRaces}
                    eventScopeFilters={eventResultsScopeFilterToolbar}
                  />
                )}
              </>
            )}
          </div>

          {!ladderInEventAnalysis &&
            eventAnalysisTab !== "driver-analysis" &&
            eventAnalysisTab !== "qualification-results" && (
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
            <h2 id="session-analysis-subview-heading" className={typography.h4}>
              {getSubTabLabel(eventAnalysisTab, "session")}
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
            {eventClassFilterTabs.includes(eventAnalysisTab) &&
              sessionAnalysisNavClassOptions.length > 0 && (
                <div className="mt-2 space-y-2">
                  <div
                    className="-mx-1 overflow-x-hidden"
                    role="toolbar"
                    aria-label="Program buckets (LiveRC session types); nav order when available from ingestion."
                  >
                    <div className="flex flex-wrap gap-2 px-1 py-1">
                      {sessionAnalysisNavClassOptions.map((className, index) => {
                        const isActive = selectedClass === className
                        return (
                          <button
                            key={`nav-class:${className}`}
                            type="button"
                            title={className}
                            className={`inline-flex max-w-[min(100%,18rem)] items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                              isActive
                                ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                                : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface)]/45"
                            }`}
                            onClick={() => handleLiveRcClassNavSelect(className)}
                            aria-pressed={isActive}
                            onKeyDown={(event) => handleLiveRcSessionNavChipKeyDown(event, index)}
                            ref={(el) => {
                              liveRcSessionNavChipRefs.current[index] = el
                            }}
                          >
                            <span className="min-w-0 truncate">{className}</span>
                          </button>
                        )
                      })}
                    </div>
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
                {sessionAnalysisNavClassOptions.length === 0 ? (
                  <p className="text-sm text-[var(--token-text-secondary)]">
                    No class or session buckets found for this event.
                  </p>
                ) : sessionDriverAnalysisSortedRaces.length === 0 ? (
                  <p className="text-sm text-[var(--token-text-secondary)]">
                    No sessions in scope for the current class filter. Choose another session above
                    or adjust class in Actions.
                  </p>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <h3
                        id="session-compare-driver-performance-heading"
                        className={`${typography.h4} tracking-tight`}
                      >
                        Compare driver performance (this session)
                      </h3>
                      <div
                        className="w-full max-w-full rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)]/35 px-3 py-3 text-sm leading-relaxed text-[var(--token-text-secondary)]"
                        role="note"
                      >
                        Best lap, average lap, gap, and related metrics for the selected session
                        only. Use the legend below for Avg Top 5–15, consecutive laps, and std. dev.
                        Pick a class or session with the pills above; refine class scope in Actions.
                        Use the session pills in the chart header to switch session without
                        scrolling.
                      </div>
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
                            sessionDriverAnalysisSortedRaces,
                            "Choose session for compare chart"
                          )}
                        />
                      </ChartSection>
                    </div>
                    <div className="space-y-1.5">
                      <h3
                        id="session-lap-by-lap-heading"
                        className={`${typography.h4} tracking-tight`}
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
                              ...OVERVIEW_GLASS_SURFACE_STYLE,
                              boxShadow: "var(--glass-shadow-stack)",
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
                                    sessionDriverAnalysisSortedRaces,
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
              <SessionRaceResultsTable
                races={sessionAnalysisRaces}
                raceLabelContextRaces={sessionAnalysisRaceLabelContextRaces}
              />
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
