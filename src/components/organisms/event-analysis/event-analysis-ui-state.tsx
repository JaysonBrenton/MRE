/**
 * @fileoverview Persisted UI state for Event Level Analysis (survives primary tab switches).
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
import { arrayMove } from "@dnd-kit/sortable"
import {
  EVENT_LEVEL_ANALYSIS_PANEL_IDS,
  allAnalysisPanelIds,
  computePanelDisplayOrder,
  defaultPanelOrder,
  expandSequenceFromHomeOrder,
  loadPanelOrder,
  savePanelOrder,
  type AnalysisGlassPanelId,
  type EventLevelAnalysisPanelId,
  type StoredPanelOrder,
} from "@/components/organisms/event-analysis/analysis-panel-order"

export {
  EVENT_LEVEL_ANALYSIS_PANEL_IDS,
  type AnalysisGlassPanelId,
  type EventLevelAnalysisPanelId,
} from "@/components/organisms/event-analysis/analysis-panel-order"

/** Decision D3: every card starts collapsed (mini) on first visit per event. */
function defaultPanelExpanded(): Record<string, boolean> {
  return Object.fromEntries(allAnalysisPanelIds().map((id) => [id, false]))
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
  setAllPanelsExpanded: (expanded: boolean) => void
  getPanelDisplayOrder: (panelId: AnalysisGlassPanelId) => number
  eventLevelPanelOrder: EventLevelAnalysisPanelId[]
  reorderEventLevelPanels: (activeId: string, overId: string) => void
  resetPanelOrder: () => void
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
    setPanelExpandSequence: Dispatch<SetStateAction<Record<string, number>>>
    setEventLevelPanelOrder: Dispatch<SetStateAction<EventLevelAnalysisPanelId[]>>
  },
  seedKeyRef: MutableRefObject<string>,
  panelOrder: StoredPanelOrder
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
  setters.setPanelExpandSequence({})
  setters.setEventLevelPanelOrder(panelOrder.event)
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
  const [panelExpandSequence, setPanelExpandSequence] = useState<Record<string, number>>({})
  const [eventLevelPanelOrder, setEventLevelPanelOrder] = useState<EventLevelAnalysisPanelId[]>(
    () => [...EVENT_LEVEL_ANALYSIS_PANEL_IDS]
  )
  const prevEventLevelLapSeedKeyRef = useRef("")
  const lastEventIdRef = useRef<string | null>(null)
  const panelOrderRef = useRef({
    event: [...EVENT_LEVEL_ANALYSIS_PANEL_IDS] as EventLevelAnalysisPanelId[],
  })

  useEffect(() => {
    if (!eventId) {
      lastEventIdRef.current = null
      return
    }
    if (lastEventIdRef.current === eventId) return
    lastEventIdRef.current = eventId
    const order = loadPanelOrder(eventId)
    panelOrderRef.current = order
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
        setPanelExpandSequence,
        setEventLevelPanelOrder,
      },
      prevEventLevelLapSeedKeyRef,
      order
    )
  }, [eventId])

  const nextExpandSequence = useCallback((prevSequence: Record<string, number>) => {
    let max = -1
    for (const id of EVENT_LEVEL_ANALYSIS_PANEL_IDS) {
      const seq = prevSequence[id]
      if (seq != null && seq > max) max = seq
    }
    return max + 1
  }, [])

  const expandedStackForHomeOrder = useCallback(
    (homeOrder: readonly string[]) => {
      return homeOrder
        .filter((id) => panelExpanded[id])
        .sort((a, b) => (panelExpandSequence[a] ?? 0) - (panelExpandSequence[b] ?? 0))
    },
    [panelExpanded, panelExpandSequence]
  )

  const eventLevelDisplayOrder = useMemo(
    () =>
      computePanelDisplayOrder(
        eventLevelPanelOrder,
        expandedStackForHomeOrder(eventLevelPanelOrder)
      ),
    [eventLevelPanelOrder, expandedStackForHomeOrder]
  )

  const getPanelDisplayOrder = useCallback(
    (panelId: AnalysisGlassPanelId) => eventLevelDisplayOrder.get(panelId) ?? 0,
    [eventLevelDisplayOrder]
  )

  const isPanelExpanded = useCallback(
    (panelId: AnalysisGlassPanelId) => panelExpanded[panelId] ?? false,
    [panelExpanded]
  )

  const setPanelExpandedOne = useCallback(
    (panelId: AnalysisGlassPanelId, expanded: boolean) => {
      setPanelExpanded((prev) => ({ ...prev, [panelId]: expanded }))
      setPanelExpandSequence((prev) => {
        if (!expanded) {
          if (prev[panelId] == null) return prev
          const next = { ...prev }
          delete next[panelId]
          return next
        }
        if (prev[panelId] != null) return prev
        return { ...prev, [panelId]: nextExpandSequence(prev) }
      })
    },
    [nextExpandSequence]
  )

  const togglePanelExpanded = useCallback(
    (panelId: AnalysisGlassPanelId) => {
      const expanded = !(panelExpanded[panelId] ?? false)
      setPanelExpandedOne(panelId, expanded)
    },
    [panelExpanded, setPanelExpandedOne]
  )

  const setAllPanelsExpanded = useCallback((expanded: boolean) => {
    const homeOrder = panelOrderRef.current.event

    setPanelExpanded((prev) => {
      const next = { ...prev }
      for (const id of EVENT_LEVEL_ANALYSIS_PANEL_IDS) next[id] = expanded
      return next
    })

    setPanelExpandSequence((prev) => {
      const next = { ...prev }
      if (expanded) {
        const fromHome = expandSequenceFromHomeOrder(homeOrder)
        for (const id of EVENT_LEVEL_ANALYSIS_PANEL_IDS) {
          if (fromHome[id] != null) next[id] = fromHome[id]
        }
      } else {
        for (const id of EVENT_LEVEL_ANALYSIS_PANEL_IDS) delete next[id]
      }
      return next
    })
  }, [])

  const persistPanelOrder = useCallback(
    (eventOrder: EventLevelAnalysisPanelId[]) => {
      if (!eventId) return
      panelOrderRef.current = { event: eventOrder }
      savePanelOrder(eventId, { event: eventOrder })
    },
    [eventId]
  )

  const reorderList = useCallback(
    <T extends string>(items: T[], activeId: string, overId: string): T[] => {
      const oldIndex = items.indexOf(activeId as T)
      const newIndex = items.indexOf(overId as T)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return items
      return arrayMove(items, oldIndex, newIndex)
    },
    []
  )

  const reorderEventLevelPanels = useCallback(
    (activeId: string, overId: string) => {
      setEventLevelPanelOrder((prev) => {
        const next = reorderList(prev, activeId, overId)
        persistPanelOrder(next)
        return next
      })
    },
    [persistPanelOrder, reorderList]
  )

  const resetPanelOrder = useCallback(() => {
    const defaults = defaultPanelOrder()
    setEventLevelPanelOrder(defaults.event)
    persistPanelOrder(defaults.event)
  }, [persistPanelOrder])

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
      setAllPanelsExpanded,
      getPanelDisplayOrder,
      eventLevelPanelOrder,
      reorderEventLevelPanels,
      resetPanelOrder,
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
      setAllPanelsExpanded,
      getPanelDisplayOrder,
      eventLevelPanelOrder,
      reorderEventLevelPanels,
      resetPanelOrder,
      panelExpanded,
      panelExpandSequence,
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
