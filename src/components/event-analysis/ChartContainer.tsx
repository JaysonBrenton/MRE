/**
 * @fileoverview Chart container component - base wrapper for all charts with MRE theming
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Base wrapper component for all Visx charts with MRE token-based theming
 * 
 * @purpose Provides consistent theming, responsive sizing, and accessibility for all charts.
 *          Applies MRE dark theme tokens to Visx charts.
 * 
 * @relatedFiles
 * - src/components/event-analysis/BestLapBarChart.tsx (uses this)
 * - src/components/event-analysis/AvgVsFastestChart.tsx (uses this)
 * - docs/design/mre-dark-theme-guidelines.md (token system)
 */

"use client"

import { ReactNode } from "react"

export interface ChartContainerProps {
  children: ReactNode
  title?: string
  description?: string
  height?: number
  className?: string
  "aria-label"?: string
  chartInstanceId?: string
  onTitleClick?: () => void
}

/**
 * Chart container with MRE theming and responsive sizing
 */
export default function ChartContainer({
  children,
  title,
  description,
  height = 400,
  className = "",
  "aria-label": ariaLabel,
  chartInstanceId,
  onTitleClick,
}: ChartContainerProps) {
  return (
    <div
      className={`w-full pb-4 ${className}`}
      style={{
        minHeight: `${height}px`,
      }}
      role="img"
      aria-label={ariaLabel || title || "Chart"}
    >
      {title && (
        <h3
          className={`text-lg font-semibold text-[var(--token-text-primary)] mb-2 ${
            onTitleClick
              ? "cursor-pointer hover:text-[var(--token-accent)] transition-colors"
              : ""
          }`}
          onClick={onTitleClick}
          onKeyDown={(e) => {
            if (onTitleClick && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault()
              onTitleClick()
            }
          }}
          tabIndex={onTitleClick ? 0 : undefined}
          role={onTitleClick ? "button" : undefined}
          aria-label={onTitleClick ? `${title} - Click to customize color` : undefined}
        >
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm text-[var(--token-text-secondary)] mb-4">
          {description}
        </p>
      )}
      <div
        className="w-full"
        style={{
          minHeight: `${height}px`,
          color: "var(--token-text-primary)",
        }}
      >
        {children}
      </div>
    </div>
  )
}

