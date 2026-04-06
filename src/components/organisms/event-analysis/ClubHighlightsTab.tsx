/**
 * @fileoverview Club Highlights tab – club-level highlights for the selected track context
 */

"use client"

import { typography } from "@/lib/typography"

export interface ClubHighlightsTabProps {
  trackName: string
}

export default function ClubHighlightsTab({ trackName }: ClubHighlightsTabProps) {
  return (
    <div
      className="space-y-6"
      role="tabpanel"
      id="tabpanel-club-highlights"
      aria-labelledby="tab-club-highlights"
    >
      <div className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6">
        <h2 className={`${typography.h4} mb-2`}>Club Highlights</h2>
        <p className={typography.bodySecondary}>
          Highlights for club activity at {trackName}. Content for this section will appear here.
        </p>
      </div>
    </div>
  )
}
