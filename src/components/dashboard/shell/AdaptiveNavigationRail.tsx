"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { useDashboardContext } from "@/components/dashboard/context/DashboardContext"

interface NavItem {
  href: string
  label: string
  description: string
  icon: (active: boolean) => JSX.Element
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Mission control overview",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/my-event",
    label: "My Events",
    description: "Current event details",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M4 7h16m-5-3v6m-6-6v6M5 12h14v8H5z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/event-search",
    label: "Event Search",
    description: "Find and import events",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth={1.5} />
        <path d="m20 20-4-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/dashboard/my-telemetry",
    label: "Telemetry",
    description: "Data sources & traces",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M4 14c2.5-4 4.5-4 7 0s4.5 4 7 0"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path d="M3 6h18v12H3z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/dashboard/my-engineer",
    label: "My Engineer",
    description: "Collaboration hub",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 14a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 0c-5 0-7 3-7 5v1h14v-1c0-2-2-5-7-5z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/dashboard/profile",
    label: "Settings",
    description: "Profile & preferences",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 15a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm7.5-3a7.5 7.5 0 0 1-.09 1.15l2.11 1.65-2 3.46-2.49-1a7.58 7.58 0 0 1-1.93 1.15l-.37 2.65h-4l-.37-2.65a7.58 7.58 0 0 1-1.93-1.15l-2.49 1-2-3.46 2.11-1.65A7.5 7.5 0 0 1 4.5 12a7.5 7.5 0 0 1 .09-1.15L2.48 9.2l2-3.46 2.49 1a7.58 7.58 0 0 1 1.93-1.15L9.27 3h4l.37 2.65a7.58 7.58 0 0 1 1.93 1.15l2.49-1 2 3.46-2.11 1.65A7.5 7.5 0 0 1 19.5 12z"
          stroke="currentColor"
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
]

export default function AdaptiveNavigationRail() {
  const pathname = usePathname()
  const { isNavCollapsed, toggleNavCollapsed } = useDashboardContext()

  const navWidth = isNavCollapsed ? "w-[80px]" : "w-64"

  const navItems = useMemo(() => NAV_ITEMS, [])

  return (
    <aside
      className={`${navWidth} hidden border-r border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/90 backdrop-blur-lg transition-all duration-300 lg:flex lg:flex-col`}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--token-text-muted)]">
          MRE
        </div>
        <button
          type="button"
          onClick={toggleNavCollapsed}
          className="rounded-md border border-[var(--token-border-default)] p-2 text-[var(--token-text-secondary)] transition hover:text-[var(--token-text-primary)]"
          aria-label={isNavCollapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
            <path
              d={isNavCollapsed ? "m9 6 6 6-6 6" : "m15 18-6-6 6-6"}
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex flex-col ${isNavCollapsed ? "items-center" : "items-stretch"} rounded-lg px-3 py-2 transition hover:bg-[var(--token-surface)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)]`}
              title={item.label}
              aria-current={active ? "page" : undefined}
            >
              <div className={`flex items-center ${isNavCollapsed ? "justify-center" : "gap-3"}`}>
                {item.icon(active)}
                {!isNavCollapsed && (
                  <span className={`text-sm font-medium ${active ? "text-[var(--token-text-primary)]" : "text-[var(--token-text-secondary)]"}`}>
                    {item.label}
                  </span>
                )}
              </div>
              {!isNavCollapsed && (
                <p className="mt-1 text-xs text-[var(--token-text-muted)]">{item.description}</p>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-6 text-xs text-[var(--token-text-muted)]">
        <p className="mb-1 font-semibold text-[var(--token-text-secondary)]">Need speed?</p>
        <p>Click Command for quick actions</p>
      </div>
    </aside>
  )
}
