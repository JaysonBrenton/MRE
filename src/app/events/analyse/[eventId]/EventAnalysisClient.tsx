/**
 * @fileoverview Event Analysis client component - handles client-side state
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Client component for managing tab state and driver selection
 * 
 * @purpose Separates client-side interactivity from server component.
 *          Manages tab navigation and driver selection state.
 * 
 * @relatedFiles
 * - src/app/events/analyse/[eventId]/page.tsx (parent server component)
 */

"use client"

import { startTransition, useEffect, useState } from "react"
import TabNavigation, { type TabId } from "@/components/event-analysis/TabNavigation"
import OverviewTab from "@/components/event-analysis/OverviewTab"
import DriversTab from "@/components/event-analysis/DriversTab"
import SessionsTab from "@/components/event-analysis/SessionsTab"
import ComparisonsTab from "@/components/event-analysis/ComparisonsTab"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface EventAnalysisClientProps {
  initialData: EventAnalysisData
}

const STORAGE_KEY_SELECTED_DRIVERS = "mre-overview-selected-drivers"

export default function EventAnalysisClient({
  initialData,
}: EventAnalysisClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    try {
      const storedDrivers = window.localStorage.getItem(
        STORAGE_KEY_SELECTED_DRIVERS
      )
      const parsed = storedDrivers ? JSON.parse(storedDrivers) : []
      if (Array.isArray(parsed) && parsed.length > 0) {
        startTransition(() => {
          setSelectedDriverIds(parsed)
        })
      }
    } catch {
      // Ignore malformed localStorage data and fall back to defaults
    }
  }, [])

  // Persist driver selections for subsequent visits
  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      STORAGE_KEY_SELECTED_DRIVERS,
      JSON.stringify(selectedDriverIds)
    )
  }, [selectedDriverIds])

  const availableTabs = [
    { id: "overview" as TabId, label: "Overview" },
    { id: "drivers" as TabId, label: "Drivers" },
    { id: "sessions" as TabId, label: "Sessions / Heats" },
    { id: "comparisons" as TabId, label: "Comparisons" },
  ]

  return (
    <div className="space-y-6">
      <TabNavigation
        tabs={availableTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === "overview" && (
        <OverviewTab
          data={initialData}
          selectedDriverIds={selectedDriverIds}
          onDriverSelectionChange={setSelectedDriverIds}
        />
      )}

      {activeTab === "drivers" && (
        <DriversTab
          data={initialData}
          selectedDriverIds={selectedDriverIds}
          onSelectionChange={setSelectedDriverIds}
        />
      )}

      {activeTab === "sessions" && <SessionsTab />}

      {activeTab === "comparisons" && <ComparisonsTab />}
    </div>
  )
}
