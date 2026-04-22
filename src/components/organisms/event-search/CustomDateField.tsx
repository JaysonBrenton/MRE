/**
 * @fileoverview Date field: native `type="date"` on narrow viewports; desktop calendar popover
 * (react-day-picker) with MRE tokens, portaled above modals.
 */

"use client"

import { enAU } from "date-fns/locale"
import { Calendar } from "lucide-react"
import type { CSSProperties } from "react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { DayPicker } from "react-day-picker"

import { toLocalDateString } from "@/lib/date-utils"
import { DATE_INPUT_CALENDAR_Z_INDEX } from "@/lib/modal-styles"

import "react-day-picker/style.css"

function parseYmdLocal(ymd: string): Date {
  const parts = ymd.split("-").map(Number)
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (!y || !m || !d) return new Date(NaN)
  return new Date(y, m - 1, d)
}

function useDesktopDateCalendar(): boolean {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const update = () => setDesktop(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return desktop
}

function formatButtonDate(ymd: string): string {
  const d = parseYmdLocal(ymd)
  if (isNaN(d.getTime())) return ymd
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export interface CustomDateFieldProps {
  id: string
  label: string
  value: string
  onChange: (date: string) => void
  minDate?: string
  maxDate?: string
  disabled?: boolean
  errorMessage?: string
  describedById?: string
  /** Shown when value is empty (desktop trigger) */
  placeholder?: string
}

export default function CustomDateField({
  id,
  label,
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  errorMessage,
  describedById,
  placeholder = "Select date",
}: CustomDateFieldProps) {
  const useCalendarUi = useDesktopDateCalendar()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  const isDateDisabled = useCallback(
    (date: Date) => {
      const ds = toLocalDateString(date)
      if (minDate && ds < minDate) return true
      if (maxDate && ds > maxDate) return true
      return false
    },
    [minDate, maxDate]
  )

  const closePopover = useCallback(() => {
    setOpen(false)
    setPosition(null)
  }, [])

  const openPopover = () => {
    if (disabled) return
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPosition({ top: rect.bottom + 8, left: rect.left })
    setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open || !position || !popoverRef.current) return

    const popover = popoverRef.current
    const rect = popover.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const padding = 8

    let top = position.top
    let left = position.left

    if (rect.right > viewportWidth - padding) {
      left = viewportWidth - rect.width - padding
    }
    if (rect.left < padding) {
      left = padding
    }
    if (rect.bottom > viewportHeight - padding) {
      const tr = triggerRef.current?.getBoundingClientRect()
      if (tr) {
        top = tr.top - rect.height - 8
      }
      if (top < padding) {
        top = viewportHeight - rect.height - padding
      }
    }
    if (rect.top < padding) {
      top = padding
    }

    if (top !== position.top || left !== position.left) {
      requestAnimationFrame(() => {
        setPosition({ top, left })
      })
    }
  }, [open, position])

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (popoverRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      closePopover()
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [open, closePopover])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        e.preventDefault()
        closePopover()
      }
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [open, closePopover])

  const nativeInput = (
    <input
      id={id}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={minDate}
      max={maxDate}
      disabled={disabled}
      className="w-full h-11 px-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
      aria-invalid={Boolean(errorMessage)}
      aria-describedby={describedById}
    />
  )

  if (!useCalendarUi) {
    return (
      <div>
        <label
          htmlFor={id}
          className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
        >
          {label}
        </label>
        {nativeInput}
      </div>
    )
  }

  const selected = value ? parseYmdLocal(value) : undefined
  const defaultMonth = selected && !isNaN(selected.getTime()) ? selected : new Date()

  const popoverContent = open && position && (
    <div
      ref={popoverRef}
      className="rdp-root rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-2 shadow-lg"
      style={
        {
          position: "fixed",
          top: `${position.top}px`,
          left: `${position.left}px`,
          zIndex: DATE_INPUT_CALENDAR_Z_INDEX,
          ["--rdp-accent-color" as string]: "var(--token-accent)",
          ["--rdp-accent-background-color" as string]:
            "color-mix(in srgb, var(--token-accent) 22%, transparent)",
          ["--rdp-range_start-date-background-color" as string]: "var(--token-accent)",
          ["--rdp-range_end-date-background-color" as string]: "var(--token-accent)",
        } as CSSProperties
      }
      role="application"
      aria-label={`${label} calendar`}
      onClick={(e) => e.stopPropagation()}
    >
      <DayPicker
        mode="single"
        locale={enAU}
        selected={selected && !isNaN(selected.getTime()) ? selected : undefined}
        onSelect={(d) => {
          if (d) {
            onChange(toLocalDateString(d))
            closePopover()
          }
        }}
        disabled={isDateDisabled}
        defaultMonth={defaultMonth}
        className="text-[var(--token-text-primary)]"
        classNames={{
          month_caption: "text-[var(--token-text-primary)] font-medium capitalize",
          button_next:
            "text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] rounded-md p-1",
          button_previous:
            "text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] rounded-md p-1",
          weekday: "text-[var(--token-text-secondary)] text-xs",
        }}
      />
    </div>
  )

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
      >
        {label}
      </label>
      <div className="relative w-full">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => (open ? closePopover() : openPopover())}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-describedby={describedById}
          className="flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-4 text-left text-sm text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50"
        >
          <span className={value ? "" : "text-[var(--token-text-secondary)]"}>
            {value ? formatButtonDate(value) : placeholder}
          </span>
          <Calendar
            className="h-5 w-5 flex-shrink-0 text-[var(--token-text-secondary)]"
            aria-hidden
          />
        </button>
      </div>
      {typeof document !== "undefined" && popoverContent
        ? createPortal(popoverContent, document.body)
        : null}
    </div>
  )
}
