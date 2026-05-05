"use client"

import { usePathname, useRouter } from "next/navigation"
import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { setActiveEventAnalysisTab } from "@/store/slices/dashboardSlice"
import { closeMobileNav, toggleNavCollapsed } from "@/store/slices/uiSlice"
import NavigationRailGuidesSection from "./adaptive-navigation-rail/NavigationRailGuidesSection"
import NavigationRailNavItems from "./adaptive-navigation-rail/NavigationRailNavItems"
import {
  ADMIN_NAV_ITEM,
  NAV_ITEMS,
  STORAGE_KEY_GUIDES_EXPANDED,
  STORAGE_KEY_MY_CLUB_EXPANDED,
} from "./adaptive-navigation-rail/navigationRailConfig"
import { useMobileNavFocusTrap } from "./adaptive-navigation-rail/useMobileNavFocusTrap"
import { DASHBOARD_NAV_RAIL_TRANSITION_CLASS } from "./dashboard-shell-nav-transition"

interface AdaptiveNavigationRailProps {
  user?: {
    isAdmin?: boolean | null
  } | null
}

export default function AdaptiveNavigationRail({ user }: AdaptiveNavigationRailProps) {
  const pathname = usePathname()
  const router = useRouter()
  const dispatch = useAppDispatch()
  const railRef = useRef<HTMLElement>(null)
  const isNavCollapsed = useAppSelector((state) => state.ui.isNavCollapsed)
  const isMobileNavOpen = useAppSelector((state) => state.ui.isMobileNavOpen)
  const selectedEventId = useAppSelector((state) => state.dashboard.selectedEventId)
  const analysisData = useAppSelector((state) => state.dashboard.analysisData)
  const eventData = useAppSelector((state) => state.dashboard.eventData)
  const activeEventAnalysisTab = useAppSelector((state) => state.dashboard.activeEventAnalysisTab)
  const isPracticeDay = analysisData?.isPracticeDay ?? eventData?.isPracticeDay ?? false
  const showMyEventsRail =
    pathname === "/eventAnalysis" && Boolean(selectedEventId) && !isPracticeDay
  const myEventsActive =
    pathname === "/eventAnalysis" && activeEventAnalysisTab === "my-events" && showMyEventsRail

  const handleMyEventsInRailClick = useCallback(() => {
    dispatch(setActiveEventAnalysisTab("my-events"))
    dispatch(closeMobileNav())
    if (pathname !== "/eventAnalysis") {
      router.push("/eventAnalysis")
    }
  }, [dispatch, pathname, router])

  const handleDashboardNavClick = useCallback(() => {
    dispatch(setActiveEventAnalysisTab("event-overview"))
    dispatch(closeMobileNav())
  }, [dispatch])

  const [isGuidesExpanded, setIsGuidesExpanded] = useState(() => {
    if (typeof window === "undefined") {
      return false
    }
    const stored = window.localStorage.getItem(STORAGE_KEY_GUIDES_EXPANDED)
    return stored === "true"
  })
  const [isGuidesMenuExpanded, setIsGuidesMenuExpanded] = useState(false)
  const [isMyClubExpanded, setIsMyClubExpanded] = useState(() => {
    if (typeof window === "undefined") {
      return false
    }
    const stored = window.localStorage.getItem(STORAGE_KEY_MY_CLUB_EXPANDED)
    return stored === "true"
  })

  const expandMyClubMenu = useCallback(() => {
    setIsMyClubExpanded(true)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY_MY_CLUB_EXPANDED, "true")
    }
  }, [])

  const handleTrackLeaderboardInRailClick = useCallback(() => {
    expandMyClubMenu()
    dispatch(setActiveEventAnalysisTab("track-leader-board"))
    dispatch(closeMobileNav())
    if (pathname !== "/eventAnalysis") {
      router.push("/eventAnalysis")
    }
  }, [dispatch, expandMyClubMenu, pathname, router])

  const handleClubHighlightsInRailClick = useCallback(() => {
    expandMyClubMenu()
    dispatch(setActiveEventAnalysisTab("club-highlights"))
    dispatch(closeMobileNav())
    if (pathname !== "/eventAnalysis") {
      router.push("/eventAnalysis")
    }
  }, [dispatch, expandMyClubMenu, pathname, router])

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

  const toggleGuidesExpanded = useCallback(() => {
    const newState = !isGuidesExpanded
    setIsGuidesExpanded(newState)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY_GUIDES_EXPANDED, String(newState))
    }
  }, [isGuidesExpanded])

  const toggleGuidesMenuExpanded = useCallback(() => {
    setIsGuidesMenuExpanded((v) => !v)
  }, [])

  const toggleMyClubExpanded = useCallback(() => {
    const newState = !isMyClubExpanded
    setIsMyClubExpanded(newState)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY_MY_CLUB_EXPANDED, String(newState))
    }
  }, [isMyClubExpanded])

  useEffect(() => {
    dispatch(closeMobileNav())
  }, [pathname, dispatch])

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const onMq = () => {
      if (mq.matches) dispatch(closeMobileNav())
    }
    mq.addEventListener("change", onMq)
    return () => mq.removeEventListener("change", onMq)
  }, [dispatch])

  useEffect(() => {
    if (!isMobileNavOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch(closeMobileNav())
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isMobileNavOpen, dispatch])

  useEffect(() => {
    if (!isMobileNavOpen) return
    const mq = window.matchMedia("(max-width: 1023px)")
    if (!mq.matches) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [isMobileNavOpen])

  useMobileNavFocusTrap(railRef, isMobileNavOpen)

  return (
    <>
      {isMobileNavOpen ? (
        <div
          className="fixed inset-x-0 bottom-0 top-16 z-40 bg-black/50 lg:hidden"
          aria-hidden
          onClick={() => dispatch(closeMobileNav())}
        />
      ) : null}
      <aside
        ref={railRef}
        id="dashboard-navigation-rail"
        aria-label="Primary navigation"
        className={`${navWidth} fixed left-0 top-16 z-50 flex h-[calc(100vh-4rem)] flex-col overflow-hidden border-r border-[var(--token-border-muted)] bg-[color-mix(in_oklab,var(--token-surface-elevated)_82%,var(--token-surface-page))]/92 backdrop-blur-lg supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--token-surface-elevated)_74%,var(--token-surface-page))]/88 ${DASHBOARD_NAV_RAIL_TRANSITION_CLASS} will-change-[width] motion-reduce:will-change-auto lg:top-0 lg:z-10 lg:h-screen ${
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full max-lg:pointer-events-none"
        } lg:translate-x-0`}
      >
        <div
          className={`flex h-16 shrink-0 items-center ${isNavCollapsed ? "justify-center px-2" : "justify-between px-4"}`}
        >
          {!isNavCollapsed && (
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--token-text-muted)] transition-opacity duration-150 ease-out motion-reduce:transition-none">
              MRE
            </div>
          )}
          <button
            type="button"
            onClick={handleToggleNavCollapsed}
            className="rounded-md border border-[var(--token-border-default)] p-2 text-[var(--token-text-secondary)] transition motion-reduce:transition-none hover:text-[var(--token-text-primary)]"
            aria-label={isNavCollapsed ? "Expand navigation" : "Collapse navigation"}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
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

        <nav
          className="min-h-0 min-w-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 py-4"
          aria-label="Application sections"
        >
          <NavigationRailNavItems
            navItems={navItems}
            isNavCollapsed={isNavCollapsed}
            pathname={pathname}
            onDashboardNavClick={handleDashboardNavClick}
            showMyEventsRail={showMyEventsRail}
            myEventsActive={myEventsActive}
            onMyEventsInRailClick={handleMyEventsInRailClick}
            activeEventAnalysisTab={activeEventAnalysisTab}
            isMyClubExpanded={isMyClubExpanded}
            onToggleMyClubExpanded={toggleMyClubExpanded}
            onTrackLeaderboardInRailClick={handleTrackLeaderboardInRailClick}
            onClubHighlightsInRailClick={handleClubHighlightsInRailClick}
          />
        </nav>

        <div className="shrink-0">
          <NavigationRailGuidesSection
            isNavCollapsed={isNavCollapsed}
            isGuidesExpanded={isGuidesExpanded}
            onToggleGuidesExpanded={toggleGuidesExpanded}
            isGuidesMenuExpanded={isGuidesMenuExpanded}
            onToggleGuidesMenuExpanded={toggleGuidesMenuExpanded}
          />
        </div>
      </aside>
    </>
  )
}
