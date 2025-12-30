/**
 * @fileoverview Home page - Landing page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Landing page for My Race Engineer
 * 
 * @purpose Displays an enterprise-grade landing page with hero section, trust signals,
 *          feature blocks, and clear CTA hierarchy. This page is accessible to all users
 *          (authenticated and unauthenticated). Authenticated users will be redirected to
 *          /welcome by middleware.
 * 
 * @relatedFiles
 * - middleware.ts (route protection and redirects)
 * - src/lib/auth.ts (authentication configuration)
 * - src/components/Hero.tsx (hero section component)
 */

import Link from "next/link"

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[var(--token-surface)]">
      <main className="page-container flex flex-1 w-full min-w-0 items-center justify-center px-4 py-16">
        <section className="content-wrapper w-full min-w-0 max-w-2xl min-w-[280px] mx-auto text-center space-y-6">
          <div className="space-y-2 w-full">
            <p className="text-sm uppercase tracking-wide text-[var(--token-text-muted)] w-full">
              My Race Engineer · v0.1.0
            </p>
            <h1 className="text-3xl font-semibold text-[var(--token-text-primary)] w-full">
              Sign in to continue
            </h1>
            <p className="text-base text-[var(--token-text-secondary)] w-full">
              Registration and login are the only enabled workflows in this locked scope build.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)] px-6 text-base font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-6 text-base font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
            >
              Create account
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
