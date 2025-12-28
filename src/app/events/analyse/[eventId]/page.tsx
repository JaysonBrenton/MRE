/**
 * @fileoverview Event Analysis page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Event Analysis page for authenticated users to analyze race event data
 * 
 * @purpose Provides the Event Analysis interface where Drivers can view and analyze
 *          race data for a specific event. Features interactive charts, driver lists,
 *          and comprehensive event statistics.
 * 
 * @relatedFiles
 * - src/components/AuthenticatedNav.tsx (navigation)
 * - src/components/event-analysis/ (all analysis components)
 * - src/core/events/get-event-analysis-data.ts (data fetching)
 * - docs/frontend/liverc/user-workflow.md (complete UX specification)
 * - src/lib/auth.ts (authentication check)
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AuthenticatedNav from "@/components/AuthenticatedNav"
import Breadcrumbs from "@/components/Breadcrumbs"
import EventAnalysisHeader from "@/components/event-analysis/EventAnalysisHeader"
import { getEventAnalysisData } from "@/core/events/get-event-analysis-data"
import EventAnalysisClient from "./EventAnalysisClient"

interface EventAnalysisPageProps {
  params: Promise<{
    eventId: string
  }>
}

export default async function EventAnalysisPage({ params }: EventAnalysisPageProps) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const { eventId } = await params

  // Fetch event analysis data
  const analysisData = await getEventAnalysisData(eventId)

  if (!analysisData) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-[var(--token-surface)]">
        <AuthenticatedNav />
        <main className="page-container flex-1 w-full min-w-0 px-4 py-8 sm:px-6 lg:px-8">
          <section className="content-wrapper mx-auto w-full min-w-0 max-w-4xl">
            <div className="text-center space-y-4">
              <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--token-text-primary)]">
                Event Not Found
              </h1>
              <p className="text-[var(--token-text-secondary)]">
                The event you&apos;re looking for doesn&rsquo;t exist or has been removed.
              </p>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-[var(--token-surface)]">
      <AuthenticatedNav />
      <main className="page-container flex-1 w-full min-w-0 px-4 py-8 sm:px-6 lg:px-8">
        <section className="content-wrapper mx-auto w-full min-w-0 max-w-6xl">
          <Breadcrumbs
            items={[
              { label: "Welcome", href: "/welcome" },
              { label: "Event Search", href: "/event-search" },
              { label: analysisData.event.eventName },
            ]}
          />
          <EventAnalysisHeader
            eventName={analysisData.event.eventName}
            eventDate={analysisData.event.eventDate}
            trackName={analysisData.event.trackName}
          />

          <EventAnalysisClient initialData={analysisData} />
        </section>
      </main>
    </div>
  )
}
