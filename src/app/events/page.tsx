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
 * - app/components/AppShell.tsx (application shell wrapper)
 * - src/components/events/EventsPageClient.tsx (client component)
 * - src/lib/auth.ts (authentication check)
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AppShell from "../components/AppShell"
import EventsPageClient from "@/components/events/EventsPageClient"

export default async function EventsPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  return (
    <AppShell session={session}>
      <EventsPageClient />
    </AppShell>
  )
}

