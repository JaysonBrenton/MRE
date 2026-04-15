/**
 * @fileoverview Club Highlights tab – club-level highlights for the selected track context
 */

"use client"

import TabPanelIntro from "@/components/molecules/TabPanelIntro"

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
      <TabPanelIntro
        eyebrow="Club"
        title="Club highlights"
        description={`Highlights for club activity at ${trackName}. Content for this section will appear here.`}
      />
    </div>
  )
}
