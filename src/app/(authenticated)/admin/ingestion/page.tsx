import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import IngestionControls from "@/components/organisms/admin/IngestionControls"
import IngestionSubNav from "@/components/organisms/admin/IngestionSubNav"
import Breadcrumbs from "@/components/atoms/Breadcrumbs"

export default async function AdminIngestionPage() {
  const session = await auth()
  if (!session || !session.user.isAdmin) redirect("/login")
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6">
      <Breadcrumbs
        items={[
          { label: "My Event Analysis", href: "/eventAnalysis" },
          { label: "Admin Console", href: "/admin" },
          { label: "Ingestion Controls" },
        ]}
      />
      <div>
        <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">
          Ingestion Controls
        </h1>
      </div>
      <IngestionSubNav />
      <IngestionControls />
    </div>
  )
}
