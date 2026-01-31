import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Breadcrumbs from "@/components/atoms/Breadcrumbs"
import TracksTable from "@/components/organisms/admin/TracksTable"

export default async function AdminTracksPage() {
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
          { label: "Tracks" },
        ]}
      />
      <div>
        <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">
          Track Management
        </h1>
        <p className="mt-2 text-base text-[var(--token-text-secondary)]">
          View and manage tracks. Follow tracks to monitor for new events.
        </p>
      </div>

      <TracksTable />
    </div>
  )
}
