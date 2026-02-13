/**
 * @fileoverview Switch atom - iOS-style toggle control
 *
 * @description Pill-shaped switch with sliding knob. Uses role="switch" and
 *              keyboard support (Enter/Space to toggle, ArrowLeft/ArrowRight for values).
 *
 * @purpose Reusable toggle for binary choices; follows MRE design tokens.
 *
 * @relatedFiles
 * - docs/architecture/atomic-design-system.md
 * - src/components/molecules/LabeledSwitch.tsx
 */

"use client"

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  "aria-label": string
  className?: string
}

export default function Switch({
  checked,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
  className = "",
}: SwitchProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onChange(!checked)
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault()
      onChange(e.key === "ArrowRight")
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      onKeyDown={handleKeyDown}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] focus:ring-offset-[var(--token-surface)] disabled:opacity-50 disabled:cursor-not-allowed ${className} ${
        checked
          ? "bg-[var(--token-accent)]/30 border-[var(--token-accent)]/50"
          : "bg-[var(--token-surface-elevated)] border-[var(--token-border-default)]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-[var(--token-surface)] border border-[var(--token-border-default)] shadow-sm transition-transform duration-200 ease-in-out ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
        aria-hidden
      />
    </button>
  )
}
