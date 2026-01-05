/**
 * @fileoverview Chart type selector component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Standalone chart type selector dropdown
 *
 * @purpose Provides chart type selection control for performance visualizations.
 *          Extracted from ChartControls to be placed near the chart it controls.
 *
 * @relatedFiles
 * - src/components/event-analysis/OverviewTab.tsx (uses this)
 * - src/components/event-analysis/ChartControls.tsx (previously contained this)
 */

"use client"

import { useState, useEffect, useRef } from "react"

export interface ChartTypeSelectorProps {
  chartType: "best-lap" | "avg-vs-fastest"
  onChartTypeChange: (type: "best-lap" | "avg-vs-fastest") => void
}

const chartTypeLabels: Record<"best-lap" | "avg-vs-fastest", string> = {
  "best-lap": "Best Lap",
  "avg-vs-fastest": "Avg vs Fastest",
}

export default function ChartTypeSelector({
  chartType,
  onChartTypeChange,
}: ChartTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-2.5 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] whitespace-nowrap"
        aria-label="Select chart type"
        aria-expanded={isOpen}
      >
        <span>{chartTypeLabels[chartType]}</span>
        <svg
          className={`w-4 h-4 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-10 left-0 w-auto min-w-[200px] max-w-[280px] mt-1 bg-[var(--token-surface-elevated)] border border-[var(--token-border-default)] rounded-md shadow-lg overflow-auto">
          <button
            type="button"
            onClick={() => {
              onChartTypeChange("best-lap")
              setIsOpen(false)
            }}
            className={`w-full text-left px-3 py-2 text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] ${
              chartType === "best-lap"
                ? "bg-[var(--token-surface)] border-l-2 border-l-[var(--token-accent)]"
                : ""
            }`}
            aria-label="Best Lap chart - shows fastest lap time per driver"
            title="Best Lap: Shows the fastest lap time for each driver"
          >
            <div className="font-medium">Best Lap</div>
            <div className="text-xs text-[var(--token-text-secondary)] mt-0.5">
              Shows the fastest lap time for each driver
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              onChartTypeChange("avg-vs-fastest")
              setIsOpen(false)
            }}
            className={`w-full text-left px-3 py-2 text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] ${
              chartType === "avg-vs-fastest"
                ? "bg-[var(--token-surface)] border-l-2 border-l-[var(--token-accent)]"
                : ""
            }`}
            aria-label="Average vs Fastest chart - compares average and fastest lap times"
            title="Avg vs Fastest: Compares each driver's average lap time to their fastest lap"
          >
            <div className="font-medium">Avg vs Fastest</div>
            <div className="text-xs text-[var(--token-text-secondary)] mt-0.5">
              Compares each driver&apos;s average lap time to their fastest lap
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
