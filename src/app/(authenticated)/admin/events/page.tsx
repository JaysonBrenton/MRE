import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Breadcrumbs from "@/components/atoms/Breadcrumbs"
import EventsTable from "@/components/organisms/admin/EventsTable"

export default async function AdminEventsPage() {
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
          { label: "Events" },
        ]}
      />
      <div>
        <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">
          Event Management
        </h1>
        <p className="mt-2 text-base text-[var(--token-text-secondary)]">
          View, re-ingest, and manage ingested events.
        </p>
      </div>

      <EventsTable />
    </div>
  )
}
