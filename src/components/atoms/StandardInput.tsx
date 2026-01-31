/**
 * @fileoverview Standard Input component following MRE design system
 *
 * @created 2025-01-27
 * @creator UI Review Implementation
 * @lastModified 2025-01-27
 *
 * @description Standard form input component with consistent styling and focus states
 *
 * @purpose Provides a consistent input component that all forms should use to maintain
 *          visual consistency and design system compliance.
 *
 * @relatedFiles
 * - docs/design/mre-ux-principles.md (form guidelines)
 * - docs/design/mre-dark-theme-guidelines.md (theme tokens)
 */

import { InputHTMLAttributes, forwardRef, useId } from "react"

export interface StandardInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  errorId?: string
}

/**
 * Standard input component following MRE design system.
 *
 * All form inputs should use this component to ensure:
 * - Consistent styling using form tokens
 * - Proper focus states
 * - Accessibility attributes
 * - Error state handling
 */
const StandardInput = forwardRef<HTMLInputElement, StandardInputProps>(
  ({ label, error, errorId, className = "", id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id || `input-${generatedId}`
    const errorIdFinal = errorId || `${inputId}-error`

    return (
      <div>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-base font-medium text-[var(--token-text-secondary)] mb-2"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`block w-full min-w-0 rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-4 py-3 text-base text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] ${error ? "border-[var(--token-status-error-text)]" : ""} ${className}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorIdFinal : undefined}
          {...props}
        />
        {error && (
          <p id={errorIdFinal} className="mt-2 text-sm text-[var(--token-error-text)]">
            {error}
          </p>
        )}
      </div>
    )
  }
)

StandardInput.displayName = "StandardInput"

export default StandardInput
