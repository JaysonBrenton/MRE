/**
 * @fileoverview Event analysis actions dropdown menu
 *
 * @description Actions menu visible when viewing Event Overview, Event Sessions, or Drivers.
 *              Replaces the former sidebar event-actions block. Five items: Select a Class,
 *              Select Drivers, Find and Import Events, Refresh Event Data, Clear Event.
 *
 * @purpose Single "Actions" control in the tab row; click opens dropdown with event actions.
 */

"use client"

import { useRef, useEffect, useCallback, useState, type KeyboardEvent } from "react"
import { createPortal } from "react-dom"
import { useEventActionsOptional } from "@/components/organisms/dashboard/EventActionsContext"

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function RefreshIcon({ className, spin }: { className?: string; spin?: boolean }) {
  return (
    <svg
      className={spin ? `${className ?? ""} animate-spin` : className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M3 21v-5h5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DriversIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ClassIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ClearEventIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
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

const iconClass = "h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
const itemClass =
  "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--token-text-secondary)] transition hover:bg-[var(--token-surface-raised)]/70 hover:text-[var(--token-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-accent)] disabled:opacity-50 disabled:cursor-not-allowed"

const classItemClass =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--token-text-primary)] transition hover:bg-[var(--token-surface-raised)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-accent)]"

const CLASS_LIST_POPOVER_GAP = 8
const CLASS_LIST_ESTIMATE_WIDTH = 200
const CLASS_LIST_ESTIMATE_HEIGHT = 240

export default function EventAnalysisActionsMenu() {
  const eventActions = useEventActionsOptional()
  const [open, setOpen] = useState(false)
  const [isClassListExpanded, setIsClassListExpanded] = useState(false)
  const [classListPosition, setClassListPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const classListAnchorRef = useRef<HTMLButtonElement>(null)
  const classListPanelRef = useRef<HTMLDivElement>(null)

  const hasEventSelected = eventActions?.hasEventSelected ?? false
  const selectedDriverCount = eventActions?.selectedDriverIds.length ?? 0
  const classesForFilter = eventActions?.classesForFilter ?? []

  const close = useCallback(() => {
    setOpen(false)
    setIsClassListExpanded(false)
  }, [])

  // Click outside to close (main menu and portaled class list count as "inside")
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target) ||
        classListPanelRef.current?.contains(target)
      )
        return
      close()
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open, close])

  // Escape: close class list first if open, then close menu
  useEffect(() => {
    if (!open) return
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (isClassListExpanded) {
        setIsClassListExpanded(false)
      } else {
        close()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, close, isClassListExpanded])

  // Position portaled class list to the right of "Select a Class" button, with viewport bounds
  useEffect(() => {
    if (!isClassListExpanded || !open || !classListAnchorRef.current || !classListPanelRef.current)
      return

    const updatePosition = () => {
      if (!classListAnchorRef.current || !classListPanelRef.current) return
      const anchorRect = classListAnchorRef.current.getBoundingClientRect()
      const panelRect = classListPanelRef.current.getBoundingClientRect()
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      const panelWidth = panelRect.width || CLASS_LIST_ESTIMATE_WIDTH
      const panelHeight = panelRect.height || CLASS_LIST_ESTIMATE_HEIGHT

      let preferredLeft = anchorRect.right + CLASS_LIST_POPOVER_GAP
      let preferredTop = anchorRect.top

      if (preferredLeft + panelWidth > viewport.width - 8) {
        preferredLeft = anchorRect.left - panelWidth - CLASS_LIST_POPOVER_GAP
      }
      preferredLeft = Math.max(8, Math.min(viewport.width - panelWidth - 8, preferredLeft))
      preferredTop = Math.max(8, Math.min(viewport.height - panelHeight - 8, preferredTop))

      setClassListPosition({ top: preferredTop, left: preferredLeft })
    }

    const timeoutId = setTimeout(updatePosition, 0)
    const handleScroll = () => updatePosition()
    const handleResize = () => updatePosition()
    window.addEventListener("scroll", handleScroll, true)
    window.addEventListener("resize", handleResize)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener("scroll", handleScroll, true)
      window.removeEventListener("resize", handleResize)
    }
  }, [isClassListExpanded, open])

  const handleItemClick = useCallback(
    (action: () => void) => {
      action()
      close()
    },
    [close]
  )

  const handleClassSelect = useCallback(
    (className: string | null) => {
      eventActions?.onClassChange(className)
      close()
    },
    [eventActions, close]
  )

  const handleButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      setOpen((prev) => !prev)
    }
    if (e.key === "Escape") close()
  }

  if (!eventActions) return null

  return (
    <div className="relative flex shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleButtonKeyDown}
        className="flex items-center gap-2 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--token-text-primary)] transition hover:bg-[var(--token-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Event actions menu"
      >
        <span>Actions</span>
        <ChevronDownIcon
          className={`h-4 w-4 text-[var(--token-text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Event actions"
          className="absolute right-0 top-full z-50 mt-1 w-[220px] rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] shadow-lg"
        >
          <div className="space-y-1 p-2">
            {/* Find and Import Events - always */}
            <button
              type="button"
              role="menuitem"
              onClick={() => handleItemClick(eventActions.openEventSearch)}
              className={itemClass}
              aria-label="Find and Import Events (⌘E)"
            >
              <SearchIcon className={iconClass} />
              <span>Find and Import Events</span>
            </button>

            {/* Refresh Event Data - when event selected */}
            {hasEventSelected && (
              <button
                type="button"
                role="menuitem"
                onClick={() => handleItemClick(eventActions.handleRefreshEventData)}
                disabled={eventActions.isRefreshing}
                className={itemClass}
                aria-label="Refresh event data (⌘⌥R)"
              >
                {eventActions.isRefreshing ? (
                  <RefreshIcon className={iconClass} spin />
                ) : (
                  <RefreshIcon className={iconClass} />
                )}
                <span>Refresh Event Data</span>
              </button>
            )}

            {/* Select a Class - when event selected: opens portaled class list to the right */}
            {hasEventSelected && (
              <button
                ref={classListAnchorRef}
                type="button"
                role="menuitem"
                onClick={() => setIsClassListExpanded((prev) => !prev)}
                className={itemClass}
                aria-label="Filter by class (number is drivers per class)"
                aria-expanded={isClassListExpanded}
                aria-haspopup="menu"
              >
                <ClassIcon className={iconClass} />
                <span>Select a Class</span>
                <ChevronDownIcon
                  className={`ml-auto h-4 w-4 text-[var(--token-text-muted)] transition-transform ${isClassListExpanded ? "rotate-180" : ""}`}
                />
              </button>
            )}

            {/* Select Drivers - when event selected */}
            {hasEventSelected && (
              <button
                type="button"
                role="menuitem"
                onClick={() => handleItemClick(eventActions.openDriverSelection)}
                disabled={!hasEventSelected}
                className={itemClass}
                aria-label={`Select Drivers (⌘D) - ${selectedDriverCount > 0 ? `${selectedDriverCount} selected` : "No drivers selected"}`}
                aria-haspopup="dialog"
                aria-expanded={eventActions.isDriverModalOpen}
              >
                <DriversIcon className={iconClass} />
                <span>Select Drivers</span>
                {selectedDriverCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--token-accent)] px-1.5 text-[10px] font-medium text-[var(--token-text-primary)]">
                    {selectedDriverCount}
                  </span>
                )}
              </button>
            )}

            {/* Clear Event - when event selected */}
            {hasEventSelected && (
              <button
                type="button"
                role="menuitem"
                onClick={() => handleItemClick(eventActions.clearEvent)}
                className={itemClass}
                aria-label="Clear selected event (⌘⇧E)"
              >
                <ClearEventIcon className={iconClass} />
                <span>Clear Event</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Portaled class list: pops out to the right of "Select a Class" */}
      {open &&
        isClassListExpanded &&
        typeof document !== "undefined" &&
        document.body &&
        createPortal(
          <div
            ref={classListPanelRef}
            role="menu"
            aria-label="Select a class"
            className="fixed z-[60] w-[200px] max-h-60 overflow-auto rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-1 shadow-lg"
            style={{
              top: `${classListPosition.top}px`,
              left: `${classListPosition.left}px`,
              visibility:
                classListPosition.top === 0 && classListPosition.left === 0 ? "hidden" : "visible",
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => handleClassSelect(null)}
              className={classItemClass}
              aria-label="All Classes"
            >
              All Classes
            </button>
            {classesForFilter.map(({ className, count }) => (
              <button
                key={className}
                type="button"
                role="menuitem"
                onClick={() => handleClassSelect(className)}
                className={classItemClass}
                aria-label={`${className} (${count} drivers)`}
              >
                {className} ({count})
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}
