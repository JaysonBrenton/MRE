import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Breadcrumbs from "@/components/atoms/Breadcrumbs"
import VenueCorrectionRequestsTable from "@/components/organisms/admin/VenueCorrectionRequestsTable"

export default async function AdminVenueCorrectionsPage() {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }
  if (!session.user.isAdmin) {
    redirect("/eventAnalysis")
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
      <Breadcrumbs
        items={[
          { label: "My Event Analysis", href: "/eventAnalysis" },
          { label: "Admin Console", href: "/admin" },
          { label: "Venue Corrections" },
        ]}
      />
      <div>
        <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">
          Venue Correction Requests
        </h1>
        <p className="mt-2 text-base text-[var(--token-text-secondary)]">
          Approve or reject venue correction requests from event-linked users.
        </p>
      </div>

      <VenueCorrectionRequestsTable />
    </div>
  )
}
