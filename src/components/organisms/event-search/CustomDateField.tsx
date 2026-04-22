/**
 * @fileoverview Date field: native `type="date"` on narrow viewports; desktop month calendar
 * popover (date-fns + CSS grid) with MRE tokens, portaled above modals. No extra dependencies.
 */

"use client"

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { enAU } from "date-fns/locale"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import type { CSSProperties } from "react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { toLocalDateString } from "@/lib/date-utils"
import { DATE_INPUT_CALENDAR_Z_INDEX } from "@/lib/modal-styles"

const WEEK_STARTS_ON = 0 as const // Sunday (en-AU–friendly)

function parseYmdLocal(ymd: string): Date {
  const parts = ymd.split("-").map(Number)
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (!y || !m || !d) return new Date(NaN)
  return new Date(y, m - 1, d)
}

function getMonthGrid(visibleMonth: Date): Date[] {
  const mStart = startOfMonth(visibleMonth)
  const mEnd = endOfMonth(visibleMonth)
  const calStart = startOfWeek(mStart, { weekStartsOn: WEEK_STARTS_ON })
  const calEnd = endOfWeek(mEnd, { weekStartsOn: WEEK_STARTS_ON })
  return eachDayOfInterval({ start: calStart, end: calEnd })
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

function weekdayShortLabels(): string[] {
  const ref = new Date(2024, 5, 2) // Sunday
  const start = startOfWeek(ref, { weekStartsOn: WEEK_STARTS_ON })
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return format(day, "EEE", { locale: enAU })
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
  const [visibleMonth, setVisibleMonth] = useState(() => new Date())
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

  const handleOpen = () => {
    if (disabled) return
    if (open) {
      closePopover()
      return
    }
    const m = value && value.length >= 8 ? parseYmdLocal(value) : new Date()
    setVisibleMonth(isNaN(m.getTime()) ? new Date() : m)
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
  const selectedValid = selected && !isNaN(selected.getTime()) ? selected : undefined
  const monthDays = getMonthGrid(visibleMonth)
  const wkLabels = weekdayShortLabels()

  const popoverContent = open && position && (
    <div
      ref={popoverRef}
      className="w-[min(100vw-2rem,20rem)] rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-3 shadow-lg"
      style={
        {
          position: "fixed",
          top: `${position.top}px`,
          left: `${position.left}px`,
          zIndex: DATE_INPUT_CALENDAR_Z_INDEX,
        } as CSSProperties
      }
      role="dialog"
      aria-label={`${label} calendar`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setVisibleMonth((d) => subMonths(d, 1))}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 text-center text-sm font-semibold capitalize text-[var(--token-text-primary)]">
          {format(visibleMonth, "MMMM yyyy", { locale: enAU })}
        </div>
        <button
          type="button"
          onClick={() => setVisibleMonth((d) => addMonths(d, 1))}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[0.7rem] font-medium text-[var(--token-text-secondary)]">
        {wkLabels.map((w) => (
          <div key={w} className="px-0 py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {monthDays.map((day) => {
          const ymd = toLocalDateString(day)
          const inMonth = isSameMonth(day, visibleMonth)
          const dis = isDateDisabled(day)
          const isSel = selectedValid && isSameDay(day, selectedValid)
          return (
            <button
              key={ymd}
              type="button"
              disabled={dis}
              onClick={() => {
                onChange(ymd)
                closePopover()
              }}
              className={`flex h-10 min-w-0 items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] ${
                isSel
                  ? "bg-[var(--token-accent)] text-white"
                  : inMonth
                    ? "text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)]"
                    : "text-[var(--token-text-secondary)] opacity-60 hover:bg-[var(--token-surface-raised)]"
              } ${dis ? "cursor-not-allowed opacity-30 hover:bg-transparent" : ""} `}
            >
              {format(day, "d")}
            </button>
          )
        })}
      </div>
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
          onClick={handleOpen}
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
