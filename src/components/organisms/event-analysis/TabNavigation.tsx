/**
 * @fileoverview Tab navigation component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-04-06
 *
 * @description Primary tabs with optional submenus under Event Analysis and Session Analysis.
 *              Clicking the tab toggles its submenu; the primary tab changes when a menu item is
 *              chosen (or when using a non-submenu tab / arrow keys).
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
  type EventAnalysisSubTabId,
  getSubTabOptions,
} from "@/components/organisms/event-analysis/event-analysis-sub-tabs"

export type TabId =
  | "event-overview"
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

export interface TabNavigationProps {
  tabs: Tab[]
  activeTab: TabId
  onTabChange: (tabId: TabId) => void
  embedded?: boolean
  /** Event Analysis / Session Analysis sub-views (menus under those tab buttons). */
  analysisSubTab?: EventAnalysisSubTabId
  onAnalysisSubTabChange?: (id: EventAnalysisSubTabId) => void
  /** After the last tab in the scrollable strip (not part of the tablist). */
  tabListTrailing?: ReactNode
}

const defaultTabs: Tab[] = [
  { id: "event-overview", label: "Event Overview" },
  { id: "event-analysis", label: "Event Analysis" },
  { id: "session-analysis", label: "Session Analysis" },
  { id: "drivers", label: "Entry List" },
]

type SubmenuTabProps = {
  tab: Tab
  isActive: boolean
  menuOpen: boolean
  menuOptions: { id: string; label: string }[]
  selectedMenuId: string
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
              const selected = opt.id === selectedMenuId && isActive
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

  const tabButton = (
    <div data-analysis-submenu-root className="relative inline-block shrink-0">
      <button
        ref={anchorRef}
        type="button"
        role="tab"
        aria-selected={isActive}
        id={`tab-${tab.id}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : `tabpanel-${tab.id}`}
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
  analysisSubTab,
  onAnalysisSubTabChange,
  tabListTrailing,
}: TabNavigationProps) {
  const [subMenuOpenFor, setSubMenuOpenFor] = useState<TabId | null>(null)
  const baseId = useId()

  const hasAnalysisSubmenus = analysisSubTab !== undefined && onAnalysisSubTabChange !== undefined

  const tabHasSubmenu = useCallback(
    (tabId: TabId): boolean =>
      (tabId === "event-analysis" || tabId === "session-analysis") && hasAnalysisSubmenus,
    [hasAnalysisSubmenus]
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

  const tabButtonClass = (isActive: boolean) =>
    `shrink-0 px-6 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
      isActive
        ? "text-[var(--token-accent)]"
        : "text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)]"
    }`

  const submenuTabButtonClass = (isActive: boolean) =>
    `inline-flex shrink-0 items-center gap-1 ${tabButtonClass(isActive)}`

  const tabButtons = tabs.map((tab) => {
    const isActive = activeTab === tab.id

    if (tab.id === "event-analysis" && hasAnalysisSubmenus) {
      const menuOpen = subMenuOpenFor === tab.id
      const menuId = `${baseId}-menu-${tab.id}`
      return (
        <Fragment key={tab.id}>
          <SubmenuTab
            tab={tab}
            isActive={isActive}
            menuOpen={menuOpen}
            menuOptions={getSubTabOptions("event")}
            selectedMenuId={analysisSubTab!}
            onMenuItemSelect={(id) => {
              changeTab(tab.id)
              onAnalysisSubTabChange!(id as EventAnalysisSubTabId)
            }}
            onTabButtonClick={() => {
              setSubMenuOpenFor((prev) => (prev === tab.id ? null : tab.id))
            }}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            tabButtonClass={submenuTabButtonClass}
            menuId={menuId}
            menuAriaLabel="Event Analysis views"
            onCloseMenu={closeSubMenu}
          />
        </Fragment>
      )
    }

    if (tab.id === "session-analysis" && hasAnalysisSubmenus) {
      const menuOpen = subMenuOpenFor === tab.id
      const menuId = `${baseId}-menu-${tab.id}`
      return (
        <Fragment key={tab.id}>
          <SubmenuTab
            tab={tab}
            isActive={isActive}
            menuOpen={menuOpen}
            menuOptions={getSubTabOptions("session")}
            selectedMenuId={analysisSubTab!}
            onMenuItemSelect={(id) => {
              changeTab(tab.id)
              onAnalysisSubTabChange!(id as EventAnalysisSubTabId)
            }}
            onTabButtonClick={() => {
              setSubMenuOpenFor((prev) => (prev === tab.id ? null : tab.id))
            }}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            tabButtonClass={submenuTabButtonClass}
            menuId={menuId}
            menuAriaLabel="Session Analysis views"
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

  return (
    <div
      className={`min-w-0 overflow-x-auto overscroll-x-contain ${embedded ? "w-max max-w-full" : "w-full border-b border-[var(--token-border-default)]"}`}
    >
      <div className="flex w-max min-w-0 flex-nowrap items-stretch">
        <div role="tablist" aria-label="Event analysis tabs" className="flex min-w-0 flex-nowrap">
          {tabButtons}
        </div>
        {tabListTrailing ? (
          <div className="flex shrink-0 items-stretch">{tabListTrailing}</div>
        ) : null}
      </div>
    </div>
  )
}
