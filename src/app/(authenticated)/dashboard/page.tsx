/**
 * @fileoverview Dashboard page - Overview page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Dashboard/Overview page for My Race Engineer
 * 
 * @purpose Displays the main overview page with event overview and recent events.
 *          This page is protected and requires authentication.
 * 
 * @relatedFiles
 * - src/components/dashboard/DashboardClient.tsx (dashboard content)
 * - src/components/dashboard/DashboardSidebar.tsx (sidebar navigation)
 * - src/app/(authenticated)/layout.tsx (shared layout wrapper)
 * - src/lib/auth.ts (authentication check)
 */

import DashboardClient from "@/components/dashboard/DashboardClient"

export default async function Dashboard() {
  return (
    <section className="content-wrapper mx-auto w-full min-w-0 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">
          Dashboard
        </h1>
        <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
          Overview of your selected event and recent events
        </p>
      </div>
      <DashboardClient />
    </section>
  )
}
