"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { DensityPreference, EventAnalysisSummary, ImportedEventSummary } from "@root-types/dashboard"

const STORAGE_KEYS = {
  selectedEvent: "mre-selected-event-id",
  density: "mre-dashboard-density",
  navCollapsed: "mre-dashboard-nav-collapsed",
}

interface DashboardContextValue {
  selectedEventId: string | null
  selectedEvent: EventAnalysisSummary["event"] | null
  eventSummary: EventAnalysisSummary["summary"] | null
  topDrivers: EventAnalysisSummary["topDrivers"]
  mostConsistentDrivers: EventAnalysisSummary["mostConsistentDrivers"]
  bestAvgLapDrivers: EventAnalysisSummary["bestAvgLapDrivers"]
  userBestLap: EventAnalysisSummary["userBestLap"]
  userBestConsistency: EventAnalysisSummary["userBestConsistency"]
  userBestAvgLap: EventAnalysisSummary["userBestAvgLap"]
  isEventLoading: boolean
  eventError: string | null
  recentEvents: ImportedEventSummary[]
  isRecentLoading: boolean
  selectEvent: (eventId: string | null) => void
  refreshEventData: () => Promise<void>
  fetchRecentEvents: (eventScope?: "all" | "my") => Promise<void>
  density: DensityPreference
  setDensity: (density: DensityPreference) => void
  isNavCollapsed: boolean
  toggleNavCollapsed: () => void
  setNavCollapsed: (state: boolean) => void
  isCommandPaletteOpen: boolean
  openCommandPalette: () => void
  closeCommandPalette: () => void
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined)

export function DashboardContextProvider({ children }: { children: React.ReactNode }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [eventData, setEventData] = useState<EventAnalysisSummary | null>(null)
  const [isEventLoading, setIsEventLoading] = useState(true)
  const [eventError, setEventError] = useState<string | null>(null)
  const [recentEvents, setRecentEvents] = useState<ImportedEventSummary[]>([])
  const [isRecentLoading, setIsRecentLoading] = useState(true)
  const [density, setDensityState] = useState<DensityPreference>("comfortable")
  const [isNavCollapsed, setIsNavCollapsed] = useState(false)
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Hydrate persisted preferences on mount
  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const storedEventId = sessionStorage.getItem(STORAGE_KEYS.selectedEvent)
    const storedDensity = window.localStorage.getItem(STORAGE_KEYS.density) as DensityPreference | null
    const storedNavState = window.localStorage.getItem(STORAGE_KEYS.navCollapsed)

    if (storedEventId) {
      setSelectedEventId(storedEventId)
    } else {
      setIsEventLoading(false)
    }

    if (storedDensity && ["compact", "comfortable", "spacious"].includes(storedDensity)) {
      setDensityState(storedDensity)
    }

    if (storedNavState) {
      setIsNavCollapsed(storedNavState === "true")
    }
  }, [])

  const fetchEventData = useCallback(async (eventId: string) => {
    setIsEventLoading(true)
    setEventError(null)

    try {
      const response = await fetch(`/api/v1/events/${eventId}/summary`, { cache: "no-store" })

      if (!response.ok) {
        if (response.status === 404) {
          sessionStorage.removeItem(STORAGE_KEYS.selectedEvent)
          setSelectedEventId(null)
          setEventData(null)
          setEventError("Event not found")
        } else {
          setEventError("Failed to load event data")
        }
        return
      }

      const result = await response.json()

      if (result.success && result.data) {
        setEventData(result.data)
      } else {
        setEventError("Invalid response from server")
      }
    } catch (error) {
      console.error("Error fetching event summary", error)
      setEventError("Failed to fetch event data")
    } finally {
      setIsEventLoading(false)
    }
  }, [])

  const fetchRecentEvents = useCallback(async (eventScope: "all" | "my" = "all") => {
    setIsRecentLoading(true)
    try {
      // Build query string with limit and optional filter
      const params = new URLSearchParams({ limit: "8" })
      if (eventScope === "my") {
        params.append("filter", "my")
      }
      
      const response = await fetch(`/api/v1/events?${params.toString()}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Failed to load recent events")
      }
      const json = await response.json()
      if (json.success && Array.isArray(json.data?.events)) {
        setRecentEvents(json.data.events)
      }
    } catch (error) {
      console.error("Error fetching recent events", error)
    } finally {
      setIsRecentLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRecentEvents()
  }, [fetchRecentEvents])

  useEffect(() => {
    if (!selectedEventId) {
      setEventData(null)
      setIsEventLoading(false)
      return
    }

    fetchEventData(selectedEventId)
  }, [selectedEventId, fetchEventData])

  const selectEvent = useCallback((eventId: string | null) => {
    if (typeof window !== "undefined") {
      if (eventId) {
        sessionStorage.setItem(STORAGE_KEYS.selectedEvent, eventId)
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.selectedEvent)
      }
    }
    setSelectedEventId(eventId)
  }, [])

  const refreshEventData = useCallback(async () => {
    if (!selectedEventId) {
      return
    }
    await fetchEventData(selectedEventId)
  }, [fetchEventData, selectedEventId])

  const setDensity = useCallback((value: DensityPreference) => {
    setDensityState(value)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.density, value)
    }
  }, [])

  const setNavCollapsed = useCallback((state: boolean) => {
    setIsNavCollapsed(state)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.navCollapsed, String(state))
    }
  }, [])

  const toggleNavCollapsed = useCallback(() => {
    setNavCollapsed(!isNavCollapsed)
  }, [isNavCollapsed, setNavCollapsed])

  const openCommandPalette = useCallback(() => setCommandPaletteOpen(true), [])
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), [])

  const value = useMemo<DashboardContextValue>(() => ({
    selectedEventId,
    selectedEvent: eventData?.event ?? null,
    eventSummary: eventData?.summary ?? null,
    topDrivers: eventData?.topDrivers,
    mostConsistentDrivers: eventData?.mostConsistentDrivers,
    bestAvgLapDrivers: eventData?.bestAvgLapDrivers,
    userBestLap: eventData?.userBestLap,
    userBestConsistency: eventData?.userBestConsistency,
    userBestAvgLap: eventData?.userBestAvgLap,
    isEventLoading,
    eventError,
    recentEvents,
    isRecentLoading,
    selectEvent,
    refreshEventData,
    fetchRecentEvents,
    density,
    setDensity,
    isNavCollapsed,
    toggleNavCollapsed,
    setNavCollapsed,
    isCommandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
  }), [
    closeCommandPalette,
    density,
    eventData,
    eventError,
    fetchRecentEvents,
    isCommandPaletteOpen,
    isEventLoading,
    isNavCollapsed,
    isRecentLoading,
    openCommandPalette,
    recentEvents,
    refreshEventData,
    selectEvent,
    selectedEventId,
    setDensity,
    setNavCollapsed,
    toggleNavCollapsed,
  ])

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboardContext() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error("useDashboardContext must be used within DashboardContextProvider")
  }
  return context
}
