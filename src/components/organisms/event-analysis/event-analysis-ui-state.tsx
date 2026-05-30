/**
 * @fileoverview Persisted UI state for Event / Session Level Analysis (survives primary tab switches).
 */

"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react"
import type { ChartViewType } from "@/components/organisms/event-analysis/UnifiedPerformanceChart"

export const EVENT_LEVEL_ANALYSIS_PANEL_IDS = [
  "event-level-analysis-col-1",
  "event-level-analysis-col-3",
  "event-level-analysis-col-4",
  "event-level-analysis-col-5",
  "event-level-analysis-col-6",
  "event-level-analysis-col-7",
  "event-level-analysis-col-8",
] as const

export const SESSION_LEVEL_ANALYSIS_PANEL_IDS = [
  "session-level-analysis-col-1",
  "session-level-analysis-col-2",
] as const

export type EventLevelAnalysisPanelId = (typeof EVENT_LEVEL_ANALYSIS_PANEL_IDS)[number]
export type SessionLevelAnalysisPanelId = (typeof SESSION_LEVEL_ANALYSIS_PANEL_IDS)[number]
export type AnalysisGlassPanelId = EventLevelAnalysisPanelId | SessionLevelAnalysisPanelId

function defaultPanelExpanded(): Record<string, boolean> {
  const ids = [...EVENT_LEVEL_ANALYSIS_PANEL_IDS, ...SESSION_LEVEL_ANALYSIS_PANEL_IDS]
  return Object.fromEntries(ids.map((id) => [id, true]))
}

type EventAnalysisUiStateValue = {
  eventId: string | null
  eventLevelDriverProgressionClass: string | null
  setEventLevelDriverProgressionClass: Dispatch<SetStateAction<string | null>>
  eventLevelDriverLapChartClassOverride: string | null
  setEventLevelDriverLapChartClassOverride: Dispatch<SetStateAction<string | null>>
  eventLevelLapChartDriverIds: string[]
  setEventLevelLapChartDriverIds: Dispatch<SetStateAction<string[]>>
  eventLevelLapChartRaceId: string | null
  setEventLevelLapChartRaceId: Dispatch<SetStateAction<string | null>>
  eventLevelLapChartSessionTypeFilter: string
  setEventLevelLapChartSessionTypeFilter: Dispatch<SetStateAction<string>>
  eventLevelDriverLapChartExpanded: boolean
  setEventLevelDriverLapChartExpanded: Dispatch<SetStateAction<boolean>>
  eventLevelLapChartClosestOnly: boolean
  setEventLevelLapChartClosestOnly: Dispatch<SetStateAction<boolean>>
  driverCompareEventClassFilter: string | null
  setDriverCompareEventClassFilter: Dispatch<SetStateAction<string | null>>
  driverCompareEventTaxonomyNodeFilter: string | null
  setDriverCompareEventTaxonomyNodeFilter: Dispatch<SetStateAction<string | null>>
  unifiedChartDriverIds: string[]
  setUnifiedChartDriverIds: Dispatch<SetStateAction<string[]>>
  chartViewState: ChartViewType
  setChartViewState: Dispatch<SetStateAction<ChartViewType>>
  isPanelExpanded: (panelId: AnalysisGlassPanelId) => boolean
  setPanelExpanded: (panelId: AnalysisGlassPanelId, expanded: boolean) => void
  togglePanelExpanded: (panelId: AnalysisGlassPanelId) => void
  /** Survives OverviewTab remount; used to avoid re-seeding lap chart drivers. */
  prevEventLevelLapSeedKeyRef: MutableRefObject<string>
}

const EventAnalysisUiStateContext = createContext<EventAnalysisUiStateValue | null>(null)

function resetEventScopedState(
  setters: {
    setEventLevelDriverProgressionClass: Dispatch<SetStateAction<string | null>>
    setEventLevelDriverLapChartClassOverride: Dispatch<SetStateAction<string | null>>
    setEventLevelLapChartDriverIds: Dispatch<SetStateAction<string[]>>
    setEventLevelLapChartRaceId: Dispatch<SetStateAction<string | null>>
    setEventLevelLapChartSessionTypeFilter: Dispatch<SetStateAction<string>>
    setEventLevelDriverLapChartExpanded: Dispatch<SetStateAction<boolean>>
    setEventLevelLapChartClosestOnly: Dispatch<SetStateAction<boolean>>
    setDriverCompareEventClassFilter: Dispatch<SetStateAction<string | null>>
    setDriverCompareEventTaxonomyNodeFilter: Dispatch<SetStateAction<string | null>>
    setUnifiedChartDriverIds: Dispatch<SetStateAction<string[]>>
    setChartViewState: Dispatch<SetStateAction<ChartViewType>>
    setPanelExpanded: Dispatch<SetStateAction<Record<string, boolean>>>
  },
  seedKeyRef: MutableRefObject<string>
) {
  setters.setEventLevelDriverProgressionClass(null)
  setters.setEventLevelDriverLapChartClassOverride(null)
  setters.setEventLevelLapChartDriverIds([])
  setters.setEventLevelLapChartRaceId(null)
  setters.setEventLevelLapChartSessionTypeFilter("")
  setters.setEventLevelDriverLapChartExpanded(false)
  setters.setEventLevelLapChartClosestOnly(false)
  setters.setDriverCompareEventClassFilter(null)
  setters.setDriverCompareEventTaxonomyNodeFilter(null)
  setters.setUnifiedChartDriverIds([])
  setters.setChartViewState("column")
  setters.setPanelExpanded(defaultPanelExpanded())
  seedKeyRef.current = ""
}

export function EventAnalysisUiStateProvider({
  eventId,
  children,
}: {
  eventId: string | null
  children: ReactNode
}) {
  const [eventLevelDriverProgressionClass, setEventLevelDriverProgressionClass] = useState<
    string | null
  >(null)
  const [eventLevelDriverLapChartClassOverride, setEventLevelDriverLapChartClassOverride] =
    useState<string | null>(null)
  const [eventLevelLapChartDriverIds, setEventLevelLapChartDriverIds] = useState<string[]>([])
  const [eventLevelLapChartRaceId, setEventLevelLapChartRaceId] = useState<string | null>(null)
  const [eventLevelLapChartSessionTypeFilter, setEventLevelLapChartSessionTypeFilter] = useState("")
  const [eventLevelDriverLapChartExpanded, setEventLevelDriverLapChartExpanded] = useState(false)
  const [eventLevelLapChartClosestOnly, setEventLevelLapChartClosestOnly] = useState(false)
  const [driverCompareEventClassFilter, setDriverCompareEventClassFilter] = useState<string | null>(
    null
  )
  const [driverCompareEventTaxonomyNodeFilter, setDriverCompareEventTaxonomyNodeFilter] = useState<
    string | null
  >(null)
  const [unifiedChartDriverIds, setUnifiedChartDriverIds] = useState<string[]>([])
  const [chartViewState, setChartViewState] = useState<ChartViewType>("column")
  const [panelExpanded, setPanelExpanded] = useState<Record<string, boolean>>(defaultPanelExpanded)
  const prevEventLevelLapSeedKeyRef = useRef("")
  const lastEventIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!eventId) {
      lastEventIdRef.current = null
      return
    }
    if (lastEventIdRef.current === eventId) return
    lastEventIdRef.current = eventId
    resetEventScopedState(
      {
        setEventLevelDriverProgressionClass,
        setEventLevelDriverLapChartClassOverride,
        setEventLevelLapChartDriverIds,
        setEventLevelLapChartRaceId,
        setEventLevelLapChartSessionTypeFilter,
        setEventLevelDriverLapChartExpanded,
        setEventLevelLapChartClosestOnly,
        setDriverCompareEventClassFilter,
        setDriverCompareEventTaxonomyNodeFilter,
        setUnifiedChartDriverIds,
        setChartViewState,
        setPanelExpanded,
      },
      prevEventLevelLapSeedKeyRef
    )
  }, [eventId])

  const isPanelExpanded = useCallback(
    (panelId: AnalysisGlassPanelId) => panelExpanded[panelId] ?? true,
    [panelExpanded]
  )

  const setPanelExpandedOne = useCallback((panelId: AnalysisGlassPanelId, expanded: boolean) => {
    setPanelExpanded((prev) => ({ ...prev, [panelId]: expanded }))
  }, [])

  const togglePanelExpanded = useCallback((panelId: AnalysisGlassPanelId) => {
    setPanelExpanded((prev) => ({
      ...prev,
      [panelId]: !(prev[panelId] ?? true),
    }))
  }, [])

  const value = useMemo<EventAnalysisUiStateValue>(
    () => ({
      eventId,
      eventLevelDriverProgressionClass,
      setEventLevelDriverProgressionClass,
      eventLevelDriverLapChartClassOverride,
      setEventLevelDriverLapChartClassOverride,
      eventLevelLapChartDriverIds,
      setEventLevelLapChartDriverIds,
      eventLevelLapChartRaceId,
      setEventLevelLapChartRaceId,
      eventLevelLapChartSessionTypeFilter,
      setEventLevelLapChartSessionTypeFilter,
      eventLevelDriverLapChartExpanded,
      setEventLevelDriverLapChartExpanded,
      eventLevelLapChartClosestOnly,
      setEventLevelLapChartClosestOnly,
      driverCompareEventClassFilter,
      setDriverCompareEventClassFilter,
      driverCompareEventTaxonomyNodeFilter,
      setDriverCompareEventTaxonomyNodeFilter,
      unifiedChartDriverIds,
      setUnifiedChartDriverIds,
      chartViewState,
      setChartViewState,
      isPanelExpanded,
      setPanelExpanded: setPanelExpandedOne,
      togglePanelExpanded,
      prevEventLevelLapSeedKeyRef,
    }),
    [
      eventId,
      eventLevelDriverProgressionClass,
      eventLevelDriverLapChartClassOverride,
      eventLevelLapChartDriverIds,
      eventLevelLapChartRaceId,
      eventLevelLapChartSessionTypeFilter,
      eventLevelDriverLapChartExpanded,
      eventLevelLapChartClosestOnly,
      driverCompareEventClassFilter,
      driverCompareEventTaxonomyNodeFilter,
      unifiedChartDriverIds,
      chartViewState,
      isPanelExpanded,
      setPanelExpandedOne,
      togglePanelExpanded,
    ]
  )

  return (
    <EventAnalysisUiStateContext.Provider value={value}>
      {children}
    </EventAnalysisUiStateContext.Provider>
  )
}

export function useEventAnalysisUiState(): EventAnalysisUiStateValue {
  const ctx = useContext(EventAnalysisUiStateContext)
  if (!ctx) {
    throw new Error("useEventAnalysisUiState must be used within EventAnalysisUiStateProvider")
  }
  return ctx
}

/** Optional hook for components that may render outside the provider. */
export function useEventAnalysisUiStateOptional(): EventAnalysisUiStateValue | null {
  return useContext(EventAnalysisUiStateContext)
}
