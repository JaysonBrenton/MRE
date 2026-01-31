/**
 * @fileoverview Reusable delete confirmation dialog component
 *
 * @created 2025-01-29
 * @creator System
 * @lastModified 2025-01-29
 *
 * @description Confirmation dialog for destructive delete actions
 *
 * @purpose Provides a consistent confirmation pattern for delete operations
 *
 * @relatedFiles
 * - src/components/ui/Modal.tsx (modal component)
 */

"use client"

import Modal from "@/components/molecules/Modal"

interface DeleteConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  itemName?: string
  loading?: boolean
}

export default function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  loading = false,
}: DeleteConfirmationDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="md"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-elevated)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md border border-[var(--token-border-error)] bg-[var(--token-error)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-error-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      }
    >
      <div className="px-4 py-4">
        <p className="text-sm text-[var(--token-text-primary)]">{message}</p>
        {itemName && (
          <p className="mt-2 text-sm font-medium text-[var(--token-text-primary)]">{itemName}</p>
        )}
        <p className="mt-4 text-sm text-[var(--token-text-error)]">This action cannot be undone.</p>
      </div>
    </Modal>
  )
}
