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
 *          includes navigation to Event Search. This is the default landing page for
 *          regular users after login. Admins are automatically redirected to /admin.
 * 
 * @relatedFiles
 * - src/app/admin/page.tsx (admin console)
 * - src/lib/auth.ts (session check)
 * - components/LogoutButton.tsx (logout functionality)
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
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
    <div className="flex min-h-screen w-full flex-col bg-[var(--token-surface)]">
      <AuthenticatedNav />
      <main
        id="main-content"
        className="page-container flex-1 w-full min-w-0 flex items-center justify-center px-4 py-8"
        tabIndex={-1}
      >
        <section className="content-wrapper w-full min-w-0 max-w-3xl text-center">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--token-text-primary)]">
            Welcome back {session.user.name}
          </h1>
        </section>
      </main>
      <Footer />
    </div>
  )
}
