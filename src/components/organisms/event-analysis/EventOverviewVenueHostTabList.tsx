"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import {
  OVERVIEW_GLASS_SURFACE_CLASS,
  OVERVIEW_GLASS_SURFACE_STYLE,
} from "./overview-glass-surface"

export type VenueHostSubTab = "eventHost" | "hostTrack" | "eventWeather" | "eventMix"

const TAB_META: Record<VenueHostSubTab, { tabId: string; panelId: string; label: string }> = {
  eventHost: {
    tabId: "overview-venue-host-tab-event-host",
    panelId: "overview-venue-host-panel-event-host",
    label: "Event Host",
  },
  hostTrack: {
    tabId: "overview-venue-host-tab-host-track",
    panelId: "overview-venue-host-panel-host-track",
    label: "Host Track",
  },
  eventWeather: {
    tabId: "overview-venue-host-tab-event-weather",
    panelId: "overview-venue-host-panel-event-weather",
    label: "Event Weather",
  },
  eventMix: {
    tabId: "overview-venue-host-tab-event-mix",
    panelId: "overview-venue-host-panel-event-mix",
    label: "Event Mix",
  },
}

const TAB_FOCUS_RING =
  "focus:outline-none focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-interactive-focus-ring)]"

type EventOverviewVenueHostTabListProps = {
  selected: VenueHostSubTab
  onSelect: (tab: VenueHostSubTab) => void
  showEventHostTab: boolean
  showHostTrackTab: boolean
  showEventWeatherTab: boolean
  showEventMixTab: boolean
}

export function EventOverviewVenueHostTabList({
  selected,
  onSelect,
  showEventHostTab,
  showHostTrackTab,
  showEventWeatherTab,
  showEventMixTab,
}: EventOverviewVenueHostTabListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [fade, setFade] = useState({ left: false, right: false })

  const visibleTabs = useMemo(() => {
    const tabs: VenueHostSubTab[] = []
    if (showEventHostTab) tabs.push("eventHost")
    if (showHostTrackTab) tabs.push("hostTrack")
    if (showEventWeatherTab) tabs.push("eventWeather")
    if (showEventMixTab) tabs.push("eventMix")
    return tabs
  }, [showEventHostTab, showHostTrackTab, showEventWeatherTab, showEventMixTab])

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

  const selectedIndex = visibleTabs.indexOf(selected)

  useEffect(() => {
    if (selectedIndex === -1) return
    tabRefs.current[selectedIndex]?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    })
  }, [selected, selectedIndex])

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
  }, [updateFade, selected, visibleTabs.length])

  const focusTabIndex = useCallback(
    (index: number) => {
      const len = visibleTabs.length
      if (len === 0) return
      const i = ((index % len) + len) % len
      requestAnimationFrame(() => {
        tabRefs.current[i]?.focus()
      })
    },
    [visibleTabs.length]
  )

  const onTabKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const len = visibleTabs.length
      if (len <= 1) return
      if (e.key === "ArrowRight") {
        e.preventDefault()
        const next = (index + 1) % len
        onSelect(visibleTabs[next]!)
        focusTabIndex(next)
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        const prev = (index - 1 + len) % len
        onSelect(visibleTabs[prev]!)
        focusTabIndex(prev)
      } else if (e.key === "Home") {
        e.preventDefault()
        onSelect(visibleTabs[0]!)
        focusTabIndex(0)
      } else if (e.key === "End") {
        e.preventDefault()
        const last = len - 1
        onSelect(visibleTabs[last]!)
        focusTabIndex(last)
      }
    },
    [focusTabIndex, onSelect, visibleTabs]
  )

  if (visibleTabs.length === 0) return null

  return (
    <div className="relative min-w-0 w-full">
      {fade.left ? (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 rounded-l-[inherit] bg-gradient-to-r from-[var(--token-surface-elevated)] to-transparent"
          aria-hidden
        />
      ) : null}
      {fade.right ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 rounded-r-[inherit] bg-gradient-to-l from-[var(--token-surface-elevated)] to-transparent"
          aria-hidden
        />
      ) : null}

      <div
        className={`min-w-0 overflow-hidden ${OVERVIEW_GLASS_SURFACE_CLASS}`}
        style={OVERVIEW_GLASS_SURFACE_STYLE}
      >
        <div
          ref={scrollRef}
          role="tablist"
          aria-label="Event host, track, weather, and mix"
          className="scrollbar-none flex snap-x snap-mandatory gap-1 overflow-x-auto scroll-smooth px-1 py-1"
        >
          {visibleTabs.map((tabKey, index) => {
            const { tabId, panelId, label } = TAB_META[tabKey]
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
                  "relative min-h-9 shrink-0 snap-start whitespace-nowrap rounded-lg px-4 py-2.5 text-left text-sm font-medium transition-colors",
                  isSelected
                    ? "bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                    : "text-[var(--token-text-secondary)] hover:bg-[var(--token-surface)]/35 hover:text-[var(--token-text-primary)]",
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
