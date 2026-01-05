"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState, type ReactElement } from "react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { toggleNavCollapsed } from "@/store/slices/uiSlice"

interface NavItem {
  href: string
  label: string
  description: string
  icon: (active: boolean) => ReactElement
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
    label: "My Telemetry",
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
    description: "Racing intelligence hub",
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
    href: "/under-development",
    label: "My Team",
    description: "Team dashboard & insights",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth={1.5} />
        <path
          d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
]

interface GuideItem {
  href: string
  label: string
  icon: (active: boolean) => ReactElement
}

const GUIDE_ITEMS: GuideItem[] = [
  {
    href: "/guides/getting-started",
    label: "Getting Started",
    icon: (active) => (
      <svg
        className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
]

const STORAGE_KEY_GUIDES_EXPANDED = "mre-user-guides-expanded"

const ADMIN_NAV_ITEM: NavItem = {
  href: "/admin",
  label: "MRE Administration",
  description: "System administration console",
  icon: (active) => (
    <svg
      className={`h-5 w-5 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

interface AdaptiveNavigationRailProps {
  user?: {
    isAdmin?: boolean | null
  } | null
}

export default function AdaptiveNavigationRail({ user }: AdaptiveNavigationRailProps) {
  const pathname = usePathname()
  const dispatch = useAppDispatch()
  const isNavCollapsed = useAppSelector((state) => state.ui.isNavCollapsed)
  const [isGuidesExpanded, setIsGuidesExpanded] = useState(() => {
    if (typeof window === "undefined") {
      return false
    }
    const stored = window.localStorage.getItem(STORAGE_KEY_GUIDES_EXPANDED)
    return stored === "true"
  })

  const navWidth = isNavCollapsed ? "w-[80px]" : "w-64"

  const handleToggleNavCollapsed = () => {
    dispatch(toggleNavCollapsed())
  }

  const navItems = useMemo(() => {
    const items = [...NAV_ITEMS]
    if (user?.isAdmin === true) {
      items.push(ADMIN_NAV_ITEM)
    }
    return items
  }, [user?.isAdmin])

  const toggleGuidesExpanded = () => {
    const newState = !isGuidesExpanded
    setIsGuidesExpanded(newState)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY_GUIDES_EXPANDED, String(newState))
    }
  }

  const isGuideActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <aside
      className={`${navWidth} fixed left-0 top-0 z-10 hidden h-screen border-r border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/90 backdrop-blur-lg transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[width] lg:flex lg:flex-col`}
    >
      <div
        className={`flex h-16 items-center ${isNavCollapsed ? "justify-center px-2" : "justify-between px-4"}`}
      >
        {!isNavCollapsed && (
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--token-text-muted)] transition-opacity duration-200 ease-in-out">
            MRE
          </div>
        )}
        <button
          type="button"
          onClick={handleToggleNavCollapsed}
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
          // For external URLs, don't check active state
          const isExternal = item.href.startsWith("http://") || item.href.startsWith("https://")
          const active = isExternal
            ? false
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
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
                  <span
                    className={`text-sm font-medium transition-opacity duration-200 ease-in-out ${active ? "text-[var(--token-text-primary)]" : "text-[var(--token-text-secondary)]"}`}
                  >
                    {item.label}
                  </span>
                )}
              </div>
              {!isNavCollapsed && (
                <p className="mt-1 text-xs text-[var(--token-text-muted)] transition-opacity duration-200 ease-in-out">
                  {item.description}
                </p>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User Guides Section */}
      <div className="border-t border-[var(--token-border-muted)] px-2 py-4">
        {isNavCollapsed ? (
          <div className="space-y-1">
            {GUIDE_ITEMS.map((guide) => {
              const active = isGuideActive(guide.href)
              return (
                <Link
                  key={guide.href}
                  href={guide.href}
                  className={`group flex items-center justify-center rounded-lg px-3 py-2 transition hover:bg-[var(--token-surface)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)]`}
                  title={guide.label}
                  aria-current={active ? "page" : undefined}
                >
                  {guide.icon(active)}
                </Link>
              )
            })}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleGuidesExpanded}
              className="group flex w-full items-center justify-between rounded-lg px-3 py-2 transition hover:bg-[var(--token-surface)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)]"
              aria-label="User Guides"
              aria-expanded={isGuidesExpanded}
            >
              <div className="flex items-center gap-3">
                <svg
                  className="h-5 w-5 text-[var(--token-text-secondary)]"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-sm font-medium text-[var(--token-text-secondary)] transition-opacity duration-200 ease-in-out">
                  User Guides
                </span>
              </div>
              <svg
                className={`h-4 w-4 text-[var(--token-text-muted)] transition-transform ${isGuidesExpanded ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="m6 9 6 6 6-6"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {isGuidesExpanded && (
              <div className="mt-1 space-y-1 pl-8">
                {GUIDE_ITEMS.map((guide) => {
                  const active = isGuideActive(guide.href)
                  return (
                    <Link
                      key={guide.href}
                      href={guide.href}
                      className={`block rounded-lg px-3 py-2 text-sm transition hover:bg-[var(--token-surface)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)] ${
                        active
                          ? "font-medium text-[var(--token-text-primary)]"
                          : "text-[var(--token-text-secondary)]"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      {guide.label}
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
