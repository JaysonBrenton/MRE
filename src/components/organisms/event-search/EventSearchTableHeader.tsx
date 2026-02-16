/**
 * @fileoverview Shared table header for event search results
 *
 * @description Displays column headings (Event Name, Event Status, Event Date, Actions)
 *              used by both event and practice day results. Supports optional sorting
 *              for the events table.
 *
 * @relatedFiles
 * - src/components/organisms/event-search/EventTable.tsx
 * - src/components/organisms/event-search/EventRow.tsx
 * - src/components/organisms/practice-days/PracticeDayRow.tsx
 */

"use client"

export type SortField = "date" | "name" | "status"
export type SortDirection = "asc" | "desc"

export interface EventSearchTableHeaderProps {
  /** When provided, name/status/date columns are sortable buttons */
  sortField?: SortField
  sortDirection?: SortDirection
  onSort?: (field: SortField) => void
}

const GRID_CLASS =
  "grid grid-cols-[2.5fr_1fr_1fr_1.5fr] gap-4 px-4 py-3 border-b border-[var(--token-border-default)]"

export default function EventSearchTableHeader({
  sortField,
  sortDirection,
  onSort,
}: EventSearchTableHeaderProps) {
  const sortable = typeof sortField !== "undefined" && typeof sortDirection !== "undefined" && onSort

  return (
    <div className={GRID_CLASS} role="row">
      <div
        className="text-left"
        aria-sort={
          sortable && sortField === "name"
            ? sortDirection === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
      >
        {sortable ? (
          <button
            type="button"
            onClick={() => onSort!("name")}
            className="text-left text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
            aria-label={`Sort by event name ${sortField === "name" ? (sortDirection === "asc" ? "ascending" : "descending") : ""}`}
          >
            Event Name
            {sortField === "name" && (
              <span className="ml-2" aria-hidden="true">
                {sortDirection === "asc" ? "↑" : "↓"}
              </span>
            )}
          </button>
        ) : (
          <span className="text-sm font-medium text-[var(--token-text-secondary)]">Event Name</span>
        )}
      </div>
      <div
        className="text-center"
        aria-sort={
          sortable && sortField === "status"
            ? sortDirection === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
      >
        {sortable ? (
          <button
            type="button"
            onClick={() => onSort!("status")}
            className="text-center text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
            aria-label={`Sort by event status ${sortField === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : ""}`}
          >
            Event Status
            {sortField === "status" && (
              <span className="ml-2" aria-hidden="true">
                {sortDirection === "asc" ? "↑" : "↓"}
              </span>
            )}
          </button>
        ) : (
          <span className="text-sm font-medium text-[var(--token-text-secondary)]">
            Event Status
          </span>
        )}
      </div>
      <div
        className="text-center"
        aria-sort={
          sortable && sortField === "date"
            ? sortDirection === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
      >
        {sortable ? (
          <button
            type="button"
            onClick={() => onSort!("date")}
            className="text-center text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
            aria-label={`Sort by event date ${sortField === "date" ? (sortDirection === "asc" ? "ascending" : "descending") : ""}`}
          >
            Event Date
            {sortField === "date" && (
              <span className="ml-2" aria-hidden="true">
                {sortDirection === "asc" ? "↑" : "↓"}
              </span>
            )}
          </button>
        ) : (
          <span className="text-sm font-medium text-[var(--token-text-secondary)]">
            Event Date
          </span>
        )}
      </div>
      <div className="text-sm font-medium text-[var(--token-text-secondary)] text-center">
        <span aria-label="Actions column">Actions</span>
      </div>
    </div>
  )
}
