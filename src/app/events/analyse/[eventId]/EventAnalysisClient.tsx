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
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface EventAnalysisClientProps {
  initialData: EventAnalysisData
}

export default function EventAnalysisClient({
  initialData,
}: EventAnalysisClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([])

  // Only show Overview and Drivers tabs for now (Sessions and Comparisons deferred)
  const availableTabs = [
    { id: "overview" as TabId, label: "Overview" },
    { id: "drivers" as TabId, label: "Drivers" },
  ]

  return (
    <div className="space-y-6">
      <TabNavigation
        tabs={availableTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === "overview" && <OverviewTab data={initialData} />}

      {activeTab === "drivers" && (
        <DriversTab
          data={initialData}
          selectedDriverIds={selectedDriverIds}
          onSelectionChange={setSelectedDriverIds}
        />
      )}

      {activeTab === "sessions" && (
        <div className="text-center py-12">
          <p className="text-[var(--token-text-secondary)]">
            Sessions / Heats tab coming soon
          </p>
        </div>
      )}

      {activeTab === "comparisons" && (
        <div className="text-center py-12">
          <p className="text-[var(--token-text-secondary)]">
            Comparisons tab coming soon
          </p>
        </div>
      )}
    </div>
  )
}

