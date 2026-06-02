/**
 * @fileoverview Pure helpers for LapByLapTrendChart (bands, crosshair tooltip, colors)
 */

import type { DriverLapTrendSeries, LapTrendPoint } from "@/core/events/get-lap-data"

export interface SessionBand {
  startLapIndex: number
  endLapIndex: number
  raceId: string
  raceLabel: string
}

export interface CrosshairTooltipColumn {
  driverId: string
  driverName: string
  currentLapNumber: number | null
  positionOnLap: number | null
  lapTimeSeconds: number | null
  raceId: string | null
  raceLabel: string | null
  className: string | null
  sessionName: string | null
  lapInSession: string | null
  overallLapIndex: number | null
  deltaToDriverBestSeconds: number | null
  deltaToChartBestSeconds: number | null
  isOutlierLap: boolean
}

/** @deprecated Use CrosshairTooltipColumn */
export type AggregateTooltipColumn = CrosshairTooltipColumn

export type ChartXDimension = "eventLapIndex" | "sessionLapNumber"

/**
 * One contiguous block of the shared event x-axis, owned by a single session (raceId).
 * `startOffset` laps precede this session; its first lap sits at `startOffset + 1` and its
 * last at `startOffset + lapCount`.
 */
export interface SessionLayoutEntry {
  raceId: string
  raceLabel: string
  startOffset: number
  lapCount: number
}

/**
 * Session-aligned x-axis for multi-driver event scope. Sessions are concatenated in
 * chronological order and each is sized by its widest driver, so a given x maps to exactly
 * one session and one session-lap for every driver (fixes per-driver cumulative index drift).
 */
export interface SessionLayout {
  entries: SessionLayoutEntry[]
  byRaceId: Map<string, SessionLayoutEntry>
  totalLaps: number
}

export interface CrosshairTooltipPayload {
  /** Primary heading when all drivers share one session at this index; otherwise generic */
  sessionHeading: string
  /** Snapped X-axis value (session-aligned event x, or session lap number, per `xDimension`). */
  lapIndex: number
  /** Lap number within the resolved session at this x (shared across drivers when aligned). */
  lapInSessionNumber: number | null
  columns: CrosshairTooltipColumn[]
  /** Present when all drivers with data at this X share one session */
  sessionMeta?: {
    raceStartTime: string | null
    sessionDurationSeconds: number | null
  }
}

/** @deprecated Use CrosshairTooltipPayload */
export type AggregateTooltipPayload = CrosshairTooltipPayload

function lapSessionNumber(lap: LapTrendPoint): number | null {
  const lapNumber = lap.lapNumber
  return typeof lapNumber === "number" && Number.isFinite(lapNumber) && lapNumber >= 1
    ? Math.round(lapNumber)
    : null
}

/**
 * Build the shared session-aligned x-axis from all selected drivers' laps. Sessions are ordered
 * by the earliest per-driver lap index seen (chronological), then raceId for stability.
 */
export function computeSessionLayout(drivers: DriverLapTrendSeries[]): SessionLayout {
  const meta = new Map<string, { raceLabel: string; minIndex: number; maxLapNumber: number }>()

  for (const driver of drivers) {
    for (const lap of driver.laps as LapTrendPoint[]) {
      if (!isPlottableLapTime(lap.lapTimeSeconds)) continue
      const sessionLap = lapSessionNumber(lap)
      if (sessionLap == null) continue
      const prev = meta.get(lap.raceId)
      if (!prev) {
        meta.set(lap.raceId, {
          raceLabel: lap.raceLabel,
          minIndex: lap.lapIndex,
          maxLapNumber: sessionLap,
        })
      } else {
        prev.minIndex = Math.min(prev.minIndex, lap.lapIndex)
        prev.maxLapNumber = Math.max(prev.maxLapNumber, sessionLap)
        if (lap.raceLabel.trim()) prev.raceLabel = lap.raceLabel
      }
    }
  }

  const ordered = [...meta.entries()].sort(
    (a, b) => a[1].minIndex - b[1].minIndex || a[0].localeCompare(b[0])
  )

  const entries: SessionLayoutEntry[] = []
  const byRaceId = new Map<string, SessionLayoutEntry>()
  let offset = 0
  for (const [raceId, m] of ordered) {
    const entry: SessionLayoutEntry = {
      raceId,
      raceLabel: m.raceLabel,
      startOffset: offset,
      lapCount: m.maxLapNumber,
    }
    entries.push(entry)
    byRaceId.set(raceId, entry)
    offset += m.maxLapNumber
  }

  return { entries, byRaceId, totalLaps: offset }
}

/** Session-aligned event x for a lap: session offset + its lap-in-session number. */
export function alignedEventLapX(lap: LapTrendPoint, layout: SessionLayout): number | null {
  const entry = layout.byRaceId.get(lap.raceId)
  if (!entry) return null
  const sessionLap = lapSessionNumber(lap)
  if (sessionLap == null) return null
  return entry.startOffset + sessionLap
}

/**
 * X-axis value for a lap point; null when missing/invalid.
 * For `eventLapIndex`, pass `layout` to use the shared session-aligned axis; without it,
 * falls back to the legacy per-driver cumulative lap index.
 */
export function lapChartXValue(
  lap: LapTrendPoint,
  dimension: ChartXDimension,
  layout?: SessionLayout
): number | null {
  if (dimension === "eventLapIndex") {
    if (layout) return alignedEventLapX(lap, layout)
    return Number.isFinite(lap.lapIndex) && lap.lapIndex >= 1 ? lap.lapIndex : null
  }
  return lapSessionNumber(lap)
}

/** Session bands derived from the shared layout (exact, driver-independent boundaries). */
export function sessionBandsFromLayout(layout: SessionLayout): SessionBand[] {
  return layout.entries.map((entry) => ({
    raceId: entry.raceId,
    raceLabel: entry.raceLabel,
    startLapIndex: entry.startOffset + 1,
    endLapIndex: entry.startOffset + entry.lapCount,
  }))
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

function driverBestLapTime(driver: DriverLapTrendSeries): number | null {
  const times = (driver.laps as LapTrendPoint[])
    .map((l) => l.lapTimeSeconds)
    .filter((t) => isPlottableLapTime(t))
  return times.length > 0 ? Math.min(...times) : null
}

function chartBestLapTime(drivers: DriverLapTrendSeries[]): number | null {
  const allTimes = drivers.flatMap((d) =>
    (d.laps as LapTrendPoint[]).map((l) => l.lapTimeSeconds).filter((t) => isPlottableLapTime(t))
  )
  return allTimes.length > 0 ? Math.min(...allTimes) : null
}

function parseSessionName(lap: LapTrendPoint): string {
  const className = lap.className ?? lap.raceLabel
  if (lap.raceLabel.startsWith(className)) {
    const rest = lap.raceLabel.slice(className.length).trim()
    return rest || lap.raceLabel
  }
  return lap.raceLabel
}

export function buildSessionLapMeta(
  driver: DriverLapTrendSeries,
  lap: LapTrendPoint
): {
  sessionLapRange?: string
  lapInSession?: string
} {
  const sameSessionLaps = (driver.laps as LapTrendPoint[])
    .filter((l) => l.raceId === lap.raceId)
    .filter(
      (l) => typeof l.lapNumber === "number" && Number.isFinite(l.lapNumber) && l.lapNumber >= 1
    )
  if (sameSessionLaps.length === 0) return {}
  const lapNumbers = sameSessionLaps.map((l) => Math.round(l.lapNumber))
  const minLapNumber = Math.min(...lapNumbers)
  const maxLapNumber = Math.max(...lapNumbers)
  const sessionLapRange =
    minLapNumber === maxLapNumber
      ? `Session lap ${minLapNumber}`
      : `Session laps ${minLapNumber}-${maxLapNumber}`
  return {
    sessionLapRange,
    lapInSession: `Session Lap: ${Math.round(lap.lapNumber)} of ${maxLapNumber}`,
  }
}

function emptyCrosshairColumn(driver: DriverLapTrendSeries): CrosshairTooltipColumn {
  return {
    driverId: driver.driverId,
    driverName: driver.driverName,
    currentLapNumber: null,
    positionOnLap: null,
    lapTimeSeconds: null,
    raceId: null,
    raceLabel: null,
    className: null,
    sessionName: null,
    lapInSession: null,
    overallLapIndex: null,
    deltaToDriverBestSeconds: null,
    deltaToChartBestSeconds: null,
    isOutlierLap: false,
  }
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

/** Exact lap at the snapped X value; no nearest-neighbour fallback (avoids misleading cross-lap data). */
export function lapForDriverAtChartX(
  laps: LapTrendPoint[],
  targetX: number,
  dimension: ChartXDimension,
  layout?: SessionLayout
): LapTrendPoint | null {
  const snapped = Math.round(targetX)
  for (const lap of laps) {
    if (!isPlottableLapTime(lap.lapTimeSeconds)) continue
    const x = lapChartXValue(lap, dimension, layout)
    if (x === snapped) return lap
  }
  return null
}

export function buildCrosshairTooltipPayload(params: {
  drivers: DriverLapTrendSeries[]
  lapIndexValue: number
  minLapIndex: number
  maxLapIndex: number
  raceDisplayLabelById: Map<string, string>
  xDimension?: ChartXDimension
  sessionLayout?: SessionLayout
  outlierLapKeysByDriverId?: ReadonlyMap<string, ReadonlySet<string>>
}): CrosshairTooltipPayload | null {
  const {
    drivers,
    lapIndexValue,
    minLapIndex,
    maxLapIndex,
    raceDisplayLabelById,
    xDimension = "eventLapIndex",
    sessionLayout,
    outlierLapKeysByDriverId = new Map(),
  } = params
  if (drivers.length === 0) return null

  const snappedLapIndex = Math.max(minLapIndex, Math.min(maxLapIndex, Math.round(lapIndexValue)))
  const chartBest = chartBestLapTime(drivers)

  const columns: CrosshairTooltipColumn[] = drivers.map((driver) => {
    const lapAtX = lapForDriverAtChartX(
      driver.laps as LapTrendPoint[],
      snappedLapIndex,
      xDimension,
      sessionLayout
    )
    if (!lapAtX) {
      return emptyCrosshairColumn(driver)
    }

    const rawPosition = lapAtX.positionOnLap
    const positionOnLap =
      typeof rawPosition === "number" && Number.isFinite(rawPosition) && rawPosition >= 1
        ? Math.round(rawPosition)
        : null
    const rawLapNumber = lapAtX.lapNumber
    const currentLapNumber =
      typeof rawLapNumber === "number" && Number.isFinite(rawLapNumber) && rawLapNumber >= 1
        ? Math.round(rawLapNumber)
        : null

    const driverBest = driverBestLapTime(driver)
    const lapTimeSeconds = lapAtX.lapTimeSeconds
    const lapKey = `${lapAtX.lapIndex}-${lapAtX.raceId}`
    const outlierKeys = outlierLapKeysByDriverId.get(driver.driverId)
    const { lapInSession } = buildSessionLapMeta(driver, lapAtX)

    return {
      driverId: driver.driverId,
      driverName: driver.driverName,
      currentLapNumber,
      positionOnLap,
      lapTimeSeconds: isPlottableLapTime(lapTimeSeconds) ? lapTimeSeconds : null,
      raceId: lapAtX.raceId,
      raceLabel: lapAtX.raceLabel,
      className: lapAtX.className ?? lapAtX.raceLabel,
      sessionName: parseSessionName(lapAtX),
      lapInSession: lapInSession ?? null,
      overallLapIndex: lapAtX.lapIndex,
      deltaToDriverBestSeconds:
        driverBest != null && isPlottableLapTime(lapTimeSeconds)
          ? lapTimeSeconds - driverBest
          : null,
      deltaToChartBestSeconds:
        chartBest != null && isPlottableLapTime(lapTimeSeconds) ? lapTimeSeconds - chartBest : null,
      isOutlierLap: outlierKeys?.has(lapKey) ?? false,
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

  let sessionMeta: CrosshairTooltipPayload["sessionMeta"]
  if (sessionHeading !== "Multiple sessions" && raceIdsAtIndex.size === 1) {
    const onlyRaceId = [...raceIdsAtIndex][0]
    const referenceLap = drivers
      .flatMap((d) => d.laps as LapTrendPoint[])
      .find((lap) => lap.raceId === onlyRaceId && isPlottableLapTime(lap.lapTimeSeconds))
    if (referenceLap) {
      sessionMeta = {
        raceStartTime: referenceLap.raceStartTime ?? null,
        sessionDurationSeconds: referenceLap.durationSeconds ?? null,
      }
    }
  }

  // Lap-in-session is shared across drivers when aligned: session-aligned x minus its offset.
  let lapInSessionNumber: number | null = null
  if (xDimension === "sessionLapNumber") {
    lapInSessionNumber = snappedLapIndex
  } else if (sessionLayout && raceIdsAtIndex.size === 1) {
    const onlyRaceId = [...raceIdsAtIndex][0]
    const entry = sessionLayout.byRaceId.get(onlyRaceId)
    if (entry) lapInSessionNumber = snappedLapIndex - entry.startOffset
  } else {
    const lapNumbers = columns.map((c) => c.currentLapNumber).filter((n): n is number => n != null)
    if (lapNumbers.length > 0 && lapNumbers.every((n) => n === lapNumbers[0])) {
      lapInSessionNumber = lapNumbers[0]
    }
  }

  return {
    sessionHeading,
    lapIndex: snappedLapIndex,
    lapInSessionNumber,
    columns,
    sessionMeta,
  }
}

/** @deprecated Use buildCrosshairTooltipPayload */
export function buildAggregateTooltipPayload(
  params: Parameters<typeof buildCrosshairTooltipPayload>[0]
): AggregateTooltipPayload | null {
  return buildCrosshairTooltipPayload(params)
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
