/**
 * @fileoverview Event Search page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Event Search page for authenticated users to search for race events
 * 
 * @purpose Provides the Event Search interface where Drivers can select a track and
 *          date range to search for events. This page implements:
 *          - DB-backed search by track and date range
 *          - LiveRC event discovery for selected tracks
 *          - Import (ingestion) flow through "Import All" and related actions
 * 
 * @relatedFiles
 * - src/components/event-search/EventSearchContainer.tsx (main search component)
 * - src/app/(authenticated)/layout.tsx (shared layout wrapper)
 * - docs/frontend/liverc/user-workflow.md (complete UX specification)
 * - src/lib/auth.ts (authentication check)
 */

import EventSearchContainer from "@/components/event-search/EventSearchContainer"

export default async function EventSearchPage() {
  return (
    <section className="content-wrapper mx-auto w-full min-w-0 max-w-6xl flex-shrink-0">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">
          Event Search
        </h1>
        <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
          Search for race events by track and date range
        </p>
      </div>
      <EventSearchContainer />
    </section>
  )
}
