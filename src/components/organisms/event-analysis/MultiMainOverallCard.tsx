/**
 * @fileoverview Multi-main overall standings card for Event Analysis Overview
 *
 * @description Displays overall winners from triple/double main results
 * (e.g. 1/8 Electric Buggy Triple A-Main) - the official LiveRC overall standings.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/MainsCard.tsx (schedule of mains)
 * - src/components/organisms/event-analysis/OverviewTab.tsx (uses this)
 */

"use client"

import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

const CARD_CLASS =
  "mb-6 w-fit rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2"
const HEADING_CLASS = "text-sm font-semibold text-[var(--token-text-primary)] mb-2"
const ROW_CLASS =
  "grid grid-cols-[auto_1fr_1fr] gap-x-2 text-sm text-[var(--token-text-primary)] py-0.5"
const LABEL_CLASS = "text-[var(--token-text-secondary)]"
const PODIUM_CLASS = "font-medium"

export interface MultiMainOverallCardProps {
  multiMainResults: EventAnalysisData["multiMainResults"]
}

export default function MultiMainOverallCard({
  multiMainResults,
}: MultiMainOverallCardProps) {
  if (!multiMainResults || multiMainResults.length === 0) {
    return null
  }

  return (
    <>
      {multiMainResults.map((mm) => (
        <div key={mm.id} className={CARD_CLASS}>
          <h3 className={HEADING_CLASS}>{mm.classLabel} Overall</h3>
          {mm.tieBreaker && (
            <p className="text-xs text-[var(--token-text-secondary)] mb-1">
              Tie breaker: {mm.tieBreaker}
            </p>
          )}
          <div className="space-y-0.5">
            {mm.entries.slice(0, 10).map((entry, idx) => (
              <div key={entry.position} className={ROW_CLASS}>
                <span className={idx < 3 ? PODIUM_CLASS : LABEL_CLASS}>
                  {entry.position === 1
                    ? "🥇"
                    : entry.position === 2
                      ? "🥈"
                      : entry.position === 3
                        ? "🥉"
                        : `${entry.position}.`}
                </span>
                <span>{entry.driverName}</span>
                <span className={LABEL_CLASS}>{entry.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
