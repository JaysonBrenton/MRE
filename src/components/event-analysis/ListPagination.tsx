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
  rowsPerPageOptions = [5, 10, 25, 50, 100],
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
    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-16">
      {/* Left side: Rows per page selector and showing text */}
      <div className="flex items-center gap-2">
        {onRowsPerPageChange && (
          <>
            <label htmlFor="pageSize" className="text-sm text-[var(--token-text-secondary)]">
              Rows per page:
            </label>
            <select
              id="pageSize"
              value={itemsPerPage}
              onChange={handleRowsPerPageChange}
              className="px-3 py-1 text-sm rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)]"
              aria-label="Rows per page"
            >
              {rowsPerPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </>
        )}
        <span className="text-sm text-[var(--token-text-secondary)] ml-4" aria-live="polite">
          Showing {startItem}-{endItem} of {totalItems} {itemLabel}
        </span>
      </div>

      {/* Right side: Page navigation controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFirst}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)]"
            aria-label="First page"
          >
            First
          </button>
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)]"
            aria-label="Previous page"
          >
            Previous
          </button>
          <span className="px-4 py-1 text-sm text-[var(--token-text-primary)]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)]"
            aria-label="Next page"
          >
            Next
          </button>
          <button
            type="button"
            onClick={handleLast}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)]"
            aria-label="Last page"
          >
            Last
          </button>
        </div>
      )}
    </div>
  )
}

