"use client"

import { useMemo } from "react"
import type { WeatherDayRow } from "@/hooks/useEventWeather"
import { computeEventWeatherGlance } from "@/lib/event-weather-glance"
import { formatDateLong } from "@/lib/date-utils"
import { EVENT_DETAILS_WEATHER_GLANCE_CLASS } from "@/components/organisms/event-analysis/overview-glass-surface"
import { typography } from "@/lib/typography"
import TemperatureSparkline from "./TemperatureSparkline"

const WRAP_CLASS = EVENT_DETAILS_WEATHER_GLANCE_CLASS

const CHIP_CLASS_COMPACT =
  "min-w-0 max-w-full rounded-lg border border-[color-mix(in_oklab,var(--token-border-muted)_72%,transparent)] bg-[color-mix(in_oklab,var(--token-surface-raised)_38%,var(--token-surface-alt))] px-2.5 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]"

/** Fills grid cells in the glass Event Conditions column — wider padding, full cell width. */
const CHIP_CLASS_FILL =
  "min-w-0 w-full rounded-lg border border-[color-mix(in_oklab,var(--token-border-muted)_72%,transparent)] bg-[color-mix(in_oklab,var(--token-surface-raised)_38%,var(--token-surface-alt))] px-3 py-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]"

const TREND_SECTION_CLASS =
  "mt-3 min-w-0 w-full border-t border-[color-mix(in_oklab,var(--token-border-muted)_55%,transparent)] pt-3"

type HourlyPoint = { time: string; temperature: number }

/**
 * One chronological hourly temperature series for the full event (all days in `weatherByDay`).
 */
function mergeEventHourlyTemperatureSeries(rows: WeatherDayRow[]): {
  hourly: HourlyPoint[]
  minTemp: number
  maxTemp: number
} | null {
  if (!rows.length) return null

  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  const merged: HourlyPoint[] = []
  for (const row of sorted) {
    const hourly = row.weather.dailyTemperatureSummary?.hourly
    if (!hourly?.length) continue
    merged.push(...hourly)
  }

  if (merged.length < 2) return null

  merged.sort((a, b) => {
    const ta = new Date(a.time).getTime()
    const tb = new Date(b.time).getTime()
    const aOk = Number.isFinite(ta)
    const bOk = Number.isFinite(tb)
    if (!aOk && !bOk) return 0
    if (!aOk) return 1
    if (!bOk) return -1
    return ta - tb
  })

  const seenTime = new Set<string>()
  const deduped: HourlyPoint[] = []
  for (const p of merged) {
    if (seenTime.has(p.time)) continue
    seenTime.add(p.time)
    deduped.push(p)
  }

  const hourly = deduped.length >= 2 ? deduped : merged
  if (hourly.length < 2) return null

  let minTemp = Infinity
  let maxTemp = -Infinity
  for (const p of hourly) {
    const t = p.temperature
    if (typeof t !== "number" || Number.isNaN(t)) continue
    minTemp = Math.min(minTemp, t)
    maxTemp = Math.max(maxTemp, t)
  }
  if (!Number.isFinite(minTemp) || !Number.isFinite(maxTemp)) return null

  return { hourly, minTemp, maxTemp }
}

type GlanceChipProps = {
  label: string
  dateIso: string
  detail: string
  /** `fill` expands to use column width when laid out in a grid (flat variant). */
  layout?: "compact" | "fill"
}

function GlanceChip({ label, dateIso, detail, layout = "compact" }: GlanceChipProps) {
  const dateLabel = formatDateLong(dateIso)
  const shell = layout === "fill" ? CHIP_CLASS_FILL : CHIP_CLASS_COMPACT
  return (
    <div className={shell}>
      <div className={`${typography.overviewMetricLabel} mb-0.5`}>{label}</div>
      <div className={`${typography.overviewMetricValue} break-words`}>{dateLabel}</div>
      <div className={`${typography.overviewMetricValue} break-words`}>{detail}</div>
    </div>
  )
}

export type EventWeatherAtAGlanceProps = {
  weatherByDay: WeatherDayRow[]
  /**
   * `default`: inset well (border + fill) for embedding in Event details tab body.
   * `flat`: content only — parent supplies the surface (e.g. glass Event Conditions column).
   */
  variant?: "default" | "flat"
}

/**
 * Compact multi-day weather summary for Event details → Weather tab (above daily cards).
 */
export function EventWeatherAtAGlance({
  weatherByDay,
  variant = "default",
}: EventWeatherAtAGlanceProps) {
  const glance = useMemo(() => computeEventWeatherGlance(weatherByDay), [weatherByDay])

  const eventHourlyTrend = useMemo(
    () => mergeEventHourlyTemperatureSeries(weatherByDay),
    [weatherByDay]
  )

  if (!glance.hasAny) return null

  const rootClass =
    variant === "flat"
      ? "min-w-0 w-full max-w-full text-left"
      : `min-w-0 w-full max-w-full ${WRAP_CLASS}`

  const chipLayout = variant === "flat" ? "fill" : "compact"

  const visibleChipCount =
    (glance.wettest ? 1 : 0) + (glance.warmest ? 1 : 0) + (glance.windiest ? 1 : 0)

  const chipRowClass =
    variant === "flat"
      ? [
          "grid min-w-0 w-full gap-2",
          visibleChipCount <= 1
            ? "grid-cols-1"
            : visibleChipCount === 2
              ? "grid-cols-2"
              : "grid-cols-3",
        ].join(" ")
      : "flex min-w-0 flex-wrap gap-2"

  const trendHourly = eventHourlyTrend?.hourly
  const firstTrendTime = trendHourly?.[0]?.time
  const lastTrendTime =
    trendHourly && trendHourly.length > 0 ? trendHourly[trendHourly.length - 1]?.time : undefined

  return (
    <div className={rootClass} aria-label="Weather at a glance">
      {variant !== "flat" ? (
        <p className={`${typography.overviewEyebrow} mb-2`}>At a glance</p>
      ) : null}
      {glance.conditionsSummary ? (
        <div
          className={["mb-2 flex min-w-0 w-full flex-col gap-0.5", variant === "flat" ? "pl-3" : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <span className={typography.overviewMetricLabel}>Overall</span>
          <span className={`min-w-0 ${typography.overviewMetricValue} break-words`}>
            {glance.conditionsSummary}
          </span>
        </div>
      ) : null}
      <div className={chipRowClass}>
        {glance.wettest ? (
          <GlanceChip
            label="Wettest"
            dateIso={glance.wettest.date}
            detail={glance.wettest.detail}
            layout={chipLayout}
          />
        ) : null}
        {glance.warmest ? (
          <GlanceChip
            label="Warmest"
            dateIso={glance.warmest.date}
            detail={glance.warmest.detail}
            layout={chipLayout}
          />
        ) : null}
        {glance.windiest ? (
          <GlanceChip
            label="Windiest"
            dateIso={glance.windiest.date}
            detail={glance.windiest.detail}
            layout={chipLayout}
          />
        ) : null}
      </div>
      {eventHourlyTrend ? (
        <div className={TREND_SECTION_CLASS}>
          <div className={`${typography.overviewMetricLabel} mb-2`}>Hourly temperature</div>
          {firstTrendTime && lastTrendTime ? (
            <span className="sr-only">
              Hourly temperature trend from {formatDateLong(firstTrendTime)} through{" "}
              {formatDateLong(lastTrendTime)}
            </span>
          ) : null}
          <TemperatureSparkline
            hourly={eventHourlyTrend.hourly}
            minTemp={eventHourlyTrend.minTemp}
            maxTemp={eventHourlyTrend.maxTemp}
            fullWidth
          />
        </div>
      ) : null}
    </div>
  )
}
