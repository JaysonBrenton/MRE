/**
 * @fileoverview Event Actions Context for global event action handlers
 *
 * @created 2025-01-29
 * @creator System
 * @lastModified 2025-01-29
 *
 * @description Provides global access to event actions (Find Events, Refresh, Select Drivers, Clear Event)
 *              and their associated modal states. This context is used by AdaptiveNavigationRail
 *              to provide action buttons in the navigation sidebar.
 *
 * @purpose Centralizes event action handlers and modal state management so actions are available
 *          globally from the navigation rail, not just on event analysis pages.
 *
 * @relatedFiles
 * - src/components/dashboard/EventActionsProvider.tsx (provider component)
 * - src/components/dashboard/shell/AdaptiveNavigationRail.tsx (uses this context)
 */

"use client"

import { createContext, useContext } from "react"

export interface EventActionsContextValue {
  // Event search (delegates to DashboardEventSearchProvider)
  openEventSearch: () => void

  // Refresh event data
  handleRefreshEventData: () => Promise<void>
  isRefreshing: boolean

  // Driver selection modal
  openDriverSelection: () => void
  closeDriverSelection: () => void
  isDriverModalOpen: boolean

  // Class details modal
  openClassDetails: (className: string) => void
  closeClassDetails: () => void
  isClassDetailsModalOpen: boolean
  selectedClassForDetails: string | null

  // Clear event
  clearEvent: () => void

  // Driver selection state
  selectedDriverIds: string[]
  onDriverSelectionChange: (driverIds: string[]) => void
  selectedClass: string | null
  onClassChange: (className: string | null) => void

  // Event state
  selectedEventId: string | null
  hasEventSelected: boolean
}

export const EventActionsContext = createContext<EventActionsContextValue | null>(null)

export function useEventActions() {
  const ctx = useContext(EventActionsContext)
  if (!ctx) {
    throw new Error("useEventActions must be used within EventActionsProvider")
  }
  return ctx
}

export function useEventActionsOptional() {
  return useContext(EventActionsContext)
}
