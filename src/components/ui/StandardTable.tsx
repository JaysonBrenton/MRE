/**
 * @fileoverview Standard Table component following MRE design system
 * 
 * @created 2025-01-27
 * @creator UI Review Implementation
 * @lastModified 2025-01-27
 * 
 * @description Standard table component with consistent styling and accessibility
 * 
 * @purpose Provides a consistent table component that all tables should use to maintain
 *          visual consistency and accessibility compliance.
 * 
 * @relatedFiles
 * - docs/design/mre-dark-theme-guidelines.md (theme tokens)
 */

import { ReactNode } from "react"

export interface StandardTableProps {
  children: ReactNode
  className?: string
}

export interface StandardTableHeaderProps {
  children: ReactNode
  className?: string
}

export interface StandardTableRowProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export interface StandardTableCellProps {
  children: ReactNode
  className?: string
  header?: boolean
}

/**
 * Standard table component following MRE design system.
 * 
 * Provides consistent styling for:
 * - Table borders using border tokens
 * - Row hover states
 * - Text colors using text tokens
 * - Proper spacing
 */
export function StandardTable({ children, className = "" }: StandardTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse ${className}`}>
        {children}
      </table>
    </div>
  )
}

export function StandardTableHeader({ children, className = "" }: StandardTableHeaderProps) {
  return (
    <thead className={className}>
      {children}
    </thead>
  )
}

export function StandardTableRow({ children, className = "", onClick }: StandardTableRowProps) {
  const baseClasses = "border-b border-[var(--token-border-default)]"
  const interactiveClasses = onClick ? "hover:bg-[var(--token-surface-raised)] cursor-pointer" : "hover:bg-[var(--token-surface-raised)]"
  
  return (
    <tr
      className={`${baseClasses} ${interactiveClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function StandardTableCell({ children, className = "", header = false }: StandardTableCellProps) {
  const baseClasses = header
    ? "px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
    : "px-4 py-3 text-sm font-normal text-[var(--token-text-primary)]"
  
  const Component = header ? "th" : "td"
  
  return (
    <Component className={`${baseClasses} ${className}`}>
      {children}
    </Component>
  )
}

