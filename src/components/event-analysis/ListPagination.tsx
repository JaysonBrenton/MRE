/**
 * @fileoverview List pagination component
 * 
 * @created 2025-01-29
 * @creator Jayson Brenton
 * @lastModified 2025-01-29
 * 
 * @description Pagination controls for lists and tables with many items
 * 
 * @purpose Provides navigation controls for paginated list/table views.
 *          Optimized for desktop viewports.
 * 
 * @spacing CRITICAL: This component includes `mb-16` (4rem / 64px) bottom margin to prevent footer overlap.
 *          DO NOT use `mb-8` - it's insufficient and will cause overlap.
 *          See docs/development/PAGINATION_SPACING_GUIDELINES.md for complete spacing requirements.
 * 
 * @relatedFiles
 * - src/components/event-analysis/DriverList.tsx (uses this)
 * - src/components/event-analysis/EntryList.tsx (uses this)
 * - docs/development/PAGINATION_SPACING_GUIDELINES.md (spacing requirements)
 * - src/components/event-analysis/ChartPagination.tsx (reference implementation)
 */

"use client"

export interface ListPaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  itemsPerPage: number
  totalItems: number
  itemLabel?: string
  rowsPerPageOptions?: number[]
  onRowsPerPageChange?: (rowsPerPage: number) => void
}

export default function ListPagination({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems,
  itemLabel = "items",
  rowsPerPageOptions = [10, 25, 50, 100],
  onRowsPerPageChange,
}: ListPaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  const handleFirst = () => {
    if (currentPage > 1) {
      onPageChange(1)
    }
  }

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  const handleLast = () => {
    if (currentPage < totalPages) {
      onPageChange(totalPages)
    }
  }

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value, 10)
    if (page >= 1 && page <= totalPages) {
      onPageChange(page)
    }
  }

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRowsPerPage = parseInt(e.target.value, 10)
    if (onRowsPerPageChange) {
      onRowsPerPageChange(newRowsPerPage)
    }
  }

  // Show pagination if there are multiple pages OR if rows-per-page selector is enabled
  if (totalPages <= 1 && !onRowsPerPageChange) {
    return null
  }

  return (
    <nav
      className="flex items-center justify-between gap-4 mt-4 mb-16 px-2"
      aria-label="List pagination"
    >
      <div className="text-sm text-[var(--token-text-secondary)]" aria-live="polite">
        Showing {startItem}-{endItem} of {totalItems} {itemLabel}
      </div>

      <div className="flex items-center gap-2">
        {/* Rows per page selector */}
        {onRowsPerPageChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--token-text-secondary)]">
              Rows per page:
            </span>
            <select
              value={itemsPerPage}
              onChange={handleRowsPerPageChange}
              className="px-3 py-2 text-sm rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              aria-label="Rows per page"
            >
              {rowsPerPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Page navigation controls - only show when there are multiple pages */}
        {totalPages > 1 && (
          <>
            {/* First button */}
            <button
              type="button"
              onClick={handleFirst}
              disabled={currentPage === 1}
              className="flex items-center justify-center px-3 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="First page"
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
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Previous button */}
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentPage === 1}
              className="flex items-center justify-center px-3 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
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
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Page input */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--token-text-secondary)]">
                Page
              </span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={handlePageInput}
                className="w-16 px-2 py-2 text-center text-sm rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                aria-label="Current page"
              />
              <span className="text-sm text-[var(--token-text-secondary)]">
                of {totalPages}
              </span>
            </div>

            {/* Next button */}
            <button
              type="button"
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className="flex items-center justify-center px-3 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
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
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            {/* Last button */}
            <button
              type="button"
              onClick={handleLast}
              disabled={currentPage === totalPages}
              className="flex items-center justify-center px-3 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Last page"
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
                  strokeWidth={2}
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              </svg>
            </button>
          </>
        )}
      </div>
    </nav>
  )
}

