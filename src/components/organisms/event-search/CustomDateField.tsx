/**
 * @fileoverview Date field: native `type="date"` on narrow viewports; desktop month calendar
 * in a portaled popover (date-fns + MRE tokens). Month/year selects, optional confirm flow.
 * No react-day-picker — avoids install/CI issues.
 */

"use client"

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getMonth,
  getYear,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { enAU } from "date-fns/locale"
import { Calendar, ChevronDown } from "lucide-react"
import type { CSSProperties } from "react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { toLocalDateString } from "@/lib/date-utils"
import { DATE_INPUT_CALENDAR_Z_INDEX } from "@/lib/modal-styles"

const WEEK_STARTS_ON = 0 as const

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

function clampVisibleMonth(visible: Date, minD?: string, maxD?: string): Date {
  let next = startOfMonth(visible)
  if (minD) {
    const minT = parseYmdLocal(minD)
    if (endOfMonth(next) < minT) {
      next = startOfMonth(minT)
    }
  }
  if (maxD) {
    const maxT = parseYmdLocal(maxD)
    if (startOfMonth(next) > maxT) {
      next = startOfMonth(maxT)
    }
  }
  return next
}

function yearRange(minD?: string, maxD?: string): number[] {
  const nowY = new Date().getFullYear()
  const y0 = minD ? getYear(parseYmdLocal(minD)) : nowY - 10
  const y1 = maxD ? getYear(parseYmdLocal(maxD)) : nowY + 1
  const lo = Math.min(y0, y1)
  const hi = Math.max(y0, y1)
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}

function availableMonthsInYear(
  y: number,
  minD?: string,
  maxD?: string
): { value: number; label: string }[] {
  const out: { value: number; label: string }[] = []
  for (let m = 0; m < 12; m++) {
    const first = new Date(y, m, 1)
    const last = endOfMonth(first)
    if (minD) {
      const minT = parseYmdLocal(minD)
      if (last < minT) continue
    }
    if (maxD) {
      const maxT = parseYmdLocal(maxD)
      if (first > maxT) continue
    }
    out.push({
      value: m,
      label: format(new Date(2020, m, 1), "MMMM", { locale: enAU }),
    })
  }
  return out
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

function formatButtonDate(ymd: string, longForm: boolean): string {
  const d = parseYmdLocal(ymd)
  if (isNaN(d.getTime())) return ymd
  if (longForm) {
    return d.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
  }
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function weekdayCapLabels(): string[] {
  const ref = new Date(2024, 5, 2)
  const s = startOfWeek(ref, { weekStartsOn: WEEK_STARTS_ON })
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(s)
    day.setDate(s.getDate() + i)
    return format(day, "EEE", { locale: enAU }).toUpperCase()
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
  placeholder?: string
  /**
   * `compact`: inline label + pill trigger, chevron (e.g. custom range modal).
   * `default`: label above, full-width trigger, calendar icon.
   */
  appearance?: "default" | "compact"
  /**
   * When true (desktop calendar), day tap updates a draft; Close discards, Confirm applies.
   * When false, day tap applies and closes (legacy).
   */
  confirmInPopover?: boolean
}

const SELECT_PILL =
  "rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-1.5 text-sm text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"

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
  appearance = "default",
  confirmInPopover = true,
}: CustomDateFieldProps) {
  const useCalendarUi = useDesktopDateCalendar()
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => new Date())
  const [pendingYmd, setPendingYmd] = useState(value)
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

  const handleToggle = () => {
    if (disabled) return
    if (open) {
      closePopover()
      return
    }
    const m = value && value.length >= 8 ? parseYmdLocal(value) : new Date()
    setVisibleMonth(clampVisibleMonth(isNaN(m.getTime()) ? new Date() : m, minDate, maxDate))
    setPendingYmd(value)
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
        {errorMessage && (
          <p
            id={describedById}
            className="mt-1 text-sm text-[var(--token-error-text)]"
            role="alert"
          >
            {errorMessage}
          </p>
        )}
      </div>
    )
  }

  const showPending = open && confirmInPopover
  const displayPendingYmd = showPending ? pendingYmd : value
  const selectedForDisplay = displayPendingYmd ? parseYmdLocal(displayPendingYmd) : undefined
  const selectedValid =
    selectedForDisplay && !isNaN(selectedForDisplay.getTime()) ? selectedForDisplay : undefined

  const monthDays = getMonthGrid(visibleMonth)
  const wkLabels = weekdayCapLabels()
  const yNow = getYear(visibleMonth)
  const mNow = getMonth(visibleMonth)
  const years = yearRange(minDate, maxDate)
  const monthOpts = availableMonthsInYear(yNow, minDate, maxDate)

  const applyMonthYear = (y: number, monthIndex: number) => {
    const base = new Date(y, monthIndex, 1)
    setVisibleMonth(clampVisibleMonth(base, minDate, maxDate))
  }

  const onConfirm = () => {
    if (pendingYmd && !isDateDisabled(parseYmdLocal(pendingYmd))) {
      onChange(pendingYmd)
    }
    closePopover()
  }

  const onPopoverClose = () => {
    setPendingYmd(value)
    closePopover()
  }

  const useLongFormLabel = appearance === "compact"

  const popoverContent = open && position && (
    <div
      ref={popoverRef}
      className="w-[min(100vw-2rem,22rem)] rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-4 shadow-xl"
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
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <select
          aria-label="Month"
          className={SELECT_PILL + " min-w-0 max-w-[11rem]"}
          value={monthOpts.some((o) => o.value === mNow) ? mNow : (monthOpts[0]?.value ?? 0)}
          onChange={(e) => {
            const mi = parseInt(e.target.value, 10)
            applyMonthYear(yNow, mi)
          }}
        >
          {monthOpts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Year"
          className={SELECT_PILL + " w-[5.5rem]"}
          value={yNow}
          onChange={(e) => {
            const y = parseInt(e.target.value, 10)
            const safeMonth = availableMonthsInYear(y, minDate, maxDate).some(
              (o) => o.value === mNow
            )
              ? mNow
              : (availableMonthsInYear(y, minDate, maxDate)[0]?.value ?? 0)
            applyMonthYear(y, safeMonth)
          }}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-0.5 border-b border-[var(--token-border-accent-soft)] pb-2 text-center text-[0.65rem] font-semibold text-[var(--token-text-secondary)]">
        {wkLabels.map((w, i) => (
          <div key={i} className="px-0 py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-7 gap-0.5 pt-1">
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
                if (confirmInPopover) {
                  setPendingYmd(ymd)
                } else {
                  onChange(ymd)
                  closePopover()
                }
              }}
              className={`flex h-10 min-w-0 items-center justify-center rounded-full text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] ${
                isSel
                  ? "bg-[#00AEEF] text-white shadow-[0_0_10px_rgba(0,174,239,0.45)]"
                  : inMonth
                    ? "text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)]"
                    : "text-[var(--token-text-secondary)] opacity-55 hover:bg-[var(--token-surface-raised)]"
              } ${dis ? "cursor-not-allowed opacity-30 hover:bg-transparent" : ""} `}
            >
              {format(day, "d")}
            </button>
          )
        })}
      </div>
      {confirmInPopover && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--token-border-accent-soft)] pt-3">
          <button
            type="button"
            onClick={onPopoverClose}
            className="min-h-10 min-w-[4.5rem] rounded-full px-4 text-sm font-medium text-[#E6674C] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
            style={{ backgroundColor: "#FDF2F0" }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-10 min-w-[4.5rem] rounded-full px-4 text-sm font-medium text-[#5a9a3a] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
            style={{ backgroundColor: "#EBF5E1" }}
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  )

  const triggerClass =
    appearance === "compact"
      ? "flex h-10 w-full min-w-0 sm:min-w-[12rem] max-w-md items-center justify-between gap-2 rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface)] px-4 text-left text-sm text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50"
      : "flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-4 text-left text-sm text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50"

  const fieldInner = (
    <div
      className={
        appearance === "compact"
          ? "flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
          : ""
      }
    >
      <label
        htmlFor={id}
        className={
          appearance === "compact"
            ? "shrink-0 text-sm text-[var(--token-text-secondary)]"
            : "block text-sm font-medium text-[var(--token-text-primary)] mb-1"
        }
      >
        {label}
      </label>
      <div className={appearance === "compact" ? "min-w-0 flex-1" : "relative w-full"}>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          disabled={disabled}
          onClick={handleToggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-describedby={errorMessage && describedById ? describedById : undefined}
          className={triggerClass}
        >
          <span className={value ? "truncate" : "text-[var(--token-text-secondary)]"}>
            {value ? formatButtonDate(value, useLongFormLabel) : placeholder}
          </span>
          {appearance === "compact" ? (
            <ChevronDown
              className="h-4 w-4 flex-shrink-0 text-[var(--token-text-secondary)]"
              aria-hidden
            />
          ) : (
            <Calendar
              className="h-5 w-5 flex-shrink-0 text-[var(--token-text-secondary)]"
              aria-hidden
            />
          )}
        </button>
      </div>
    </div>
  )

  return (
    <div>
      {fieldInner}
      {errorMessage && (
        <p id={describedById} className="mt-1 text-sm text-[var(--token-error-text)]" role="alert">
          {errorMessage}
        </p>
      )}
      {typeof document !== "undefined" && popoverContent
        ? createPortal(popoverContent, document.body)
        : null}
    </div>
  )
}
