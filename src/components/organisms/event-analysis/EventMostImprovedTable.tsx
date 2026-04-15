"use client"

import { useMemo, useState, useEffect } from "react"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"
import ListPagination from "./ListPagination"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { formatTimeUTC } from "@/lib/format-session-data"
import DataPanelSurface, {
  DataTableFrame,
} from "@/components/organisms/event-analysis/DataPanelSurface"
import {
  sessionTypeFilterKeyForRace,
  sessionTypeFilterChipLabel,
} from "@/core/events/session-type-filter"

type RaceSummary = EventAnalysisData["races"][number]
type RaceResultSummary = RaceSummary["results"][number]

interface ImprovedDriver {
  driverName: string
  positionImprovement: number
  lapTimeImprovement: number | null
  score: number
}

interface MostImprovedRow {
  raceId: string
  raceLabel: string
  className: string
  sessionType: string
  raceOrder: number | null
  startTime: Date | null
  raceUrl: string
  first?: ImprovedDriver
  second?: ImprovedDriver
  third?: ImprovedDriver
}

type SortField = "raceOrder" | "startTime" | "raceLabel" | "className" | "sessionType"
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

function formatSessionTypeLabel(
  race: Pick<
    EventAnalysisData["races"][number],
    "sessionType" | "sectionHeader" | "raceLabel" | "className"
  >
): string {
  const sh = race.sectionHeader?.trim()
  if (sh) return sh
  return sessionTypeFilterChipLabel(sessionTypeFilterKeyForRace(race))
}

function sanitizeLapTime(value: number | null | undefined): number | null {
  if (typeof value !== "number") return null
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

function normalizePositionImprovement(positionImprovement: number, maxPosition: number): number {
  if (positionImprovement <= 0) return 0
  const maxPossible = maxPosition - 1
  if (maxPossible <= 0) return 0
  return Math.min(100, Math.max(0, (positionImprovement / maxPossible) * 100))
}

function normalizeLapTimeImprovement(lapTimeImprovement: number, firstFastLap: number): number {
  if (lapTimeImprovement <= 0 || firstFastLap <= 0) return 0
  const improvementPercent = (lapTimeImprovement / firstFastLap) * 100
  return Math.min(100, Math.max(0, (improvementPercent / 20) * 100))
}

export interface EventMostImprovedTableProps {
  races: EventAnalysisData["races"]
  isPracticeDay?: boolean
}

export default function EventMostImprovedTable({
  races,
  isPracticeDay = false,
}: EventMostImprovedTableProps) {
  const headerClassLabel = useMemo(() => {
    const classes = Array.from(
      new Set(
        races
          .map((race) => race.className)
          .filter(
            (className): className is string =>
              typeof className === "string" && className.trim().length > 0
          )
      )
    )

    if (classes.length === 0) {
      return "All Classes"
    }
    if (classes.length === 1) {
      return classes[0]
    }
    return "Multiple Classes"
  }, [races])

  const [sessionFilter, setSessionFilter] = useState<string>("")
  const [driverSearch, setDriverSearch] = useState<string>("")
  const [sortField, setSortField] = useState<SortField>("raceOrder")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const mostImprovedRows: MostImprovedRow[] = useMemo(() => {
    if (races.length === 0) return []

    const sortedRaces = [...races].sort((a, b) => {
      const orderA = a.raceOrder ?? 0
      const orderB = b.raceOrder ?? 0
      if (orderA !== orderB) return orderA - orderB
      const timeA = a.startTime?.getTime?.() ?? 0
      const timeB = b.startTime?.getTime?.() ?? 0
      return timeA - timeB
    })

    const historyByDriverClass = new Map<
      string,
      Map<
        string,
        Array<{
          raceIndex: number
          positionFinal: number
          fastLapTime: number | null
        }>
      >
    >()

    sortedRaces.forEach((race, raceIdx) => {
      race.results.forEach((result) => {
        const driverId = result.driverId
        if (!driverId) return
        let classMap = historyByDriverClass.get(driverId)
        if (!classMap) {
          classMap = new Map()
          historyByDriverClass.set(driverId, classMap)
        }
        let entries = classMap.get(race.className)
        if (!entries) {
          entries = []
          classMap.set(race.className, entries)
        }
        entries.push({
          raceIndex: raceIdx,
          positionFinal: result.positionFinal,
          fastLapTime: sanitizeLapTime(result.fastLapTime),
        })
      })
    })

    const rows: MostImprovedRow[] = []

    sortedRaces.forEach((race, raceIdx) => {
      const improvements: ImprovedDriver[] = []

      race.results.forEach((result: RaceResultSummary) => {
        const driverId = result.driverId
        if (!driverId) return

        const classMap = historyByDriverClass.get(driverId)
        const history = classMap?.get(race.className)
        if (!history || history.length < 2) return

        const first = history[0]
        if (first.raceIndex === raceIdx) return

        const firstPosition = first.positionFinal
        const currentPosition = result.positionFinal
        const positionImprovement = firstPosition - currentPosition

        const firstFastLap = first.fastLapTime
        const currentFastLap = sanitizeLapTime(result.fastLapTime)
        let lapTimeImprovement: number | null = null
        if (firstFastLap != null && currentFastLap != null) {
          lapTimeImprovement = firstFastLap - currentFastLap
        }

        const hasImprovement =
          positionImprovement > 0 || (lapTimeImprovement != null && lapTimeImprovement > 0)
        if (!hasImprovement) {
          return
        }

        const maxPosition = Math.max(...history.map((h) => h.positionFinal))
        const positionScore = normalizePositionImprovement(positionImprovement, maxPosition)
        let lapTimeScore = 0
        if (lapTimeImprovement != null && firstFastLap != null) {
          lapTimeScore = normalizeLapTimeImprovement(lapTimeImprovement, firstFastLap)
        }

        const score = isPracticeDay
          ? lapTimeScore
          : lapTimeScore > 0
            ? positionScore * 0.5 + lapTimeScore * 0.5
            : positionScore

        if (score <= 0) {
          return
        }

        improvements.push({
          driverName: result.driverName,
          positionImprovement,
          lapTimeImprovement,
          score,
        })
      })

      if (improvements.length === 0) {
        rows.push({
          raceId: race.id,
          raceLabel: race.raceLabel,
          className: race.className,
          sessionType: formatSessionTypeLabel(race),
          raceOrder: race.raceOrder,
          startTime: race.startTime,
          raceUrl: race.raceUrl,
        })
        return
      }

      const sortedDrivers = improvements.sort((a, b) => b.score - a.score)
      const [first, second, third] = sortedDrivers

      rows.push({
        raceId: race.id,
        raceLabel: race.raceLabel,
        className: race.className,
        sessionType: formatSessionTypeLabel(race),
        raceOrder: race.raceOrder,
        startTime: race.startTime,
        raceUrl: race.raceUrl,
        first,
        second,
        third,
      })
    })

    return rows
  }, [races, isPracticeDay])

  const sessionOptions = useMemo(() => {
    const set = new Set<string>()
    mostImprovedRows.forEach((row) => {
      if (row.sessionType) {
        set.add(row.sessionType)
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [mostImprovedRows])

  const filteredRows = useMemo(() => {
    let rows = mostImprovedRows

    if (sessionFilter) {
      rows = rows.filter((row) => row.sessionType === sessionFilter)
    }

    const search = driverSearch.trim().toLowerCase()
    if (search) {
      rows = rows.filter((row) => {
        const names = [row.first?.driverName, row.second?.driverName, row.third?.driverName].filter(
          Boolean
        ) as string[]
        return names.some((name) => name.toLowerCase().includes(search))
      })
    }

    return rows
  }, [mostImprovedRows, sessionFilter, driverSearch])

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows]

    rows.sort((a, b) => {
      let aVal: number | string | null = null
      let bVal: number | string | null = null

      switch (sortField) {
        case "raceOrder":
          aVal = a.raceOrder ?? Number.POSITIVE_INFINITY
          bVal = b.raceOrder ?? Number.POSITIVE_INFINITY
          if (aVal === bVal) {
            const aTime = a.startTime ? a.startTime.getTime() : Number.POSITIVE_INFINITY
            const bTime = b.startTime ? b.startTime.getTime() : Number.POSITIVE_INFINITY
            return sortDirection === "asc" ? aTime - bTime : bTime - aTime
          }
          break
        case "startTime":
          aVal = a.startTime ? a.startTime.getTime() : Number.POSITIVE_INFINITY
          bVal = b.startTime ? b.startTime.getTime() : Number.POSITIVE_INFINITY
          break
        case "raceLabel":
          aVal = a.raceLabel.toLowerCase()
          bVal = b.raceLabel.toLowerCase()
          break
        case "className":
          aVal = a.className.toLowerCase()
          bVal = b.className.toLowerCase()
          break
        case "sessionType":
          aVal = a.sessionType.toLowerCase()
          bVal = b.sessionType.toLowerCase()
          break
        default:
          return 0
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        const cmp = aVal.localeCompare(bVal)
        return sortDirection === "asc" ? cmp : -cmp
      }

      const aNum = typeof aVal === "number" ? aVal : 0
      const bNum = typeof bVal === "number" ? bVal : 0
      if (aNum < bNum) return sortDirection === "asc" ? -1 : 1
      if (aNum > bNum) return sortDirection === "asc" ? 1 : -1
      return 0
    })

    return rows
  }, [filteredRows, sortField, sortDirection])

  const totalPages = Math.ceil(sortedRows.length / itemsPerPage) || 1
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedRows = sortedRows.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1)
  }, [sessionFilter, driverSearch, itemsPerPage, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleRowsPerPageChange = (rowsPerPage: number) => {
    setItemsPerPage(rowsPerPage)
  }

  if (mostImprovedRows.length === 0) {
    return (
      <DataPanelSurface
        title="Most Improved Drivers"
        subtitle="No improvement data available for this event."
        contentClassName="px-4 py-3"
      />
    )
  }

  return (
    <DataPanelSurface
      title={`Most Improved Drivers: ${headerClassLabel}`}
      headerControls={
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="most-improved-session-filter"
              className="text-xs font-medium text-[var(--token-text-secondary)]"
            >
              Session
            </label>
            <select
              id="most-improved-session-filter"
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
            >
              <option value="">All session types</option>
              {sessionOptions.map((session) => (
                <option key={session} value={session}>
                  {session}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="most-improved-driver-filter"
              className="text-xs font-medium text-[var(--token-text-secondary)]"
            >
              Driver
            </label>
            <input
              id="most-improved-driver-filter"
              type="text"
              value={driverSearch}
              onChange={(e) => setDriverSearch(e.target.value)}
              placeholder="Search driver name"
              className="w-40 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] placeholder:text-[var(--token-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
            />
          </div>
        </div>
      }
      contentClassName="px-4 py-3"
    >
      {sortedRows.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-[var(--token-text-secondary)]">
          No races match the selected filters.
        </div>
      ) : (
        <>
          <DataTableFrame>
            <StandardTable>
              <StandardTableHeader>
                <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-alt)]">
                  <StandardTableCell header>
                    <button
                      type="button"
                      onClick={() => handleSort("raceLabel")}
                      className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    >
                      Race
                      <SortIcon
                        field="raceLabel"
                        activeField={sortField}
                        direction={sortDirection}
                      />
                    </button>
                  </StandardTableCell>
                  <StandardTableCell header>
                    <button
                      type="button"
                      onClick={() => handleSort("className")}
                      className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    >
                      Class
                      <SortIcon
                        field="className"
                        activeField={sortField}
                        direction={sortDirection}
                      />
                    </button>
                  </StandardTableCell>
                  <StandardTableCell header>
                    <button
                      type="button"
                      onClick={() => handleSort("sessionType")}
                      className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    >
                      Session
                      <SortIcon
                        field="sessionType"
                        activeField={sortField}
                        direction={sortDirection}
                      />
                    </button>
                  </StandardTableCell>
                  <StandardTableCell header>
                    <button
                      type="button"
                      onClick={() => handleSort("startTime")}
                      className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    >
                      Start Time
                      <SortIcon
                        field="startTime"
                        activeField={sortField}
                        direction={sortDirection}
                      />
                    </button>
                  </StandardTableCell>
                  <StandardTableCell header>1st Place</StandardTableCell>
                  <StandardTableCell header>2nd Place</StandardTableCell>
                  <StandardTableCell header>3rd Place</StandardTableCell>
                </tr>
              </StandardTableHeader>
              <tbody>
                {paginatedRows.map((row) => (
                  <StandardTableRow key={row.raceId}>
                    <StandardTableCell>
                      {row.raceUrl ? (
                        <a
                          href={row.raceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--token-accent)] underline-offset-2 hover:underline"
                        >
                          {row.raceLabel}
                        </a>
                      ) : (
                        row.raceLabel
                      )}
                    </StandardTableCell>
                    <StandardTableCell className="text-[var(--token-text-secondary)]">
                      {row.className}
                    </StandardTableCell>
                    <StandardTableCell className="text-[var(--token-text-secondary)]">
                      {row.sessionType}
                    </StandardTableCell>
                    <StandardTableCell className="text-[var(--token-text-secondary)]">
                      {formatTimeUTC(row.startTime)}
                    </StandardTableCell>
                    <StandardTableCell className="font-semibold">
                      {row.first?.driverName ?? "—"}
                    </StandardTableCell>
                    <StandardTableCell>{row.second?.driverName ?? "—"}</StandardTableCell>
                    <StandardTableCell>{row.third?.driverName ?? "—"}</StandardTableCell>
                  </StandardTableRow>
                ))}
              </tbody>
            </StandardTable>
          </DataTableFrame>
          <div className="mt-4">
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={sortedRows.length}
              itemLabel="races"
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          </div>
        </>
      )}
    </DataPanelSurface>
  )
}
