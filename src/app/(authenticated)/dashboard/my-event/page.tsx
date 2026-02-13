/**
 * @fileoverview My Event page - displays events matched via fuzzy logic
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-02-01
 *
 * @description Page showing events where the user's driver name was matched using fuzzy matching.
 * Content is provided by MyEventsContent component, shared with the My Events tab in SessionChartTabs.
 *
 * @purpose Entry point for sidebar/URL navigation to My Events. Renders breadcrumbs, header,
 *          and MyEventsContent. The same content is also embedded in the Sessions tab.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/MyEventsContent.tsx
 * - src/components/organisms/event-analysis/sessions/SessionChartTabs.tsx
 * - src/app/api/v1/personas/driver/events/route.ts
 * - src/app/api/v1/users/me/driver-links/events/[eventId]/route.ts
 */

"use client"

import Breadcrumbs from "@/components/atoms/Breadcrumbs"
import MyEventsContent from "@/components/organisms/event-analysis/MyEventsContent"

export default function MyEventPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Breadcrumbs
        items={[{ label: "My Event Analysis", href: "/dashboard" }, { label: "My Events" }]}
      />
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-[var(--token-text-primary)]">My Events</h1>
            <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
              Events matched to your driver name
            </p>
          </div>
        </div>
      </div>
      <MyEventsContent />
    </div>
  )
}
