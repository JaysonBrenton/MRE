/**
 * @fileoverview Authenticated route group layout
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Shared layout for all authenticated pages providing consistent shell
 * 
 * @purpose Provides the dashboard layout (sidebar, navigation, footer) to all
 *          authenticated pages via Next.js route groups. This ensures consistent
 *          UI across all authenticated routes without manually wrapping each page.
 * 
 * @relatedFiles
 * - src/components/dashboard/DashboardLayout.tsx (sidebar wrapper)
 * - src/components/dashboard/DashboardSidebar.tsx (sidebar component)
 * - src/components/AuthenticatedNav.tsx (regular user navigation)
 * - src/components/AdminNav.tsx (admin navigation)
 * - src/components/Footer.tsx (footer component)
 * - src/lib/auth.ts (authentication check)
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import DashboardLayout from "@/components/dashboard/DashboardLayout"
import ConditionalNav from "@/components/ConditionalNav"
import Footer from "@/components/Footer"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  return (
    <DashboardLayout>
      <div className="flex min-h-screen w-full flex-col bg-[var(--token-surface)]">
        <ConditionalNav />
        <main
          id="main-content"
          className="page-container flex-1 w-full min-w-0 px-6 py-12"
          tabIndex={-1}
        >
          {children}
        </main>
        <Footer />
      </div>
    </DashboardLayout>
  )
}

