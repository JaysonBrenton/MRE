/**
 * @fileoverview User welcome page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Welcome page for authenticated regular users
 * 
 * @purpose Displays a welcome message for authenticated users after login.
 *          Per version 0.1.0 scope, this page shows "Welcome back <Driver Name>" and
 *          includes a logout button. Admins are automatically redirected to the
 *          admin console.
 * 
 * @relatedFiles
 * - src/app/admin/page.tsx (admin console)
 * - src/lib/auth.ts (session check)
 * - components/LogoutButton.tsx (logout functionality)
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import AuthenticatedNav from "@/components/AuthenticatedNav"
import Footer from "@/components/Footer"

export default async function WelcomePage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  // Redirect admins to admin page
  if (session.user.isAdmin) {
    redirect("/admin")
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--token-surface)]">
      <AuthenticatedNav />
      <main id="main-content" className="page-container flex-1 flex flex-col px-4 py-8" tabIndex={-1}>
        <section className="content-wrapper flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto text-center space-y-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--token-text-primary)]">
            Welcome back {session.user.name}
          </h1>
          <p className="text-sm text-[var(--token-text-secondary)]">
            Ready to dive into telemetry? Jump straight into Event Search to import fresh LiveRC data and start analysing races.
          </p>
          <Link
            href="/event-search"
            className="mobile-button inline-flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-6 py-3 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            Start analysing events
          </Link>
        </section>
        <Footer />
      </main>
    </div>
  )
}
