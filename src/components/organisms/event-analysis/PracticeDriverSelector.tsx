/**
 * @fileoverview Practice day driver selector
 *
 * @description Searchable lookup to select which driver's data to view on a practice day.
 *              "All sessions" or a specific driver. Width fits selected value.
 */

"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useAppDispatch } from "@/store/hooks"
import { setSelectedPracticeDriverId } from "@/store/slices/dashboardSlice"

export interface PracticeDriverSelectorProps {
  drivers: Array<{ driverId: string; driverName: string }>
  selectedDriverId: string | null
  className?: string
  /** When true, hide the "Viewing" label (e.g. when embedded in Actions menu). */
  hideLabel?: boolean
}

const ALL_SESSIONS_ID = "__all_sessions__"
const MIN_WIDTH_CH = 14

export default function PracticeDriverSelector({
  drivers,
  selectedDriverId,
  className = "",
  hideLabel = false,
}: PracticeDriverSelectorProps) {
  const dispatch = useAppDispatch()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedLabel =
    selectedDriverId === null
      ? "All sessions"
      : drivers.find((d) => d.driverId === selectedDriverId)?.driverName ?? "All sessions"

  const options = useMemo(() => {
    const list: Array<{ id: string | null; label: string }> = [
      { id: null, label: "All sessions" },
      ...drivers.map((d) => ({ id: d.driverId, label: d.driverName })),
    ]
    return list
  }, [drivers])

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase().trim()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const inputWidthCh = useMemo(() => {
    const display = isOpen && query !== "" ? query : selectedLabel
    return Math.max(MIN_WIDTH_CH, display.length + 2)
  }, [selectedLabel, isOpen, query])

  const select = (id: string | null) => {
    dispatch(setSelectedPracticeDriverId(id))
    setQuery("")
    setIsOpen(false)
    setHighlightedIndex(0)
    inputRef.current?.blur()
  }

  const handleFocus = () => {
    setIsOpen(true)
    setQuery("")
    setHighlightedIndex(0)
  }

  const handleBlur = () => {
    setTimeout(() => setIsOpen(false), 150)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault()
        setIsOpen(true)
        setQuery("")
        setHighlightedIndex(0)
      }
      return
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((i) => (i < filteredOptions.length - 1 ? i + 1 : i))
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((i) => (i > 0 ? i - 1 : 0))
        break
      case "Enter":
        e.preventDefault()
        if (filteredOptions[highlightedIndex]) {
          select(filteredOptions[highlightedIndex].id)
        }
        break
      case "Escape":
        e.preventDefault()
        setQuery("")
        setIsOpen(false)
        inputRef.current?.blur()
        break
      default:
        break
    }
  }

  useEffect(() => {
    if (isOpen && filteredOptions.length > 0) {
      setHighlightedIndex(0)
    }
  }, [query, isOpen, filteredOptions.length])

  useEffect(() => {
    if (!isOpen) return
    const el = listRef.current
    if (!el) return
    const highlighted = el.querySelector("[data-highlighted]")
    highlighted?.scrollIntoView({ block: "nearest" })
  }, [highlightedIndex, isOpen])

  return (
    <div className={`relative inline-block ${className}`}>
      {!hideLabel && (
        <label htmlFor="practice-driver-select" className="mb-2 block text-sm font-medium text-[var(--token-text-primary)]">
          Viewing
        </label>
      )}
      <input
        ref={inputRef}
        id="practice-driver-select"
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls="practice-driver-list"
        aria-label="Select driver to view"
        aria-activedescendant={isOpen && filteredOptions[highlightedIndex] ? `practice-driver-opt-${highlightedIndex}` : undefined}
        value={isOpen ? query : selectedLabel}
        placeholder={isOpen ? "Search drivers..." : undefined}
        onChange={(e) => {
          setQuery(e.target.value)
          setIsOpen(true)
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{ minWidth: `${inputWidthCh}ch`, width: `${inputWidthCh}ch` }}
        className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2 text-sm text-[var(--token-text-primary)] placeholder:text-[var(--token-text-muted)] focus:border-[var(--token-interactive-focus-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
      />
      {isOpen && (
        <div
          ref={listRef}
          id="practice-driver-list"
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] py-1 shadow-lg"
          style={{ minWidth: `${inputWidthCh}ch` }}
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[var(--token-text-muted)]">
              No drivers match
            </div>
          ) : (
            filteredOptions.map((opt, i) => (
              <button
                key={opt.id ?? ALL_SESSIONS_ID}
                type="button"
                role="option"
                id={`practice-driver-opt-${i}`}
                data-highlighted={i === highlightedIndex}
                aria-selected={i === highlightedIndex}
                onClick={() => select(opt.id)}
                onMouseEnter={() => setHighlightedIndex(i)}
                className={`w-full text-left px-3 py-2 text-sm focus:outline-none focus:ring-0 ${
                  i === highlightedIndex
                    ? "bg-[var(--token-accent)]/20 text-[var(--token-accent)]"
                    : "text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)]"
                }`}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
