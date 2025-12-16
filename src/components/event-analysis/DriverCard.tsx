/**
 * @fileoverview Driver card component - mobile card view for driver
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Mobile-friendly card component for displaying driver information
 * 
 * @purpose Displays driver stats in a card format for mobile view.
 *          Touch-friendly with 44px minimum height.
 * 
 * @relatedFiles
 * - src/components/event-analysis/DriverList.tsx (uses this)
 */

"use client"

export interface DriverCardProps {
  driverId: string
  driverName: string
  racesParticipated: number
  bestLapTime: number | null
  avgLapTime: number | null
  consistency: number | null
  isSelected: boolean
  onSelectionChange: (driverId: string, selected: boolean) => void
}

function formatLapTime(seconds: number | null): string {
  if (seconds === null) return "N/A"
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  const wholeSecs = Math.floor(secs)
  const millis = Math.floor((secs - wholeSecs) * 1000)
  return `${minutes}:${wholeSecs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`
}

export default function DriverCard({
  driverId,
  driverName,
  racesParticipated,
  bestLapTime,
  avgLapTime,
  consistency,
  isSelected,
  onSelectionChange,
}: DriverCardProps) {
  return (
    <div
      className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4 space-y-3"
      style={{ minHeight: "44px" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelectionChange(driverId, e.target.checked)}
            className="w-5 h-5 rounded border-[var(--token-border-default)] text-[var(--token-accent)] focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] mt-0.5"
          />
          <div className="flex-1">
            <h3 className="font-medium text-[var(--token-text-primary)]">
              {driverName}
            </h3>
            <p className="text-sm text-[var(--token-text-secondary)]">
              {racesParticipated} race{racesParticipated !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[var(--token-text-secondary)] mb-1">
            Best Lap
          </div>
          <div className="text-[var(--token-text-primary)] font-medium">
            {formatLapTime(bestLapTime)}
          </div>
        </div>
        <div>
          <div className="text-[var(--token-text-secondary)] mb-1">
            Avg Lap
          </div>
          <div className="text-[var(--token-text-primary)] font-medium">
            {formatLapTime(avgLapTime)}
          </div>
        </div>
        {consistency !== null && (
          <div>
            <div className="text-[var(--token-text-secondary)] mb-1">
              Consistency
            </div>
            <div className="text-[var(--token-text-primary)] font-medium">
              {consistency.toFixed(1)}%
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

