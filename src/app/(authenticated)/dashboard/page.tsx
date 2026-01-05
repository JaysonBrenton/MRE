/**
 * @fileoverview Dashboard page - Overview page
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Dashboard/Overview page for My Race Engineer
 *
 * @purpose Renders the driver-first dashboard composed of modern racing widgets
 *          (hero context, KPIs, telemetry snapshot, activity, weather, etc.).
 *          This page is protected and requires authentication.
 *
 * @relatedFiles
 * - src/components/dashboard/DashboardClient.tsx (dashboard content/widg)
 * - src/app/(authenticated)/layout.tsx (shared immersive layout)
 * - src/lib/auth.ts (authentication check)
 */

import DashboardClient from "@/components/dashboard/DashboardClient"
import EventAnalysisSection from "@/components/dashboard/EventAnalysisSection"

export default async function Dashboard() {
  return (
    <section className="content-wrapper w-full min-w-0">
      <DashboardClient />
      <EventAnalysisSection />
    </section>
  )
}
