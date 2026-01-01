"use client"

import { usePathname } from "next/navigation"
import { DashboardContextProvider, useDashboardContext } from "@/components/dashboard/context/DashboardContext"
import AdaptiveNavigationRail from "@/components/dashboard/shell/AdaptiveNavigationRail"
import TopStatusBar from "@/components/dashboard/shell/TopStatusBar"
import ContextRibbon from "@/components/dashboard/shell/ContextRibbon"
import CommandPalette from "@/components/dashboard/shell/CommandPalette"

interface DashboardLayoutProps {
  children: React.ReactNode
  user?: {
    name?: string | null
    email?: string | null
    isAdmin?: boolean | null
  } | null
}

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
  return (
    <DashboardContextProvider>
      <DashboardShell user={user}>{children}</DashboardShell>
    </DashboardContextProvider>
  )
}

function DashboardShell({ children, user }: { children: React.ReactNode; user?: DashboardLayoutProps["user"] }) {
  const { density } = useDashboardContext()
  const pathname = usePathname()
  
  // Only show ContextRibbon on the main dashboard page
  const showContextRibbon = pathname === "/dashboard"

  return (
    <div
      className="flex min-h-screen bg-[var(--token-surface)] text-[var(--token-text-primary)]"
      data-density={density}
    >
      <AdaptiveNavigationRail />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopStatusBar user={user ?? null} />
        {showContextRibbon && <ContextRibbon />}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10">
          {children}
        </div>
      </div>
      <CommandPalette />
    </div>
  )
}
