/**
 * @fileoverview Reusable list row component with proper text truncation
 *
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 *
 * @description Reusable list row component that enforces proper flexbox constraints
 *              and text truncation to prevent horizontal compression issues.
 *
 * @purpose Provides a consistent list row pattern that prevents flexbox shrink issues
 *          when displaying text content with action buttons/icons.
 *
 * @relatedFiles
 * - src/components/molecules/Modal.tsx (modal component)
 */

"use client"

import { ReactNode } from "react"

export interface ListRowProps {
  children: ReactNode
  onClick?: () => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  className?: string
  ariaLabel?: string
  role?: string
  tabIndex?: number
}

/**
 * ListRow component with enforced flexbox constraints and text truncation
 *
 * This component ensures proper width constraints for list rows:
 * - Container has min-w-0 and width: 100%
 * - Text content automatically truncates with ellipsis
 * - Action elements (buttons/icons) have flex-shrink-0
 * - Prevents horizontal compression issues
 *
 * Usage:
 * ```tsx
 * <ListRow onClick={handleClick} ariaLabel="Select item">
 *   <span>Long text content that will truncate</span>
 *   <button>Action</button>
 * </ListRow>
 * ```
 *
 * For text content that should truncate, wrap it in a span with className="flex-1":
 * ```tsx
 * <ListRow>
 *   <span className="flex-1">This text will truncate</span>
 *   <button className="flex-shrink-0">Action</button>
 * </ListRow>
 * ```
 */
export default function ListRow({
  children,
  onClick,
  onKeyDown,
  className = "",
  ariaLabel,
  role = "button",
  tabIndex = 0,
}: ListRowProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onKeyDown) {
      onKeyDown(e)
    } else if (onClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--token-surface-raised)] transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] ${className}`}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}
    >
      {children}
    </div>
  )
}

/**
 * ListRowText component for text content that should truncate
 *
 * Use this component for text content inside ListRow that may overflow.
 * It automatically applies truncation styles.
 */
export function ListRowText({
  children,
  className = "",
  title,
}: {
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      className={`text-[var(--token-text-primary)] flex-1 ${className}`}
      title={title}
      style={{
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  )
}

/**
 * ListRowAction component for action buttons/icons that should not shrink
 *
 * Use this component for action elements (buttons, icons) inside ListRow.
 * It automatically applies flex-shrink-0 to prevent compression.
 */
export function ListRowAction({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className} style={{ flexShrink: 0 }}>
      {children}
    </div>
  )
}
