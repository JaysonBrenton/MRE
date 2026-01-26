/**
 * @fileoverview Reusable sidebar action button for EventAnalysisSidebar
 *
 * Renders either icon-only (collapsed) with Tooltip or icon + label (expanded).
 * Supports optional badge, shortcut in tooltip, and loading state.
 */

"use client"

import React from "react"
import Tooltip from "@/components/ui/Tooltip"

export interface SidebarActionProps {
  icon: React.ReactNode
  /** Optional icon when isLoading (e.g. spinning variant). Falls back to icon if omitted. */
  loadingIcon?: React.ReactNode
  label: string
  tooltip?: string
  shortcut?: string
  badge?: number | null
  disabled?: boolean
  onClick: () => void
  isCollapsed: boolean
  ariaLabel: string
  ariaHaspopup?: "dialog"
  ariaExpanded?: boolean
  isLoading?: boolean
}

const SIDEBAR_TRANSITION = "duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
const baseButtonClasses =
  "w-full flex items-center rounded-lg text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
const collapsedClasses = "justify-center p-2"
const expandedClasses = "gap-2 px-3 py-2 text-sm font-medium"

export default function SidebarAction({
  icon,
  loadingIcon,
  label,
  tooltip,
  shortcut,
  badge,
  disabled = false,
  onClick,
  isCollapsed,
  ariaLabel,
  ariaHaspopup,
  ariaExpanded,
  isLoading = false,
}: SidebarActionProps) {
  const effectiveTooltip = tooltip ?? (shortcut ? `${label} (${shortcut})` : label)
  const displayIcon = isLoading && loadingIcon != null ? loadingIcon : icon
  const iconSize = isCollapsed ? "h-4 w-4" : "h-3.5 w-3.5"
  const iconWrapperClass = `${iconSize} [&_svg]:h-full [&_svg]:w-full text-[var(--token-text-muted)] flex-shrink-0 flex items-center justify-center ${isLoading ? "animate-spin" : ""} ${isLoading && !loadingIcon ? "opacity-50" : ""}`

  const labelWrapperClass = `overflow-hidden transition-all ${SIDEBAR_TRANSITION} ${
    isCollapsed
      ? "max-w-0 min-w-0 flex-none opacity-0"
      : "min-w-0 max-w-40 flex-1 opacity-100"
  }`

  const badgeEl =
    badge != null && badge > 0 ? (
      <span
        className="absolute -top-1 -right-1 flex h-4 min-w-[20px] items-center justify-center rounded-full bg-[var(--token-accent)] px-1 text-[10px] font-medium text-[var(--token-text-primary)]"
        aria-hidden="true"
      >
        {badge}
      </span>
    ) : null

  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseButtonClasses} ${isCollapsed ? collapsedClasses : expandedClasses} relative`}
      aria-label={ariaLabel}
      aria-haspopup={ariaHaspopup}
      aria-expanded={ariaExpanded}
    >
      <span className="relative flex-shrink-0" aria-hidden="true">
        <span className={iconWrapperClass}>{displayIcon}</span>
        {badgeEl}
      </span>
      <span className={`flex items-center gap-2 ${labelWrapperClass}`} aria-hidden="true">
        <span className="flex-1 truncate text-left">{label}</span>
      </span>
    </button>
  )

  if (isCollapsed) {
    return (
      <Tooltip text={effectiveTooltip} position="right">
        {button}
      </Tooltip>
    )
  }

  return button
}
