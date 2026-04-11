/**
 * @fileoverview Reusable Button component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Standard button component with variants following MRE design system
 *
 * @purpose Provides consistent button styling across the application. Follows the
 *          outlined/secondary style pattern documented in mre-ux-principles.md.
 *
 * @relatedFiles
 * - docs/design/mre-ux-principles.md (button style standard)
 * - docs/design/mre-dark-theme-guidelines.md (theme tokens)
 */

import { ButtonHTMLAttributes, ReactNode } from "react"

export type ButtonVariant = "default" | "primary" | "error"

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Button visual variant.
   * - default: Outlined/secondary style (preferred for most actions).
   * - primary: Accent fill. @deprecated Prefer StandardButton; only for documented primary CTA exceptions (e.g. empty-state "Search for Events", modal "Select track").
   * - error: Destructive/danger style (e.g. Reject).
   */
  variant?: ButtonVariant
  fullWidth?: boolean
  children: ReactNode
}

export default function Button({
  variant = "default",
  fullWidth = false,
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseClasses =
    "flex items-center justify-center gap-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"

  const variantClasses = {
    default:
      "border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] shadow-sm hover:bg-[var(--token-surface-raised)] hover:border-[var(--token-accent)]/40 active:scale-[0.98]",
    primary:
      "border border-[var(--token-accent)] bg-[var(--token-accent)] text-white shadow-md hover:bg-[var(--token-accent-hover)] hover:shadow-lg active:scale-[0.98]",
    error:
      "border border-[var(--token-status-error-text)] bg-[var(--token-status-error-bg)] text-[var(--token-status-error-text)] hover:opacity-80 active:opacity-90",
  }

  const widthClass = fullWidth ? "w-full" : ""
  const paddingClass = "px-5"

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${widthClass} ${paddingClass} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
