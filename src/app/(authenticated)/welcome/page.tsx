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
 *          Per version 0.1.1 scope, this page shows "Welcome back <Driver Name>" and
 *          includes navigation to Event Search. This is the default landing page for
 *          regular users after login. Admins are automatically redirected to /admin.
 * 
 * @relatedFiles
 * - src/app/(authenticated)/admin/page.tsx (admin console)
 * - src/app/(authenticated)/layout.tsx (shared layout wrapper)
 * - src/lib/auth.ts (session check)
 * - components/LogoutButton.tsx (logout functionality)
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function WelcomePage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  // Redirect admins to admin page
  if (session.user.isAdmin) {
    redirect("/admin")
  }

  // Redirect all users to dashboard
  redirect("/dashboard")
}
