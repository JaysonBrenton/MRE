/**
 * @fileoverview Status Badge component following MRE design system
 *
 * @created 2025-01-27
 * @creator UI Review Implementation
 * @lastModified 2025-01-27
 *
 * @description Standard status badge component with consistent styling
 *
 * @purpose Provides a consistent status indicator component that all status displays
 *          should use to maintain visual consistency.
 *
 * @relatedFiles
 * - docs/design/mre-dark-theme-guidelines.md (status tokens)
 */

export type StatusType = "success" | "info" | "warning" | "error"

export interface StatusBadgeProps {
  status: StatusType
  children: React.ReactNode
  className?: string
}

/**
 * Standard status badge component following MRE design system.
 *
 * Uses semantic status tokens for consistent color mapping:
 * - success: --token-status-success-*
 * - info: --token-status-info-*
 * - warning: --token-status-warning-*
 * - error: --token-status-error-*
 */
export default function StatusBadge({ status, children, className = "" }: StatusBadgeProps) {
  const statusClasses = {
    success: "bg-[var(--token-status-success-bg)] text-[var(--token-status-success-text)]",
    info: "bg-[var(--token-status-info-bg)] text-[var(--token-status-info-text)]",
    warning: "bg-[var(--token-status-warning-bg)] text-[var(--token-status-warning-text)]",
    error: "bg-[var(--token-status-error-bg)] text-[var(--token-status-error-text)]",
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses[status]} ${className}`}
    >
      {children}
    </span>
  )
}
