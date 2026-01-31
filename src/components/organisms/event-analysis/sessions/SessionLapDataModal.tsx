/**
 * @fileoverview Modal that displays lap data for a single session (race).
 *
 * @description Lazy-loads lap data only when the modal is opened. Fetches from
 *   /api/v1/events/[eventId]/laps filtered by class, then filters client-side
 *   to the selected raceId.
 *
 * @relatedFiles
 * - src/components/event-analysis/sessions/SessionsTableRow.tsx (opens modal)
 * - src/components/ui/Modal.tsx
 * - src/core/events/get-lap-data.ts
 */

"use client"

import { useState, useEffect, useCallback, Fragment } from "react"
import Modal from "@/components/molecules/Modal"
import { formatLapTime } from "@/lib/format-session-data"
import type { DriverLapData, RaceLapData } from "@/core/events/get-lap-data"

export interface SessionLapDataModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  selectedClass: string | null
  raceId: string
  raceLabel: string
}

function getTimeDelta(lapTime: number, bestLap: number | null): number | null {
  if (bestLap === null) return null
  return lapTime - bestLap
}

function isBestLap(lapTime: number, bestLap: number | null): boolean {
  if (bestLap === null) return false
  return Math.abs(lapTime - bestLap) < 0.001
}

export default function SessionLapDataModal({
  isOpen,
  onClose,
  eventId,
  selectedClass,
  raceId,
  raceLabel,
}: SessionLapDataModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drivers, setDrivers] = useState<DriverLapData[]>([])
  const [expandedDriverIds, setExpandedDriverIds] = useState<Set<string>>(new Set())

  const fetchLapData = useCallback(async () => {
    if (!eventId || !raceId) return
    setLoading(true)
    setError(null)
    try {
      const classNameParam = selectedClass?.trim()
        ? `?className=${encodeURIComponent(selectedClass.trim())}`
        : ""
      const res = await fetch(`/api/v1/events/${eventId}/laps${classNameParam}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error?.message || `HTTP ${res.status}`)
      }
      const json = await res.json()
      if (!json?.success || !json?.data?.drivers) {
        throw new Error("Invalid lap data response")
      }
      const allDrivers: DriverLapData[] = json.data.drivers
      const forRace = allDrivers
        .map((d) => {
          const race = d.races.find((r: RaceLapData) => r.raceId === raceId)
          if (!race) return null
          return {
            ...d,
            races: [race],
            overallBestLap: race.bestLapTime,
            totalLaps: race.totalLaps,
          } as DriverLapData
        })
        .filter((d): d is DriverLapData => d !== null)
        .sort((a, b) => {
          const raceA = a.races[0]
          const raceB = b.races[0]
          if (!raceA || !raceB) return 0
          return raceA.positionFinal - raceB.positionFinal
        })
      setDrivers(forRace)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lap data")
      setDrivers([])
    } finally {
      setLoading(false)
    }
  }, [eventId, selectedClass, raceId])

  useEffect(() => {
    if (isOpen && eventId && raceId) {
      fetchLapData()
    } else if (!isOpen) {
      setDrivers([])
      setExpandedDriverIds(new Set())
      setError(null)
    }
  }, [isOpen, eventId, raceId, fetchLapData])

  const toggleDriver = (driverId: string) => {
    setExpandedDriverIds((prev) => {
      const next = new Set(prev)
      if (next.has(driverId)) next.delete(driverId)
      else next.add(driverId)
      return next
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Lap data — ${raceLabel}`}
      maxWidth="4xl"
      ariaLabel="Session lap data"
    >
      <div className="px-1 pb-2">
        {loading && (
          <div className="flex items-center justify-center py-16 text-[var(--token-text-secondary)]">
            Loading lap data…
          </div>
        )}
        {error && !loading && (
          <div className="py-8 text-center text-[var(--token-text-error)]">{error}</div>
        )}
        {!loading && !error && drivers.length === 0 && (
          <div className="py-8 text-center text-[var(--token-text-secondary)]">
            No lap data for this session.
          </div>
        )}
        {!loading && !error && drivers.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-[var(--token-border-default)]">
            <table className="w-full min-w-[800px]" aria-label="Lap data by driver">
              <thead className="bg-[var(--token-surface-alt)] border-b border-[var(--token-border-default)]">
                <tr>
                  <th
                    scope="col"
                    className="w-8 px-2 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                  />
                  <th
                    scope="col"
                    className="px-4 py-3 text-center text-sm font-medium text-[var(--token-text-secondary)]"
                  >
                    Pos
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                  >
                    Driver
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                  >
                    Best Lap
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-center text-sm font-medium text-[var(--token-text-secondary)]"
                  >
                    Laps
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[var(--token-surface)]">
                {drivers.map((driver) => {
                  const race = driver.races[0]
                  if (!race) return null
                  const expanded = expandedDriverIds.has(driver.driverId)
                  return (
                    <Fragment key={driver.driverId}>
                      <tr
                        className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)] cursor-pointer"
                        onClick={() => toggleDriver(driver.driverId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            toggleDriver(driver.driverId)
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                      >
                        <td className="px-2 py-3 text-[var(--token-text-secondary)]">
                          <span
                            className="inline-block transition-transform"
                            style={{
                              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                            }}
                            aria-hidden
                          >
                            ▶
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center font-medium text-[var(--token-text-primary)]">
                          {race.positionFinal}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--token-text-primary)]">
                          {driver.driverName}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-[var(--token-text-primary)]">
                          {formatLapTime(race.bestLapTime)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-[var(--token-text-primary)]">
                          {race.totalLaps}
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={5} className="px-4 py-2 pl-8">
                            <div className="overflow-x-auto rounded border border-[var(--token-border-default)]/60">
                              <table className="w-full min-w-[600px]">
                                <thead className="bg-[var(--token-surface-alt)]">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-[var(--token-text-secondary)]">
                                      Lap #
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-[var(--token-text-secondary)]">
                                      Lap Time
                                    </th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-[var(--token-text-secondary)]">
                                      Position
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-[var(--token-text-secondary)]">
                                      Elapsed
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-[var(--token-text-secondary)]">
                                      Delta
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {race.laps.map((lap) => {
                                    const delta = getTimeDelta(lap.lapTimeSeconds, race.bestLapTime)
                                    const best = isBestLap(lap.lapTimeSeconds, race.bestLapTime)
                                    return (
                                      <tr
                                        key={lap.lapId}
                                        className={
                                          best
                                            ? "bg-[var(--token-accent)]/10 border-b border-[var(--token-border-default)]/50"
                                            : "border-b border-[var(--token-border-default)]/50 hover:bg-[var(--token-surface-raised)]"
                                        }
                                      >
                                        <td className="px-3 py-2 text-sm text-[var(--token-text-primary)]">
                                          {lap.lapNumber}
                                          {best && (
                                            <span
                                              className="ml-1 text-[var(--token-accent)]"
                                              title="Best lap"
                                              aria-label="Best lap"
                                            >
                                              ★
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 text-sm font-mono text-[var(--token-text-primary)]">
                                          {formatLapTime(lap.lapTimeSeconds)}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-center text-[var(--token-text-primary)]">
                                          {lap.positionOnLap}
                                        </td>
                                        <td className="px-3 py-2 text-sm font-mono text-[var(--token-text-secondary)]">
                                          {formatLapTime(lap.elapsedRaceTime)}
                                        </td>
                                        <td className="px-3 py-2 text-sm font-mono">
                                          {delta !== null ? (
                                            <span
                                              className={
                                                delta === 0
                                                  ? "text-[var(--token-accent)]"
                                                  : delta > 0
                                                    ? "text-[var(--token-text-secondary)]"
                                                    : "text-[var(--token-text-error)]"
                                              }
                                            >
                                              {delta > 0 ? "+" : delta < 0 ? "-" : ""}
                                              {formatLapTime(Math.abs(delta))}
                                            </span>
                                          ) : (
                                            <span className="text-[var(--token-text-secondary)]">
                                              —
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}
