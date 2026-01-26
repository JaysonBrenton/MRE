/**
 * @fileoverview Dashboard-level Event Search modal + keyboard shortcuts
 *
 * Holds EventSearchModal state, renders the modal, and registers shortcuts
 * (e.g. ⌘E Find Events, ⌘⌥R Refresh) so they work across the dashboard
 * even when the sidebar is not mounted (no event selected).
 */

"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { selectEvent } from "@/store/slices/dashboardSlice"
import EventSearchModal from "@/components/dashboard/shell/EventSearchModal"

type ActionId = "refresh" | "select-drivers" | "clear-event"
type ActionRegistry = Partial<Record<ActionId, () => void>>

interface DashboardEventSearchContextValue {
  openEventSearch: () => void
  closeEventSearch: () => void
  isEventSearchOpen: boolean
  registerAction: (id: ActionId, handler: () => void) => void
  unregisterAction: (id: ActionId) => void
}

const DashboardEventSearchContext = createContext<DashboardEventSearchContextValue | null>(null)

export function useDashboardEventSearch() {
  const ctx = useContext(DashboardEventSearchContext)
  if (!ctx) {
    throw new Error("useDashboardEventSearch must be used within DashboardEventSearchProvider")
  }
  return ctx
}

export function useDashboardEventSearchOptional() {
  return useContext(DashboardEventSearchContext)
}

interface DashboardEventSearchProviderProps {
  children: React.ReactNode
}

export default function DashboardEventSearchProvider({ children }: DashboardEventSearchProviderProps) {
  const [isEventSearchOpen, setIsEventSearchOpen] = useState(false)
  const actionsRef = useRef<ActionRegistry>({})
  const dispatch = useAppDispatch()
  const selectedEventId = useAppSelector((state) => state.dashboard.selectedEventId)

  const openEventSearch = useCallback(() => setIsEventSearchOpen(true), [])
  const closeEventSearch = useCallback(() => setIsEventSearchOpen(false), [])

  const registerAction = useCallback((id: ActionId, handler: () => void) => {
    actionsRef.current[id] = handler
  }, [])

  const unregisterAction = useCallback((id: ActionId) => {
    delete actionsRef.current[id]
  }, [])

  const handleSelectEvent = useCallback(
    (eventId: string) => {
      dispatch(selectEvent(eventId))
      closeEventSearch()
    },
    [dispatch, closeEventSearch]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const inInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      if (inInput) return
      if (isEventSearchOpen) return

      const mac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
      const mod = mac ? e.metaKey : e.ctrlKey
      const k = e.key.toLowerCase()

      if (mod && e.shiftKey && k === "e") {
        e.preventDefault()
        const fn = actionsRef.current["clear-event"]
        if (fn) fn()
        return
      }

      if (mod && k === "e") {
        e.preventDefault()
        openEventSearch()
        return
      }

      if (mod && e.altKey && k === "r") {
        e.preventDefault()
        const fn = actionsRef.current["refresh"]
        if (fn) fn()
        return
      }

      if (mod && k === "d") {
        e.preventDefault()
        const fn = actionsRef.current["select-drivers"]
        if (fn) fn()
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isEventSearchOpen, openEventSearch])

  const value: DashboardEventSearchContextValue = {
    openEventSearch,
    closeEventSearch,
    isEventSearchOpen,
    registerAction,
    unregisterAction,
  }

  return (
    <DashboardEventSearchContext.Provider value={value}>
      {children}
      <EventSearchModal
        isOpen={isEventSearchOpen}
        onClose={closeEventSearch}
        onSelectEvent={handleSelectEvent}
        selectedEventId={selectedEventId}
      />
    </DashboardEventSearchContext.Provider>
  )
}
