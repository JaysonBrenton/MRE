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
import { formatLapTime, formatTotalTime, formatTimeUTC } from "@/lib/format-session-data"

type RaceSummary = EventAnalysisData["races"][number]
type RaceResultSummary = RaceSummary["results"][number]

interface WinnerRow {
  raceId: string
  raceLabel: string
  className: string
  sessionType: string
  raceOrder: number | null
  startTime: Date | null
  raceUrl: string
  winnerName: string
  secondPlaceName: string | null
  thirdPlaceName: string | null
  winnerLaps: number
  winnerTotalTimeSeconds: number | null
  winnerFastLapTime: number | null
  gapToP2Seconds: number | null
}

type SortField =
  | "raceOrder"
  | "startTime"
  | "raceLabel"
  | "className"
  | "sessionType"
  | "winnerName"
  | "winnerLaps"
  | "winnerTotalTimeSeconds"
  | "winnerFastLapTime"
  | "gapToP2Seconds"

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

function formatSessionTypeLabel(sessionType: string | null, sectionHeader: string | null): string {
  if (sectionHeader && sectionHeader.trim().length > 0) {
    return sectionHeader
  }

  if (!sessionType) {
    return "Race"
  }

  const normalized = sessionType.toLowerCase()
  switch (normalized) {
    case "practice":
      return "Practice"
    case "seeding":
      return "Seeding"
    case "qualifying":
      return "Qualifier"
    case "heat":
      return "Heat"
    case "main":
      return "Main"
    case "race":
      return "Race"
    case "practiceday":
      return "Practice Day"
    default:
      return sessionType
  }
}

function formatGapToP2(gapSeconds: number | null): string {
  if (gapSeconds == null) {
    return "—"
  }
  if (!Number.isFinite(gapSeconds)) {
    return "—"
  }
  if (gapSeconds <= 0) {
    return "0.000s"
  }
  return `+${gapSeconds.toFixed(3)}s`
}

export interface EventWinnersTableProps {
  races: EventAnalysisData["races"]
}

export default function EventWinnersTable({ races }: EventWinnersTableProps) {
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

  const winnerRows: WinnerRow[] = useMemo(() => {
    return races
      .map<WinnerRow | null>((race) => {
        const winner = race.results.find((r) => r.positionFinal === 1)
        if (!winner) {
          return null
        }
        const runnerUp = race.results.find((r) => r.positionFinal === 2) ?? null
        const thirdPlace = race.results.find((r) => r.positionFinal === 3) ?? null

        let gapToP2Seconds: number | null = null
        if (
          runnerUp &&
          winner.totalTimeSeconds != null &&
          runnerUp.totalTimeSeconds != null &&
          Number.isFinite(winner.totalTimeSeconds) &&
          Number.isFinite(runnerUp.totalTimeSeconds)
        ) {
          const diff = runnerUp.totalTimeSeconds - winner.totalTimeSeconds
          gapToP2Seconds = diff > 0 ? diff : 0
        }

        return {
          raceId: race.id,
          raceLabel: race.raceLabel,
          className: race.className,
          sessionType: formatSessionTypeLabel(race.sessionType, race.sectionHeader),
          raceOrder: race.raceOrder,
          startTime: race.startTime,
          raceUrl: race.raceUrl,
          winnerName: winner.driverName,
          secondPlaceName: runnerUp?.driverName ?? null,
          thirdPlaceName: thirdPlace?.driverName ?? null,
          winnerLaps: winner.lapsCompleted,
          winnerTotalTimeSeconds: winner.totalTimeSeconds,
          winnerFastLapTime: winner.fastLapTime,
          gapToP2Seconds,
        }
      })
      .filter((row): row is WinnerRow => row !== null)
  }, [races])

  const sessionOptions = useMemo(() => {
    const set = new Set<string>()
    winnerRows.forEach((row) => {
      if (row.sessionType) {
        set.add(row.sessionType)
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [winnerRows])

  const filteredRows = useMemo(() => {
    let rows = winnerRows

    if (sessionFilter) {
      rows = rows.filter((row) => row.sessionType === sessionFilter)
    }

    const search = driverSearch.trim().toLowerCase()
    if (search) {
      rows = rows.filter((row) => row.winnerName.toLowerCase().includes(search))
    }

    return rows
  }, [winnerRows, sessionFilter, driverSearch])

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
        case "winnerName":
          aVal = a.winnerName.toLowerCase()
          bVal = b.winnerName.toLowerCase()
          break
        case "winnerLaps":
          aVal = a.winnerLaps
          bVal = b.winnerLaps
          break
        case "winnerTotalTimeSeconds":
          aVal = a.winnerTotalTimeSeconds ?? Number.POSITIVE_INFINITY
          bVal = b.winnerTotalTimeSeconds ?? Number.POSITIVE_INFINITY
          break
        case "winnerFastLapTime":
          aVal = a.winnerFastLapTime ?? Number.POSITIVE_INFINITY
          bVal = b.winnerFastLapTime ?? Number.POSITIVE_INFINITY
          break
        case "gapToP2Seconds":
          aVal = a.gapToP2Seconds ?? Number.POSITIVE_INFINITY
          bVal = b.gapToP2Seconds ?? Number.POSITIVE_INFINITY
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

  if (winnerRows.length === 0) {
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
          <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">Race Winners</h2>
          <p className="mt-1 text-sm text-[var(--token-text-secondary)]">
            No race winners available for this event.
          </p>
        </div>
      </div>
    )
  }

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
      <div className="px-4 py-3 border-b border-[var(--token-border-default)]">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
              {`Session Results: ${headerClassLabel}`}
            </h2>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-0">
            <div className="flex items-center gap-2">
              <label
                htmlFor="winners-session-filter"
                className="text-xs font-medium text-[var(--token-text-secondary)]"
              >
                Session
              </label>
              <select
                id="winners-session-filter"
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
                htmlFor="winners-driver-filter"
                className="text-xs font-medium text-[var(--token-text-secondary)]"
              >
                Driver
              </label>
              <input
                id="winners-driver-filter"
                type="text"
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                placeholder="Search winner name"
                className="w-40 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] placeholder:text-[var(--token-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        {sortedRows.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-[var(--token-text-secondary)]">
            No races match the selected filters.
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-[var(--token-border-default)] overflow-hidden bg-[var(--token-surface-elevated)]">
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
                    <StandardTableCell header>
                      <button
                        type="button"
                        onClick={() => handleSort("winnerName")}
                        className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                        style={{ color: "#FFD700" }}
                      >
                        1st Place
                        <SortIcon
                          field="winnerName"
                          activeField={sortField}
                          direction={sortDirection}
                        />
                      </button>
                    </StandardTableCell>
                    <StandardTableCell header>
                      <span style={{ color: "#C0C0C0" }}>2nd Place</span>
                    </StandardTableCell>
                    <StandardTableCell header>
                      <span style={{ color: "#CD7F32" }}>3rd Place</span>
                    </StandardTableCell>
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
                        {row.sessionType}
                      </StandardTableCell>
                      <StandardTableCell className="text-[var(--token-text-secondary)]">
                        {formatTimeUTC(row.startTime)}
                      </StandardTableCell>
                      <StandardTableCell className="font-semibold" style={{ color: "#FFD700" }}>
                        {row.winnerName}
                      </StandardTableCell>
                      <StandardTableCell style={{ color: "#C0C0C0" }}>
                        {row.secondPlaceName ?? "—"}
                      </StandardTableCell>
                      <StandardTableCell style={{ color: "#CD7F32" }}>
                        {row.thirdPlaceName ?? "—"}
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
                itemLabel="races"
                rowsPerPageOptions={[10, 25, 50, 100]}
                onRowsPerPageChange={handleRowsPerPageChange}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
