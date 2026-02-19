/**
 * @fileoverview Compact driver picker for per-chart driver selection
 *
 * @description Button + popover for selecting which drivers to show in a single chart.
 * Used for full per-chart selection (Option B) on Unified performance and Lap-by-lap trend.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/UnifiedPerformanceChart.tsx
 * - src/components/organisms/event-analysis/OverviewTab.tsx
 */

"use client"

import { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from "react"
import { createPortal } from "react-dom"

export interface ChartDriverPickerDriver {
  driverId: string
  driverName: string
}

export interface ChartDriverPickerProps {
  drivers: ChartDriverPickerDriver[]
  selectedDriverIds: string[]
  onSelectionChange: (driverIds: string[]) => void
  /** Button label prefix; count appended as "Drivers (5)" */
  label?: string
  className?: string
  disabled?: boolean
}

export default function ChartDriverPicker({
  drivers,
  selectedDriverIds,
  onSelectionChange,
  label = "Drivers",
  className = "",
  disabled = false,
}: ChartDriverPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number } | null>(null)

  const filteredDrivers = useMemo(() => {
    if (!searchQuery.trim()) return drivers
    const q = searchQuery.toLowerCase().trim()
    return drivers.filter((d) => d.driverName.toLowerCase().includes(q))
  }, [drivers, searchQuery])

  const selectedCount = useMemo(
    () => selectedDriverIds.filter((id) => drivers.some((d) => d.driverId === id)).length,
    [selectedDriverIds, drivers]
  )

  const handleToggle = useCallback(
    (driverId: string) => {
      if (selectedDriverIds.includes(driverId)) {
        onSelectionChange(selectedDriverIds.filter((id) => id !== driverId))
      } else {
        onSelectionChange([...selectedDriverIds, driverId])
      }
    },
    [selectedDriverIds, onSelectionChange]
  )

  const handleSelectAll = useCallback(() => {
    const ids = filteredDrivers.map((d) => d.driverId)
    const currentSet = new Set(selectedDriverIds)
    ids.forEach((id) => currentSet.add(id))
    onSelectionChange(Array.from(currentSet))
  }, [filteredDrivers, selectedDriverIds, onSelectionChange])

  const handleClear = useCallback(() => {
    onSelectionChange([])
  }, [onSelectionChange])

  // Position popover in viewport when open (portal-rendered). Only need button rect.
  const updatePosition = useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const popoverHeight = 320
    const popoverWidth = 280
    const gap = 4
    const padding = 12
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top = rect.bottom + gap
    let left = rect.left

    // Prefer below; if not enough space, show above
    const spaceBelow = vh - rect.bottom - padding
    if (spaceBelow < popoverHeight && rect.top > spaceBelow) {
      top = rect.top - popoverHeight - gap
    }
    // Clamp vertical so it never goes off top or bottom
    top = Math.max(padding, Math.min(vh - popoverHeight - padding, top))

    // Clamp horizontal to viewport
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

  // Keep position in view on scroll/resize
  useEffect(() => {
    if (!isOpen) return
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    return () => {
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [isOpen, updatePosition])

  // Reset position when closed so next open starts clean
  useEffect(() => {
    if (!isOpen) queueMicrotask(() => setPopoverStyle(null))
  }, [isOpen])

  useEffect(() => {
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
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const popoverContent = isOpen && typeof document !== "undefined" && (
    <div
      ref={popoverRef}
      className="fixed z-[100] min-w-[220px] max-w-[320px] max-h-[320px] w-[var(--popover-width,280px)] flex flex-col rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] shadow-lg"
      style={{
        position: "fixed",
        top: popoverStyle?.top ?? 0,
        left: popoverStyle?.left ?? 0,
        visibility: popoverStyle ? "visible" : "hidden",
      }}
      role="listbox"
      aria-label="Driver selection"
    >
      <div className="p-2 border-b border-[var(--token-border-default)]">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search drivers..."
          className="w-full px-2.5 py-1.5 text-sm rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] placeholder:text-[var(--token-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
          aria-label="Search drivers"
        />
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--token-border-default)]">
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-xs font-medium text-[var(--token-accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] rounded"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="text-xs font-medium text-[var(--token-text-secondary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] rounded"
        >
          Clear
        </button>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0 p-1">
        {filteredDrivers.length === 0 ? (
          <p className="px-2 py-3 text-sm text-[var(--token-text-muted)]">No drivers match</p>
        ) : (
          filteredDrivers.map((driver) => {
            const isSelected = selectedDriverIds.includes(driver.driverId)
            return (
              <label
                key={driver.driverId}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--token-surface-raised)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(driver.driverId)}
                  className="w-4 h-4 rounded border-[var(--token-border-default)] text-[var(--token-accent)] focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  aria-label={`Toggle ${driver.driverName}`}
                />
                <span className="text-sm text-[var(--token-text-primary)] truncate">
                  {driver.driverName}
                </span>
              </label>
            )
          })
        )}
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className={`flex items-center gap-2 relative ${className}`}>
      <span className="text-sm text-[var(--token-text-secondary)]">{label}:</span>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={`${label}: ${selectedCount} selected`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span>({selectedCount})</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
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
