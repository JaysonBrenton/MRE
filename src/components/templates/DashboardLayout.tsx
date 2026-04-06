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
  const navWidth = isNavCollapsed ? "80px" : "256px"

  // Main scroll region is position:fixed with left+right+top+bottom so its width is the viewport
  // minus explicit edges — not dependent on nested flex min-width resolution (which was collapsing
  // to tens of px). Nav offset uses padding-left: nav width + gutter on lg+ (see --nav-content-gutter).
  return (
    <div
      className="relative min-h-screen w-full bg-[var(--token-surface)] text-[var(--token-text-primary)]"
      data-density={density}
      style={
        {
          "--nav-width": navWidth,
          "--nav-content-gutter": "var(--token-spacing-md)",
        } as React.CSSProperties
      }
    >
      <AdaptiveNavigationRail user={user ?? null} />
      <div className="h-16 shrink-0" aria-hidden />
      <TopStatusBar user={user ?? null} userId={userId} />
      <div
        data-scroll-container
        className="scrollbar-none fixed left-0 right-0 top-16 bottom-0 z-0 flex min-h-0 flex-col overflow-y-auto overflow-x-hidden px-1 py-6 transition-[padding-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] sm:px-2 md:px-2 lg:px-2 lg:pl-[calc(var(--nav-width)_+_var(--nav-content-gutter))] xl:pr-4 xl:pl-[calc(var(--nav-width)_+_var(--nav-content-gutter))] 2xl:pr-6 2xl:pl-[calc(var(--nav-width)_+_var(--nav-content-gutter))]"
      >
        {children}
      </div>
      <CommandPalette />
    </div>
  )
}
