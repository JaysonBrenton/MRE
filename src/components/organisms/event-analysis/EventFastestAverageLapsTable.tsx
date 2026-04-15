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
import DataPanelSurface, {
  DataTableFrame,
} from "@/components/organisms/event-analysis/DataPanelSurface"
import { typography } from "@/lib/typography"
import {
  sessionTypeFilterKeyForRace,
  sessionTypeFilterChipLabel,
} from "@/core/events/session-type-filter"

type RaceSummary = EventAnalysisData["races"][number]
type RaceResultSummary = RaceSummary["results"][number]

interface FastestAverageLapRow {
  raceId: string
  raceLabel: string
  className: string
  sessionType: string
  raceOrder: number | null
  startTime: Date | null
  raceUrl: string
  driverName: string
  avgLapSeconds: number
  lapsCompleted: number
}

type SortField =
  | "raceOrder"
  | "startTime"
  | "raceLabel"
  | "className"
  | "sessionType"
  | "driverName"
  | "avgLapSeconds"
  | "lapsCompleted"

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

/** Every driver's average lap in a race, best (lowest) average first (for session detail modal). */
function averageLapBreakdownForRace(race: RaceSummary) {
  const rows: Array<{
    raceResultId: string
    driverName: string
    avgLapSeconds: number
    lapsCompleted: number
  }> = []
  for (const r of race.results) {
    if (r.avgLapTime == null || r.avgLapTime <= 0) continue
    rows.push({
      raceResultId: r.raceResultId,
      driverName: r.driverName,
      avgLapSeconds: r.avgLapTime,
      lapsCompleted: r.lapsCompleted,
    })
  }
  rows.sort((a, b) => {
    if (a.avgLapSeconds !== b.avgLapSeconds) return a.avgLapSeconds - b.avgLapSeconds
    return a.driverName.localeCompare(b.driverName)
  })
  return rows
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

export interface EventFastestAverageLapsTableProps {
  races: EventAnalysisData["races"]
}

export default function EventFastestAverageLapsTable({ races }: EventFastestAverageLapsTableProps) {
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

  const fastestAverageRows: FastestAverageLapRow[] = useMemo(() => {
    const rows: FastestAverageLapRow[] = []

    races.forEach((race: RaceSummary) => {
      // Find best (lowest) valid avgLapTime in this race
      let best: RaceResultSummary | null = null
      for (const result of race.results) {
        if (result.avgLapTime == null || result.avgLapTime <= 0) continue
        if (!best || result.avgLapTime < (best.avgLapTime ?? Number.POSITIVE_INFINITY)) {
          best = result
        }
      }

      if (!best || best.avgLapTime == null) {
        return
      }

      rows.push({
        raceId: race.id,
        raceLabel: race.raceLabel,
        className: race.className,
        sessionType: formatSessionTypeLabel(race),
        raceOrder: race.raceOrder,
        startTime: race.startTime,
        raceUrl: race.raceUrl,
        driverName: best.driverName,
        avgLapSeconds: best.avgLapTime,
        lapsCompleted: best.lapsCompleted,
      })
    })

    return rows
  }, [races])

  const sessionOptions = useMemo(() => {
    const set = new Set<string>()
    fastestAverageRows.forEach((row) => {
      if (row.sessionType) {
        set.add(row.sessionType)
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [fastestAverageRows])

  const filteredRows = useMemo(() => {
    let rows = fastestAverageRows

    if (sessionFilter) {
      rows = rows.filter((row) => row.sessionType === sessionFilter)
    }

    const search = driverSearch.trim().toLowerCase()
    if (search) {
      rows = rows.filter((row) => row.driverName.toLowerCase().includes(search))
    }

    return rows
  }, [fastestAverageRows, sessionFilter, driverSearch])

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
        case "avgLapSeconds":
          aVal = a.avgLapSeconds
          bVal = b.avgLapSeconds
          break
        case "lapsCompleted":
          aVal = a.lapsCompleted
          bVal = b.lapsCompleted
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
    return averageLapBreakdownForRace(detailRace)
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
    const sessionLabel = formatSessionTypeLabel(detailRace)
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

  if (fastestAverageRows.length === 0) {
    return (
      <DataPanelSurface
        title="Fastest Average Laps"
        subtitle="No fastest average lap data available for this event."
        contentClassName="px-4 py-3"
      />
    )
  }

  return (
    <>
      <DataPanelSurface
        title={`Fastest Average Laps: ${headerClassLabel}`}
        subtitle={
          sortedRows.length > 0
            ? "Click a row for every driver's average lap in that session."
            : null
        }
        headerControls={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="fastest-avg-session-filter"
                className="text-xs font-medium text-[var(--token-text-secondary)]"
              >
                Session
              </label>
              <select
                id="fastest-avg-session-filter"
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
                htmlFor="fastest-avg-driver-filter"
                className="text-xs font-medium text-[var(--token-text-secondary)]"
              >
                Driver
              </label>
              <input
                id="fastest-avg-driver-filter"
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
                        onClick={() => handleSort("avgLapSeconds")}
                        className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                      >
                        Avg Lap
                        <SortIcon
                          field="avgLapSeconds"
                          activeField={sortField}
                          direction={sortDirection}
                        />
                      </button>
                    </StandardTableCell>
                    <StandardTableCell header>
                      <button
                        type="button"
                        onClick={() => handleSort("lapsCompleted")}
                        className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                      >
                        Laps
                        <SortIcon
                          field="lapsCompleted"
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
                      aria-label={`View all average laps for ${row.className} ${row.raceLabel}`}
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
                        {formatLapTime(row.avgLapSeconds)}
                      </StandardTableCell>
                      <StandardTableCell className="tabular-nums">
                        {row.lapsCompleted}
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
                itemLabel="races"
                onRowsPerPageChange={handleRowsPerPageChange}
              />
            </div>
          </>
        )}
      </DataPanelSurface>

      {detailRace && (
        <Modal
          isOpen
          onClose={closeDetail}
          title="Average laps by driver"
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
                No drivers with a recorded average lap in this session.
              </p>
            ) : (
              <>
                <p className="text-sm text-[var(--token-text-secondary)]">
                  Each driver&apos;s average lap time in this session, lowest average first.
                </p>
                <DataTableFrame>
                  <StandardTable>
                    <StandardTableHeader>
                      <StandardTableRow className="border-b border-[var(--token-border-default)]">
                        <StandardTableCell
                          header
                          className={`px-3 py-2 text-left ${typography.tableHeader}`}
                        >
                          Rank
                        </StandardTableCell>
                        <StandardTableCell
                          header
                          className={`px-3 py-2 text-left ${typography.tableHeader}`}
                        >
                          Driver
                        </StandardTableCell>
                        <StandardTableCell
                          header
                          className={`px-3 py-2 text-left ${typography.tableHeader}`}
                        >
                          Avg lap
                        </StandardTableCell>
                        <StandardTableCell
                          header
                          className={`px-3 py-2 text-left ${typography.tableHeader}`}
                        >
                          Laps
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
                            {formatLapTime(entry.avgLapSeconds)}
                          </StandardTableCell>
                          <StandardTableCell className="px-3 py-2 text-sm tabular-nums text-[var(--token-text-secondary)]">
                            {entry.lapsCompleted}
                          </StandardTableCell>
                        </StandardTableRow>
                      ))}
                    </tbody>
                  </StandardTable>
                </DataTableFrame>
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
    </>
  )
}
