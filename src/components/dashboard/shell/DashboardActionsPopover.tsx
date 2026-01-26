/**
 * @fileoverview Popover menu for dashboard actions when sidebar is collapsed
 * 
 * @created 2026-01-23
 * @creator System
 * @lastModified 2026-01-23
 * 
 * @description Portal-based popover that displays dashboard action buttons when
 *              hovering over the Dashboard icon in collapsed sidebar mode.
 * 
 * @purpose Provides access to dashboard actions (Find Events, Refresh, Select Drivers, Clear Event)
 *          when the sidebar is collapsed, using a compact popover menu positioned to the right
 *          of the Dashboard icon.
 * 
 * @relatedFiles
 * - src/components/dashboard/shell/AdaptiveNavigationRail.tsx (uses this component)
 * - src/components/ui/Tooltip.tsx (similar portal-based positioning pattern)
 * - src/components/dashboard/EventActionsContext.tsx (provides event actions)
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useEventActionsOptional } from "@/components/dashboard/EventActionsContext"

interface DashboardActionsPopoverProps {
  /** Reference to the Dashboard icon/link element for positioning */
  anchorRef: React.RefObject<HTMLElement | null>
  /** Whether the popover should be visible */
  isOpen: boolean
  /** Callback when popover should close */
  onClose: () => void
  /** Callback when mouse enters popover (to keep it open) */
  onMouseEnter?: () => void
  /** Callback when mouse leaves popover */
  onMouseLeave?: () => void
}

export default function DashboardActionsPopover({
  anchorRef,
  isOpen,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: DashboardActionsPopoverProps) {
  const eventActions = useEventActionsOptional()
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 })

  // Get event state
  const hasEventSelected = eventActions?.hasEventSelected ?? false
  const selectedDriverCount = eventActions?.selectedDriverIds.length ?? 0

  // Update position when popover opens or anchor moves
  useEffect(() => {
    if (!isOpen || !anchorRef.current || !popoverRef.current) return

    const updatePosition = () => {
      if (!anchorRef.current || !popoverRef.current) return

      const anchorRect = anchorRef.current.getBoundingClientRect()
      const popoverRect = popoverRef.current.getBoundingClientRect()
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      }

      // Estimate popover dimensions if not yet rendered
      const popoverWidth = popoverRect.width || 220 // Fallback estimate
      const popoverHeight = popoverRect.height || 200 // Fallback estimate
      const gap = 12 // Gap between icon and popover

      // Position to the right of the icon, vertically aligned with top
      let preferredLeft = anchorRect.right + gap
      let preferredTop = anchorRect.top

      // If not enough space on right, flip to left side
      if (preferredLeft + popoverWidth > viewport.width - 8) {
        preferredLeft = anchorRect.left - popoverWidth - gap
      }

      // Clamp horizontal position
      preferredLeft = Math.max(8, Math.min(viewport.width - popoverWidth - 8, preferredLeft))

      // Clamp vertical position to keep within viewport
      preferredTop = Math.max(8, Math.min(viewport.height - popoverHeight - 8, preferredTop))

      setPopoverPosition({
        top: preferredTop,
        left: preferredLeft,
      })
    }

    // Use a slight delay to allow popover to render and get dimensions
    const timeoutId = setTimeout(updatePosition, 0)

    const handleScroll = () => updatePosition()
    const handleResize = () => updatePosition()

    // Use requestAnimationFrame for smoother updates
    let rafId: number
    const handleUpdate = () => {
      rafId = requestAnimationFrame(() => {
        updatePosition()
      })
    }

    window.addEventListener("scroll", handleUpdate, true)
    window.addEventListener("resize", handleUpdate)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener("scroll", handleUpdate, true)
      window.removeEventListener("resize", handleUpdate)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isOpen, anchorRef])

  // Handle button clicks - close popover immediately
  const handleButtonClick = (action: () => void) => {
    action()
    onClose()
  }

  if (!isOpen || !eventActions || typeof window === "undefined" || !document.body) {
    return null
  }

  const popoverContent = (
    <div
      ref={popoverRef}
      className="fixed z-[100] w-[220px] rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/90 backdrop-blur-lg shadow-lg transition-opacity duration-200"
      role="menu"
      aria-label="Dashboard actions"
      onMouseEnter={(e) => {
        e.stopPropagation()
        // Keep popover open when mouse enters it
        onMouseEnter?.()
      }}
      onMouseLeave={(e) => {
        e.stopPropagation()
        // Close when mouse leaves popover
        onMouseLeave?.()
        onClose()
      }}
      style={{
        top: `${popoverPosition.top}px`,
        left: `${popoverPosition.left}px`,
        visibility: popoverPosition.top === 0 && popoverPosition.left === 0 ? "hidden" : "visible",
        opacity: popoverPosition.top === 0 && popoverPosition.left === 0 ? 0 : 1,
      }}
    >
      <div className="space-y-1 p-2">
        {/* Find Events */}
        <button
          type="button"
          onClick={() => handleButtonClick(eventActions.openEventSearch)}
          className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--token-text-secondary)] transition hover:bg-[var(--token-surface-raised)]/70 hover:text-[var(--token-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)]"
          aria-label="Find and Import Events (⌘E)"
        >
          <svg
            className="h-4 w-4 text-[var(--token-text-muted)]"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Find and Import Events</span>
        </button>

        {/* Refresh */}
        {hasEventSelected && (
          <button
            type="button"
            onClick={() => handleButtonClick(eventActions.handleRefreshEventData)}
            disabled={eventActions.isRefreshing}
            className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--token-text-secondary)] transition hover:bg-[var(--token-surface-raised)]/70 hover:text-[var(--token-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Refresh event data (⌘⌥R)"
          >
            {eventActions.isRefreshing ? (
              <svg
                className="h-4 w-4 animate-spin text-[var(--token-text-muted)]"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4 text-[var(--token-text-muted)]"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M3 21v-5h5"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <span>Refresh Event Data</span>
          </button>
        )}

        {/* Select a Class */}
        {hasEventSelected && (
          <button
            type="button"
            onClick={() => handleButtonClick(eventActions.openDriverSelection)}
            disabled={!hasEventSelected}
            className="group relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--token-text-secondary)] transition hover:bg-[var(--token-surface-raised)]/70 hover:text-[var(--token-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Select a Class (⌘D) - ${selectedDriverCount > 0 ? `${selectedDriverCount} selected` : "No drivers selected"}`}
            aria-haspopup="dialog"
            aria-expanded={eventActions.isDriverModalOpen}
          >
            <svg
              className="h-4 w-4 text-[var(--token-text-muted)]"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Select a Class</span>
            {selectedDriverCount > 0 && (
              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--token-accent)] px-1.5 text-[10px] font-medium text-[var(--token-text-primary)]">
                {selectedDriverCount}
              </span>
            )}
          </button>
        )}

        {/* Clear Event */}
        {hasEventSelected && (
          <button
            type="button"
            onClick={() => handleButtonClick(eventActions.clearEvent)}
            className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--token-text-secondary)] transition hover:bg-[var(--token-surface-raised)]/70 hover:text-[var(--token-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)]"
            aria-label="Clear selected event (⌘⇧E)"
          >
            <svg
              className="h-4 w-4 text-[var(--token-text-muted)]"
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
            <span>Clear Event</span>
          </button>
        )}
      </div>
    </div>
  )

  return createPortal(popoverContent, document.body)
}
