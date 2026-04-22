/**
 * @fileoverview Nested modal for choosing custom start/end dates (above DateRangeModal, z-220)
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { toLocalDateString } from "@/lib/date-utils"
import {
  getContentBlockStyles,
  getModalContainerStyles,
  MODAL_MAX_WIDTHS,
  NESTED_MODAL_OVERLAY_Z_INDEX,
} from "@/lib/modal-styles"
import CustomDateField from "./CustomDateField"

export interface CustomDateRangeModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (start: string, end: string) => void
  startDate: string
  endDate: string
  errors?: { startDate?: string; endDate?: string }
  disabled?: boolean
}

const today = () => toLocalDateString(new Date())

function parseYmdLocal(ymd: string): Date {
  const p = ymd.split("-").map(Number)
  const y = p[0]
  const m = p[1]
  const d = p[2]
  if (!y || !m || !d) return new Date(NaN)
  return new Date(y, m - 1, d)
}

function formatRangeLine(start: string, end: string): string {
  if (!start || !end) return ""
  const a = parseYmdLocal(start)
  const b = parseYmdLocal(end)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return ""
  return `${a.toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" })} – ${b.toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" })}`
}

export function formatCustomRangeSummary(start: string, end: string): string {
  return formatRangeLine(start, end)
}

export default function CustomDateRangeModal({
  isOpen,
  onClose,
  onApply,
  startDate,
  endDate,
  errors,
  disabled = false,
}: CustomDateRangeModalProps) {
  const [draftStart, setDraftStart] = useState(startDate)
  const [draftEnd, setDraftEnd] = useState(endDate)
  const modalRef = useRef<HTMLDivElement>(null)

  const maxEndForDraft = useCallback((): string => {
    if (!draftStart) return today()
    const start = new Date(draftStart)
    const max = new Date(start)
    max.setDate(max.getDate() + 90)
    const maxStr = max.toISOString().split("T")[0]
    return maxStr < today() ? maxStr : today()
  }, [draftStart])

  const handleCancel = () => {
    onClose()
  }

  const handleDone = () => {
    onApply(draftStart, draftEnd)
    onClose()
  }

  useEffect(() => {
    if (!isOpen) return
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    document.addEventListener("keydown", onEscape, true)
    return () => document.removeEventListener("keydown", onEscape, true)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const el = modalRef.current
    if (!el) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const focusable = el.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault()
          last.focus()
        }
      } else if (document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    el.addEventListener("keydown", handleKeyDown)
    return () => el.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  if (!isOpen || typeof document === "undefined") return null

  const startErrorId = errors?.startDate ? "custom-range-start-error" : undefined
  const endErrorId = errors?.endDate ? "custom-range-end-error" : undefined

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      style={{ zIndex: NESTED_MODAL_OVERLAY_Z_INDEX, minWidth: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="max-h-[90vh] flex flex-col overflow-y-auto overflow-x-hidden rounded-2xl shadow-2xl border border-[var(--token-border-accent-soft)] bg-[var(--token-surface-raised)]"
        style={getModalContainerStyles(MODAL_MAX_WIDTHS.lg)}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-date-range-title"
        tabIndex={-1}
      >
        <div
          className="flex flex-shrink-0 items-center justify-between border-b border-[var(--token-border-default)] px-4 py-4"
          style={getContentBlockStyles()}
        >
          <h2
            id="custom-date-range-title"
            className="text-lg font-semibold text-[var(--token-text-primary)]"
          >
            Select date
          </h2>
        </div>

        <div className="flex-shrink-0 px-4 py-4" style={getContentBlockStyles()}>
          <div
            className="rounded-3xl border border-[var(--token-border-default)] p-4"
            style={{ background: "var(--token-surface-elevated)" }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-0 flex-1 sm:min-w-[12rem]">
                <CustomDateField
                  id="custom-preset-start"
                  label="From"
                  value={draftStart}
                  onChange={setDraftStart}
                  maxDate={today()}
                  disabled={disabled}
                  errorMessage={errors?.startDate}
                  describedById={startErrorId}
                  placeholder="Select start date"
                  appearance="compact"
                />
              </div>
              <div className="min-w-0 flex-1 sm:min-w-[12rem]">
                <CustomDateField
                  id="custom-preset-end"
                  label="To"
                  value={draftEnd}
                  onChange={setDraftEnd}
                  minDate={draftStart || undefined}
                  maxDate={maxEndForDraft()}
                  disabled={disabled}
                  errorMessage={errors?.endDate}
                  describedById={endErrorId}
                  placeholder="Select end date"
                  appearance="compact"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex flex-shrink-0 justify-end gap-2 border-t border-[var(--token-border-default)] px-4 py-4"
          style={getContentBlockStyles()}
        >
          <button
            type="button"
            onClick={handleCancel}
            className="h-11 min-w-[5rem] rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-5 text-sm font-medium text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDone}
            className="h-11 min-w-[5rem] rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)] px-5 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
