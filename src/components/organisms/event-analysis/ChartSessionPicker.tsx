/**
 * @fileoverview Searchable session picker for chart header scope (single session vs all).
 */

"use client"

import { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from "react"
import { createPortal } from "react-dom"

export interface ChartSessionOption {
  id: string
  /** Full label shown in the dropdown list */
  label: string
  /** Shorter label for the closed trigger button */
  compactLabel?: string
}

export interface ChartSessionPickerProps {
  sessions: ChartSessionOption[]
  /** null = all sessions in scope */
  selectedRaceId: string | null
  onSessionChange: (raceId: string | null) => void
  label?: string
  allSessionsLabel?: string
  className?: string
  disabled?: boolean
}

export default function ChartSessionPicker({
  sessions,
  selectedRaceId,
  onSessionChange,
  label = "Session",
  allSessionsLabel = "All sessions",
  className = "",
  disabled = false,
}: ChartSessionPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number } | null>(null)

  const sessionById = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions])

  const selectedButtonLabel = useMemo(() => {
    if (selectedRaceId == null) return allSessionsLabel
    const session = sessionById.get(selectedRaceId)
    if (!session) return allSessionsLabel
    return session.compactLabel?.trim() || session.label
  }, [selectedRaceId, sessionById, allSessionsLabel])

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions
    const q = searchQuery.toLowerCase().trim()
    return sessions.filter(
      (s) =>
        s.label.toLowerCase().includes(q) || (s.compactLabel?.toLowerCase().includes(q) ?? false)
    )
  }, [sessions, searchQuery])

  const updatePosition = useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const popoverHeight = 320
    const popoverWidth = 320
    const gap = 4
    const padding = 12
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top = rect.bottom + gap
    let left = rect.left

    const spaceBelow = vh - rect.bottom - padding
    if (spaceBelow < popoverHeight && rect.top > spaceBelow) {
      top = rect.top - popoverHeight - gap
    }
    top = Math.max(padding, Math.min(vh - popoverHeight - padding, top))

    if (left + popoverWidth > vw - padding) left = vw - popoverWidth - padding
    if (left < padding) left = padding

    setPopoverStyle({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen || typeof document === "undefined") return
    let id2 = 0
    const id = requestAnimationFrame(() => {
      updatePosition()
      id2 = requestAnimationFrame(() => updatePosition())
    })
    return () => {
      cancelAnimationFrame(id)
      if (id2) cancelAnimationFrame(id2)
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (!isOpen) return
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    return () => {
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (!isOpen) queueMicrotask(() => setPopoverStyle(null))
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen])

  const handleSelect = useCallback(
    (raceId: string | null) => {
      onSessionChange(raceId)
      setIsOpen(false)
      setSearchQuery("")
    },
    [onSessionChange]
  )

  const popoverContent = isOpen && typeof document !== "undefined" && (
    <div
      ref={popoverRef}
      className="fixed z-[100] flex max-h-[320px] w-[min(100vw-1rem,320px)] flex-col rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] shadow-lg"
      style={{
        position: "fixed",
        top: popoverStyle?.top ?? 0,
        left: popoverStyle?.left ?? 0,
        visibility: popoverStyle ? "visible" : "hidden",
      }}
      role="listbox"
      aria-label="Session selection"
    >
      <div className="border-b border-[var(--token-border-default)] p-2">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search sessions…"
          className="w-full rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2.5 py-1.5 text-sm text-[var(--token-text-primary)] placeholder:text-[var(--token-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
          aria-label="Search sessions"
          autoFocus
        />
      </div>
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto p-1">
        <button
          type="button"
          role="option"
          aria-selected={selectedRaceId == null}
          className={`flex w-full rounded px-2.5 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-interactive-focus-ring)] ${
            selectedRaceId == null
              ? "bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
              : "text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)]"
          }`}
          onClick={() => handleSelect(null)}
        >
          {allSessionsLabel}
        </button>
        {filteredSessions.length === 0 ? (
          <p className="px-2 py-3 text-sm text-[var(--token-text-muted)]">No sessions match</p>
        ) : (
          filteredSessions.map((session) => {
            const isSelected = selectedRaceId === session.id
            return (
              <button
                key={session.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                title={session.label}
                className={`flex w-full rounded px-2.5 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                  isSelected
                    ? "bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                    : "text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)]"
                }`}
                onClick={() => handleSelect(session.id)}
              >
                <span className="line-clamp-2">{session.label}</span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className={`flex min-w-0 items-center gap-2 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || sessions.length === 0}
        onClick={() => setIsOpen((o) => !o)}
        className="inline-flex h-9 min-w-0 max-w-[min(100%,18rem)] items-center gap-1.5 rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-2.5 py-1 text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`${label}: ${selectedButtonLabel}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="rounded-full border border-[var(--token-border-muted)] bg-[var(--token-surface)]/70 px-2 py-0.5 text-xs font-medium text-[var(--token-text-secondary)]">
          {label}
        </span>
        <span className="truncate rounded-full border border-[var(--token-border-muted)] px-2 py-0.5 text-xs font-semibold">
          {selectedButtonLabel}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {typeof document !== "undefined" &&
        document.body &&
        createPortal(popoverContent, document.body)}
    </div>
  )
}
