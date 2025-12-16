/**
 * @fileoverview Home page - Landing page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Landing page for My Race Engineer
 * 
 * @purpose Displays a simple landing page with app information and links to login/register.
 *          This page is accessible to all users (authenticated and unauthenticated).
 *          Authenticated users will be redirected to /welcome by middleware.
 * 
 * @relatedFiles
 * - middleware.ts (route protection and redirects)
 * - src/lib/auth.ts (authentication configuration)
 */

import Link from "next/link"

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--token-surface)] px-4 py-8">
      <div className="w-full max-w-md space-y-6 text-center">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--token-text-primary)]">
            My Race Engineer
          </h1>
          <p className="mt-4 text-lg text-[var(--token-text-secondary)]">
            Telemetry and race analysis for RC drivers.
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <Link
            href="/login"
            className="mobile-button inline-flex w-full items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] sm:px-5"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="mobile-button inline-flex w-full items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] sm:px-5"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  )
}
