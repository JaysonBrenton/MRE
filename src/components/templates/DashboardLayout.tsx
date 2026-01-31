"use client"

import { useAppSelector } from "@/store/hooks"
import AdaptiveNavigationRail from "@/components/organisms/dashboard/shell/AdaptiveNavigationRail"
import TopStatusBar from "@/components/organisms/dashboard/shell/TopStatusBar"
import CommandPalette from "@/components/organisms/dashboard/shell/CommandPalette"

interface DashboardLayoutProps {
  children: React.ReactNode
  user?: {
    name?: string | null
    email?: string | null
    isAdmin?: boolean | null
  } | null
  userId: string
}

export default function DashboardLayout({ children, user, userId }: DashboardLayoutProps) {
  return (
    <DashboardShell user={user} userId={userId}>
      {children}
    </DashboardShell>
  )
}

function DashboardShell({
  children,
  user,
  userId,
}: {
  children: React.ReactNode
  user?: DashboardLayoutProps["user"]
  userId: string
}) {
  const density = useAppSelector((state) => state.ui.density)
  const isNavCollapsed = useAppSelector((state) => state.ui.isNavCollapsed)

  // Adjust margin based on sidebar collapse state
  const sidebarMargin = isNavCollapsed ? "lg:ml-[80px]" : "lg:ml-64"

  return (
    <div
      className="flex min-h-screen bg-[var(--token-surface)] text-[var(--token-text-primary)]"
      data-density={density}
    >
      <AdaptiveNavigationRail user={user ?? null} />
      <div
        className={`flex min-h-screen flex-1 flex-col transition-[margin-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${sidebarMargin}`}
      >
        <TopStatusBar user={user ?? null} userId={userId} />
        <div className="flex-1 overflow-y-auto px-1 py-6 pb-12 sm:px-2 md:px-2 lg:px-2 xl:px-4 2xl:px-6">
          {children}
        </div>
      </div>
      <CommandPalette />
    </div>
  )
}
