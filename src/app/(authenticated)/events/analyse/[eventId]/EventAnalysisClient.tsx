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

import { useState } from "react"
import TabNavigation, { type TabId } from "@/components/event-analysis/TabNavigation"
import OverviewTab from "@/components/event-analysis/OverviewTab"
import DriversTab from "@/components/event-analysis/DriversTab"
import EntryListTab from "@/components/event-analysis/EntryListTab"
import SessionsTab from "@/components/event-analysis/SessionsTab"
import ComparisonsTab from "@/components/event-analysis/ComparisonsTab"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface EventAnalysisClientProps {
  initialData: EventAnalysisData
}

export default function EventAnalysisClient({
  initialData,
}: EventAnalysisClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([])

  // Driver selection defaults to empty on page load/refresh (no localStorage persistence)

  const availableTabs = [
    { id: "overview" as TabId, label: "Overview" },
    { id: "drivers" as TabId, label: "Drivers" },
    { id: "entry-list" as TabId, label: "Entry List" },
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

      {activeTab === "entry-list" && (
        <EntryListTab data={initialData} />
      )}

      {activeTab === "sessions" && (
        <SessionsTab
          data={initialData}
          selectedDriverIds={selectedDriverIds}
        />
      )}

      {activeTab === "comparisons" && <ComparisonsTab />}
    </div>
  )
}
