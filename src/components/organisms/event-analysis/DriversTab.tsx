/**
 * @fileoverview Drivers tab component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-01-31
 *
 * @description Drivers tab content for event analysis
 *
 * @purpose Displays combined entry list with driver stats (one table, no selection).
 *
 * @relatedFiles
 * - src/components/event-analysis/CombinedDriversTable.tsx (combined table)
 */

"use client"

import CombinedDriversTable from "./CombinedDriversTable"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface DriversTabProps {
  data: EventAnalysisData
  selectedClass?: string | null
  onClassChange?: (className: string | null) => void
}

export default function DriversTab({
  data,
  selectedClass,
  onClassChange,
}: DriversTabProps) {
  return (
    <div className="space-y-6" role="tabpanel" id="tabpanel-drivers" aria-labelledby="tab-drivers">
      <CombinedDriversTable
        data={data}
        selectedClass={selectedClass}
        onClassChange={onClassChange}
      />
    </div>
  )
}
