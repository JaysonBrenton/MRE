/**
 * @fileoverview Standard Button component following MRE UX principles
 * 
 * @created 2025-01-27
 * @creator UI Review Implementation
 * @lastModified 2025-01-27
 * 
 * @description Standard button component that follows the outlined/secondary style pattern
 *              mandated by the UX principles document.
 * 
 * @purpose Provides a consistent button component that all buttons across the application
 *          should use to maintain visual consistency and design system compliance.
 * 
 * @relatedFiles
 * - docs/design/mre-ux-principles.md (button style standard)
 * - docs/design/mre-dark-theme-guidelines.md (theme tokens)
 */

import { ButtonHTMLAttributes, ReactNode } from "react"

export interface StandardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean
  children: ReactNode
}

/**
 * Standard button component following MRE UX principles.
 * 
 * All buttons in MRE must use the standard outlined/secondary style:
 * - Border: border-[var(--token-border-default)]
 * - Background: bg-[var(--token-surface-elevated)]
 * - Text: text-[var(--token-text-primary)]
 * - Hover: hover:bg-[var(--token-surface-raised)]
 * - Focus: focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]
 * 
 * This component enforces these standards.
 */
export default function StandardButton({
  fullWidth = false,
  className = "",
  disabled,
  children,
  ...props
}: StandardButtonProps) {
  const baseClasses = "mobile-button flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 sm:px-5 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed active:opacity-90"
  
  const widthClass = fullWidth ? "w-full" : ""
  
  return (
    <button
      className={`${baseClasses} ${widthClass} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

