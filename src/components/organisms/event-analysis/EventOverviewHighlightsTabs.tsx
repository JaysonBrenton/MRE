"use client"

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react"
import { OVERVIEW_INNER_WELL_SURFACE_CLASS } from "./overview-glass-surface"
export type EventHighlightsSubTab =
  | "classWinners"
  | "topQualifiers"
  | "seeding"
  | "lapHeroes"
  | "mostConsistentDrivers"
  | "fastestLaps"
  | "fastestAverageLaps"
  | "lapStats"
  | "closestBattles"

export const HIGHLIGHT_TAB_META: Record<
  EventHighlightsSubTab,
  { tabId: string; panelId: string; label: string }
> = {
  classWinners: {
    tabId: "event-overview-highlights-tab-cw",
    panelId: "event-overview-highlights-panel-cw",
    label: "Class Winners",
  },
  topQualifiers: {
    tabId: "event-overview-highlights-tab-tq",
    panelId: "event-overview-highlights-panel-tq",
    label: "Top Qualifiers",
  },
  seeding: {
    tabId: "event-overview-highlights-tab-seeding",
    panelId: "event-overview-highlights-panel-seeding",
    label: "Seeding",
  },
  lapHeroes: {
    tabId: "event-overview-highlights-tab-lh",
    panelId: "event-overview-highlights-panel-lh",
    label: "Lap Heroes",
  },
  mostConsistentDrivers: {
    tabId: "event-overview-highlights-tab-mc",
    panelId: "event-overview-highlights-panel-mc",
    label: "Most Consistent Drivers",
  },
  fastestLaps: {
    tabId: "event-overview-highlights-tab-fl",
    panelId: "event-overview-highlights-panel-fl",
    label: "Fastest Laps",
  },
  fastestAverageLaps: {
    tabId: "event-overview-highlights-tab-fal",
    panelId: "event-overview-highlights-panel-fal",
    label: "Fastest Average Laps",
  },
  lapStats: {
    tabId: "event-overview-highlights-tab-ls",
    panelId: "event-overview-highlights-panel-ls",
    label: "Lap Stats",
  },
  closestBattles: {
    tabId: "event-overview-highlights-tab-cb",
    panelId: "event-overview-highlights-panel-cb",
    label: "Closest Battles",
  },
}

/** Document order for keyboard navigation (event mix before closest battles). */
const HIGHLIGHT_TAB_ORDER: EventHighlightsSubTab[] = [
  "classWinners",
  "topQualifiers",
  "seeding",
  "lapHeroes",
  "mostConsistentDrivers",
  "fastestLaps",
  "fastestAverageLaps",
  "lapStats",
  "closestBattles",
]

const TAB_FOCUS_RING =
  "focus:outline-none focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-interactive-focus-ring)]"

type EventOverviewHighlightsTabListProps = {
  selected: EventHighlightsSubTab
  onSelect: (tab: EventHighlightsSubTab) => void
}

export function EventOverviewHighlightsTabList({
  selected,
  onSelect,
}: EventOverviewHighlightsTabListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [fade, setFade] = useState({ left: false, right: false })

  const updateFade = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const overflow = scrollWidth > clientWidth + 1
    if (!overflow) {
      setFade({ left: false, right: false })
      return
    }
    setFade({
      left: scrollLeft > 2,
      right: scrollLeft < scrollWidth - clientWidth - 2,
    })
  }, [])

  useEffect(() => {
    const idx = HIGHLIGHT_TAB_ORDER.indexOf(selected)
    if (idx === -1) return
    tabRefs.current[idx]?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    })
  }, [selected])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const scheduleFadeUpdate = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => updateFade())
    }
    scheduleFadeUpdate()
    el.addEventListener("scroll", scheduleFadeUpdate, { passive: true })
    const ro = new ResizeObserver(scheduleFadeUpdate)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener("scroll", scheduleFadeUpdate)
      ro.disconnect()
    }
  }, [updateFade, selected])

  const focusTabIndex = useCallback((index: number) => {
    const len = HIGHLIGHT_TAB_ORDER.length
    const i = ((index % len) + len) % len
    requestAnimationFrame(() => {
      tabRefs.current[i]?.focus()
    })
  }, [])

  const onTabKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const len = HIGHLIGHT_TAB_ORDER.length
      if (e.key === "ArrowRight") {
        e.preventDefault()
        const next = (index + 1) % len
        onSelect(HIGHLIGHT_TAB_ORDER[next])
        focusTabIndex(next)
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        const prev = (index - 1 + len) % len
        onSelect(HIGHLIGHT_TAB_ORDER[prev])
        focusTabIndex(prev)
      } else if (e.key === "Home") {
        e.preventDefault()
        onSelect(HIGHLIGHT_TAB_ORDER[0])
        focusTabIndex(0)
      } else if (e.key === "End") {
        e.preventDefault()
        const last = len - 1
        onSelect(HIGHLIGHT_TAB_ORDER[last])
        focusTabIndex(last)
      }
    },
    [focusTabIndex, onSelect]
  )

  return (
    <div className="relative min-w-0 w-full">
      {fade.left ? (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 rounded-l-[inherit] bg-gradient-to-r from-[var(--token-surface-alt)] to-transparent"
          aria-hidden
        />
      ) : null}
      {fade.right ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 rounded-r-[inherit] bg-gradient-to-l from-[var(--token-surface-alt)] to-transparent"
          aria-hidden
        />
      ) : null}

      <div className={`min-w-0 overflow-hidden ${OVERVIEW_INNER_WELL_SURFACE_CLASS}`}>
        <div
          ref={scrollRef}
          role="tablist"
          aria-label="Event overview highlights"
          className="scrollbar-none flex snap-x snap-mandatory gap-1 overflow-x-auto scroll-smooth px-1 py-1"
        >
          {HIGHLIGHT_TAB_ORDER.map((tabKey, index) => {
            const { tabId, panelId, label } = HIGHLIGHT_TAB_META[tabKey]
            const isSelected = selected === tabKey
            return (
              <button
                key={tabKey}
                ref={(el) => {
                  tabRefs.current[index] = el
                }}
                id={tabId}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={panelId}
                tabIndex={isSelected ? 0 : -1}
                className={[
                  TAB_FOCUS_RING,
                  "relative min-h-8 shrink-0 snap-start whitespace-nowrap rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                  isSelected
                    ? "bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                    : "text-[var(--token-text-secondary)] hover:bg-[var(--token-surface-raised)]/35 hover:text-[var(--token-text-primary)]",
                ].join(" ")}
                onClick={() => onSelect(tabKey)}
                onKeyDown={(e) => onTabKeyDown(e, index)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
