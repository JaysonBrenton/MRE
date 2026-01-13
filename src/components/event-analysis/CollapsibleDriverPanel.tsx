/**
 * @fileoverview Collapsible driver panel component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Collapsible accordion panel for driver selection
 * 
 * @purpose Provides expand/collapse functionality for driver selection panel.
 *          Mobile-friendly with smooth animations.
 * 
 * @relatedFiles
 * - src/components/event-analysis/ChartControls.tsx (uses this)
 */

"use client"

import { ReactNode, useEffect, useRef } from "react"

export interface CollapsibleDriverPanelProps {
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
  selectedCount: number
  totalCount: number
  header?: ReactNode
}

export default function CollapsibleDriverPanel({
  isOpen,
  onToggle,
  children,
  selectedCount,
  totalCount,
  header,
}: CollapsibleDriverPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  // Set initial height based on screen size
  useEffect(() => {
    if (contentRef.current) {
      if (isOpen) {
        contentRef.current.style.maxHeight = `${contentRef.current.scrollHeight}px`
      } else {
        contentRef.current.style.maxHeight = "0px"
      }
    }
  }, [isOpen])

  // Update height when content changes
  useEffect(() => {
    if (contentRef.current && isOpen) {
      contentRef.current.style.maxHeight = `${contentRef.current.scrollHeight}px`
    }
  }, [children, isOpen])

  const selectionText =
    selectedCount === 0
      ? "No drivers selected"
      : selectedCount === totalCount
        ? `All ${totalCount} drivers selected`
        : `${selectedCount} of ${totalCount} drivers selected`

  return (
    <div className="border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface-elevated)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--token-surface-elevated)]">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-3 flex-1 text-left hover:bg-[var(--token-surface-raised)] rounded-md px-2 -mx-2 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)]"
          aria-expanded={isOpen}
          aria-controls="driver-panel-content"
          aria-label={`${isOpen ? "Collapse" : "Expand"} driver selection panel`}
        >
          <svg
            className={`w-5 h-5 text-[var(--token-text-secondary)] transition-transform ${
              isOpen ? "rotate-90" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <div className="text-left">
            <div className="text-sm font-medium text-[var(--token-text-primary)]">
              Select Drivers
            </div>
            <div className="text-xs text-[var(--token-text-secondary)]">
              {selectionText}
            </div>
          </div>
        </button>
        {header && <div className="ml-2">{header}</div>}
      </div>

      {/* Content */}
      <div
        id="driver-panel-content"
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? "none" : "0px",
        }}
      >
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  )
}

