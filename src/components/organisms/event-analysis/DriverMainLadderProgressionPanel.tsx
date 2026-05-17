/**
 * Mains-ladder driver progression: finish position across bracket finals (1/16 → 1/8 → … → A-main).
 */

"use client"

import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { Group } from "@visx/group"
import { Circle, Line, LinePath } from "@visx/shape"
import { curveLinear } from "@visx/curve"
import { scaleBand, scaleLinear } from "@visx/scale"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { GridRows } from "@visx/grid"
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import { ParentSize } from "@visx/responsive"
import ChartContainer from "@/components/organisms/event-analysis/ChartContainer"
import type { DriverMainEventProgressionMatrix } from "@/core/events/driver-main-event-progression"
import { typography } from "@/lib/typography"

export type MainLadderViewMode = "chart" | "table"
export type MainLadderChartType = "line" | "lollipop" | "pointsLine"

const SERIES_COLORS = [
  "var(--token-chart-series-1)",
  "var(--token-chart-series-2)",
  "var(--token-chart-series-3)",
  "var(--token-chart-series-4)",
] as const

const SERIES_DASHES = ["", "6 4", "3 3", "8 4 2 4"] as const

const LS_VIEW = "viewMode"
const LS_CHART_TYPE = "chartType"
const LS_DRIVERS = "driverIds"

function storageKey(eventId: string, suffix: string): string {
  return `mre.main-ladder-progression.${eventId}.${suffix}`
}

type DriverSlotIds = [string, string, string, string]

const EMPTY_DRIVER_SLOTS: DriverSlotIds = ["", "", "", ""]

function parseDriverIds(raw: string | null): DriverSlotIds | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as unknown
    if (!Array.isArray(v)) return null
    const ids = v.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, 4)
    if (!ids.length) return null
    const slots = [...EMPTY_DRIVER_SLOTS] as DriverSlotIds
    ids.forEach((id, i) => {
      slots[i] = id
    })
    return slots
  } catch {
    return null
  }
}

function selectedIdsFromSlots(slots: DriverSlotIds): string[] {
  return slots.filter((id) => id !== "")
}

function slotsFromIds(ids: string[]): DriverSlotIds {
  const slots = [...EMPTY_DRIVER_SLOTS] as DriverSlotIds
  ids.slice(0, 4).forEach((id, i) => {
    slots[i] = id
  })
  return slots
}

export interface DriverMainLadderProgressionPanelProps {
  eventId: string
  matrix: DriverMainEventProgressionMatrix
  classOptions: string[]
  resolvedClassName: string | null
  onClassNameChange: (className: string) => void
  hasLadderClasses: boolean
}

type ChartPoint = {
  legIdx: number
  x: number
  y: number
  position: number
  sessionLabel: string
}

function splitContiguousSegments(points: ChartPoint[]): ChartPoint[][] {
  if (points.length === 0) return []
  const segments: ChartPoint[][] = []
  let cur: ChartPoint[] = [points[0]!]
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!
    const prev = cur[cur.length - 1]!
    if (p.legIdx === prev.legIdx + 1) {
      cur.push(p)
    } else {
      segments.push(cur)
      cur = [p]
    }
  }
  segments.push(cur)
  return segments
}

function defaultDriverSlots(matrix: DriverMainEventProgressionMatrix): DriverSlotIds {
  const withPath = matrix.rows.filter((r) => r.positions.filter((p) => p !== null).length >= 2)
  const pick = withPath[0] ?? matrix.rows[0]
  return pick ? slotsFromIds([pick.driverId]) : EMPTY_DRIVER_SLOTS
}

function readPersistedViewMode(eventId: string): MainLadderViewMode {
  if (typeof window === "undefined") return "chart"
  const v = localStorage.getItem(storageKey(eventId, LS_VIEW))
  return v === "chart" || v === "table" ? v : "chart"
}

function readPersistedChartType(eventId: string): MainLadderChartType {
  if (typeof window === "undefined") return "line"
  const ct = localStorage.getItem(storageKey(eventId, LS_CHART_TYPE))
  return ct === "line" || ct === "lollipop" || ct === "pointsLine" ? ct : "line"
}

function resolveDriverSlotsForMatrix(
  matrix: DriverMainEventProgressionMatrix,
  eventId: string,
  current: DriverSlotIds
): DriverSlotIds {
  const valid = selectedIdsFromSlots(current).filter((id) =>
    matrix.rows.some((r) => r.driverId === id)
  )
  if (valid.length > 0) return slotsFromIds(valid)
  const stored = parseDriverIds(localStorage.getItem(storageKey(eventId, LS_DRIVERS)))
  const fromStore = stored
    ? selectedIdsFromSlots(stored).filter((id) => matrix.rows.some((r) => r.driverId === id))
    : []
  if (fromStore.length > 0) return slotsFromIds(fromStore)
  return defaultDriverSlots(matrix)
}

export default function DriverMainLadderProgressionPanel({
  eventId,
  matrix,
  classOptions,
  resolvedClassName,
  onClassNameChange,
  hasLadderClasses,
}: DriverMainLadderProgressionPanelProps) {
  const chartDescId = useId()
  const sessionLabels = useMemo(() => matrix.columns.map((c) => c.raceLabel), [matrix.columns])

  const [prefsEventId, setPrefsEventId] = useState(eventId)
  const [viewMode, setViewMode] = useState<MainLadderViewMode>(() => readPersistedViewMode(eventId))
  const [chartType, setChartType] = useState<MainLadderChartType>(() =>
    readPersistedChartType(eventId)
  )
  const [driverSlots, setDriverSlots] = useState<DriverSlotIds>(EMPTY_DRIVER_SLOTS)
  const [prevMatrixSignature, setPrevMatrixSignature] = useState<string | null>(null)

  if (prefsEventId !== eventId) {
    setPrefsEventId(eventId)
    setViewMode(readPersistedViewMode(eventId))
    setChartType(readPersistedChartType(eventId))
    setDriverSlots(EMPTY_DRIVER_SLOTS)
    setPrevMatrixSignature(null)
  }

  const matrixSignature = useMemo(
    () =>
      `${resolvedClassName ?? ""}|${matrix.columns.map((c) => c.sessionId).join("\0")}|${matrix.rows.length}`,
    [resolvedClassName, matrix.columns, matrix.rows.length]
  )

  if (prevMatrixSignature !== matrixSignature) {
    setPrevMatrixSignature(matrixSignature)
    setDriverSlots((prev) => resolveDriverSlotsForMatrix(matrix, eventId, prev))
  }

  useEffect(() => {
    localStorage.setItem(storageKey(eventId, LS_VIEW), viewMode)
  }, [eventId, viewMode])

  useEffect(() => {
    localStorage.setItem(storageKey(eventId, LS_CHART_TYPE), chartType)
  }, [eventId, chartType])

  const selectedDriverIds = useMemo(() => selectedIdsFromSlots(driverSlots), [driverSlots])

  useEffect(() => {
    localStorage.setItem(storageKey(eventId, LS_DRIVERS), JSON.stringify(selectedDriverIds))
  }, [eventId, selectedDriverIds])

  const setDriverSlot = useCallback((slotIndex: number, driverId: string) => {
    setDriverSlots((prev) => {
      const next = [...prev] as DriverSlotIds
      if (driverId) {
        for (let i = 0; i < 4; i++) {
          if (i !== slotIndex && next[i] === driverId) next[i] = ""
        }
      }
      next[slotIndex] = driverId
      return next
    })
  }, [])

  const displayedRows = useMemo(() => {
    const orderMap = new Map(selectedDriverIds.map((id, i) => [id, i]))
    return [...matrix.rows]
      .filter((r) => selectedDriverIds.includes(r.driverId))
      .sort((a, b) => (orderMap.get(a.driverId)! ?? 99) - (orderMap.get(b.driverId)! ?? 99))
      .slice(0, 4)
  }, [matrix.rows, selectedDriverIds])

  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } =
    useTooltip<{
      driverName: string
      sessionLabel: string
      position: number
    }>()

  const maxPosition = useMemo(() => {
    let m = 1
    for (const row of displayedRows) {
      for (const p of row.positions) {
        if (p != null && Number.isFinite(p)) m = Math.max(m, p)
      }
    }
    return m
  }, [displayedRows])

  const headerControls = (
    <ProgressionHeaderControls
      viewMode={viewMode}
      setViewMode={setViewMode}
      chartType={chartType}
      setChartType={setChartType}
      matrixRows={matrix.rows}
      driverSlots={driverSlots}
      onDriverSlotChange={setDriverSlot}
    />
  )

  if (!hasLadderClasses) {
    return (
      <p className={`${typography.bodySecondary} max-w-prose mx-auto text-center`}>
        No classes with multiple mains-ladder sessions (for example 1/8 finals through A-main) were
        found in ingested results for this event.
      </p>
    )
  }

  if (classOptions.length > 1 && !resolvedClassName) {
    return (
      <div className="w-full min-w-0 space-y-3">
        <p className={`${typography.bodySecondary} text-center max-w-prose mx-auto`}>
          Select a class to see how drivers progressed through mains bracket finals.
        </p>
        <div className="flex flex-wrap justify-center gap-2" role="toolbar" aria-label="Class">
          {classOptions.map((c) => (
            <button
              key={c}
              type="button"
              className="inline-flex items-center rounded-full border border-[var(--token-border-subtle)] px-3 py-1 text-xs font-medium text-[var(--token-text-secondary)] hover:border-[var(--token-accent)] hover:text-[var(--token-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
              onClick={() => onClassNameChange(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (resolvedClassName && matrix.columns.length === 0) {
    return (
      <p className={`${typography.bodySecondary} max-w-prose mx-auto text-center`}>
        No mains-ladder sessions found for <strong>{resolvedClassName}</strong>.
      </p>
    )
  }

  return (
    <div className="w-full min-w-0 space-y-4 text-left">
      {classOptions.length > 1 && resolvedClassName && (
        <div className="flex flex-wrap items-center gap-2 justify-center">
          <span className="text-xs text-[var(--token-text-secondary)]">Class:</span>
          <ClassChipRow
            classOptions={classOptions}
            resolvedClassName={resolvedClassName}
            onClassNameChange={onClassNameChange}
          />
        </div>
      )}

      <ChartContainer
        title="Finish position by mains session"
        description="Tracks finishing place in each mains bracket final (for example 1/8 Odd → 1/4 Odd). P1 is at the top."
        height={360}
        headerControls={headerControls}
        chartInstanceId={`main-ladder-finish-${eventId}`}
      >
        <>
          <p id={chartDescId} className="sr-only">
            Finish position across mains ladder sessions for selected drivers.
          </p>
          {viewMode === "table" ? (
            <MainLadderTable matrix={matrix} rows={displayedRows} />
          ) : displayedRows.length === 0 ? (
            <div className="flex min-h-[280px] items-center justify-center text-sm text-[var(--token-text-secondary)]">
              Select at least one driver above (up to four).
            </div>
          ) : (
            <MainLadderChart
              sessionLabels={sessionLabels}
              rows={displayedRows}
              chartType={chartType}
              maxPosition={maxPosition}
              showTooltip={showTooltip}
              hideTooltip={hideTooltip}
            />
          )}
          {tooltipOpen && tooltipData && viewMode === "chart" && (
            <TooltipWithBounds
              top={tooltipTop}
              left={tooltipLeft}
              style={{
                ...defaultStyles,
                background: "var(--token-surface-elevated)",
                border: "1px solid var(--token-border-default)",
                color: "var(--token-text-primary)",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                pointerEvents: "none",
              }}
            >
              <div className="font-medium">{tooltipData.driverName}</div>
              <div className="text-[var(--token-text-secondary)]">
                {tooltipData.sessionLabel}: P{tooltipData.position}
              </div>
            </TooltipWithBounds>
          )}
        </>
      </ChartContainer>
    </div>
  )
}

const progressionSelectClassName =
  "max-w-[9.5rem] truncate rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)]"

function ProgressionHeaderControls({
  viewMode,
  setViewMode,
  chartType,
  setChartType,
  matrixRows,
  driverSlots,
  onDriverSlotChange,
}: {
  viewMode: MainLadderViewMode
  setViewMode: (m: MainLadderViewMode) => void
  chartType: MainLadderChartType
  setChartType: (t: MainLadderChartType) => void
  matrixRows: DriverMainEventProgressionMatrix["rows"]
  driverSlots: DriverSlotIds
  onDriverSlotChange: (slotIndex: number, driverId: string) => void
}) {
  const sortedRows = useMemo(
    () => [...matrixRows].sort((a, b) => a.driverName.localeCompare(b.driverName)),
    [matrixRows]
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="inline-flex rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/60 p-0.5"
        role="group"
        aria-label="View mode"
      >
        {(["chart", "table"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
              viewMode === mode
                ? "bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                : "text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)]"
            }`}
            aria-pressed={viewMode === mode}
            onClick={() => setViewMode(mode)}
          >
            {mode === "chart" ? "Chart" : "Table"}
          </button>
        ))}
      </div>
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Compare drivers, up to four"
      >
        <span className="text-xs text-[var(--token-text-secondary)]" aria-hidden>
          Drivers:
        </span>
        {driverSlots.map((selectedId, slotIndex) => (
          <label
            key={slotIndex}
            className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--token-text-secondary)]"
          >
            <span className="sr-only">Compare driver {slotIndex + 1}</span>
            <select
              className={progressionSelectClassName}
              value={selectedId}
              aria-label={`Compare driver ${slotIndex + 1}`}
              onChange={(e) => onDriverSlotChange(slotIndex, e.target.value)}
            >
              <option value="">—</option>
              {sortedRows.map((row) => {
                const takenElsewhere =
                  driverSlots.includes(row.driverId) && selectedId !== row.driverId
                return (
                  <option key={row.driverId} value={row.driverId} disabled={takenElsewhere}>
                    {row.driverName}
                  </option>
                )
              })}
            </select>
          </label>
        ))}
      </div>
      {viewMode === "chart" && (
        <label className="flex items-center gap-1.5 text-xs text-[var(--token-text-secondary)]">
          <span className="sr-only">Chart style</span>
          <span aria-hidden>Style:</span>
          <select
            className={progressionSelectClassName}
            value={chartType}
            aria-label="Chart style"
            onChange={(e) => setChartType(e.target.value as MainLadderChartType)}
          >
            <option value="line">Line</option>
            <option value="lollipop">Lollipop</option>
            <option value="pointsLine">Points + line</option>
          </select>
        </label>
      )}
    </div>
  )
}

function ClassChipRow({
  classOptions,
  resolvedClassName,
  onClassNameChange,
}: {
  classOptions: string[]
  resolvedClassName: string
  onClassNameChange: (className: string) => void
}) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {classOptions.map((c) => (
        <button
          key={c}
          type="button"
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
            resolvedClassName === c
              ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
              : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:border-[var(--token-border-default)]"
          }`}
          aria-pressed={resolvedClassName === c}
          onClick={() => onClassNameChange(c)}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

function MainLadderTable({
  matrix,
  rows,
}: {
  matrix: DriverMainEventProgressionMatrix
  rows: DriverMainEventProgressionMatrix["rows"]
}) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-[var(--token-text-secondary)]">
        Select at least one driver above to show the table.
      </div>
    )
  }

  const formatCell = (v: number | null) => (v == null ? "—" : `P${v}`)

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-[var(--token-border-default)]">
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/50">
            <th scope="col" className="px-3 py-2 font-semibold text-[var(--token-text-primary)]">
              Driver
            </th>
            {matrix.columns.map((col) => (
              <th
                key={col.sessionId}
                scope="col"
                className="max-w-[10rem] px-2 py-2 text-center text-xs font-semibold text-[var(--token-text-primary)]"
              >
                <span className="line-clamp-2 leading-tight">{col.raceLabel}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.driverId}
              className="border-b border-[var(--token-border-muted)] odd:bg-[var(--token-surface)]/25"
            >
              <td className="px-3 py-2 font-medium whitespace-nowrap text-[var(--token-text-primary)]">
                {row.driverName}
              </td>
              {row.positions.map((cell, i) => (
                <td
                  key={matrix.columns[i]!.sessionId}
                  className="px-2 py-2 text-center tabular-nums text-[var(--token-text-secondary)]"
                >
                  {formatCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MainLadderChart({
  sessionLabels,
  rows,
  chartType,
  maxPosition,
  showTooltip,
  hideTooltip,
}: {
  sessionLabels: string[]
  rows: DriverMainEventProgressionMatrix["rows"]
  chartType: MainLadderChartType
  maxPosition: number
  showTooltip: (args: {
    tooltipLeft: number
    tooltipTop: number
    tooltipData: { driverName: string; sessionLabel: string; position: number }
  }) => void
  hideTooltip: () => void
}) {
  const margin = { top: 12, right: 16, bottom: 88, left: 44 }

  return (
    <LadderChartSvg
      sessionLabels={sessionLabels}
      rows={rows}
      chartType={chartType}
      maxPosition={maxPosition}
      margin={margin}
      showTooltip={showTooltip}
      hideTooltip={hideTooltip}
    />
  )
}

function LadderChartSvg(props: {
  sessionLabels: string[]
  rows: DriverMainEventProgressionMatrix["rows"]
  chartType: MainLadderChartType
  maxPosition: number
  margin: { top: number; right: number; bottom: number; left: number }
  showTooltip: (args: {
    tooltipLeft: number
    tooltipTop: number
    tooltipData: { driverName: string; sessionLabel: string; position: number }
  }) => void
  hideTooltip: () => void
}) {
  const { sessionLabels, rows, chartType, maxPosition, margin, showTooltip, hideTooltip } = props

  return (
    <div className="relative w-full" style={{ height: "300px" }}>
      <ParentSize>
        {({ width: parentWidth }) => {
          const height = 300
          const width = parentWidth || 480
          if (width < 40) return null
          const innerWidth = width - margin.left - margin.right
          const innerHeight = height - margin.top - margin.bottom

          const xScale = scaleBand<string>({
            domain: sessionLabels,
            range: [0, innerWidth],
            padding: 0.2,
          })

          const yScale = scaleLinear<number>({
            domain: [maxPosition + 0.5, 0.5],
            range: [innerHeight, 0],
            nice: false,
          })

          const tickValues = Array.from({ length: maxPosition }, (_, i) => i + 1)

          const seriesGeo = rows.map((row, si) => {
            const pts: ChartPoint[] = []
            sessionLabels.forEach((label, legIdx) => {
              const pos = row.positions[legIdx]
              if (pos == null) return
              const xBand = xScale(label)
              if (xBand == null) return
              pts.push({
                legIdx,
                x: xBand + xScale.bandwidth() / 2,
                y: yScale(pos),
                position: pos,
                sessionLabel: label,
              })
            })
            return {
              row,
              color: SERIES_COLORS[si % SERIES_COLORS.length]!,
              strokeDasharray: SERIES_DASHES[si % SERIES_DASHES.length]!,
              points: pts,
              segments: splitContiguousSegments(pts),
            }
          })

          const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
            const pt = localPoint(event)
            if (!pt) return
            const lx = pt.x - margin.left
            const ly = pt.y - margin.top
            if (lx < 0 || ly < 0 || lx > innerWidth || ly > innerHeight) {
              hideTooltip()
              return
            }
            let best: {
              driverName: string
              sessionLabel: string
              position: number
              dist: number
            } | null = null
            for (const sg of seriesGeo) {
              for (const p of sg.points) {
                const dx = p.x - lx
                const dy = p.y - ly
                const d = dx * dx + dy * dy
                if (!best || d < best.dist) {
                  best = {
                    driverName: sg.row.driverName,
                    sessionLabel: p.sessionLabel,
                    position: p.position,
                    dist: d,
                  }
                }
              }
            }
            if (best && best.dist < 18 * 18) {
              showTooltip({
                tooltipLeft: pt.x,
                tooltipTop: pt.y,
                tooltipData: {
                  driverName: best.driverName,
                  sessionLabel: best.sessionLabel,
                  position: best.position,
                },
              })
            } else {
              hideTooltip()
            }
          }

          return (
            <svg
              width={width}
              height={height}
              role="presentation"
              onMouseMove={handleMouseMove}
              onMouseLeave={hideTooltip}
            >
              <Group left={margin.left} top={margin.top}>
                <GridRows
                  scale={yScale}
                  width={innerWidth}
                  stroke="var(--token-border-muted)"
                  strokeOpacity={0.35}
                  pointerEvents="none"
                />
                <AxisLeft
                  scale={yScale}
                  tickValues={tickValues}
                  stroke="var(--token-text-muted)"
                  tickStroke="var(--token-text-muted)"
                  tickFormat={(v) => `P${v}`}
                  tickLabelProps={() => ({
                    fill: "var(--token-text-secondary)",
                    fontSize: 11,
                    textAnchor: "end",
                    dx: -4,
                  })}
                />
                <AxisBottom
                  top={innerHeight}
                  scale={xScale}
                  stroke="var(--token-text-muted)"
                  tickStroke="var(--token-text-muted)"
                  tickLabelProps={() => ({
                    fill: "var(--token-text-secondary)",
                    fontSize: 10,
                    textAnchor: "end",
                    angle: -40,
                    dx: -4,
                    dy: 2,
                  })}
                />
                {seriesGeo.map((sg) => (
                  <Group key={sg.row.driverId}>
                    {(chartType === "line" || chartType === "pointsLine") &&
                      sg.segments.map((seg, segIdx) => (
                        <LinePath
                          key={`${sg.row.driverId}-seg-${segIdx}`}
                          data={seg}
                          x={(d) => d.x}
                          y={(d) => d.y}
                          stroke={sg.color}
                          strokeWidth={2}
                          strokeDasharray={sg.strokeDasharray}
                          curve={curveLinear}
                        />
                      ))}
                    {(chartType === "lollipop" || chartType === "pointsLine") &&
                      sg.points.map((p) => (
                        <Group key={`${sg.row.driverId}-${p.legIdx}`}>
                          {chartType === "lollipop" && (
                            <Line
                              x1={p.x}
                              x2={p.x}
                              y1={innerHeight}
                              y2={p.y}
                              stroke={sg.color}
                              strokeWidth={1.5}
                              strokeDasharray={sg.strokeDasharray}
                            />
                          )}
                          <Circle
                            cx={p.x}
                            cy={p.y}
                            r={chartType === "pointsLine" ? 5 : 4}
                            fill={chartType === "lollipop" ? sg.color : "var(--token-surface)"}
                            stroke={sg.color}
                            strokeWidth={2}
                          />
                        </Group>
                      ))}
                    {chartType === "line" &&
                      sg.points.map((p) => (
                        <Circle
                          key={`${sg.row.driverId}-${p.legIdx}-dot`}
                          cx={p.x}
                          cy={p.y}
                          r={3.5}
                          fill={sg.color}
                          stroke="var(--token-surface)"
                          strokeWidth={1}
                        />
                      ))}
                  </Group>
                ))}
              </Group>
            </svg>
          )
        }}
      </ParentSize>
    </div>
  )
}
