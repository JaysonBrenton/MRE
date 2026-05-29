/**
 * @fileoverview Pure helpers for LapByLapTrendChart (bands, aggregate tooltip, colors)
 */

import type { DriverLapTrendSeries, LapTrendPoint } from "@/core/events/get-lap-data"

export interface SessionBand {
  startLapIndex: number
  endLapIndex: number
  raceId: string
  raceLabel: string
}

export interface AggregateTooltipColumn {
  driverId: string
  driverName: string
  currentLapNumber: number | null
  positionOnLap: number | null
  lapTimeSeconds: number | null
  raceId: string | null
  raceLabel: string | null
}

export interface AggregateTooltipPayload {
  /** Primary heading when all drivers share one session at this index; otherwise generic */
  sessionHeading: string
  lapIndex: number
  columns: AggregateTooltipColumn[]
}

function isPlottableLapTime(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

export function countPlottableLaps(laps: LapTrendPoint[]): number {
  return laps.filter((lap) => isPlottableLapTime(lap.lapTimeSeconds)).length
}

/** Filter lap series to allowed races without re-indexing (preserves shared event lap index). */
export function filterLapTrendDriversByRaceIds(
  drivers: DriverLapTrendSeries[],
  allowedRaceIds: ReadonlySet<string>
): DriverLapTrendSeries[] {
  return drivers.map((driver) => ({
    ...driver,
    laps: (driver.laps as LapTrendPoint[]).filter((lap) => allowedRaceIds.has(lap.raceId)),
  }))
}

export function driverHasPlottableLaps(driver: DriverLapTrendSeries): boolean {
  return countPlottableLaps(driver.laps as LapTrendPoint[]) > 0
}

/**
 * Session bands from all visible drivers: one band per raceId with min/max lap index
 * across drivers, ordered by earliest lap index seen for that race.
 */
export function computeSessionBands(drivers: DriverLapTrendSeries[]): SessionBand[] {
  const raceMeta = new Map<string, { raceLabel: string; minIndex: number; maxIndex: number }>()

  for (const driver of drivers) {
    for (const lap of driver.laps as LapTrendPoint[]) {
      const prev = raceMeta.get(lap.raceId)
      if (!prev) {
        raceMeta.set(lap.raceId, {
          raceLabel: lap.raceLabel,
          minIndex: lap.lapIndex,
          maxIndex: lap.lapIndex,
        })
      } else {
        prev.minIndex = Math.min(prev.minIndex, lap.lapIndex)
        prev.maxIndex = Math.max(prev.maxIndex, lap.lapIndex)
        if (lap.raceLabel.trim()) prev.raceLabel = lap.raceLabel
      }
    }
  }

  return [...raceMeta.entries()]
    .sort((a, b) => a[1].minIndex - b[1].minIndex || a[0].localeCompare(b[0]))
    .map(([raceId, meta]) => ({
      raceId,
      raceLabel: meta.raceLabel,
      startLapIndex: meta.minIndex,
      endLapIndex: meta.maxIndex,
    }))
}

/** Vertical divider cues for session boundaries (all bands after the first chronologically). */
export function computeSessionDividers(bands: SessionBand[]): SessionBand[] {
  return bands.slice(1)
}

function nearestLapForDriverAtIndex(
  laps: LapTrendPoint[],
  targetLapIndex: number
): LapTrendPoint | null {
  const plottable = laps.filter((l) => isPlottableLapTime(l.lapTimeSeconds))
  if (plottable.length === 0) return null

  let nearest = plottable[0]
  let minDist = Math.abs(nearest.lapIndex - targetLapIndex)
  for (let i = 1; i < plottable.length; i += 1) {
    const dist = Math.abs(plottable[i].lapIndex - targetLapIndex)
    if (dist < minDist) {
      minDist = dist
      nearest = plottable[i]
    }
  }
  return nearest
}

export function buildAggregateTooltipPayload(params: {
  drivers: DriverLapTrendSeries[]
  lapIndexValue: number
  minLapIndex: number
  maxLapIndex: number
  raceDisplayLabelById: Map<string, string>
}): AggregateTooltipPayload | null {
  const { drivers, lapIndexValue, minLapIndex, maxLapIndex, raceDisplayLabelById } = params
  if (drivers.length === 0) return null

  const snappedLapIndex = Math.max(minLapIndex, Math.min(maxLapIndex, Math.round(lapIndexValue)))

  const columns: AggregateTooltipColumn[] = drivers.map((driver) => {
    const nearest = nearestLapForDriverAtIndex(driver.laps as LapTrendPoint[], snappedLapIndex)
    if (!nearest) {
      return {
        driverId: driver.driverId,
        driverName: driver.driverName,
        currentLapNumber: null,
        positionOnLap: null,
        lapTimeSeconds: null,
        raceId: null,
        raceLabel: null,
      }
    }

    const rawPosition = nearest.positionOnLap
    const positionOnLap =
      typeof rawPosition === "number" && Number.isFinite(rawPosition) && rawPosition >= 1
        ? Math.round(rawPosition)
        : null
    const rawLapNumber = nearest.lapNumber
    const currentLapNumber =
      typeof rawLapNumber === "number" && Number.isFinite(rawLapNumber) && rawLapNumber >= 1
        ? Math.round(rawLapNumber)
        : null

    return {
      driverId: driver.driverId,
      driverName: driver.driverName,
      currentLapNumber,
      positionOnLap,
      lapTimeSeconds: isPlottableLapTime(nearest.lapTimeSeconds) ? nearest.lapTimeSeconds : null,
      raceId: nearest.raceId,
      raceLabel: nearest.raceLabel,
    }
  })

  const raceIdsAtIndex = new Set(
    columns.map((c) => c.raceId).filter((id): id is string => id != null)
  )
  const raceLabels = new Set(
    columns
      .map((c) => c.raceLabel)
      .filter((l): l is string => typeof l === "string" && l.length > 0)
  )

  let sessionHeading: string
  if (raceIdsAtIndex.size === 1) {
    const onlyRaceId = [...raceIdsAtIndex][0]
    sessionHeading =
      raceDisplayLabelById.get(onlyRaceId) ??
      columns.find((c) => c.raceId === onlyRaceId)?.raceLabel ??
      "Session"
  } else if (raceLabels.size === 1) {
    sessionHeading = [...raceLabels][0]
  } else {
    sessionHeading = "Multiple sessions"
  }

  return {
    sessionHeading,
    lapIndex: snappedLapIndex,
    columns,
  }
}

/** Stable localStorage suffix for a driver's line color */
export function driverLineColorKey(driverId: string): string {
  return `driverId-${driverId.replace(/[^a-zA-Z0-9_-]/g, "_")}`
}

const DRIVER_PALETTE = [
  "var(--token-chart-series-1)",
  "var(--token-chart-series-2)",
  "var(--token-chart-series-3)",
  "var(--token-chart-series-4)",
  "var(--token-chart-series-5)",
  "var(--token-chart-series-6)",
  "var(--token-chart-series-7)",
  "var(--token-chart-series-8)",
  "var(--token-chart-series-9)",
  "var(--token-chart-series-10)",
  "var(--token-chart-series-11)",
  "var(--token-chart-series-12)",
] as const

export function defaultDriverLineColor(driverId: string, driverIds: string[]): string {
  const sorted = [...driverIds].sort((a, b) => a.localeCompare(b))
  const idx = sorted.indexOf(driverId)
  const paletteIndex = idx >= 0 ? idx : 0
  return DRIVER_PALETTE[paletteIndex % DRIVER_PALETTE.length]
}
