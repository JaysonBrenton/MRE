/**
 * @fileoverview Combined drivers and entry list table
 *
 * @description Single table showing event entries with driver stats (entry-centric).
 *              One row per entry (driver + class); columns: Driver, Class, Vehicle Type,
 *              Transponder, Car #, Races, Best Lap, Avg Lap, Consistency.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/DriversTab.tsx (uses this)
 * - src/components/organisms/event-analysis/EntryList.tsx (reference for layout/modal)
 * - src/components/organisms/event-analysis/ChartContainer.tsx
 */

"use client"

import { useState, useMemo, useEffect } from "react"
import ListPagination from "./ListPagination"
import ChartContainer from "./ChartContainer"
import ClassDetailsModal from "./ClassDetailsModal"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface CombinedRow {
  id: string
  driverId: string
  driverName: string
  className: string
  transponderNumber: string | null
  carNumber: string | null
  racesParticipated: number
  bestLapTime: number | null
  avgLapTime: number | null
  consistency: number | null
}

export interface CombinedDriversTableProps {
  data: EventAnalysisData
  /** When provided, table filter is controlled by parent (e.g. global "Select a Class" action) */
  selectedClass?: string | null
  onClassChange?: (className: string | null) => void
}

type SortField =
  | "driverName"
  | "className"
  | "transponderNumber"
  | "carNumber"
  | "racesParticipated"
  | "bestLapTime"
  | "avgLapTime"
  | "consistency"
type SortDirection = "asc" | "desc"

interface SortIconProps {
  field: SortField
  activeField: SortField
  direction: SortDirection
}

function SortIcon({ field, activeField, direction }: SortIconProps) {
  if (activeField !== field) {
    return null
  }
  return <span aria-hidden="true">{direction === "asc" ? "↑" : "↓"}</span>
}

function formatLapTime(seconds: number | null): string {
  if (seconds == null) return "N/A"
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(3).padStart(6, "0")}`
}

export default function CombinedDriversTable({
  data,
  selectedClass: selectedClassProp,
}: CombinedDriversTableProps) {
  const [sortField, setSortField] = useState<SortField>("driverName")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalClassName, setModalClassName] = useState<string | null>(null)

  const selectedClass = selectedClassProp ?? null

  const driverStatsByDriverId = useMemo(() => {
    const map = new Map<
      string,
      {
        racesParticipated: number
        bestLapTime: number | null
        avgLapTime: number | null
        consistency: number | null
      }
    >()
    data.drivers.forEach((d) => {
      map.set(d.driverId, {
        racesParticipated: d.racesParticipated,
        bestLapTime: d.bestLapTime,
        avgLapTime: d.avgLapTime,
        consistency: d.consistency,
      })
    })
    return map
  }, [data.drivers])

  const mergedRows: CombinedRow[] = useMemo(() => {
    return data.entryList.map((entry) => {
      const stats = driverStatsByDriverId.get(entry.driverId)
      return {
        id: entry.id,
        driverId: entry.driverId,
        driverName: entry.driverName,
        className: entry.className,
        transponderNumber: entry.transponderNumber,
        carNumber: entry.carNumber,
        racesParticipated: stats?.racesParticipated ?? 0,
        bestLapTime: stats?.bestLapTime ?? null,
        avgLapTime: stats?.avgLapTime ?? null,
        consistency: stats?.consistency ?? null,
      }
    })
  }, [data.entryList, driverStatsByDriverId])

  const filteredRows = useMemo(() => {
    if (!selectedClass) return mergedRows
    return mergedRows.filter((row) => row.className === selectedClass)
  }, [mergedRows, selectedClass])

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let aVal: number | string | null
      let bVal: number | string | null
      switch (sortField) {
        case "driverName":
          aVal = a.driverName.toLowerCase()
          bVal = b.driverName.toLowerCase()
          break
        case "className":
          aVal = a.className.toLowerCase()
          bVal = b.className.toLowerCase()
          break
        case "transponderNumber":
          aVal = a.transponderNumber ?? ""
          bVal = b.transponderNumber ?? ""
          break
        case "carNumber":
          aVal = a.carNumber ?? ""
          bVal = b.carNumber ?? ""
          break
        case "racesParticipated":
          aVal = a.racesParticipated
          bVal = b.racesParticipated
          break
        case "bestLapTime":
          aVal = a.bestLapTime ?? Infinity
          bVal = b.bestLapTime ?? Infinity
          break
        case "avgLapTime":
          aVal = a.avgLapTime ?? Infinity
          bVal = b.avgLapTime ?? Infinity
          break
        case "consistency":
          aVal = a.consistency ?? -Infinity
          bVal = b.consistency ?? -Infinity
          break
        default:
          return 0
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
      return 0
    })
  }, [filteredRows, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setItemsPerPage(newRowsPerPage)
    setCurrentPage(1)
  }

  const totalPages = Math.ceil(sortedRows.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedRows = sortedRows.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    setTimeout(() => setCurrentPage(1), 0)
  }, [sortField, sortDirection, selectedClass, itemsPerPage])

  const { raceClasses, event } = data
  const eventId = event.id

  if (data.entryList.length === 0) {
    return (
      <ChartContainer
        title="Drivers"
        description="Entry list with driver stats"
        aria-label="Drivers table - no data"
      >
        <div className="flex items-center justify-center h-64 text-[var(--token-text-secondary)]">
          No entry list data available for this event.
        </div>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer
      title="Drivers"
      description="Entry list with driver names, classes, transponders, car numbers, and stats"
      aria-label="Drivers table with entries and stats"
      selectedClass={selectedClass || undefined}
    >
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--token-border-default)]">
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                  <button
                    type="button"
                    onClick={() => handleSort("driverName")}
                    className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  >
                    Driver Name
                    <SortIcon field="driverName" activeField={sortField} direction={sortDirection} />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                  <button
                    type="button"
                    onClick={() => handleSort("className")}
                    className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  >
                    Class
                    <SortIcon field="className" activeField={sortField} direction={sortDirection} />
                  </button>
                </th>
                {raceClasses && (
                  <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                    Vehicle Type
                  </th>
                )}
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                  <button
                    type="button"
                    onClick={() => handleSort("transponderNumber")}
                    className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  >
                    Transponder
                    <SortIcon
                      field="transponderNumber"
                      activeField={sortField}
                      direction={sortDirection}
                    />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                  <button
                    type="button"
                    onClick={() => handleSort("carNumber")}
                    className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  >
                    Car Number
                    <SortIcon field="carNumber" activeField={sortField} direction={sortDirection} />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                  <button
                    type="button"
                    onClick={() => handleSort("racesParticipated")}
                    className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  >
                    Races
                    <SortIcon
                      field="racesParticipated"
                      activeField={sortField}
                      direction={sortDirection}
                    />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                  <button
                    type="button"
                    onClick={() => handleSort("bestLapTime")}
                    className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  >
                    Best Lap
                    <SortIcon field="bestLapTime" activeField={sortField} direction={sortDirection} />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                  <button
                    type="button"
                    onClick={() => handleSort("avgLapTime")}
                    className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  >
                    Avg Lap
                    <SortIcon field="avgLapTime" activeField={sortField} direction={sortDirection} />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                  <button
                    type="button"
                    onClick={() => handleSort("consistency")}
                    className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  >
                    Consistency
                    <SortIcon field="consistency" activeField={sortField} direction={sortDirection} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => {
                const vehicleType = raceClasses?.get(row.className)?.vehicleType
                return (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)] transition-colors"
                  >
                    <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-primary)]">
                      {row.driverName}
                    </td>
                    <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                      <div className="flex items-center gap-2">
                        <span>{row.className}</span>
                        {eventId && (
                          <button
                            type="button"
                            onClick={() => {
                              setModalClassName(row.className)
                              setModalOpen(true)
                            }}
                            className="p-1 text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] rounded"
                            aria-label={`View details for ${row.className}`}
                            title="View class details"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                    {raceClasses && (
                      <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                        {vehicleType ?? "Not determined"}
                      </td>
                    )}
                    <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                      {row.transponderNumber ?? "N/A"}
                    </td>
                    <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                      {row.carNumber ?? "N/A"}
                    </td>
                    <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                      {row.racesParticipated}
                    </td>
                    <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                      {formatLapTime(row.bestLapTime)}
                    </td>
                    <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                      {formatLapTime(row.avgLapTime)}
                    </td>
                    <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                      {row.consistency != null ? `${row.consistency.toFixed(1)}%` : "N/A"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <ListPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          totalItems={sortedRows.length}
          itemLabel="entries"
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </div>

      {eventId && modalClassName && raceClasses && (
        <ClassDetailsModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false)
            setModalClassName(null)
          }}
          eventId={eventId}
          className={modalClassName}
          vehicleType={raceClasses.get(modalClassName)?.vehicleType ?? null}
          vehicleTypeNeedsReview={raceClasses.get(modalClassName)?.vehicleTypeNeedsReview ?? true}
          onSave={async (vehicleType, acceptInference) => {
            const response = await fetch(
              `/api/v1/events/${eventId}/race-classes/${encodeURIComponent(modalClassName)}/vehicle-type`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vehicleType, acceptInference }),
                credentials: "include",
                cache: "no-store",
              }
            )
            if (!response.ok) {
              let msg = "Failed to save vehicle type"
              try {
                const err = await response.json()
                if (err.error?.message) msg = err.error.message
                else if (err.error?.code) msg = `${err.error.code}: ${msg}`
              } catch {
                msg = response.statusText || msg
              }
              throw new Error(msg)
            }
            const result = await response.json()
            if (!result.success) {
              throw new Error(result.error?.message ?? "Save failed")
            }
            window.location.reload()
          }}
        />
      )}
    </ChartContainer>
  )
}
