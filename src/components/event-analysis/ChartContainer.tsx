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
  selectedClass?: string | null
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
  selectedClass,
}: ChartContainerProps) {
  return (
    <div
      className={`w-full relative ${className}`}
      style={{
        minHeight: `${height}px`,
        backgroundColor: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        borderRadius: "16px",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--glass-shadow), var(--glass-shadow-inset)",
        padding: "20px",
        overflow: "hidden",
      }}
      role="img"
      aria-label={ariaLabel || title || "Chart"}
    >
      {/* Subtle gradient overlay for extra glass depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 100%)",
          borderRadius: "16px",
        }}
      />
      {/* Subtle top highlight for glass edge effect */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)",
          borderRadius: "16px 16px 0 0",
        }}
      />
      {/* Content wrapper */}
      <div className="relative z-10">
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
            aria-label={onTitleClick ? `${title}${selectedClass ? ` - ${selectedClass}` : ""} - Click to customize color` : undefined}
          >
            {title}{selectedClass ? ` - ${selectedClass}` : ""}
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
    </div>
  )
}

