import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Breadcrumbs from "@/components/atoms/Breadcrumbs"
import HealthStatus from "@/components/organisms/admin/HealthStatus"

export default async function AdminHealthPage() {
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
          { label: "Health Checks" },
        ]}
      />
      <div>
        <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">System Health</h1>
        <p className="mt-2 text-base text-[var(--token-text-secondary)]">
          Monitor system status and health checks.
        </p>
      </div>

      <HealthStatus />
    </div>
  )
}
