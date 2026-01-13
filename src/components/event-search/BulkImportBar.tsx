/**
 * @fileoverview Bulk import action bar component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Action bar that appears when events are selected for bulk import
 * 
 * @purpose Provides bulk import actions including import button, select all,
 *          and clear selection. Shows import progress during bulk operations.
 * 
 * @relatedFiles
 * - src/components/event-search/EventSearchContainer.tsx (parent component)
 */

"use client"

export interface BulkImportBarProps {
  selectedCount: number
  importableCount: number
  isImporting: boolean
  importProgress?: { current: number; total: number } | null
  onImport: () => void
  onSelectAll: () => void
  onClearSelection: () => void
}

export default function BulkImportBar({
  selectedCount,
  importableCount,
  isImporting,
  importProgress,
  onImport,
  onSelectAll,
  onClearSelection,
}: BulkImportBarProps) {
  if (selectedCount === 0) {
    return null
  }

  return (
    <div className="mt-4 p-4 bg-[var(--token-surface-elevated)] border border-[var(--token-border-default)] rounded-lg transition-all duration-200">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-[var(--token-text-primary)] font-medium">
            {selectedCount} event{selectedCount === 1 ? "" : "s"} selected
          </span>
          {importProgress && (
            <span className="text-sm text-[var(--token-text-secondary)]">
              Importing {importProgress.current} of {importProgress.total}...
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          {!isImporting && (
            <>
              <button
                type="button"
                onClick={onSelectAll}
                disabled={selectedCount === importableCount}
                className="flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-5 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed h-11"
              >
                Select All Importable
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                className="flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-5 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] h-11"
              >
                Clear Selection
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onImport}
            disabled={isImporting || selectedCount === 0}
            className="mobile-button flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-5 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed active:opacity-90 h-11"
          >
            {isImporting
              ? importProgress
                ? `Importing ${importProgress.current} of ${importProgress.total}...`
                : "Importing..."
              : `Import ${selectedCount} selected event${selectedCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  )
}

