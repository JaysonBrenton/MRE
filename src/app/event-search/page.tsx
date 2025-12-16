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
 * - src/components/AuthenticatedNav.tsx (navigation)
 * - docs/frontend/liverc/user-workflow.md (complete UX specification)
 * - src/lib/auth.ts (authentication check)
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AuthenticatedNav from "@/components/AuthenticatedNav"
import EventSearchContainer from "@/components/event-search/EventSearchContainer"

export default async function EventSearchPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--token-surface)]">
      <AuthenticatedNav />
      <main className="page-container flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <section className="content-wrapper mx-auto max-w-4xl">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--token-text-primary)] mb-8">
            Event Search
          </h1>
          <EventSearchContainer />
        </section>
      </main>
    </div>
  )
}

