/**
 * @fileoverview Admin users management page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-29
 * 
 * @description Page for managing users (admin only)
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Breadcrumbs from "@/components/Breadcrumbs"
import UsersTable from "@/components/admin/UsersTable"

export default async function AdminUsersPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (!session.user.isAdmin) {
    redirect("/dashboard")
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/dashboard" },
          { label: "Admin Console", href: "/admin" },
          { label: "Users" },
        ]}
      />
      <div>
        <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">
          User Management
        </h1>
        <p className="mt-2 text-base text-[var(--token-text-secondary)]">
          View, edit, and manage user accounts.
        </p>
      </div>

      <UsersTable />
    </div>
  )
}
