"use client"

import { useMemo } from "react"
import type { WeatherDayRow } from "@/hooks/useEventWeather"
import { computeEventWeatherGlance } from "@/lib/event-weather-glance"
import { formatDateLong } from "@/lib/date-utils"
import { EVENT_DETAILS_WEATHER_GLANCE_CLASS } from "@/components/organisms/event-analysis/overview-glass-surface"
import { typography } from "@/lib/typography"

const WRAP_CLASS = EVENT_DETAILS_WEATHER_GLANCE_CLASS

const CHIP_CLASS =
  "min-w-0 max-w-full rounded-lg border border-[color-mix(in_oklab,var(--token-border-muted)_72%,transparent)] bg-[color-mix(in_oklab,var(--token-surface-raised)_38%,var(--token-surface-alt))] px-2.5 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]"

type GlanceChipProps = {
  label: string
  dateIso: string
  detail: string
}

function GlanceChip({ label, dateIso, detail }: GlanceChipProps) {
  const dateLabel = formatDateLong(dateIso)
  return (
    <div className={CHIP_CLASS}>
      <div className={`${typography.overviewEyebrow} mb-0.5`}>{label}</div>
      <div className="text-xs font-medium text-[var(--token-text-primary)]">{dateLabel}</div>
      <div className="text-[0.7rem] leading-snug text-[var(--token-text-secondary)]">{detail}</div>
    </div>
  )
}

export type EventWeatherAtAGlanceProps = {
  weatherByDay: WeatherDayRow[]
}

/**
 * Compact multi-day weather summary for Event details → Weather tab (above daily cards).
 */
export function EventWeatherAtAGlance({ weatherByDay }: EventWeatherAtAGlanceProps) {
  const glance = useMemo(() => computeEventWeatherGlance(weatherByDay), [weatherByDay])

  if (!glance.hasAny) return null

  return (
    <div className={`min-w-0 w-full max-w-full ${WRAP_CLASS}`} aria-label="Weather at a glance">
      <p className={`${typography.overviewEyebrow} mb-2`}>At a glance</p>
      <div className="flex min-w-0 flex-wrap gap-2">
        {glance.wettest ? (
          <GlanceChip
            label="Wettest"
            dateIso={glance.wettest.date}
            detail={glance.wettest.detail}
          />
        ) : null}
        {glance.warmest ? (
          <GlanceChip
            label="Warmest"
            dateIso={glance.warmest.date}
            detail={glance.warmest.detail}
          />
        ) : null}
        {glance.windiest ? (
          <GlanceChip
            label="Windiest"
            dateIso={glance.windiest.date}
            detail={glance.windiest.detail}
          />
        ) : null}
      </div>
      {glance.conditionsSummary ? (
        <p className="mt-2 border-t border-[var(--token-border-muted)]/70 pt-2 text-sm leading-snug text-[var(--token-text-secondary)]">
          <span className="font-medium text-[var(--token-text-muted)]">Conditions:</span>{" "}
          {glance.conditionsSummary}
        </p>
      ) : null}
    </div>
  )
}
