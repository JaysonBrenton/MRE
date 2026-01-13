/**
 * @fileoverview Administrator console page
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Admin console for authenticated administrators
 *
 * @purpose Displays the administrator console. Per version 0.1.1 scope, this page shows
 *          "Welcome back <administrator-name>" and includes a logout button.
 *          Only users with isAdmin=true can access this page. Non-admin users are
 *          automatically redirected to the dashboard.
 *
 * @relatedFiles
 * - src/app/(authenticated)/dashboard/page.tsx (user dashboard)
 * - src/app/(authenticated)/layout.tsx (shared layout wrapper)
 * - src/lib/auth.ts (session check)
 */

import Link from "next/link"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Breadcrumbs from "@/components/Breadcrumbs"
import AdminDashboardStats from "@/components/admin/AdminDashboardStats"

export default async function AdminPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  // Redirect non-admins to dashboard
  if (!session.user.isAdmin) {
    redirect("/dashboard")
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
      <Breadcrumbs items={[{ label: "Home", href: "/dashboard" }, { label: "Admin Console" }]} />
      <div>
        <h1 className="text-4xl font-semibold text-[var(--token-text-primary)]">
          Welcome back {session.user.name}
        </h1>
        <p className="mt-2 text-base text-[var(--token-text-secondary)]">
          Use this console to manage users, events, tracks, and monitor system status.
        </p>
      </div>

      <AdminDashboardStats />

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/admin/ingestion"
          className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-6 transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
        >
          <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
            Ingestion Controls
          </h2>
          <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
            Trigger track syncs or event ingestion jobs.
          </p>
        </Link>

        <Link
          href="/admin/events"
          className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-6 transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
        >
          <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">Recent Events</h2>
          <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
            View and manage ingested events.
          </p>
        </Link>

        <Link
          href="/admin/health"
          className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-6 transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
        >
          <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">System Health</h2>
          <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
            Monitor system status and health checks.
          </p>
        </Link>
      </div>
    </div>
  )
}
