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
import { computeMostImprovedPerClass } from "@/core/events/event-most-improved-per-class"
import { formatPositionImprovement, formatLapTimeImprovement } from "@/lib/date-utils"
import DataPanelSurface, {
  DataTableFrame,
} from "@/components/organisms/event-analysis/DataPanelSurface"

export interface EventTopMostImprovedPerClassTableProps {
  races: EventAnalysisData["races"]
  isPracticeDay?: boolean
}

interface TableRow {
  rank: number
  className: string
  driverId: string
  driverName: string
  firstRacePosition: number
  lastRacePosition: number
  positionImprovement: number
  lapTimeImprovement: number | null
  improvementScore: number
  firstRaceLabel: string
  lastRaceLabel: string
}

type SortField =
  | "rank"
  | "className"
  | "driverName"
  | "improvementScore"
  | "positionImprovement"
  | "lapTimeImprovement"
  | "firstRaceLabel"
  | "lastRaceLabel"

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

export default function EventTopMostImprovedPerClassTable({
  races,
  isPracticeDay = false,
}: EventTopMostImprovedPerClassTableProps) {
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
    const groups = computeMostImprovedPerClass(races, isPracticeDay)
    const flat: TableRow[] = []
    for (const { className, entries } of groups) {
      for (const e of entries) {
        flat.push({
          rank: e.rank,
          className,
          driverId: e.driverId,
          driverName: e.driverName,
          firstRacePosition: e.firstRacePosition,
          lastRacePosition: e.lastRacePosition,
          positionImprovement: e.positionImprovement,
          lapTimeImprovement: e.lapTimeImprovement,
          improvementScore: e.improvementScore,
          firstRaceLabel: e.firstRaceLabel,
          lastRaceLabel: e.lastRaceLabel,
        })
      }
    }
    return flat
  }, [races, isPracticeDay])

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
        case "improvementScore":
          aVal = a.improvementScore
          bVal = b.improvementScore
          break
        case "positionImprovement":
          aVal = a.positionImprovement
          bVal = b.positionImprovement
          break
        case "lapTimeImprovement":
          aVal = a.lapTimeImprovement ?? Number.NEGATIVE_INFINITY
          bVal = b.lapTimeImprovement ?? Number.NEGATIVE_INFINITY
          break
        case "firstRaceLabel":
          aVal = a.firstRaceLabel.toLowerCase()
          bVal = b.firstRaceLabel.toLowerCase()
          break
        case "lastRaceLabel":
          aVal = a.lastRaceLabel.toLowerCase()
          bVal = b.lastRaceLabel.toLowerCase()
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
      <DataPanelSurface
        title="Most Improved Drivers Per Class"
        subtitle="No improvement data available for this event."
        contentClassName="px-4 py-3"
      />
    )
  }

  return (
    <DataPanelSurface
      title={`Most Improved Drivers Per Class: ${headerClassLabel}`}
      headerControls={
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="event-top-mi-class-filter"
              className="text-xs font-medium text-[var(--token-text-secondary)]"
            >
              Class
            </label>
            <select
              id="event-top-mi-class-filter"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
            >
              <option value="">All Classes</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="event-top-mi-driver-filter"
              className="text-xs font-medium text-[var(--token-text-secondary)]"
            >
              Driver
            </label>
            <input
              id="event-top-mi-driver-filter"
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
          No rows match the selected filters.
        </div>
      ) : (
        <>
          <DataTableFrame className="scrollbar-none">
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
                      onClick={() => handleSort("positionImprovement")}
                      className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    >
                      Position
                      <SortIcon
                        field="positionImprovement"
                        activeField={sortField}
                        direction={sortDirection}
                      />
                    </button>
                  </StandardTableCell>
                  <StandardTableCell header>
                    <button
                      type="button"
                      onClick={() => handleSort("lapTimeImprovement")}
                      className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    >
                      Lap Δ
                      <SortIcon
                        field="lapTimeImprovement"
                        activeField={sortField}
                        direction={sortDirection}
                      />
                    </button>
                  </StandardTableCell>
                  <StandardTableCell header>
                    <button
                      type="button"
                      onClick={() => handleSort("firstRaceLabel")}
                      className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    >
                      First race
                      <SortIcon
                        field="firstRaceLabel"
                        activeField={sortField}
                        direction={sortDirection}
                      />
                    </button>
                  </StandardTableCell>
                  <StandardTableCell header>
                    <button
                      type="button"
                      onClick={() => handleSort("lastRaceLabel")}
                      className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    >
                      Last race
                      <SortIcon
                        field="lastRaceLabel"
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
                    key={`${row.className}-${row.driverId}-${row.rank}-${row.improvementScore}-${startIndex + idx}`}
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
                    <StandardTableCell className="max-w-[14rem] text-sm">
                      {formatPositionImprovement(row.firstRacePosition, row.lastRacePosition)}
                    </StandardTableCell>
                    <StandardTableCell className="tabular-nums text-sm">
                      {row.lapTimeImprovement != null
                        ? formatLapTimeImprovement(row.lapTimeImprovement)
                        : "—"}
                    </StandardTableCell>
                    <StandardTableCell className="max-w-[12rem] text-[var(--token-text-secondary)] text-sm">
                      {row.firstRaceLabel}
                    </StandardTableCell>
                    <StandardTableCell className="max-w-[12rem] text-[var(--token-text-secondary)] text-sm">
                      {row.lastRaceLabel}
                    </StandardTableCell>
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
              itemLabel="results"
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          </div>
        </>
      )}
    </DataPanelSurface>
  )
}
