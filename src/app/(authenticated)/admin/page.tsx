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
 *          automatically redirected to the welcome page.
 * 
 * @relatedFiles
 * - src/app/(authenticated)/welcome/page.tsx (user welcome page)
 * - src/app/(authenticated)/layout.tsx (shared layout wrapper)
 * - src/lib/auth.ts (session check)
 */

import Link from "next/link"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function AdminPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  // Redirect non-admins to user welcome page
  if (!session.user.isAdmin) {
    redirect("/welcome")
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6">
      <div>
        <h1 className="text-4xl font-semibold text-[var(--token-text-primary)]">
          Welcome back {session.user.name}
        </h1>
        <p className="mt-2 text-base text-[var(--token-text-secondary)]">
          Use this console to run LiveRC ingestion workflows and review system status.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-6">
        <h2 className="text-xl font-semibold text-[var(--token-text-primary)]">
          LiveRC ingestion
        </h2>
        <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
          Trigger manual track syncs or followed-event refreshes when coordinating with the ingestion service operators.
        </p>
        <Link
          href="/admin/ingestion"
          className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-4 text-base font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-elevated)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
        >
          Open ingestion controls
        </Link>
      </div>
    </div>
  )
}
