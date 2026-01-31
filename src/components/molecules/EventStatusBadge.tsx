/**
 * @fileoverview Event status badge component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Status tag/badge for event import status with progress visualization
 *
 * @purpose Displays event status with color-coded badges. Accessible with
 *          text labels (not color-only indicators). For importing status,
 *          displays a visual progress bar that fills from left to right and
 *          shows progress percentage in the label (e.g., "Importing 45%").
 *          The badge background color transitions from warning (yellow/orange)
 *          to success (green) as import progresses, and a progress bar overlay
 *          provides additional visual feedback of completion percentage.
 *
 * @features
 * - Color progression: Background color transitions from warning to success colors
 * - Progress bar: Visual fill effect that shows completion percentage
 * - Dynamic label: Shows "Importing X%" when progress is available
 * - Theme-aware: Reads CSS variables at runtime to support dark/light themes
 * - Accessible: Includes progress percentage in aria-label and title attributes
 *
 * @relatedFiles
 * - src/components/organisms/event-search/EventRow.tsx (uses this component, calculates progress)
 */

import React from "react"

export type EventStatus = "stored" | "imported" | "new" | "importing" | "failed" | "scheduled"

export interface EventStatusBadgeProps {
  status: EventStatus
  progress?: number // Optional progress percentage (0-100) for importing status
  stage?: string // Optional import stage text to display beneath the badge
}

const statusConfig: Record<
  EventStatus,
  { label: string; description: string; bgColor: string; textColor: string }
> = {
  stored: {
    label: "Stored",
    description: "Event data is stored and ready for analysis",
    bgColor: "bg-[var(--token-status-success-bg)]",
    textColor: "text-[var(--token-status-success-text)]",
  },
  imported: {
    label: "Ready",
    description: "Event has been fully imported with lap data",
    bgColor: "bg-[var(--token-status-success-bg)]",
    textColor: "text-[var(--token-status-success-text)]",
  },
  new: {
    label: "Not imported",
    description: "Event found on LiveRC but not yet imported into MRE",
    bgColor: "bg-[var(--token-status-info-bg)]",
    textColor: "text-[var(--token-status-info-text)]",
  },
  importing: {
    label: "Importing",
    description: "Event data is currently being imported from LiveRC",
    bgColor: "bg-[var(--token-status-warning-bg)]",
    textColor: "text-[var(--token-status-warning-text)]",
  },
  failed: {
    label: "Import failed",
    description: "Import failed - click Retry to try again",
    bgColor: "bg-[var(--token-status-error-bg)]",
    textColor: "text-[var(--token-status-error-text)]",
  },
  scheduled: {
    label: "Scheduled",
    description:
      "This event is scheduled for a future date. Import will be available after the event occurs.",
    bgColor: "bg-[var(--token-status-info-bg)]",
    textColor: "text-[var(--token-status-info-text)]",
  },
}

/**
 * Parses a color string (hex, rgb, or rgba) and returns RGB values
 */
function parseColor(color: string): [number, number, number] {
  // Handle hex colors
  if (color.startsWith("#")) {
    const hex = color.replace("#", "")
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    return [r, g, b]
  }

  // Handle rgb/rgba colors
  const matches = color.match(/\d+/g)
  if (matches && matches.length >= 3) {
    return [parseInt(matches[0], 10), parseInt(matches[1], 10), parseInt(matches[2], 10)]
  }

  // Fallback to black
  return [0, 0, 0]
}

/**
 * Interpolates between two colors based on progress (0-100)
 * Returns an rgba color string for backgrounds or rgb for text
 */
function interpolateColor(
  color1: string,
  color2: string,
  progress: number,
  isBackground: boolean = false
): string {
  // Clamp progress between 0 and 100
  const t = Math.max(0, Math.min(100, progress)) / 100

  const [r1, g1, b1] = parseColor(color1)
  const [r2, g2, b2] = parseColor(color2)

  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)

  if (isBackground) {
    // For backgrounds, use the same alpha as the warning color
    // Extract alpha from the first color if it's rgba, otherwise default to 0.2
    let alpha = 0.2
    if (color1.includes("rgba")) {
      const alphaMatch = color1.match(/[\d.]+(?=\))/)
      if (alphaMatch) {
        alpha = parseFloat(alphaMatch[0])
      }
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  // For text colors, return rgb (no alpha)
  return `rgb(${r}, ${g}, ${b})`
}

export default function EventStatusBadge({ status, progress, stage }: EventStatusBadgeProps) {
  const config = statusConfig[status]
  const [dynamicColors, setDynamicColors] = React.useState<{
    bg: string
    text: string
    progressBarBg: string
  } | null>(null)
  const badgeRef = React.useRef<HTMLSpanElement>(null)

  // Calculate color progression for importing status
  React.useEffect(() => {
    if (status === "importing" && progress !== undefined && badgeRef.current) {
      // Default colors (fallback if CSS variables can't be read)
      // Dark theme defaults
      const warningBgDefault = "rgba(245, 158, 11, 0.2)"
      const warningTextDefault = "#f59e0b"
      const successBgDefault = "rgba(16, 185, 129, 0.2)"
      const successTextDefault = "#10b981"

      // Get CSS variable values
      const computedStyle = getComputedStyle(badgeRef.current)
      const warningBgVar =
        computedStyle.getPropertyValue("--token-status-warning-bg").trim() || warningBgDefault
      const warningTextVar =
        computedStyle.getPropertyValue("--token-status-warning-text").trim() || warningTextDefault
      const successBgVar =
        computedStyle.getPropertyValue("--token-status-success-bg").trim() || successBgDefault
      const successTextVar =
        computedStyle.getPropertyValue("--token-status-success-text").trim() || successTextDefault

      // Interpolate colors based on progress
      // For backgrounds, pass isBackground=true to preserve alpha
      const interpolatedBg = interpolateColor(warningBgVar, successBgVar, progress, true)
      // For text, use isBackground=false to get solid rgb
      const interpolatedText = interpolateColor(warningTextVar, successTextVar, progress, false)

      // Calculate progress bar fill color
      const successBgForBar =
        computedStyle.getPropertyValue("--token-status-success-bg").trim() ||
        "rgba(16, 185, 129, 0.4)"
      let filledColor = successBgForBar
      if (successBgForBar.includes("rgba")) {
        filledColor = successBgForBar.replace(/rgba\(([^)]+)\)/, (match, values) => {
          const parts = values.split(",").map((v: string) => v.trim())
          if (parts.length === 4) {
            // Increase opacity for progress bar visibility
            const opacity = Math.min(1, parseFloat(parts[3]) * 2)
            return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${opacity})`
          }
          return match
        })
      }

      setDynamicColors({
        bg: interpolatedBg,
        text: interpolatedText,
        progressBarBg: filledColor,
      })
    } else {
      setDynamicColors(null)
    }
  }, [status, progress])

  // Use dynamic colors if available, otherwise use static config
  const useDynamicColors =
    status === "importing" && progress !== undefined && dynamicColors !== null

  // Update label to include percentage when progress is available
  const displayLabel =
    status === "importing" && progress !== undefined
      ? `Importing ${Math.round(progress)}%`
      : config.label

  // Build styles for progress bar effect
  const buildContainerStyle = (): React.CSSProperties => {
    if (!useDynamicColors || !dynamicColors) {
      return {}
    }
    return {
      backgroundColor: dynamicColors.bg, // Overall color progression (yellow → green)
      color: dynamicColors.text,
      position: "relative" as const,
      overflow: "hidden" as const,
    }
  }

  const buildProgressBarStyle = (): React.CSSProperties => {
    if (!useDynamicColors || !dynamicColors || progress === undefined) {
      return { display: "none" }
    }

    // Clamp progress between 0 and 100
    const progressPercent = Math.max(0, Math.min(100, progress))

    return {
      position: "absolute" as const,
      left: 0,
      top: 0,
      height: "100%",
      width: `${progressPercent}%`,
      backgroundColor: dynamicColors.progressBarBg,
      transition: "width 0.3s ease",
      zIndex: 0,
    }
  }

  const className = useDynamicColors
    ? "inline-flex items-center px-2 py-1 rounded text-xs font-medium relative overflow-hidden"
    : `inline-flex items-center px-2 py-1 rounded text-xs font-medium ${config.bgColor} ${config.textColor}`

  const containerStyle = useDynamicColors ? buildContainerStyle() : {}
  const progressBarStyle = useDynamicColors ? buildProgressBarStyle() : {}

  const progressText = progress !== undefined ? ` (${Math.round(progress)}% complete)` : ""

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        ref={badgeRef}
        className={className}
        style={containerStyle}
        aria-label={`Event status: ${displayLabel}. ${config.description}${progressText}`}
        title={`${config.description}${progressText}`}
      >
        {/* Progress bar fill element */}
        <span style={progressBarStyle} aria-hidden="true" />
        {/* Label text */}
        <span className="relative z-10">{displayLabel}</span>
      </span>
      {/* Stage text displayed beneath the badge when importing */}
      {status === "importing" && stage && (
        <span
          className="text-xs text-[var(--token-text-secondary)] text-center"
          title={stage}
          aria-label={`Import stage: ${stage}`}
        >
          {stage}
        </span>
      )}
    </div>
  )
}
