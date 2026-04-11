"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"
import Modal from "@/components/molecules/Modal"
import ListPagination from "./ListPagination"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { formatLapTime, formatTimeUTC } from "@/lib/format-session-data"
import { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/lib/table-pagination"

type RaceSummary = EventAnalysisData["races"][number]
type RaceResultSummary = RaceSummary["results"][number]

interface FastestLapRow {
  raceId: string
  raceLabel: string
  className: string
  sessionType: string
  raceOrder: number | null
  startTime: Date | null
  raceUrl: string
  driverName: string
  lapTimeSeconds: number
  lapNumber: number | null
}

type SortField =
  | "raceOrder"
  | "startTime"
  | "raceLabel"
  | "className"
  | "sessionType"
  | "driverName"
  | "lapTimeSeconds"
  | "lapNumber"

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

/** Every driver's fastest lap in a race, fastest first (for session detail modal). */
function fastestLapBreakdownForRace(race: RaceSummary) {
  const rows: Array<{
    raceResultId: string
    driverName: string
    lapTimeSeconds: number
    lapNumber: number | null
  }> = []
  for (const r of race.results) {
    if (r.fastLapTime == null || r.fastLapTime <= 0) continue
    rows.push({
      raceResultId: r.raceResultId,
      driverName: r.driverName,
      lapTimeSeconds: r.fastLapTime,
      lapNumber: r.fastLapLapNumber ?? null,
    })
  }
  rows.sort((a, b) => {
    if (a.lapTimeSeconds !== b.lapTimeSeconds) return a.lapTimeSeconds - b.lapTimeSeconds
    return a.driverName.localeCompare(b.driverName)
  })
  return rows
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

export interface EventFastestLapsTableProps {
  races: EventAnalysisData["races"]
}

export default function EventFastestLapsTable({ races }: EventFastestLapsTableProps) {
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
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)
  const [detailRaceId, setDetailRaceId] = useState<string | null>(null)
  const [modalPage, setModalPage] = useState(1)
  const [modalItemsPerPage, setModalItemsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)

  const fastestLapRows: FastestLapRow[] = useMemo(() => {
    const rows: FastestLapRow[] = []

    races.forEach((race: RaceSummary) => {
      // Find best (lowest) valid fastLapTime in this race
      let best: RaceResultSummary | null = null
      for (const result of race.results) {
        if (result.fastLapTime == null || result.fastLapTime <= 0) continue
        if (!best || (result.fastLapTime ?? Infinity) < (best.fastLapTime ?? Infinity)) {
          best = result
        }
      }

      if (!best || best.fastLapTime == null) {
        return
      }

      rows.push({
        raceId: race.id,
        raceLabel: race.raceLabel,
        className: race.className,
        sessionType: formatSessionTypeLabel(race.sessionType, race.sectionHeader),
        raceOrder: race.raceOrder,
        startTime: race.startTime,
        raceUrl: race.raceUrl,
        driverName: best.driverName,
        lapTimeSeconds: best.fastLapTime,
        lapNumber: best.fastLapLapNumber ?? null,
      })
    })

    return rows
  }, [races])

  const sessionOptions = useMemo(() => {
    const set = new Set<string>()
    fastestLapRows.forEach((row) => {
      if (row.sessionType) {
        set.add(row.sessionType)
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [fastestLapRows])

  const filteredRows = useMemo(() => {
    let rows = fastestLapRows

    if (sessionFilter) {
      rows = rows.filter((row) => row.sessionType === sessionFilter)
    }

    const search = driverSearch.trim().toLowerCase()
    if (search) {
      rows = rows.filter((row) => row.driverName.toLowerCase().includes(search))
    }

    return rows
  }, [fastestLapRows, sessionFilter, driverSearch])

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

  const detailRace = useMemo(() => {
    if (!detailRaceId) return null
    return races.find((r) => r.id === detailRaceId) ?? null
  }, [races, detailRaceId])

  useEffect(() => {
    if (detailRaceId && !detailRace) {
      queueMicrotask(() => setDetailRaceId(null))
    }
  }, [detailRaceId, detailRace])

  const breakdownRows = useMemo(() => {
    if (!detailRace) return []
    return fastestLapBreakdownForRace(detailRace)
  }, [detailRace])

  const modalRowCount = breakdownRows.length
  const modalTotalPages = Math.max(1, Math.ceil(modalRowCount / modalItemsPerPage) || 1)
  const modalStartIndex = (modalPage - 1) * modalItemsPerPage
  const paginatedBreakdown = useMemo(
    () => breakdownRows.slice(modalStartIndex, modalStartIndex + modalItemsPerPage),
    [breakdownRows, modalStartIndex, modalItemsPerPage]
  )

  const detailModalKey = detailRaceId ?? ""

  useEffect(() => {
    if (!detailModalKey) return
    queueMicrotask(() => setModalPage(1))
  }, [detailModalKey])

  useEffect(() => {
    if (!detailRaceId) return
    if (modalPage > modalTotalPages) {
      queueMicrotask(() => setModalPage(modalTotalPages))
    }
  }, [detailRaceId, modalPage, modalTotalPages])

  const handleModalRowsPerPageChange = useCallback((next: number) => {
    setModalItemsPerPage(next)
    setModalPage(1)
  }, [])

  const closeDetail = useCallback(() => setDetailRaceId(null), [])

  const detailSubtitle = useMemo(() => {
    if (!detailRace) return null
    const sessionLabel = formatSessionTypeLabel(detailRace.sessionType, detailRace.sectionHeader)
    const timeLabel = formatTimeUTC(detailRace.startTime)
    return (
      <span className="block space-y-0.5">
        <span className="block truncate">
          {detailRace.className} · {detailRace.raceLabel}
        </span>
        <span className="block truncate text-sm font-normal text-[var(--token-text-secondary)]">
          {sessionLabel}
          {timeLabel ? ` · ${timeLabel}` : ""}
        </span>
      </span>
    )
  }, [detailRace])

  if (fastestLapRows.length === 0) {
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
          <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">Fastest Laps</h2>
          <p className="mt-1 text-sm text-[var(--token-text-secondary)]">
            No fastest lap data available for this event.
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
              {`Fastest Laps: ${headerClassLabel}`}
            </h2>
            {sortedRows.length > 0 && (
              <p className="mt-1 text-sm text-[var(--token-text-secondary)]">
                Click a row for every driver&apos;s fastest lap in that session.
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-0">
            <div className="flex items-center gap-2">
              <label
                htmlFor="fastest-session-filter"
                className="text-xs font-medium text-[var(--token-text-secondary)]"
              >
                Session
              </label>
              <select
                id="fastest-session-filter"
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
                htmlFor="fastest-driver-filter"
                className="text-xs font-medium text-[var(--token-text-secondary)]"
              >
                Driver
              </label>
              <input
                id="fastest-driver-filter"
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
                  </tr>
                </StandardTableHeader>
                <tbody>
                  {paginatedRows.map((row) => (
                    <StandardTableRow
                      key={row.raceId}
                      tabIndex={0}
                      aria-label={`View all fastest laps for ${row.className} ${row.raceLabel}`}
                      onClick={() => setDetailRaceId(row.raceId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setDetailRaceId(row.raceId)
                        }
                      }}
                    >
                      <StandardTableCell>
                        {row.raceUrl ? (
                          <a
                            href={row.raceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--token-accent)] underline-offset-2 hover:underline"
                            onClick={(e) => e.stopPropagation()}
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
                        {row.driverName}
                      </StandardTableCell>
                      <StandardTableCell className="tabular-nums">
                        {formatLapTime(row.lapTimeSeconds)}
                      </StandardTableCell>
                      <StandardTableCell className="tabular-nums">
                        {row.lapNumber ?? "—"}
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
                onRowsPerPageChange={handleRowsPerPageChange}
              />
            </div>
          </>
        )}
      </div>

      {detailRace && (
        <Modal
          isOpen
          onClose={closeDetail}
          title="Fastest laps by driver"
          subtitle={detailSubtitle}
          maxWidth="3xl"
          footer={
            detailRace.raceUrl ? (
              <a
                href={detailRace.raceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--token-accent)] underline-offset-2 hover:underline"
              >
                Open session on LiveRC
              </a>
            ) : undefined
          }
        >
          <div className="space-y-3">
            {breakdownRows.length === 0 ? (
              <p className="text-sm text-[var(--token-text-secondary)]">
                No drivers with a recorded fastest lap in this session.
              </p>
            ) : (
              <>
                <p className="text-sm text-[var(--token-text-secondary)]">
                  Each driver&apos;s best lap in this session, fastest first.
                </p>
                <StandardTable>
                  <StandardTableHeader>
                    <StandardTableRow className="border-b border-[var(--token-border-default)]">
                      <StandardTableCell
                        header
                        className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                      >
                        Rank
                      </StandardTableCell>
                      <StandardTableCell
                        header
                        className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                      >
                        Driver
                      </StandardTableCell>
                      <StandardTableCell
                        header
                        className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                      >
                        Fastest lap
                      </StandardTableCell>
                      <StandardTableCell
                        header
                        className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                      >
                        Lap #
                      </StandardTableCell>
                    </StandardTableRow>
                  </StandardTableHeader>
                  <tbody>
                    {paginatedBreakdown.map((entry, i) => (
                      <StandardTableRow key={entry.raceResultId}>
                        <StandardTableCell className="px-3 py-2 text-sm tabular-nums text-[var(--token-text-primary)]">
                          {modalStartIndex + i + 1}
                        </StandardTableCell>
                        <StandardTableCell className="px-3 py-2 text-sm text-[var(--token-text-primary)]">
                          {entry.driverName}
                        </StandardTableCell>
                        <StandardTableCell className="px-3 py-2 text-sm tabular-nums text-[var(--token-text-secondary)]">
                          {formatLapTime(entry.lapTimeSeconds)}
                        </StandardTableCell>
                        <StandardTableCell className="px-3 py-2 text-sm tabular-nums text-[var(--token-text-secondary)]">
                          {entry.lapNumber ?? "—"}
                        </StandardTableCell>
                      </StandardTableRow>
                    ))}
                  </tbody>
                </StandardTable>
                <div className="min-w-0 w-full max-w-full pt-2">
                  <ListPagination
                    currentPage={modalPage}
                    totalPages={modalTotalPages}
                    onPageChange={setModalPage}
                    itemsPerPage={modalItemsPerPage}
                    totalItems={modalRowCount}
                    itemLabel="drivers"
                    onRowsPerPageChange={handleModalRowsPerPageChange}
                    embedded
                  />
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
