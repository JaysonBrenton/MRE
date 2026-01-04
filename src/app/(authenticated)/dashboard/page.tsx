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
import ContextRibbon from "@/components/dashboard/shell/ContextRibbon"

export default async function Dashboard() {
  return (
    <section className="content-wrapper w-full min-w-0">
      <header className="mb-8 space-y-2">
        <h2 className="text-[11px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">Event Discovery</h2>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Browse and discover racing events from LiveRC. Select an event to view detailed race data, telemetry, and performance analytics.
        </p>
        <ContextRibbon />
      </header>
      <DashboardClient />
    </section>
  )
}
