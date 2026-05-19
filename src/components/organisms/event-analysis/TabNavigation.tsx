/**
 * @fileoverview Tab navigation component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-04-06
 *
 * @description Primary tabs with optional submenu under Analysis (dispatches event- or
 *              session-level content while keeping the Analysis tab selected).
 *              Clicking the tab toggles its submenu; the primary tab updates when a menu item is
 *              chosen (or via arrow keys), or stays on Analysis when {@link onAnalysisMenuDispatch} is set.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/OverviewTab.tsx (tab content)
 * - src/components/organisms/event-analysis/DriversTab.tsx (tab content)
 */

"use client"

import {
  Fragment,
  type ReactNode,
  KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"

import {
  type AnalysisPrimarySubTabId,
  getAnalysisPrimarySubTabOptions,
} from "@/components/organisms/event-analysis/event-analysis-sub-tabs"
import {
  OVERVIEW_GLASS_SURFACE_CLASS,
  OVERVIEW_GLASS_SURFACE_STYLE,
} from "@/components/organisms/event-analysis/overview-glass-surface"

export type TabId =
  | "event-overview"
  | "analysis"
  | "event-sessions"
  | "event-analysis"
  | "session-analysis"
  | "my-events"
  | "drivers"
  | "track-leader-board"
  | "club-highlights"
  | "my-day"
  | "my-sessions"
  | "class-reference"
  | "all-sessions"

export interface Tab {
  id: TabId
  label: string
}

function ChevronDownIcon({ className, open }: { className?: string; open?: boolean }) {
  return (
    <svg
      className={`${className ?? ""} ${open ? "rotate-180" : ""} transition-transform`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const menuItemClass =
  "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[var(--token-text-secondary)] transition hover:bg-[var(--token-surface-raised)]/70 hover:text-[var(--token-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-accent)]"

/** Embedded primary tab surface for the Event Overview glass strip (pill row). */
function embeddedGlassStripPrimaryControlClass(selected: boolean): string {
  const focusRing =
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-[var(--token-interactive-focus-ring)]"
  return (
    `shrink-0 snap-start rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${focusRing} ` +
    (selected
      ? "bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
      : "text-[var(--token-text-secondary)] hover:bg-[var(--token-surface)]/35 hover:text-[var(--token-text-primary)]")
  )
}

export interface TabNavigationProps {
  tabs: Tab[]
  activeTab: TabId
  onTabChange: (tabId: TabId) => void
  embedded?: boolean
  /** After the last tab in the scrollable strip (not part of the tablist). */
  tabListTrailing?: ReactNode
  /** Which Analysis chevron item is “current”: `event-level`, `session-level`, or "". Dashboard supplies this. */
  analysisMenuSelectedId?: string
  /** When set, Analysis menu selections call this and keep the Analysis tab selected. */
  onAnalysisMenuDispatch?: (id: AnalysisPrimarySubTabId) => void
  /**
   * When `embedded`, how the tablist is chromed. `glass` matches the default pill; `none` is bare
   * tablist for a parent outline (e.g. overview strip above the main toolbar).
   */
  embeddedChrome?: "glass" | "none"
}

const defaultTabs: Tab[] = [
  { id: "event-overview", label: "Event Overview" },
  { id: "analysis", label: "Analysis" },
  { id: "drivers", label: "Entry List" },
]

type SubmenuTabProps = {
  tab: Tab
  isActive: boolean
  menuOpen: boolean
  menuOptions: { id: string; label: string }[]
  selectedMenuId: string
  /** When true, menu item “current” styling follows {@link selectedMenuId} even if this tab is not active (dispatcher pattern). */
  selectedWithoutActiveTab?: boolean
  /**
   * Analysis uses a submenu before mounting {@code #tabpanel-analysis}. While no menu item is
   * chosen, omit aria-controls when the menu is closed so we do not reference a missing node.
   */
  deferTabpanelAriaUntilMenuChoice?: boolean
  onMenuItemSelect: (id: string) => void
  onTabButtonClick: () => void
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void
  tabButtonClass: (isActive: boolean) => string
  menuId: string
  menuAriaLabel: string
  onCloseMenu: () => void
}

function SubmenuTab({
  tab,
  isActive,
  menuOpen,
  menuOptions,
  selectedMenuId,
  selectedWithoutActiveTab,
  deferTabpanelAriaUntilMenuChoice,
  onMenuItemSelect,
  onTabButtonClick,
  onKeyDown,
  tabButtonClass,
  menuId,
  menuAriaLabel,
  onCloseMenu,
}: SubmenuTabProps) {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [fixedPos, setFixedPos] = useState<{
    top: number
    left: number
    minWidth: number
  } | null>(null)

  useLayoutEffect(() => {
    if (!menuOpen) {
      queueMicrotask(() => setFixedPos(null))
      return
    }
    if (!anchorRef.current) {
      return
    }
    const update = () => {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setFixedPos({
        top: r.bottom + 4,
        left: r.left,
        minWidth: Math.max(240, r.width),
      })
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [menuOpen])

  const menuPanel =
    menuOpen && fixedPos && typeof document !== "undefined"
      ? createPortal(
          <div
            data-analysis-submenu-panel
            id={menuId}
            role="menu"
            aria-label={menuAriaLabel}
            style={{
              position: "fixed",
              top: fixedPos.top,
              left: fixedPos.left,
              minWidth: fixedPos.minWidth,
              zIndex: 100,
            }}
            className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] py-1 shadow-lg"
          >
            {menuOptions.map((opt) => {
              const selected = opt.id === selectedMenuId && (selectedWithoutActiveTab || isActive)
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onMenuItemSelect(opt.id)
                    onCloseMenu()
                  }}
                  className={`${menuItemClass} ${selected ? "bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]" : ""}`}
                >
                  {opt.label}
                  {selected ? <span className="sr-only"> (current)</span> : null}
                </button>
              )
            })}
          </div>,
          document.body
        )
      : null

  const collapsedTabpanelAriaControls =
    deferTabpanelAriaUntilMenuChoice && selectedMenuId.length === 0
      ? undefined
      : `tabpanel-${tab.id}`

  const tabButton = (
    <div data-analysis-submenu-root className="relative inline-block shrink-0 snap-start">
      <button
        ref={anchorRef}
        type="button"
        role="tab"
        aria-selected={isActive}
        id={`tab-${tab.id}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : collapsedTabpanelAriaControls}
        onClick={onTabButtonClick}
        onKeyDown={onKeyDown}
        className={tabButtonClass(isActive)}
      >
        <span>{tab.label}</span>
        <ChevronDownIcon
          className="h-3.5 w-3.5 shrink-0 text-[var(--token-text-muted)]"
          open={menuOpen}
        />
      </button>
    </div>
  )

  return (
    <>
      {tabButton}
      {menuPanel}
    </>
  )
}

export default function TabNavigation({
  tabs = defaultTabs,
  activeTab,
  onTabChange,
  embedded = false,
  embeddedChrome = "glass",
  tabListTrailing,
  analysisMenuSelectedId,
  onAnalysisMenuDispatch,
}: TabNavigationProps) {
  const [subMenuOpenFor, setSubMenuOpenFor] = useState<TabId | null>(null)
  const baseId = useId()

  const hasAnalysisDispatchTab = tabs.some((t) => t.id === "analysis")

  const tabHasSubmenu = useCallback(
    (tabId: TabId): boolean => tabId === "analysis" && hasAnalysisDispatchTab,
    [hasAnalysisDispatchTab]
  )

  const closeSubMenu = useCallback(() => setSubMenuOpenFor(null), [])

  /** Switch primary tab and close any open analysis submenu (menus can stay open while inactive). */
  const changeTab = useCallback(
    (tabId: TabId) => {
      setSubMenuOpenFor(null)
      onTabChange(tabId)
    },
    [onTabChange]
  )

  useEffect(() => {
    if (!subMenuOpenFor) return
    const handlePointer = (e: MouseEvent) => {
      const t = e.target as Node
      const roots = document.querySelectorAll(
        "[data-analysis-submenu-root], [data-analysis-submenu-panel]"
      )
      for (const root of roots) {
        if (root.contains(t)) return
      }
      closeSubMenu()
    }
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") closeSubMenu()
    }
    document.addEventListener("mousedown", handlePointer)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handlePointer)
      document.removeEventListener("keydown", handleKey)
    }
  }, [subMenuOpenFor, closeSubMenu])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tabId: TabId) => {
    const hasSubmenu = tabHasSubmenu(tabId)

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      if (hasSubmenu) {
        setSubMenuOpenFor((prev) => (prev === tabId ? null : tabId))
      } else {
        changeTab(tabId)
      }
      return
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      const currentIndex = tabs.findIndex((t) => t.id === activeTab)
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1
      changeTab(tabs[prevIndex].id)
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      const currentIndex = tabs.findIndex((t) => t.id === activeTab)
      const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0
      changeTab(tabs[nextIndex].id)
    }
  }

  const tabButtonClass = (isActive: boolean) => {
    const focusRing = embedded
      ? "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-[var(--token-interactive-focus-ring)]"
      : "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
    if (embedded) {
      return embeddedGlassStripPrimaryControlClass(isActive)
    }
    return (
      `shrink-0 snap-start px-6 py-3 text-sm font-medium transition-colors ${focusRing} ` +
      (isActive
        ? "text-[var(--token-accent)]"
        : "text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)]")
    )
  }

  const submenuTabButtonClass = (isActive: boolean) =>
    `inline-flex shrink-0 items-center gap-1 ${tabButtonClass(isActive)}`

  const tabButtons = tabs.map((tab) => {
    const isActive = activeTab === tab.id

    if (tab.id === "analysis" && hasAnalysisDispatchTab) {
      const menuOpen = subMenuOpenFor === tab.id
      const menuId = `${baseId}-menu-${tab.id}`
      const dispatchTargetSelectedId = analysisMenuSelectedId ?? ""
      return (
        <Fragment key={tab.id}>
          <SubmenuTab
            tab={tab}
            isActive={isActive}
            menuOpen={menuOpen}
            menuOptions={getAnalysisPrimarySubTabOptions()}
            selectedMenuId={dispatchTargetSelectedId}
            selectedWithoutActiveTab
            deferTabpanelAriaUntilMenuChoice={Boolean(onAnalysisMenuDispatch)}
            onMenuItemSelect={(id) => {
              onAnalysisMenuDispatch?.(id as AnalysisPrimarySubTabId)
            }}
            onTabButtonClick={() => {
              setSubMenuOpenFor((prev) => (prev === tab.id ? null : tab.id))
            }}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            tabButtonClass={submenuTabButtonClass}
            menuId={menuId}
            menuAriaLabel="Analysis views"
            onCloseMenu={closeSubMenu}
          />
        </Fragment>
      )
    }

    const tabButton = (
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-controls={`tabpanel-${tab.id}`}
        id={`tab-${tab.id}`}
        onClick={() => changeTab(tab.id)}
        onKeyDown={(e) => handleKeyDown(e, tab.id)}
        className={tabButtonClass(isActive)}
      >
        {tab.label}
      </button>
    )
    return <Fragment key={tab.id}>{tabButton}</Fragment>
  })

  const tabList = (
    <div
      role="tablist"
      aria-label="Event analysis tabs"
      className={`flex min-w-0 flex-nowrap ${embedded ? "gap-1 px-1 py-1" : ""}`}
    >
      {tabButtons}
    </div>
  )

  return (
    <div
      className={`scrollbar-none snap-x snap-mandatory scroll-smooth min-w-0 overflow-x-auto overscroll-x-contain ${embedded ? "w-max max-w-full" : "w-full border-b border-[var(--token-border-default)]"}`}
    >
      <div className={`flex w-max min-w-0 flex-nowrap items-stretch ${embedded ? "gap-2" : ""}`}>
        {embedded ? (
          embeddedChrome === "glass" ? (
            <div
              className={`inline-flex min-w-0 max-w-full overflow-hidden ${OVERVIEW_GLASS_SURFACE_CLASS}`}
              style={OVERVIEW_GLASS_SURFACE_STYLE}
            >
              {tabList}
            </div>
          ) : (
            tabList
          )
        ) : (
          tabList
        )}
        {tabListTrailing ? (
          <div className="flex shrink-0 snap-none items-stretch">{tabListTrailing}</div>
        ) : null}
      </div>
    </div>
  )
}
