"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import Tooltip from "@/components/molecules/Tooltip"
import type { TabId } from "@/components/organisms/event-analysis/TabNavigation"
import type { NavItem } from "./navigationRailConfig"

export interface MyClubNavSectionProps {
  item: NavItem
  isNavCollapsed: boolean
  activeEventAnalysisTab: TabId
  isMyClubExpanded: boolean
  onToggleMyClubExpanded: () => void
  onTrackLeaderboardClick: () => void
  onClubHighlightsClick: () => void
}

export default function MyClubNavSection({
  item,
  isNavCollapsed,
  activeEventAnalysisTab,
  isMyClubExpanded,
  onToggleMyClubExpanded,
  onTrackLeaderboardClick,
  onClubHighlightsClick,
}: MyClubNavSectionProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const fromParam = searchParams.get("from")
  const myClubActive =
    (pathname === "/under-development" && fromParam === "/eventAnalysis/my-club") ||
    pathname.startsWith("/eventAnalysis/my-club") ||
    (pathname === "/eventAnalysis" &&
      (activeEventAnalysisTab === "track-leader-board" ||
        activeEventAnalysisTab === "club-highlights"))
  const trackMapsActive =
    pathname === "/eventAnalysis/my-club/track-maps" ||
    pathname.startsWith("/eventAnalysis/my-club/track-maps")
  const trackLeaderboardRailActive =
    pathname === "/eventAnalysis" && activeEventAnalysisTab === "track-leader-board"
  const clubHighlightsRailActive =
    pathname === "/eventAnalysis" && activeEventAnalysisTab === "club-highlights"

  if (isNavCollapsed) {
    return (
      <Tooltip text={item.label} position="right">
        <Link
          href={item.href}
          className={`group flex items-center justify-center rounded-lg px-3 py-2 transition hover:bg-[var(--token-surface-raised)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)]`}
          aria-current={myClubActive ? "page" : undefined}
          aria-label={item.label}
        >
          {item.icon(myClubActive)}
        </Link>
      </Tooltip>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Link
          href={item.href}
          className={`group flex flex-1 flex-col items-stretch rounded-lg px-3 py-2 transition hover:bg-[var(--token-surface-raised)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)]`}
          aria-current={myClubActive ? "page" : undefined}
          aria-label={item.label}
        >
          <div className="flex items-center gap-3">
            {item.icon(myClubActive)}
            <span
              className={`text-sm font-medium transition-opacity duration-200 ease-in-out ${myClubActive ? "text-[var(--token-text-primary)]" : "text-[var(--token-text-secondary)]"}`}
            >
              {item.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--token-text-muted)] transition-opacity duration-200 ease-in-out">
            {item.description}
          </p>
        </Link>
        <button
          type="button"
          onClick={onToggleMyClubExpanded}
          className="rounded-lg p-1.5 text-[var(--token-text-muted)] hover:bg-[var(--token-surface-raised)] hover:text-[var(--token-text-primary)] transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
          aria-label={isMyClubExpanded ? "Collapse My Club menu" : "Expand My Club menu"}
          aria-expanded={isMyClubExpanded}
        >
          <svg
            className={`h-4 w-4 transition-transform motion-reduce:transition-none ${isMyClubExpanded ? "rotate-180" : ""}`}
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
      </div>
      {isMyClubExpanded && (
        <div className="ml-4 space-y-1 border-l-2 border-[var(--token-border-muted)] pl-3">
          <Link
            href="/eventAnalysis/my-club/track-maps"
            className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-[var(--token-surface-raised)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)] ${
              trackMapsActive
                ? "text-[var(--token-text-primary)] bg-[var(--token-surface-raised)]/50"
                : "text-[var(--token-text-secondary)]"
            }`}
            aria-current={trackMapsActive ? "page" : undefined}
            aria-label="Track Maps"
          >
            <svg className="h-4 w-4 text-[var(--token-text-muted)]" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 12h18M3 6h18M3 18h18"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 3v18M15 3v18"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="6" cy="9" r="1.5" stroke="currentColor" strokeWidth={1.5} />
              <circle cx="18" cy="15" r="1.5" stroke="currentColor" strokeWidth={1.5} />
            </svg>
            <span>Track Maps</span>
          </Link>
          <button
            type="button"
            onClick={onTrackLeaderboardClick}
            className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-[var(--token-surface-raised)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)] ${
              trackLeaderboardRailActive
                ? "text-[var(--token-text-primary)] bg-[var(--token-surface-raised)]/50"
                : "text-[var(--token-text-secondary)]"
            }`}
            aria-current={trackLeaderboardRailActive ? "page" : undefined}
            aria-label="Track Leaderboard"
          >
            <svg className="h-4 w-4 text-[var(--token-text-muted)]" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 6h16M4 12h10M4 18h16"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M18 9v6l2-2"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Track Leaderboard</span>
          </button>
          <button
            type="button"
            onClick={onClubHighlightsClick}
            className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-[var(--token-surface-raised)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)] ${
              clubHighlightsRailActive
                ? "text-[var(--token-text-primary)] bg-[var(--token-surface-raised)]/50"
                : "text-[var(--token-text-secondary)]"
            }`}
            aria-current={clubHighlightsRailActive ? "page" : undefined}
            aria-label="Club Highlights"
          >
            <svg className="h-4 w-4 text-[var(--token-text-muted)]" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2l3 6 6 .5-4.5 4 1.5 6L12 16l-6 3 1.5-6L3 8.5 9 8l3-6z"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Club Highlights</span>
          </button>
        </div>
      )}
    </div>
  )
}

export function isMyClubNavItem(item: NavItem): boolean {
  return (
    item.href === "/under-development?from=/eventAnalysis/my-club" ||
    item.href.startsWith("/eventAnalysis/my-club")
  )
}
