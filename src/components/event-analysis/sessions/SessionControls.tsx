/**
 * @fileoverview Session controls component - view toggle, filters, and preset selector
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Control panel for sessions/heats view with view toggle, class filter, and preset selector
 * 
 * @purpose Provides controls for switching between chart/table views and filtering sessions.
 * 
 * @relatedFiles
 * - src/components/event-analysis/SessionsTab.tsx (parent)
 */

"use client"

export type ViewMode = "chart" | "table"
export type PresetView = "overview"

export interface SessionControlsProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  selectedClass: string | null
  availableClasses: string[]
  presetView: PresetView
  onPresetViewChange: (preset: PresetView) => void
  isFilteringByDrivers: boolean
  selectedDriverCount: number
}

export default function SessionControls({
  viewMode,
  onViewModeChange,
  selectedClass,
  availableClasses,
  presetView,
  onPresetViewChange,
  isFilteringByDrivers,
  selectedDriverCount,
}: SessionControlsProps) {
  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-[var(--token-text-primary)]">
          View:
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onViewModeChange("chart")}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              viewMode === "chart"
                ? "bg-[var(--token-accent)] text-white"
                : "bg-[var(--token-surface-elevated)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)]"
            }`}
          >
            Chart
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("table")}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              viewMode === "table"
                ? "bg-[var(--token-accent)] text-white"
                : "bg-[var(--token-surface-elevated)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)]"
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Class Filter (Read-only) */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[var(--token-text-primary)]">
            Class:
          </label>
          <div className="px-3 py-1.5 text-sm border border-[var(--token-border-default)] rounded bg-[var(--token-surface)] text-[var(--token-text-secondary)]">
            {selectedClass || "All Classes"}
          </div>
          <span className="text-xs text-[var(--token-text-secondary)]">
            (Set in Overview tab)
          </span>
        </div>

        {/* Preset View Selector */}
        {viewMode === "chart" && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="preset-view"
              className="text-sm font-medium text-[var(--token-text-primary)]"
            >
              Preset:
            </label>
            <select
              id="preset-view"
              value={presetView}
              onChange={(e) =>
                onPresetViewChange(e.target.value as PresetView)
              }
              className="px-3 py-1.5 text-sm border border-[var(--token-border-default)] rounded bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
            >
              <option value="overview">Overview</option>
            </select>
          </div>
        )}

        {/* Driver Filter Indicator */}
        {isFilteringByDrivers && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--token-surface-elevated)] rounded border border-[var(--token-border-default)]">
            <span className="text-sm text-[var(--token-text-secondary)]">
              Filtered by {selectedDriverCount} driver
              {selectedDriverCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

