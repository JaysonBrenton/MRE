/**
 * @fileoverview LabeledSwitch molecule - switch with left/right labels
 *
 * @description Composes Switch atom with two text labels. Active option uses
 *              primary text, inactive uses secondary. Optional `labelOrder="onFirst"`
 *              puts the "on" label before the switch (e.g. Yes | switch | No).
 *
 * @purpose Reusable "label | switch | label" pattern for binary toggles.
 *
 * @relatedFiles
 * - src/components/atoms/Switch.tsx
 * - docs/architecture/atomic-design-system.md
 */

"use client"

import Switch from "@/components/atoms/Switch"

/** offFirst: No | switch | Yes (off left, on right). onFirst: Yes | switch | No. */
export type LabeledSwitchLabelOrder = "offFirst" | "onFirst"

export interface LabeledSwitchProps {
  /** Left label: "off" / false state when two labels. */
  leftLabel: string
  /** Right label: "on" / true state. */
  rightLabel?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  "aria-label"?: string
  className?: string
  /**
   * Visual order only; semantics stay left=off, right=on. Default: off on the left, on on the right.
   * Use `onFirst` to show "Yes" before the switch and "No" after (e.g. event search).
   */
  labelOrder?: LabeledSwitchLabelOrder
}

const primary = "text-[var(--token-text-primary)]"
const secondary = "text-[var(--token-text-secondary)]"

/**
 * Switch with two labels: left = off, right = on. Active label is primary.
 * `labelOrder="onFirst"` shows the on label before the switch (e.g. Yes | switch | No).
 */
export default function LabeledSwitch({
  leftLabel,
  rightLabel = "",
  checked,
  onChange,
  disabled = false,
  id,
  "aria-label": ariaLabel,
  className = "",
  labelOrder = "offFirst",
}: LabeledSwitchProps) {
  const hasRight = Boolean(rightLabel)
  const selectedLabel = hasRight && rightLabel ? (checked ? rightLabel : leftLabel) : leftLabel
  const switchAriaLabel = ariaLabel ?? selectedLabel

  if (!hasRight) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <span className={`text-sm font-medium transition-colors ${!checked ? primary : secondary}`}>
          {leftLabel}
        </span>
        <Switch
          id={id}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          aria-label={switchAriaLabel}
        />
      </div>
    )
  }

  if (labelOrder === "onFirst") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <span className={`text-sm font-medium transition-colors ${checked ? primary : secondary}`}>
          {rightLabel}
        </span>
        <Switch
          id={id}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          aria-label={switchAriaLabel}
        />
        <span className={`text-sm font-medium transition-colors ${!checked ? primary : secondary}`}>
          {leftLabel}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className={`text-sm font-medium transition-colors ${!checked ? primary : secondary}`}>
        {leftLabel}
      </span>
      <Switch
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={switchAriaLabel}
      />
      <span className={`text-sm font-medium transition-colors ${checked ? primary : secondary}`}>
        {rightLabel}
      </span>
    </div>
  )
}
