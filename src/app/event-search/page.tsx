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
 * - src/components/event-search/EventSearchContainer.tsx (main search component)
 * - docs/frontend/liverc/user-workflow.md (complete UX specification)
 * - src/lib/auth.ts (authentication check)
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AuthenticatedNav from "@/components/AuthenticatedNav"
import Footer from "@/components/Footer"
import EventSearchContainer from "@/components/event-search/EventSearchContainer"

export default async function EventSearchPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-[var(--token-surface)]">
      <AuthenticatedNav />
      <main
        id="main-content"
        className="page-container flex-1 w-full min-w-0 px-4 py-8 sm:px-6 sm:py-12"
        tabIndex={-1}
      >
        <section className="content-wrapper mx-auto w-full min-w-0 max-w-6xl">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--token-text-primary)]">
              Event Search
            </h1>
            <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
              Search for race events by track and date range
            </p>
          </div>
          <EventSearchContainer />
        </section>
      </main>
      <Footer />
    </div>
  )
}
