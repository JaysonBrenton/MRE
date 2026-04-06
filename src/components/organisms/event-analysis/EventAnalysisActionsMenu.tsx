/**
 * @fileoverview Event analysis actions dropdown menu
 *
 * @description Actions menu visible when viewing Overview or Entry List.
 *              Replaces the former sidebar event-actions block. Items: Find and Import Events,
 *              Refresh Event Data, Select a Class, Select Drivers, Clear Event.
 *              "View as driver" (practice day) is in the Select Drivers modal.
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

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="10"
        r="3"
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

export interface EventAnalysisActionsMenuProps {
  /** When true, show "Correct venue" menu item */
  venueCorrectionCanSubmit?: boolean
  /** Called when user selects "Correct venue" */
  onCorrectVenueClick?: () => void
}

export default function EventAnalysisActionsMenu({
  venueCorrectionCanSubmit = false,
  onCorrectVenueClick,
}: EventAnalysisActionsMenuProps = {}) {
  const eventActions = useEventActionsOptional()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const hasEventSelected = eventActions?.hasEventSelected ?? false

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  // Close menu when refresh starts (e.g. from keyboard shortcut)
  useEffect(() => {
    if (eventActions?.isRefreshing) {
      queueMicrotask(() => close())
    }
  }, [eventActions?.isRefreshing, close])

  // Click outside to close
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      close()
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open, close])

  // Escape: close menu
  useEffect(() => {
    if (!open) return
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return
      close()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, close])

  const handleItemClick = useCallback(
    (action: () => void) => {
      action()
      close()
    },
    [close]
  )

  const handleButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (eventActions.isRefreshing) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      setOpen((prev) => !prev)
    }
    if (e.key === "Escape") close()
  }

  if (!eventActions) return null

  const isRefreshing = eventActions.isRefreshing

  return (
    <div className="relative flex shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !isRefreshing && setOpen((prev) => !prev)}
        onKeyDown={handleButtonKeyDown}
        disabled={isRefreshing}
        className="flex items-center gap-2 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--token-text-primary)] transition hover:bg-[var(--token-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-[var(--token-surface-elevated)]"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-busy={isRefreshing}
        aria-label={isRefreshing ? "Refreshing event data" : "Event actions menu"}
      >
        {isRefreshing ? (
          <>
            <RefreshIcon className="h-4 w-4 shrink-0 text-[var(--token-text-muted)]" spin />
            <span>Refreshing...</span>
          </>
        ) : (
          <>
            <span>Actions</span>
            <ChevronDownIcon
              className={`h-4 w-4 text-[var(--token-text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
            />
          </>
        )}
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

            {/* Select a Class and Select Drivers buttons removed per design */}

            {/* Correct venue - when event selected and user can submit */}
            {hasEventSelected && venueCorrectionCanSubmit && onCorrectVenueClick && (
              <button
                type="button"
                role="menuitem"
                onClick={() => handleItemClick(onCorrectVenueClick)}
                className={itemClass}
                aria-label="Correct venue"
              >
                <MapPinIcon className={iconClass} />
                <span>Correct venue</span>
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

      {/* Class list popover removed with "Select a Class" */}
    </div>
  )
}
