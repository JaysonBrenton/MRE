/**
 * @fileoverview Drivers tab component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-04-06
 *
 * @description Entry List tab content: shows `EventEntry` rows from MRE (same payload as
 *              getEventAnalysisData.entryList), not a live LiveRC scrape.
 *
 * @relatedFiles
 * - src/core/events/get-event-analysis-data.ts (entryList from prisma.eventEntry)
 * - src/components/organisms/event-analysis/EntryList.tsx
 */

"use client"

import TabPanelIntro from "@/components/molecules/TabPanelIntro"
import EntryList from "./EntryList"
import ChartContainer from "./ChartContainer"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { getSessionAnalysisNavClassOptions } from "@/core/events/entry-list-class-options"

export interface DriversTabProps {
  data: EventAnalysisData
  selectedClass?: string | null
  onClassChange?: (className: string | null) => void
}

export default function DriversTab({ data }: DriversTabProps) {
  return (
    <div className="space-y-6" role="tabpanel" id="tabpanel-drivers" aria-labelledby="tab-drivers">
      <TabPanelIntro
        eyebrow="Entry list"
        title="Drivers and entries"
        description="Registered drivers, classes, transponders, and car numbers for this event."
      />
      <div id="drivers-table-region">
        {data.entryList.length === 0 ? (
          <ChartContainer aria-label="Entry list - no data available">
            <div className="flex h-64 items-center justify-center text-[var(--token-text-secondary)]">
              No entry list data available for this event.
            </div>
          </ChartContainer>
        ) : (
          <EntryList
            entries={data.entryList}
            raceClasses={data.raceClasses}
            eventId={data.event.id}
            classFilterOptions={getSessionAnalysisNavClassOptions(data)}
          />
        )}
      </div>
    </div>
  )
}
