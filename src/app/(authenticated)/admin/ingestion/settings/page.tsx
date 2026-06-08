import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Breadcrumbs from "@/components/atoms/Breadcrumbs"
import IngestionSubNav from "@/components/organisms/admin/IngestionSubNav"
import IngestionSettingsConsole from "@/components/organisms/admin/IngestionSettingsConsole"

export default async function AdminIngestionSettingsPage() {
  const session = await auth()
  if (!session || !session.user.isAdmin) redirect("/login")

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6">
      <Breadcrumbs
        items={[
          { label: "My Event Analysis", href: "/eventAnalysis" },
          { label: "Admin Console", href: "/admin" },
          { label: "Ingestion", href: "/admin/ingestion" },
          { label: "Settings" },
        ]}
      />
      <div>
        <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">
          Ingestion Settings
        </h1>
        <p className="mt-2 text-base text-[var(--token-text-secondary)]">
          View effective ingestion configuration across services.
        </p>
      </div>
      <IngestionSubNav />
      <IngestionSettingsConsole />
    </div>
  )
}
