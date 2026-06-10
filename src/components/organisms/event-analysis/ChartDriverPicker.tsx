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
import Tooltip from "@/components/molecules/Tooltip"

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
  /** When true, only one driver can be selected at a time */
  singleSelect?: boolean
  className?: string
  disabled?: boolean
  /** Shown when disabled; use a wrapper so the tooltip receives hover (disabled buttons ignore pointer events) */
  disabledTooltip?: string
  /**
   * Optional nearest-driver map keyed by anchor driver ID.
   * Each value should be pre-sorted nearest-first and may include any number of IDs.
   */
  closestDriverIdsByAnchor?: Record<string, string[]>
  /** Show "Closest Only" toggle in the popover header. */
  showClosestOnlyToggle?: boolean
  /** When false, closest-only is controlled elsewhere (e.g. chart Display menu). */
  closestOnlyToggleInPopover?: boolean
  /** Controlled closest-only mode (optional). */
  closestOnly?: boolean
  onClosestOnlyChange?: (enabled: boolean) => void
  /** Number of nearest drivers to include when closest-only mode is on. */
  closestCount?: number
}

export default function ChartDriverPicker({
  drivers,
  selectedDriverIds,
  onSelectionChange,
  label = "Drivers",
  singleSelect = false,
  className = "",
  disabled = false,
  disabledTooltip,
  closestDriverIdsByAnchor,
  showClosestOnlyToggle = false,
  closestOnlyToggleInPopover = true,
  closestOnly: closestOnlyProp,
  onClosestOnlyChange,
  closestCount = 3,
}: ChartDriverPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [internalClosestOnly, setInternalClosestOnly] = useState(false)
  const closestOnlyControlled = closestOnlyProp !== undefined
  const closestOnly = closestOnlyControlled ? closestOnlyProp : internalClosestOnly
  const setClosestOnly = useCallback(
    (next: boolean) => {
      if (!closestOnlyControlled) setInternalClosestOnly(next)
      onClosestOnlyChange?.(next)
    },
    [closestOnlyControlled, onClosestOnlyChange]
  )
  const [closestAnchorId, setClosestAnchorId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number } | null>(null)
  const onSelectionChangeRef = useRef(onSelectionChange)
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange
  }, [onSelectionChange])

  const validDriverIdSet = useMemo(() => new Set(drivers.map((d) => d.driverId)), [drivers])

  const resolveClosestSelection = useCallback(
    (anchorId: string): string[] => {
      if (!validDriverIdSet.has(anchorId)) return []
      const nearest = (closestDriverIdsByAnchor?.[anchorId] ?? []).filter(
        (id) => id !== anchorId && validDriverIdSet.has(id)
      )
      return [anchorId, ...nearest].slice(0, 1 + Math.max(0, closestCount))
    },
    [closestCount, closestDriverIdsByAnchor, validDriverIdSet]
  )

  const scopedDrivers = useMemo(() => {
    if (!closestOnly || !closestAnchorId) return drivers
    const inScope = new Set(resolveClosestSelection(closestAnchorId))
    return drivers.filter((d) => inScope.has(d.driverId))
  }, [closestOnly, closestAnchorId, drivers, resolveClosestSelection])

  const filteredDrivers = useMemo(() => {
    if (!searchQuery.trim()) return scopedDrivers
    const q = searchQuery.toLowerCase().trim()
    return scopedDrivers.filter((d) => d.driverName.toLowerCase().includes(q))
  }, [scopedDrivers, searchQuery])

  const selectedCount = useMemo(
    () => selectedDriverIds.filter((id) => drivers.some((d) => d.driverId === id)).length,
    [selectedDriverIds, drivers]
  )

  const handleToggle = useCallback(
    (driverId: string) => {
      if (closestOnly && !singleSelect) {
        if (selectedDriverIds.includes(driverId) && closestAnchorId === driverId) {
          setClosestAnchorId(null)
          queueMicrotask(() => onSelectionChange([]))
          return
        }
        setClosestAnchorId(driverId)
        queueMicrotask(() => onSelectionChange(resolveClosestSelection(driverId)))
        return
      }
      if (selectedDriverIds.includes(driverId)) {
        onSelectionChange(selectedDriverIds.filter((id) => id !== driverId))
      } else if (singleSelect) {
        onSelectionChange([driverId])
      } else {
        onSelectionChange([...selectedDriverIds, driverId])
      }
    },
    [
      closestOnly,
      singleSelect,
      selectedDriverIds,
      closestAnchorId,
      onSelectionChange,
      resolveClosestSelection,
    ]
  )

  const handleSelectAll = useCallback(() => {
    const ids = filteredDrivers.map((d) => d.driverId)
    const currentSet = new Set(selectedDriverIds)
    ids.forEach((id) => currentSet.add(id))
    onSelectionChange(Array.from(currentSet))
  }, [filteredDrivers, selectedDriverIds, onSelectionChange])

  const handleClear = useCallback(() => {
    setClosestAnchorId(null)
    onSelectionChange([])
  }, [onSelectionChange])

  const handleClosestOnlyToggle = useCallback(() => {
    const next = !closestOnly
    setClosestOnly(next)
    if (!next) {
      setClosestAnchorId(null)
      return
    }
    const fallbackAnchor = selectedDriverIds.find((id) => validDriverIdSet.has(id)) ?? null
    setClosestAnchorId(fallbackAnchor)
    // Selection sync is handled in useEffect so we never call onSelectionChange during render.
  }, [closestOnly, selectedDriverIds, setClosestOnly, validDriverIdSet])

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
    if (!isOpen) return
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
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

  useEffect(() => {
    if (closestOnly) return
    if (closestAnchorId === null) return
    queueMicrotask(() => setClosestAnchorId(null))
  }, [closestOnly, closestAnchorId])

  useEffect(() => {
    // When closest-only is controlled externally (e.g. chart Display menu), the parent owns selection sync.
    if (!showClosestOnlyToggle || !closestOnlyToggleInPopover || singleSelect || !closestOnly) {
      return
    }
    if (selectedDriverIds.length === 0) {
      if (closestAnchorId !== null) {
        queueMicrotask(() => setClosestAnchorId(null))
      }
      return
    }
    const fallbackAnchor = selectedDriverIds.find((id) => validDriverIdSet.has(id)) ?? null
    const anchorToUse =
      closestAnchorId && validDriverIdSet.has(closestAnchorId) ? closestAnchorId : fallbackAnchor
    if (!anchorToUse) return
    if (anchorToUse !== closestAnchorId) {
      queueMicrotask(() => setClosestAnchorId(anchorToUse))
      return
    }
    const enforced = resolveClosestSelection(anchorToUse)
    if (enforced.join("|") !== selectedDriverIds.join("|")) {
      queueMicrotask(() => onSelectionChangeRef.current(enforced))
    }
  }, [
    showClosestOnlyToggle,
    closestOnlyToggleInPopover,
    singleSelect,
    closestOnly,
    closestAnchorId,
    selectedDriverIds,
    validDriverIdSet,
    resolveClosestSelection,
  ])

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
      role="dialog"
      aria-modal="false"
      aria-label="Driver selection"
    >
      <div className="p-2 border-b border-[var(--token-border-default)]">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search drivers..."
          className="w-full px-2.5 py-1.5 text-sm rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] placeholder:text-[var(--token-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
          aria-label="Search drivers"
        />
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--token-border-default)]">
        {!singleSelect && !closestOnly && (
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs font-medium text-[var(--token-accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] rounded"
          >
            Select all
          </button>
        )}
        <button
          type="button"
          onClick={handleClear}
          className="text-xs font-medium text-[var(--token-text-secondary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] rounded"
        >
          Clear
        </button>
        {showClosestOnlyToggle && !singleSelect && closestOnlyToggleInPopover && (
          <button
            type="button"
            onClick={handleClosestOnlyToggle}
            aria-pressed={closestOnly}
            className="ml-auto inline-flex items-center gap-1 rounded border border-[var(--token-border-default)] px-2 py-1 text-xs font-medium text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
          >
            <span>Closest Only</span>
            <span className="text-[var(--token-text-muted)]">{closestOnly ? "On" : "Off"}</span>
          </button>
        )}
      </div>
      <div className="scrollbar-none flex-1 min-h-0 overflow-y-auto p-1">
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
                  className="w-4 h-4 rounded border-[var(--token-border-default)] text-[var(--token-accent)] focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
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

  const buttonEl = (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setIsOpen((o) => !o)}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-2.5 py-1 text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={`${label}: ${selectedCount} selected`}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
    >
      <span className="rounded-full border border-[var(--token-border-muted)] bg-[var(--token-surface)]/70 px-2 py-0.5 text-xs font-medium text-[var(--token-text-secondary)]">
        {label}
      </span>
      <span className="rounded-full border border-[var(--token-border-muted)] px-2 py-0.5 text-xs font-semibold tabular-nums">
        {selectedCount}
      </span>
      <svg
        className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )

  const buttonWithOptionalTooltip =
    disabled && disabledTooltip ? (
      <Tooltip text={disabledTooltip} position="top">
        <span className="inline-flex cursor-not-allowed">{buttonEl}</span>
      </Tooltip>
    ) : (
      buttonEl
    )

  return (
    <div ref={containerRef} className={`relative flex min-w-0 items-center gap-2 ${className}`}>
      {buttonWithOptionalTooltip}

      {typeof document !== "undefined" &&
        document.body &&
        createPortal(popoverContent, document.body)}
    </div>
  )
}
