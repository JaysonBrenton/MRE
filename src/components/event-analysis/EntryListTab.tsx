/**
 * @fileoverview Entry List tab component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Entry List tab content for event analysis
 * 
 * @purpose Displays the actual event entry list with driver names, classes, transponders, and car numbers.
 *          Mobile-friendly with card layout on small screens.
 * 
 * @relatedFiles
 * - src/components/event-analysis/EntryList.tsx (entry list)
 */

"use client"

import EntryList from "./EntryList"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface EntryListTabProps {
  data: EventAnalysisData
}

export default function EntryListTab({ data }: EntryListTabProps) {
  return (
    <div className="space-y-6" role="tabpanel" id="tabpanel-entry-list" aria-labelledby="tab-entry-list">
      <div>
        <h2 className="text-xl font-semibold text-[var(--token-text-primary)] mb-2">
          Entry List
        </h2>
        <p className="text-sm text-[var(--token-text-secondary)] mb-4">
          Complete list of drivers entered in this event
        </p>
      </div>

      {data.entryList.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--token-text-secondary)]">
            No entry list data available for this event.
          </p>
        </div>
      ) : (
        <EntryList entries={data.entryList} />
      )}
    </div>
  )
}

