/**
 * @fileoverview Dialog shown when a single-event import fails in Event Search.
 */

"use client"

import Modal from "@/components/molecules/Modal"
import { NESTED_MODAL_OVERLAY_Z_INDEX } from "@/lib/modal-styles"

export interface EventImportFailedModalProps {
  isOpen: boolean
  eventName: string
  errorMessage: string
  onClose: () => void
  onRetry?: () => void
}

export default function EventImportFailedModal({
  isOpen,
  eventName,
  errorMessage,
  onClose,
  onRetry,
}: EventImportFailedModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import failed"
      subtitle={eventName}
      maxWidth="lg"
      resizable={false}
      overlayZIndex={NESTED_MODAL_OVERLAY_Z_INDEX}
      ariaLabel="Event import failed"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-5 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
          >
            Close
          </button>
          {onRetry ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                onRetry()
              }}
              className="flex h-11 items-center justify-center rounded-md border border-[var(--token-status-error-text)] bg-[var(--token-status-error-bg)] px-5 text-sm font-medium text-[var(--token-status-error-text)] transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
            >
              Retry import
            </button>
          ) : null}
        </div>
      }
    >
      <p className="text-sm text-[var(--token-text-secondary)]">
        This event could not be imported from LiveRC. The ingestion service reported:
      </p>
      <p
        className="mt-3 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-4 py-3 text-sm text-[var(--token-text-primary)] whitespace-pre-wrap break-words"
        role="alert"
      >
        {errorMessage}
      </p>
      <p className="mt-4 text-sm text-[var(--token-text-secondary)]">
        If the problem persists, check that the event has published results on LiveRC, then try
        again. You can also reopen these details by clicking the Import failed status on the row.
      </p>
    </Modal>
  )
}
