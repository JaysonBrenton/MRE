"use client"

import Link from "next/link"
import type { TabId } from "@/components/organisms/event-analysis/TabNavigation"
import Tooltip from "@/components/molecules/Tooltip"
import type { NavItem } from "./navigationRailConfig"
import { myEventsNavIcon } from "./navigationRailConfig"
import MyClubNavSection, { isMyClubNavItem } from "./MyClubNavSection"

export interface NavigationRailNavItemsProps {
  navItems: NavItem[]
  isNavCollapsed: boolean
  pathname: string
  onDashboardNavClick: () => void
  showMyEventsRail: boolean
  myEventsActive: boolean
  onMyEventsInRailClick: () => void
  activeEventAnalysisTab: TabId
  isMyClubExpanded: boolean
  onToggleMyClubExpanded: () => void
  onTrackLeaderboardInRailClick: () => void
  onClubHighlightsInRailClick: () => void
}

export default function NavigationRailNavItems({
  navItems,
  isNavCollapsed,
  pathname,
  onDashboardNavClick,
  showMyEventsRail,
  myEventsActive,
  onMyEventsInRailClick,
  activeEventAnalysisTab,
  isMyClubExpanded,
  onToggleMyClubExpanded,
  onTrackLeaderboardInRailClick,
  onClubHighlightsInRailClick,
}: NavigationRailNavItemsProps) {
  return (
    <>
      {navItems.map((item) => {
        if (isMyClubNavItem(item)) {
          return (
            <MyClubNavSection
              key={item.label}
              item={item}
              isNavCollapsed={isNavCollapsed}
              activeEventAnalysisTab={activeEventAnalysisTab}
              isMyClubExpanded={isMyClubExpanded}
              onToggleMyClubExpanded={onToggleMyClubExpanded}
              onTrackLeaderboardClick={onTrackLeaderboardInRailClick}
              onClubHighlightsClick={onClubHighlightsInRailClick}
            />
          )
        }

        const isExternal = item.href.startsWith("http://") || item.href.startsWith("https://")
        const active = isExternal
          ? false
          : pathname === item.href || pathname.startsWith(`${item.href}/`)

        const linkElement = (
          <Link
            href={item.href}
            onClick={item.href === "/eventAnalysis" ? onDashboardNavClick : undefined}
            className={`group flex min-w-0 flex-col ${isNavCollapsed ? "items-center" : "items-stretch"} rounded-lg px-3 py-2 transition motion-reduce:transition-none hover:bg-[var(--token-surface-raised)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)]`}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
          >
            <div
              className={`flex min-w-0 items-center ${isNavCollapsed ? "justify-center" : "gap-3"}`}
            >
              {item.icon(active)}
              {!isNavCollapsed && (
                <span
                  className={`whitespace-nowrap text-sm font-medium transition-opacity duration-150 ease-out motion-reduce:transition-none ${active ? "text-[var(--token-text-primary)]" : "text-[var(--token-text-secondary)]"}`}
                >
                  {item.label}
                </span>
              )}
            </div>
            {!isNavCollapsed && (
              <p className="mt-1 line-clamp-2 text-xs text-[var(--token-text-muted)] transition-opacity duration-150 ease-out motion-reduce:transition-none">
                {item.description}
              </p>
            )}
          </Link>
        )

        const showMyEventsBelowDashboard = item.href === "/eventAnalysis" && showMyEventsRail

        const myEventsRailButton = showMyEventsBelowDashboard ? (
          isNavCollapsed ? (
            <Tooltip text="My Events" position="right">
              <button
                type="button"
                id="rail-nav-my-events"
                onClick={onMyEventsInRailClick}
                className={`group flex w-full items-center justify-center rounded-lg px-3 py-2 transition motion-reduce:transition-none hover:bg-[var(--token-surface-raised)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)] ${
                  myEventsActive ? "bg-[var(--token-surface-raised)]/50" : ""
                }`}
                aria-label="My Events"
                aria-pressed={myEventsActive}
              >
                {myEventsNavIcon(myEventsActive)}
              </button>
            </Tooltip>
          ) : (
            <button
              type="button"
              id="rail-nav-my-events"
              onClick={onMyEventsInRailClick}
              className={`group flex min-w-0 flex-col items-stretch rounded-lg px-3 py-2 transition motion-reduce:transition-none hover:bg-[var(--token-surface-raised)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)] ${
                myEventsActive ? "bg-[var(--token-surface-raised)]/50" : ""
              }`}
              aria-label="My Events"
              aria-pressed={myEventsActive}
            >
              <div className="flex min-w-0 items-center gap-3">
                {myEventsNavIcon(myEventsActive)}
                <span
                  className={`whitespace-nowrap text-sm font-medium transition-opacity duration-150 ease-out motion-reduce:transition-none ${myEventsActive ? "text-[var(--token-text-primary)]" : "text-[var(--token-text-secondary)]"}`}
                >
                  My Events
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--token-text-muted)] transition-opacity duration-150 ease-out motion-reduce:transition-none">
                Your entries and standings
              </p>
            </button>
          )
        ) : null

        return (
          <div key={item.label} className={showMyEventsBelowDashboard ? "space-y-1" : undefined}>
            {isNavCollapsed ? (
              <Tooltip text={item.label} position="right">
                {linkElement}
              </Tooltip>
            ) : (
              linkElement
            )}
            {myEventsRailButton}
          </div>
        )
      })}
    </>
  )
}
