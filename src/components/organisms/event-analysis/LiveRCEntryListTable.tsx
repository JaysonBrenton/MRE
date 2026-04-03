/**
 * @fileoverview LiveRC entry list table for Drivers & Classes tab
 *
 * @description Fetches and displays the event entry list from LiveRC with
 *              driver name and class filters. Data is loaded via the entry-list API.
 *
 * @relatedFiles
 * - src/app/api/v1/events/[eventId]/entry-list/route.ts
 * - src/components/organisms/event-analysis/DriversTab.tsx
 */

"use client"

import { useState, useEffect, useMemo } from "react"
import ChartContainer from "./ChartContainer"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"
import ListPagination from "./ListPagination"

export interface LiveRCEntryListTableProps {
  eventId: string
}

interface EntryRow {
  class_name: string
  driver_name: string
  car_number: string | null
  transponder_number: string | null
}

interface EntryListApiResponse {
  source_event_id: string
  entries_by_class: Record<string, EntryRow[]>
  class_order: string[]
}

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100]

export default function LiveRCEntryListTable({ eventId }: LiveRCEntryListTableProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<EntryListApiResponse | null>(null)

  const [driverFilter, setDriverFilter] = useState("")
  const [classFilter, setClassFilter] = useState<string>("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
      setData(null)
    })

    fetch(`/api/v1/events/${eventId}/entry-list`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          const code = json?.error?.code
          const msg = json?.error?.message || res.statusText || "Failed to load entry list"
          if (res.status === 400 && code === "ENTRY_LIST_NOT_AVAILABLE") {
            setError("Entry list is only available for LiveRC events.")
          } else {
            setError(msg)
          }
          setLoading(false)
          return
        }
        return res.json()
      })
      .then((json) => {
        if (cancelled || !json) return
        if (json?.success && json?.data) {
          setData(json.data)
        } else {
          setError("Invalid response")
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load entry list")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [eventId])

  const flatEntries = useMemo(() => {
    if (!data?.entries_by_class) return []
    const out: EntryRow[] = []
    const order = data.class_order?.length ? data.class_order : Object.keys(data.entries_by_class)
    for (const className of order) {
      const drivers = data.entries_by_class[className] ?? []
      for (const d of drivers) {
        out.push({
          class_name: className,
          driver_name: d.driver_name,
          car_number: d.car_number,
          transponder_number: d.transponder_number,
        })
      }
    }
    return out
  }, [data])

  const filteredEntries = useMemo(() => {
    const driverLower = driverFilter.trim().toLowerCase()
    const hasDriverFilter = driverLower.length > 0
    const hasClassFilter = classFilter.trim().length > 0
    if (!hasDriverFilter && !hasClassFilter) return flatEntries
    return flatEntries.filter((row) => {
      if (hasClassFilter && row.class_name !== classFilter) return false
      if (hasDriverFilter && !row.driver_name.toLowerCase().includes(driverLower)) return false
      return true
    })
  }, [flatEntries, driverFilter, classFilter])

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedEntries = filteredEntries.slice(startIndex, startIndex + itemsPerPage)

  const classOptions = useMemo(() => {
    if (!data?.class_order?.length) return Object.keys(data?.entries_by_class ?? {})
    return data.class_order
  }, [data])

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1))
  }, [driverFilter, classFilter, itemsPerPage])

  if (loading) {
    return (
      <ChartContainer title="Entry List" aria-label="Entry list from LiveRC - loading">
        <div className="flex items-center justify-center min-h-[200px] text-[var(--token-text-secondary)]">
          Loading entry list from LiveRC…
        </div>
      </ChartContainer>
    )
  }

  if (error) {
    return (
      <ChartContainer title="Entry List" aria-label="Entry list from LiveRC - error">
        <div className="flex items-center justify-center min-h-[200px] text-[var(--token-text-secondary)]">
          <p>{error}</p>
        </div>
      </ChartContainer>
    )
  }

  if (!data || flatEntries.length === 0) {
    return (
      <ChartContainer title="Entry List" aria-label="Entry list from LiveRC - no data">
        <div className="flex items-center justify-center min-h-[200px] text-[var(--token-text-secondary)]">
          No entry list data available for this event.
        </div>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer
      title="Entry List"
      description="Drivers and classes from LiveRC. Use filters to find a driver or class."
      aria-label="Entry list with driver name and class filters"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--token-text-primary)]">
              Find a driver
            </span>
            <input
              type="search"
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              placeholder="Driver name…"
              className="min-w-[12rem] rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-3 py-2 text-[var(--token-text-primary)] placeholder:text-[var(--token-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
              aria-label="Filter by driver name"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--token-text-primary)]">Class</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="min-w-[12rem] rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-3 py-2 text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
              aria-label="Filter by class"
            >
              <option value="">All classes</option>
              {classOptions.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-lg border border-[var(--token-border-default)] overflow-hidden bg-[var(--token-surface-elevated)]">
          <StandardTable>
            <StandardTableHeader>
              <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-alt)]">
                <StandardTableCell header>#</StandardTableCell>
                <StandardTableCell header>Driver</StandardTableCell>
                <StandardTableCell header>Class</StandardTableCell>
                <StandardTableCell header>Transponder #</StandardTableCell>
              </tr>
            </StandardTableHeader>
            <tbody>
              {paginatedEntries.map((row, i) => (
                <StandardTableRow key={`${row.class_name}-${row.driver_name}-${i}`}>
                  <StandardTableCell className="text-[var(--token-text-secondary)]">
                    {row.car_number ?? startIndex + i + 1}
                  </StandardTableCell>
                  <StandardTableCell>{row.driver_name}</StandardTableCell>
                  <StandardTableCell className="text-[var(--token-text-secondary)]">
                    {row.class_name}
                  </StandardTableCell>
                  <StandardTableCell className="text-[var(--token-text-secondary)]">
                    {row.transponder_number ?? "—"}
                  </StandardTableCell>
                </StandardTableRow>
              ))}
            </tbody>
          </StandardTable>
        </div>

        <ListPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          totalItems={filteredEntries.length}
          itemLabel="entries"
          rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          onRowsPerPageChange={setItemsPerPage}
        />
      </div>
    </ChartContainer>
  )
}
