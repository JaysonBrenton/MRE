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
 *          Per Alpha scope, this page shows "Welcome back <Driver Name>" and
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
import AuthenticatedNav from "@/components/AuthenticatedNav"

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
      <main id="main-content" className="page-container flex-1 flex items-center justify-center px-4 py-8" tabIndex={-1}>
        <section className="content-wrapper w-full max-w-2xl text-center space-y-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--token-text-primary)]">
            Welcome back {session.user.name}
          </h1>
        </section>
      </main>
    </div>
  )
}
