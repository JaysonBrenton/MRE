import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import IngestionControls from "@/components/admin/IngestionControls"
import Breadcrumbs from "@/components/Breadcrumbs"

export default async function AdminIngestionPage() {
  const session = await auth()
  if (!session || !session.user.isAdmin) redirect("/login")
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/dashboard" },
          { label: "Admin Console", href: "/admin" },
          { label: "Ingestion Controls" },
        ]}
      />
      <h1 className="text-3xl font-semibold text-[var(--token-text-primary)] mb-8">Ingestion Controls</h1>
      <IngestionControls />
    </div>
  )
}
