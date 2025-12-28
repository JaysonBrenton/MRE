/**
 * @fileoverview Drivers tab component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Drivers tab content for event analysis
 * 
 * @purpose Displays driver list with stats, supports selection and sorting.
 *          Mobile-friendly with card layout on small screens.
 * 
 * @relatedFiles
 * - src/components/event-analysis/DriverList.tsx (driver list)
 */

"use client"

import DriverList from "./DriverList"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface DriversTabProps {
  data: EventAnalysisData
  selectedDriverIds: string[]
  onSelectionChange: (driverIds: string[]) => void
}

export default function DriversTab({
  data,
  selectedDriverIds,
  onSelectionChange,
}: DriversTabProps) {
  return (
    <div className="space-y-4" role="tabpanel" id="tabpanel-drivers" aria-labelledby="tab-drivers">
      <div>
        <h2 className="text-xl font-semibold text-[var(--token-text-primary)] mb-2">
          Drivers
        </h2>
        <p className="text-sm text-[var(--token-text-secondary)] mb-4">
          Select drivers to compare in the Comparisons tab
        </p>
      </div>

      {data.drivers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--token-text-secondary)]">
            No driver data available for this event.
          </p>
        </div>
      ) : (
        <DriverList
          drivers={data.drivers}
          selectedDriverIds={selectedDriverIds}
          onSelectionChange={onSelectionChange}
        />
      )}
    </div>
  )
}
