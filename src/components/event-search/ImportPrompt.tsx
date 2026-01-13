/**
 * @fileoverview Import prompt modal component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Modal dialog prompting user to import newly discovered events
 * 
 * @purpose Shows a prompt when new events are discovered from LiveRC, asking
 *          the user if they want to import all events. In version 0.1.1, only "import all"
 *          is supported (no selective import).
 * 
 * @relatedFiles
 * - src/components/event-search/EventSearchContainer.tsx (parent component)
 */

"use client"

export interface ImportPromptProps {
  isOpen: boolean
  newEventCount: number
  onImportAll: () => void
  onCancel: () => void
}

export default function ImportPrompt({
  isOpen,
  newEventCount,
  onImportAll,
  onCancel,
}: ImportPromptProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-prompt-title"
      style={{ minWidth: 0 }}
    >
      <div
        className="bg-[var(--token-surface)] rounded-lg shadow-lg p-6"
        onClick={(e) => e.stopPropagation()}
        style={{ 
          width: '100%',
          maxWidth: '28rem',
          minWidth: '20rem',
          boxSizing: 'border-box',
          flexShrink: 0,
          flexGrow: 0
        }}
      >
        <h2 id="import-prompt-title" className="text-lg font-semibold text-[var(--token-text-primary)] mb-4">
          Import Events?
        </h2>
        <p className="text-[var(--token-text-secondary)] mb-6">
          We found {newEventCount} new event{newEventCount !== 1 ? "s" : ""} on LiveRC that{" "}
          {newEventCount !== 1 ? "are" : "is"} not yet imported. Import all now?
        </p>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onImportAll}
            className="flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-5 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] h-11"
          >
            Import All
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-5 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] h-11"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

