/**
 * @fileoverview Switch atom - iOS-style toggle control
 *
 * @description Pill-shaped switch with sliding knob. Uses role="switch" and
 *              keyboard support (Enter/Space to toggle, ArrowLeft/ArrowRight for values).
 *              Off state: neutral stepped track + border + inset (tokens); on state: bright green.
 *              Thumb uses accent blue.
 *
 * @purpose Reusable toggle for binary choices; follows MRE design tokens.
 *
 * @relatedFiles
 * - docs/architecture/atomic-design-system.md
 * - src/components/molecules/LabeledSwitch.tsx
 */

"use client"

import type { CSSProperties } from "react"

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  "aria-label": string
  className?: string
}

export default function Switch({
  checked,
  onChange,
  disabled = false,
  id,
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

  const trackStyle: CSSProperties = checked
    ? {
        background: "var(--token-switch-on-track)",
        borderColor: "var(--token-switch-on-border)",
        boxShadow: "var(--token-switch-on-glow)",
      }
    : {
        background: "var(--token-switch-off-track)",
        borderColor: "var(--token-switch-off-border)",
        boxShadow: "var(--token-switch-off-inset)",
      }

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      onKeyDown={handleKeyDown}
      style={trackStyle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border border-solid transition-all duration-200 ease-in-out focus:outline-none focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-[var(--token-accent)] border border-white/30 shadow-sm transition-transform duration-200 ease-in-out ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
        aria-hidden
      />
    </button>
  )
}
