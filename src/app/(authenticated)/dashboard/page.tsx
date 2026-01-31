/**
 * @fileoverview Dashboard page - Overview page
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-28
 *
 * @description Dashboard/Overview page for My Race Engineer
 *
 * @purpose Renders the driver-first dashboard composed of modern racing widgets
 *          (hero context, KPIs, telemetry snapshot, activity, weather, etc.).
 *          This page is protected and requires authentication.
 *          Supports eventId query parameter to auto-select an event.
 *
 * @relatedFiles
 * - src/components/dashboard/DashboardClient.tsx (dashboard content/widgets)
 * - src/components/dashboard/EventAnalysisSection.tsx (event analysis section)
 * - src/app/(authenticated)/layout.tsx (shared immersive layout)
 * - src/lib/auth.ts (authentication check)
 */

import { Suspense } from "react"
import DashboardClient from "@/components/organisms/dashboard/DashboardClient"
import EventAnalysisSection from "@/components/organisms/dashboard/EventAnalysisSection"
import DashboardEventSelector from "@/components/organisms/dashboard/DashboardEventSelector"
import DashboardEventSearchProvider from "@/components/organisms/dashboard/DashboardEventSearchProvider"

interface DashboardProps {
  searchParams: Promise<{
    eventId?: string
  }>
}

function DashboardEventSelectorWrapper({ eventId }: { eventId: string | null }) {
  return <DashboardEventSelector eventId={eventId} />
}

export default async function Dashboard({ searchParams }: DashboardProps) {
  const params = await searchParams
  const eventId = params.eventId

  return (
    <section className="content-wrapper w-full min-w-0">
      <Suspense fallback={null}>
        <DashboardEventSelectorWrapper eventId={eventId ?? null} />
      </Suspense>
      <DashboardEventSearchProvider>
        <DashboardClient />
        <EventAnalysisSection />
      </DashboardEventSearchProvider>
    </section>
  )
}
