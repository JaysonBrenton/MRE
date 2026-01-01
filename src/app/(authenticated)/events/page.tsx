/**
 * @fileoverview Events list page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Events list page showing available race events
 * 
 * @purpose Displays a list of race events with filtering options and event cards.
 *          Users can browse and select events to view detailed analysis.
 * 
 * @relatedFiles
 * - src/components/events/EventsPageClient.tsx (client component)
 * - src/app/(authenticated)/layout.tsx (shared layout wrapper)
 * - src/lib/auth.ts (authentication check)
 */

import Breadcrumbs from "@/components/Breadcrumbs"
import EventsPageClient from "@/components/events/EventsPageClient"

export default async function EventsPage() {
  return (
    <section className="content-wrapper mx-auto w-full min-w-0 max-w-6xl">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/welcome" },
          { label: "Events" },
        ]}
      />
      <EventsPageClient />
    </section>
  )
}

