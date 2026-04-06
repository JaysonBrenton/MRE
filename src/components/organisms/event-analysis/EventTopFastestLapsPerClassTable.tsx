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
import { computeTopFastestLapsPerClass } from "@/core/events/event-top-fastest-laps-per-class"
import { formatLapTime } from "@/lib/format-session-data"

export interface EventTopFastestLapsPerClassTableProps {
  races: EventAnalysisData["races"]
}

interface TableRow {
  rank: number
  className: string
  driverId: string
  driverName: string
  lapTimeSeconds: number
  lapNumber: number | null
  raceLabel: string
}

type SortField = "rank" | "className" | "driverName" | "lapTimeSeconds" | "lapNumber" | "raceLabel"

type SortDirection = "asc" | "desc"

function formatRankLabel(rank: number): string {
  if (rank === 1) return "1st"
  if (rank === 2) return "2nd"
  if (rank === 3) return "3rd"
  return `${rank}`
}

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

export default function EventTopFastestLapsPerClassTable({
  races,
}: EventTopFastestLapsPerClassTableProps) {
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

  const rows: TableRow[] = useMemo(() => {
    const groups = computeTopFastestLapsPerClass(races)
    const flat: TableRow[] = []
    for (const { className, entries } of groups) {
      for (const e of entries) {
        flat.push({
          rank: e.rank,
          className,
          driverId: e.driverId,
          driverName: e.driverName,
          lapTimeSeconds: e.lapTimeSeconds,
          lapNumber: e.lapNumber,
          raceLabel: e.raceLabel,
        })
      }
    }
    return flat
  }, [races])

  const classOptions = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((row) => set.add(row.className))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const [classFilter, setClassFilter] = useState<string>("")
  const [driverSearch, setDriverSearch] = useState<string>("")
  const [sortField, setSortField] = useState<SortField>("className")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Parent may pass races pre-filtered by class (e.g. overview pills). Clear a stale
  // table-only class filter so it cannot reference a class no longer in `races`.
  useEffect(() => {
    if (classFilter && !classOptions.includes(classFilter)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync filter to new dataset
      setClassFilter("")
    }
  }, [classOptions, classFilter])

  const filteredRows = useMemo(() => {
    let r = rows
    if (classFilter) {
      r = r.filter((row) => row.className === classFilter)
    }
    const search = driverSearch.trim().toLowerCase()
    if (search) {
      r = r.filter((row) => row.driverName.toLowerCase().includes(search))
    }
    return r
  }, [rows, classFilter, driverSearch])

  const sortedRows = useMemo(() => {
    const list = [...filteredRows]

    list.sort((a, b) => {
      let aVal: number | string | null = null
      let bVal: number | string | null = null

      switch (sortField) {
        case "rank":
          aVal = a.rank
          bVal = b.rank
          break
        case "className":
          aVal = a.className.toLowerCase()
          bVal = b.className.toLowerCase()
          break
        case "driverName":
          aVal = a.driverName.toLowerCase()
          bVal = b.driverName.toLowerCase()
          break
        case "lapTimeSeconds":
          aVal = a.lapTimeSeconds
          bVal = b.lapTimeSeconds
          break
        case "lapNumber":
          aVal = a.lapNumber ?? Number.POSITIVE_INFINITY
          bVal = b.lapNumber ?? Number.POSITIVE_INFINITY
          break
        case "raceLabel":
          aVal = a.raceLabel.toLowerCase()
          bVal = b.raceLabel.toLowerCase()
          break
        default:
          return 0
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        const cmp = aVal.localeCompare(bVal)
        if (cmp !== 0) {
          return sortDirection === "asc" ? cmp : -cmp
        }
      } else {
        const aNum = typeof aVal === "number" ? aVal : 0
        const bNum = typeof bVal === "number" ? bVal : 0
        if (aNum < bNum) return sortDirection === "asc" ? -1 : 1
        if (aNum > bNum) return sortDirection === "asc" ? 1 : -1
      }

      const cls = a.className.localeCompare(b.className)
      if (cls !== 0) return cls
      if (a.rank !== b.rank) return a.rank - b.rank
      return a.driverName.localeCompare(b.driverName)
    })

    return list
  }, [filteredRows, sortField, sortDirection])

  const totalPages = Math.ceil(sortedRows.length / itemsPerPage) || 1
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedRows = sortedRows.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1)
  }, [classFilter, driverSearch, itemsPerPage, sortField, sortDirection])

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

  if (rows.length === 0) {
    return (
      <div
        className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 shadow-sm"
        style={{
          backgroundColor: "var(--glass-bg)",
          backdropFilter: "var(--glass-blur)",
          borderRadius: 16,
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--glass-shadow)",
        }}
      >
        <div className="px-4 py-3">
          <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
            Fastest Laps Per Class
          </h2>
          <p className="mt-1 text-sm text-[var(--token-text-secondary)]">
            No fastest lap data available for this event.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="w-full rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 shadow-sm"
      style={{
        backgroundColor: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        borderRadius: 16,
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      <div className="border-b border-[var(--token-border-default)] px-4 py-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
              {`Fastest Laps Per Class: ${headerClassLabel}`}
            </h2>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-0">
            <div className="flex items-center gap-2">
              <label
                htmlFor="event-top-fastest-class-filter"
                className="text-xs font-medium text-[var(--token-text-secondary)]"
              >
                Class
              </label>
              <select
                id="event-top-fastest-class-filter"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
              >
                <option value="">All classes</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="event-top-fastest-driver-filter"
                className="text-xs font-medium text-[var(--token-text-secondary)]"
              >
                Driver
              </label>
              <input
                id="event-top-fastest-driver-filter"
                type="text"
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                placeholder="Search driver name"
                className="w-40 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] placeholder:text-[var(--token-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        {sortedRows.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-[var(--token-text-secondary)]">
            No rows match the selected filters.
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]">
              <StandardTable>
                <StandardTableHeader>
                  <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-alt)]">
                    <StandardTableCell header>
                      <button
                        type="button"
                        onClick={() => handleSort("rank")}
                        className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                      >
                        Rank
                        <SortIcon field="rank" activeField={sortField} direction={sortDirection} />
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
                        onClick={() => handleSort("driverName")}
                        className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                      >
                        Driver
                        <SortIcon
                          field="driverName"
                          activeField={sortField}
                          direction={sortDirection}
                        />
                      </button>
                    </StandardTableCell>
                    <StandardTableCell header>
                      <button
                        type="button"
                        onClick={() => handleSort("lapTimeSeconds")}
                        className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                      >
                        Fastest Lap
                        <SortIcon
                          field="lapTimeSeconds"
                          activeField={sortField}
                          direction={sortDirection}
                        />
                      </button>
                    </StandardTableCell>
                    <StandardTableCell header>
                      <button
                        type="button"
                        onClick={() => handleSort("lapNumber")}
                        className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                      >
                        Lap #
                        <SortIcon
                          field="lapNumber"
                          activeField={sortField}
                          direction={sortDirection}
                        />
                      </button>
                    </StandardTableCell>
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
                  </tr>
                </StandardTableHeader>
                <tbody>
                  {paginatedRows.map((row, idx) => (
                    <StandardTableRow
                      key={`${row.className}-${row.driverId}-${row.rank}-${row.lapTimeSeconds}-${startIndex + idx}`}
                    >
                      <StandardTableCell className="tabular-nums">
                        {formatRankLabel(row.rank)}
                      </StandardTableCell>
                      <StandardTableCell className="text-[var(--token-text-secondary)]">
                        {row.className}
                      </StandardTableCell>
                      <StandardTableCell className="font-semibold">
                        {row.driverName}
                      </StandardTableCell>
                      <StandardTableCell className="tabular-nums">
                        {formatLapTime(row.lapTimeSeconds)}
                      </StandardTableCell>
                      <StandardTableCell className="tabular-nums">
                        {row.lapNumber ?? "—"}
                      </StandardTableCell>
                      <StandardTableCell className="text-[var(--token-text-secondary)]">
                        {row.raceLabel}
                      </StandardTableCell>
                    </StandardTableRow>
                  ))}
                </tbody>
              </StandardTable>
            </div>
            <div className="mt-4">
              <ListPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={sortedRows.length}
                itemLabel="results"
                onRowsPerPageChange={handleRowsPerPageChange}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
