/**
 * @fileoverview Authenticated route group layout
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Shared layout for all authenticated pages providing consistent shell
 *
 * @purpose Provides the immersive racing shell (adaptive rail, status bar, context ribbon)
 *          to all authenticated pages via Next.js route groups. This ensures consistent
 *          UI across all authenticated routes without manually wrapping each page.
 *
 * @relatedFiles
 * - src/components/dashboard/DashboardLayout.tsx (adaptive racing shell)
 * - src/components/dashboard/shell/* (shell primitives)
 * - src/components/Footer.tsx (footer component)
 * - src/lib/auth.ts (authentication check)
 */

// Force dynamic rendering - authenticated pages require session and use client-side
// Redux/context. Static prerendering fails with "useContext of null" because providers
// are not available during build-time static generation.
export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import DashboardLayout from "@/components/templates/DashboardLayout"
import ReduxProvider from "@/components/store/ReduxProvider"
import DashboardEventSearchProvider from "@/components/organisms/dashboard/DashboardEventSearchProvider"
import EventActionsProvider from "@/components/organisms/dashboard/EventActionsProvider"
import Footer from "@/components/Footer"
import EventAnalysisHeaderWrapper from "@/components/organisms/dashboard/EventAnalysisHeaderWrapper"

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  return (
    <ReduxProvider>
      <DashboardEventSearchProvider>
        <EventActionsProvider>
          <DashboardLayout user={session.user} userId={session.user.id}>
            <div className="flex min-h-full flex-col">
              <EventAnalysisHeaderWrapper />
              <main
                id="main-content"
                className="page-container w-full min-w-0 flex-1"
                tabIndex={-1}
              >
                {children}
              </main>
              <Footer />
            </div>
          </DashboardLayout>
        </EventActionsProvider>
      </DashboardEventSearchProvider>
    </ReduxProvider>
  )
}
