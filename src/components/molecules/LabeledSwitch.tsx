/**
 * @fileoverview LabeledSwitch molecule - switch with left/right labels
 *
 * @description Composes Switch atom with two text labels. Active label uses
 *              primary text, inactive uses secondary (matches EventSearchForm pattern).
 *
 * @purpose Reusable "label | switch | label" pattern for binary toggles.
 *
 * @relatedFiles
 * - src/components/atoms/Switch.tsx
 * - docs/architecture/atomic-design-system.md
 */

"use client"

import Switch from "@/components/atoms/Switch"

export interface LabeledSwitchProps {
  leftLabel: string
  rightLabel?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  "aria-label"?: string
  className?: string
}

/**
 * Switch with left and right labels. When checked, right is "on" (primary text);
 * when unchecked, left is "on".
 */
export default function LabeledSwitch({
  leftLabel,
  rightLabel = "",
  checked,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
  className = "",
}: LabeledSwitchProps) {
  const switchAriaLabel = ariaLabel ?? `Switch to ${checked ? leftLabel : rightLabel || leftLabel}`

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span
        className={`text-sm font-medium transition-colors ${
          !checked ? "text-[var(--token-text-primary)]" : "text-[var(--token-text-secondary)]"
        }`}
      >
        {leftLabel}
      </span>
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={switchAriaLabel}
      />
      {rightLabel ? (
        <span
          className={`text-sm font-medium transition-colors ${
            checked ? "text-[var(--token-text-primary)]" : "text-[var(--token-text-secondary)]"
          }`}
        >
          {rightLabel}
        </span>
      ) : null}
    </div>
  )
}
