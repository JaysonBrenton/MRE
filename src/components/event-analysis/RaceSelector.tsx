/**
 * @fileoverview Race selector component - displays clickable race cards for selection
 * 
 * @created 2025-01-28
 * @creator Auto-generated
 * @lastModified 2025-01-28
 * 
 * @description Component for selecting a race from a list of available races
 * 
 * @purpose Provides a visual interface for race selection with race details displayed
 *          on each card. Supports filtering by class and highlights selected race.
 * 
 * @relatedFiles
 * - src/components/event-analysis/ComparisonsTab.tsx (parent component)
 */

"use client"

import { formatDateDisplay } from "@/lib/date-utils"

export interface Race {
  id: string
  raceLabel: string
  className: string
  startTime: Date | null
}

export interface RaceSelectorProps {
  races: Race[]
  selectedRaceId: string | null
  onRaceSelect: (raceId: string) => void
  selectedClass?: string | null
}

export default function RaceSelector({
  races,
  selectedRaceId,
  onRaceSelect,
  selectedClass,
}: RaceSelectorProps) {
  // Filter races by selected class if provided
  const filteredRaces = selectedClass
    ? races.filter((race) => race.className === selectedClass)
    : races

  if (filteredRaces.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-[var(--token-text-secondary)]">
          {selectedClass
            ? `No races available for class "${selectedClass}"`
            : "No races available"}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-[var(--token-text-primary)]">
        Select a Race
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredRaces.map((race) => {
          const isSelected = selectedRaceId === race.id

          return (
            <button
              key={race.id}
              type="button"
              onClick={() => onRaceSelect(race.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onRaceSelect(race.id)
                }
              }}
              className={`
                relative p-4 rounded-lg border-2 transition-all
                text-left
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]
                ${
                  isSelected
                    ? "border-[var(--token-accent)] bg-[var(--token-accent)]/10 shadow-lg"
                    : "border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] hover:border-[var(--token-accent)]/50 hover:bg-[var(--token-surface-raised)]"
                }
              `}
              aria-pressed={isSelected}
              aria-label={`Select race: ${race.raceLabel}${race.className ? ` (${race.className})` : ""}`}
            >
              <div className="space-y-1">
                <div className="font-semibold text-sm text-[var(--token-text-primary)]">
                  {race.raceLabel}
                </div>
                {race.className && (
                  <div className="text-xs text-[var(--token-text-secondary)]">
                    {race.className}
                  </div>
                )}
                {race.startTime && (
                  <div className="text-xs text-[var(--token-text-muted)]">
                    {formatDateDisplay(race.startTime.toISOString())}
                  </div>
                )}
              </div>
              {isSelected && (
                <div
                  className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--token-accent)]"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
