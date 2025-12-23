/**
 * @fileoverview Dashboard page - Overview page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Dashboard/Overview page for My Race Engineer
 * 
 * @purpose Displays the main overview page with Get Started cards and Telemetry Preview.
 *          This page is protected and requires authentication.
 * 
 * @relatedFiles
 * - app/components/AppShell.tsx (application shell wrapper)
 * - src/lib/auth.ts (authentication check)
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "../components/AppShell"
import DashboardClient from "@/components/dashboard/DashboardClient"

export default async function Dashboard() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-semibold text-[var(--token-text-primary)] sm:text-4xl lg:text-5xl">
            My Race Engineer
          </h1>
          <p className="mt-4 text-lg text-[var(--token-text-muted)] sm:text-xl">
            Telemetry and race analysis for RC drivers.
          </p>
        </div>

        {/* Get Started Section */}
        <section className="mb-16">
          <h2 className="mb-6 text-2xl font-semibold text-[var(--token-text-primary)]">
            Get Started
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Import Event Card */}
            <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)] p-6">
              <h3 className="mb-2 text-xl font-semibold text-[var(--token-text-primary)]">
                Import an event from LiveRC
              </h3>
              <p className="mb-4 text-sm text-[var(--token-text-muted)]">
                Discover and import race events from LiveRC to analyze lap times, driver performance, and race data.
              </p>
              <Link
                href="/events"
                className="mobile-button inline-flex items-center justify-center rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-accent)]"
              >
                View events
              </Link>
            </div>

            {/* Upload Telemetry Card */}
            <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)] p-6">
              <h3 className="mb-2 text-xl font-semibold text-[var(--token-text-primary)]">
                Upload a telemetry file
              </h3>
              <p className="mb-4 text-sm text-[var(--token-text-muted)]">
                Upload your telemetry data files to analyze performance metrics, lap times, and racing data.
              </p>
              <button
                disabled
                className="mobile-button inline-flex items-center justify-center rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-muted)] opacity-50 cursor-not-allowed"
              >
                Coming soon
              </button>
            </div>

            {/* Setup Notebook Card */}
            <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)] p-6">
              <h3 className="mb-2 text-xl font-semibold text-[var(--token-text-primary)]">
                Create a setup notebook
              </h3>
              <p className="mb-4 text-sm text-[var(--token-text-muted)]">
                Document your car setups, track conditions, and racing notes to improve your performance over time.
              </p>
              <button
                disabled
                className="mobile-button inline-flex items-center justify-center rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-muted)] opacity-50 cursor-not-allowed"
              >
                Coming soon
              </button>
            </div>
          </div>
        </section>

        {/* Telemetry Preview Section */}
        <section>
          <h2 className="mb-6 text-2xl font-semibold text-[var(--token-text-primary)]">
            Telemetry Preview
          </h2>
          <DashboardClient />
        </section>
      </div>
    </AppShell>
  )
}

