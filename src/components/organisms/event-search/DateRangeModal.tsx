/**
 * @fileoverview Date range preset modal for Event Search
 *
 * @description Modal that contains the date range preset picker (preset chips + optional
 * custom start/end). Header bar is draggable to reposition the panel. Opens from a
 * trigger in the form; Apply closes and keeps current selection; Cancel closes without
 * reverting (state may have changed). Rendered with createPortal(document.body) so
 * position:fixed is viewport-relative and the panel is not clipped when opened inside
 * a transformed parent (e.g. dragged EventSearchModal).
 *
 * Layout follows docs/development/FLEXBOX_LAYOUT_CHECKLIST.md to prevent horizontal
 * compression (inline minWidth, flexShrink: 0, getModalContainerStyles / getContentBlockStyles).
 *
 * @relatedFiles
 * - src/components/organisms/event-search/DateRangePresetPicker.tsx
 * - src/hooks/useModalPanelDrag.ts (header drag to reposition)
 * - src/components/organisms/event-search/TrackSelectionModal.tsx (modal pattern)
 * - docs/development/FLEXBOX_LAYOUT_CHECKLIST.md
 * - src/lib/modal-styles.ts
 */

"use client"

import type { CSSProperties } from "react"
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useModalPanelDrag } from "@/hooks/useModalPanelDrag"
import {
  getModalContainerStyles,
  getContentBlockStyles,
  MODAL_MAX_WIDTHS,
  NESTED_MODAL_OVERLAY_Z_INDEX,
} from "@/lib/modal-styles"
import DateRangePresetPicker, { type DateRangePresetPickerProps } from "./DateRangePresetPicker"

export interface DateRangeModalProps extends Pick<
  DateRangePresetPickerProps,
  | "preset"
  | "startDate"
  | "endDate"
  | "onPresetChange"
  | "onStartDateChange"
  | "onEndDateChange"
  | "errors"
  | "disabled"
> {
  isOpen: boolean
  onClose: () => void
}

export default function DateRangeModal({
  isOpen,
  onClose,
  preset,
  startDate,
  endDate,
  onPresetChange,
  onStartDateChange,
  onEndDateChange,
  errors,
  disabled = false,
}: DateRangeModalProps) {
  const pickerProps = {
    preset,
    startDate,
    endDate,
    onPresetChange,
    onStartDateChange,
    onEndDateChange,
    errors,
    disabled,
    hideLabel: true,
  }
  const modalRef = useRef<HTMLDivElement>(null)
  const { offset: dragOffset, isDragging, headerPointerDown } = useModalPanelDrag(isOpen, modalRef)

  const panelStyles: CSSProperties = {
    ...getModalContainerStyles(MODAL_MAX_WIDTHS["2xl"]),
    transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
  }

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const modalElement = modalRef.current
    if (!modalElement) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const focusableElements = modalElement.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
      if (focusableElements.length === 0) return
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    modalElement.addEventListener("keydown", handleKeyDown)
    return () => modalElement.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  if (!isOpen) return null
  if (typeof document === "undefined") return null

  const overlay = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="date-range-modal-title"
      style={{ minWidth: 0, zIndex: NESTED_MODAL_OVERLAY_Z_INDEX }}
    >
      <div
        ref={modalRef}
        className="max-h-[90vh] flex flex-col rounded-lg shadow-lg bg-[var(--token-surface-raised)] border border-[var(--token-border-accent-soft)]"
        style={panelStyles}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex select-none items-center justify-between flex-shrink-0 px-4 py-4 border-b border-[var(--token-border-default)] ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{ ...getContentBlockStyles(), touchAction: "none" }}
          onPointerDown={headerPointerDown}
        >
          <h2
            id="date-range-modal-title"
            className="text-lg font-semibold text-[var(--token-text-primary)] min-w-0 flex-1"
            style={{ minWidth: 0 }}
          >
            Date range
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 flex-shrink-0 rounded-md text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4"
          style={getContentBlockStyles()}
        >
          <DateRangePresetPicker {...pickerProps} />
        </div>

        <div
          className="flex-shrink-0 flex justify-end gap-2 px-4 py-4 border-t border-[var(--token-border-default)]"
          style={getContentBlockStyles()}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-5 py-2 text-sm font-medium text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] h-11"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] h-11"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
