/**
 * @fileoverview Drivers tab component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-01-31
 *
 * @description Drivers tab content for event analysis. Shows LiveRC entry list
 *              when event has sourceEventId and trackSlug; otherwise a short message.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/LiveRCEntryListTable.tsx
 * - src/app/api/v1/events/[eventId]/entry-list/route.ts
 */

"use client"

import LiveRCEntryListTable from "./LiveRCEntryListTable"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface DriversTabProps {
  data: EventAnalysisData
  selectedClass?: string | null
  onClassChange?: (className: string | null) => void
}

export default function DriversTab({ data }: DriversTabProps) {
  return (
    <div className="space-y-6" role="tabpanel" id="tabpanel-drivers" aria-labelledby="tab-drivers">
      <div>
        <h2 className="text-xl font-semibold text-[var(--token-text-primary)] mb-2">Entry list</h2>
      </div>

      <div id="drivers-table-region">
        <LiveRCEntryListTable eventId={data.event.id} />
      </div>
    </div>
  )
}
