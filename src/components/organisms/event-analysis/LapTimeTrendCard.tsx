/**
 * @fileoverview Lap time trend comparison card for Event Analysis Overview
 *
 * @description Card acts as summary + entry point: shows which drivers are compared and a
 * "Compare trend chart" button that opens a modal with a lap-by-lap trend (every single lap).
 * Hybrid selection: default uses overview driver selection, optional "Customize" overrides.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/OverviewTab.tsx (uses this)
 * - src/core/events/get-sessions-data.ts (getDriverLapTrends)
 * - src/core/events/get-lap-data.ts (getEventLapTrend, DriverLapTrendSeries)
 * - src/components/organisms/event-analysis/LapByLapTrendChart.tsx (modal content)
 */

"use client"

import { useMemo, useState, useEffect } from "react"
import Modal from "@/components/molecules/Modal"
import { getDriverLapTrends } from "@/core/events/get-sessions-data"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import type { EventLapTrendResponse } from "@/core/events/get-lap-data"
import LapByLapTrendChart from "./LapByLapTrendChart"

const CARD_CLASS =
  "mb-6 w-fit rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2"
const MODAL_CHART_HEIGHT = 480

export interface DriverOption {
  driverId: string
  driverName: string
}

export interface LapTimeTrendCardProps {
  data: EventAnalysisData
  selectedDriverIds: string[]
  /** When null, card uses selectedDriverIds. When set, card uses this list for the trend. */
  trendCompareDriverIds: string[] | null
  onTrendCompareDriverIdsChange: (ids: string[] | null) => void
  driverOptions: DriverOption[]
}

export default function LapTimeTrendCard({
  data,
  selectedDriverIds,
  trendCompareDriverIds,
  onTrendCompareDriverIdsChange,
  driverOptions,
}: LapTimeTrendCardProps) {
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [lapTrendData, setLapTrendData] = useState<EventLapTrendResponse | null>(null)
  const [lapTrendLoading, setLapTrendLoading] = useState(false)
  const [lapTrendError, setLapTrendError] = useState<string | null>(null)

  const effectiveDriverIds = trendCompareDriverIds !== null ? trendCompareDriverIds : selectedDriverIds
  const driverLapTrends = useMemo(
    () => getDriverLapTrends(data, effectiveDriverIds),
    [data, effectiveDriverIds]
  )

  const hasData =
    driverLapTrends.length > 0 &&
    driverLapTrends.some((t) => t.sessions.some((s) => s.bestLapTime !== null))

  const handleCustomizeClick = () => {
    if (trendCompareDriverIds !== null) {
      setCustomizeOpen(!customizeOpen)
      return
    }
    onTrendCompareDriverIdsChange([...selectedDriverIds])
    setCustomizeOpen(true)
  }

  const handleUseOverviewClick = () => {
    onTrendCompareDriverIdsChange(null)
    setCustomizeOpen(false)
  }

  const handleDriverToggle = (driverId: string, checked: boolean) => {
    if (trendCompareDriverIds === null) return
    if (checked) {
      onTrendCompareDriverIdsChange([...trendCompareDriverIds, driverId])
    } else {
      onTrendCompareDriverIdsChange(trendCompareDriverIds.filter((id) => id !== driverId))
    }
  }

  const openChart = () => setModalOpen(true)
  const closeChart = () => {
    setModalOpen(false)
    setLapTrendData(null)
    setLapTrendError(null)
  }

  useEffect(() => {
    if (!modalOpen || effectiveDriverIds.length === 0) {
      setLapTrendData(null)
      setLapTrendError(null)
      return
    }
    setLapTrendLoading(true)
    setLapTrendError(null)
    const url = `/api/v1/events/${data.event.id}/lap-trend?driverIds=${effectiveDriverIds.join(",")}`
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error?.message ?? "Failed to load lap trend")
        }
        const json = await res.json()
        if (json.success && json.data) {
          setLapTrendData(json.data as EventLapTrendResponse)
        } else {
          setLapTrendData({ drivers: [] })
        }
      })
      .catch((err) => {
        setLapTrendError(err instanceof Error ? err.message : "Failed to load lap trend")
        setLapTrendData(null)
      })
      .finally(() => setLapTrendLoading(false))
  }, [modalOpen, data.event.id, effectiveDriverIds])

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-medium text-[var(--token-text-primary)]">
          Lap time trend
        </span>
        <div className="flex items-center gap-2">
          {trendCompareDriverIds !== null ? (
            <button
              type="button"
              onClick={handleUseOverviewClick}
              className="text-xs text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] underline"
            >
              Use overview selection
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleCustomizeClick}
            className="text-xs text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] underline"
            aria-expanded={customizeOpen}
          >
            {customizeOpen ? "Done" : "Customize"}
          </button>
        </div>
      </div>

      {trendCompareDriverIds !== null && !customizeOpen && (
        <p className="text-xs text-[var(--token-text-secondary)] mb-2">
          Using custom selection ({effectiveDriverIds.length} driver
          {effectiveDriverIds.length !== 1 ? "s" : ""})
        </p>
      )}

      {customizeOpen && trendCompareDriverIds !== null && (
        <div className="mb-3 max-h-40 overflow-y-auto rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] p-2">
          <p className="text-xs text-[var(--token-text-secondary)] mb-2">
            Select drivers to compare in the trend:
          </p>
          <div className="grid grid-cols-1 gap-1">
            {driverOptions.slice(0, 50).map((driver) => {
              const checked = trendCompareDriverIds.includes(driver.driverId)
              return (
                <label
                  key={driver.driverId}
                  className="flex items-center gap-2 cursor-pointer text-sm text-[var(--token-text-primary)]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => handleDriverToggle(driver.driverId, e.target.checked)}
                    className="rounded border-[var(--token-border-default)]"
                  />
                  <span className="truncate">{driver.driverName}</span>
                </label>
              )
            })}
          </div>
          {driverOptions.length > 50 && (
            <p className="text-xs text-[var(--token-text-secondary)] mt-1">
              Showing first 50 drivers. Use overview selection to compare others.
            </p>
          )}
        </div>
      )}

      {!hasData && (
        <p className="text-sm text-[var(--token-text-secondary)] py-2">
          {effectiveDriverIds.length === 0
            ? "Select drivers above or use Customize to compare lap time trends."
            : "No lap time data for selected drivers."}
        </p>
      )}

      {hasData && (
        <>
          <p className="text-sm text-[var(--token-text-secondary)] mb-2">
            Comparing {driverLapTrends.length} driver
            {driverLapTrends.length !== 1 ? "s" : ""}:{" "}
            {driverLapTrends
              .map((t) => t.driverName)
              .slice(0, 5)
              .join(", ")}
            {driverLapTrends.length > 5 ? ` +${driverLapTrends.length - 5} more` : ""}
          </p>
          <button
            type="button"
            onClick={openChart}
            className="w-full rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-3 py-2 text-sm font-medium text-[var(--token-text-primary)] hover:bg-[var(--token-surface-elevated)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            Compare trend chart
          </button>
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeChart}
        title="Lap-by-lap trend (every lap)"
        maxWidth="4xl"
        ariaLabel="Lap-by-lap trend chart"
      >
        <div className="p-4 min-w-0">
          {lapTrendLoading && (
            <div
              className="flex items-center justify-center text-[var(--token-text-secondary)]"
              style={{ minHeight: MODAL_CHART_HEIGHT }}
            >
              Loading lap data…
            </div>
          )}
          {!lapTrendLoading && lapTrendError && (
            <div
              className="flex items-center justify-center text-[var(--token-text-secondary)]"
              style={{ minHeight: MODAL_CHART_HEIGHT }}
            >
              {lapTrendError}
            </div>
          )}
          {!lapTrendLoading && !lapTrendError && lapTrendData && (
            <>
              {lapTrendData.drivers.some((d) => d.laps.length > 0) ? (
                <LapByLapTrendChart
                  drivers={lapTrendData.drivers}
                  height={MODAL_CHART_HEIGHT}
                  chartInstanceId="overview-lap-trend-modal"
                />
              ) : (
                <div
                  className="flex items-center justify-center text-[var(--token-text-secondary)]"
                  style={{ minHeight: MODAL_CHART_HEIGHT }}
                >
                  Lap-level data not available for selected drivers (lap times may not be stored for
                  this event).
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
