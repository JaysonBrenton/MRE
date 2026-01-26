import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Breadcrumbs from "@/components/Breadcrumbs"
import AuditLogTable from "@/components/admin/AuditLogTable"

export default async function AdminAuditPage() {
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
          { label: "My Event Analysis", href: "/dashboard" },
          { label: "Admin Console", href: "/admin" },
          { label: "Audit Logs" },
        ]}
      />
      <div>
        <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">
          Audit Logs
        </h1>
        <p className="mt-2 text-base text-[var(--token-text-secondary)]">
          View audit logs of all admin actions and system events.
        </p>
      </div>

      <AuditLogTable />
    </div>
  )
}
