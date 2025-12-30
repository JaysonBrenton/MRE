/**
 * @fileoverview Session chart tabs - tabbed interface for different chart views
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Tabbed interface component for switching between different session chart visualizations
 * 
 * @purpose Manages active chart state and renders appropriate chart based on active tab.
 * 
 * @relatedFiles
 * - src/components/event-analysis/sessions/OverviewChart.tsx
 * - src/components/event-analysis/sessions/HeatProgressionChart.tsx
 * - src/components/event-analysis/sessions/DriverPerformanceChart.tsx
 */

"use client"

import { useState, KeyboardEvent } from "react"
import OverviewChart from "./OverviewChart"
import HeatProgressionChart from "./HeatProgressionChart"
import DriverPerformanceChart from "./DriverPerformanceChart"
import type { SessionData, DriverLapTrend, HeatProgressionData } from "@/core/events/get-sessions-data"

export type ChartTabId = "overview" | "progression" | "driver-performance"

export interface SessionChartTabsProps {
  sessions: SessionData[]
  driverLapTrends: DriverLapTrend[]
  heatProgression: HeatProgressionData[]
  height?: number
  className?: string
}

const defaultTabs: Array<{ id: ChartTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "progression", label: "Heat Progression" },
  { id: "driver-performance", label: "Driver Performance" },
]

export default function SessionChartTabs({
  sessions,
  driverLapTrends,
  heatProgression,
  height = 500,
  className = "",
}: SessionChartTabsProps) {
  const [activeTab, setActiveTab] = useState<ChartTabId>("overview")

  // Determine which tabs to show
  const availableTabs = defaultTabs.filter((tab) => {
    if (tab.id === "driver-performance") {
      return driverLapTrends.length > 0
    }
    return true
  })

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tabId: ChartTabId
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      setActiveTab(tabId)
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      const currentIndex = availableTabs.findIndex((t) => t.id === activeTab)
      const prevIndex =
        currentIndex > 0 ? currentIndex - 1 : availableTabs.length - 1
      setActiveTab(availableTabs[prevIndex].id)
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      const currentIndex = availableTabs.findIndex((t) => t.id === activeTab)
      const nextIndex =
        currentIndex < availableTabs.length - 1 ? currentIndex + 1 : 0
      setActiveTab(availableTabs[nextIndex].id)
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Tab Navigation */}
      <div
        className="border-b border-[var(--token-border-default)] overflow-x-auto"
        role="tablist"
        aria-label="Session chart tabs"
      >
        <div className="flex min-w-max">
          {availableTabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`chartpanel-${tab.id}`}
                id={`charttab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, tab.id)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] ${
                  isActive
                    ? "border-[var(--token-accent)] text-[var(--token-accent)]"
                    : "border-transparent text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)]"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Chart Content */}
      <div role="tabpanel" aria-labelledby={`charttab-${activeTab}`}>
        {activeTab === "overview" && (
          <OverviewChart
            sessions={sessions}
            driverLapTrends={driverLapTrends}
            height={height}
          />
        )}

        {activeTab === "progression" && (
          <HeatProgressionChart
            progressionData={heatProgression}
            height={height}
          />
        )}

        {activeTab === "driver-performance" && driverLapTrends.length > 0 && (
          <DriverPerformanceChart
            driverLapTrends={driverLapTrends}
            height={height}
          />
        )}
      </div>
    </div>
  )
}

