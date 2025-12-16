/**
 * @fileoverview Administrator console page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Admin console for authenticated administrators
 * 
 * @purpose Displays the administrator console. Per Alpha scope, this page shows
 *          "Welcome back <administrator-name>" and includes a logout button.
 *          Only users with isAdmin=true can access this page. Non-admin users are
 *          automatically redirected to the welcome page.
 * 
 * @relatedFiles
 * - src/app/welcome/page.tsx (user welcome page)
 * - src/lib/auth.ts (session check)
 * - components/LogoutButton.tsx (logout functionality)
 */

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
    <div className="flex min-h-screen items-center justify-center bg-[var(--token-surface)] px-4 py-8">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--token-text-primary)]">
          Welcome back {session.user.name}
        </h1>
      </div>
    </div>
  )
}

