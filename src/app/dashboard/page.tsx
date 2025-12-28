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
 * - src/components/AuthenticatedNav.tsx (navigation)
 * - src/components/dashboard/DashboardClient.tsx (dashboard content)
 * - src/lib/auth.ts (authentication check)
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AuthenticatedNav from "@/components/AuthenticatedNav"
import Footer from "@/components/Footer"
import DashboardClient from "@/components/dashboard/DashboardClient"

export default async function Dashboard() {
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
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
              Overview of your selected event and recent events
            </p>
          </div>
          <DashboardClient />
        </section>
      </main>
      <Footer />
    </div>
  )
}
