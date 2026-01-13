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
import ChartContainer from "./ChartContainer"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface EntryListTabProps {
  data: EventAnalysisData
}

export default function EntryListTab({ data }: EntryListTabProps) {
  return (
    <div className="space-y-6" role="tabpanel" id="tabpanel-entry-list" aria-labelledby="tab-entry-list">
      {data.entryList.length === 0 ? (
        <ChartContainer
          title="Entry List"
          description="Complete list of drivers entered in this event"
          aria-label="Entry list - no data available"
        >
          <div className="flex items-center justify-center h-64 text-[var(--token-text-secondary)]">
            No entry list data available for this event.
          </div>
        </ChartContainer>
      ) : (
        <EntryList entries={data.entryList} raceClasses={data.raceClasses} eventId={data.event.id} />
      )}
    </div>
  )
}

