/**
 * @fileoverview Admin users management page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Page for managing users (admin only)
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function AdminUsersPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!session.user.isAdmin) {
    redirect("/dashboard")
  }

  redirect("/under-development")
}
