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
  const baseClasses = "flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
  
  const variantClasses = {
    default: "border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] active:opacity-90",
    primary: "border border-[var(--token-accent)] bg-[var(--token-accent)] text-white hover:bg-[var(--token-accent-hover)] active:opacity-90",
    error: "border border-[var(--token-status-error-text)] bg-[var(--token-status-error-bg)] text-[var(--token-status-error-text)] hover:opacity-80 active:opacity-90",
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

