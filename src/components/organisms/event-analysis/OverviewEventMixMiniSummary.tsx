"use client"

import { useMemo, useState } from "react"
import type { SessionMixSegment } from "@/core/events/build-event-highlights"
import Modal from "@/components/molecules/Modal"
import {
  ClassMixMiniStackedBar,
  EventHighlightsMixFilteredChart,
  SessionMixMiniStackedBar,
} from "./EventHighlightsMixCharts"
import { typography } from "@/lib/typography"
import type { MixInsightMetric } from "@/lib/event-mix-analytics"

/** Shared min-height for the three mix mini slots (keeps tri-column rhythm). */
const MIX_MINI_CHART_SLOT_CLASS =
  "flex min-h-[2.5rem] w-full max-w-[min(100%,14rem)] flex-col justify-center"

const MIX_OPEN_HIT_CLASS = [
  "w-full rounded-lg border border-transparent p-1.5 outline-none",
  "transition-[border-color,background-color]",
  "hover:border-[color-mix(in_oklab,var(--token-border-muted)_52%,transparent)]",
  "hover:bg-[var(--token-surface-raised)]/40",
  "focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)]",
].join(" ")

export type OverviewEventMixMiniSummaryProps = {
  sessionMix: SessionMixSegment[]
  classMixByDrivers: SessionMixSegment[]
  classMixByLaps: SessionMixSegment[]
}

/**
 * Minimal overview: session, driver, and lap mix minis; each opens the full breakdown modal
 * on the matching tab when data exists.
 */
export function OverviewEventMixMiniSummary({
  sessionMix,
  classMixByDrivers,
  classMixByLaps,
}: OverviewEventMixMiniSummaryProps) {
  const [mixOpen, setMixOpen] = useState(false)
  const [mixMetric, setMixMetric] = useState<MixInsightMetric>("session")

  const sessionTotal = useMemo(
    () => sessionMix.reduce((s, x) => s + (Number.isFinite(x.count) ? Math.max(0, x.count) : 0), 0),
    [sessionMix]
  )

  const driversTotal = useMemo(
    () =>
      classMixByDrivers.reduce(
        (s, x) => s + (Number.isFinite(x.count) ? Math.max(0, x.count) : 0),
        0
      ),
    [classMixByDrivers]
  )

  const lapsTotal = useMemo(
    () =>
      classMixByLaps.reduce((s, x) => s + (Number.isFinite(x.count) ? Math.max(0, x.count) : 0), 0),
    [classMixByLaps]
  )

  const hasModalBody =
    sessionMix.length > 0 || classMixByDrivers.length > 0 || classMixByLaps.length > 0

  const openWithMetric = (metric: MixInsightMetric) => {
    if (!hasModalBody) return
    if (metric === "session" && sessionTotal <= 0) return
    if (metric === "drivers" && driversTotal <= 0) return
    if (metric === "laps" && lapsTotal <= 0) return
    setMixMetric(metric)
    setMixOpen(true)
  }

  return (
    <>
      <div
        className="border-t border-[var(--token-border-muted)]/60 pt-3"
        role="region"
        aria-label="Event mix summary"
      >
        <div
          className={[
            "grid min-h-0 min-w-0 w-full max-w-full justify-items-center text-center",
            "grid-cols-1 gap-x-4 gap-y-3",
            "sm:grid-cols-3 sm:gap-x-5",
          ].join(" ")}
        >
          <div className="flex min-w-0 w-full flex-col items-center gap-1.5 text-center">
            <span className={typography.overviewMetricLabel}>Session Mix</span>
            <div className={MIX_MINI_CHART_SLOT_CLASS}>
              {sessionTotal > 0 ? (
                <button
                  type="button"
                  className={MIX_OPEN_HIT_CLASS}
                  onClick={() => openWithMetric("session")}
                  aria-haspopup="dialog"
                  aria-label="View full session mix breakdown"
                >
                  <SessionMixMiniStackedBar segments={sessionMix} suppressA11y />
                </button>
              ) : (
                <p
                  className="text-[11px] leading-snug text-[var(--token-text-muted)]"
                  role="status"
                >
                  No session data
                </p>
              )}
            </div>
          </div>

          <div className="flex min-w-0 w-full flex-col items-center gap-1.5 text-center">
            <span className={typography.overviewMetricLabel}>Driver Mix</span>
            <div className={MIX_MINI_CHART_SLOT_CLASS}>
              {driversTotal > 0 ? (
                <button
                  type="button"
                  className={MIX_OPEN_HIT_CLASS}
                  onClick={() => openWithMetric("drivers")}
                  aria-haspopup="dialog"
                  aria-label="View full driver mix by class"
                >
                  <ClassMixMiniStackedBar
                    segments={classMixByDrivers}
                    kind="drivers"
                    suppressA11y
                  />
                </button>
              ) : (
                <p
                  className="text-[11px] leading-snug text-[var(--token-text-muted)]"
                  role="status"
                >
                  No driver data
                </p>
              )}
            </div>
          </div>

          <div className="flex min-w-0 w-full flex-col items-center gap-1.5 text-center">
            <span className={typography.overviewMetricLabel}>Lap Mix</span>
            <div className={MIX_MINI_CHART_SLOT_CLASS}>
              {lapsTotal > 0 ? (
                <button
                  type="button"
                  className={MIX_OPEN_HIT_CLASS}
                  onClick={() => openWithMetric("laps")}
                  aria-haspopup="dialog"
                  aria-label="View full lap mix by class"
                >
                  <ClassMixMiniStackedBar segments={classMixByLaps} kind="laps" suppressA11y />
                </button>
              ) : (
                <p
                  className="text-[11px] leading-snug text-[var(--token-text-muted)]"
                  role="status"
                >
                  No lap data
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {hasModalBody ? (
        <Modal
          isOpen={mixOpen}
          onClose={() => setMixOpen(false)}
          title="Event mix"
          subtitle="Session, driver, and lap breakdowns"
          maxWidth="3xl"
          resizable
          resizableDefaultSize={{ width: "46rem" }}
        >
          <EventHighlightsMixFilteredChart
            key={mixMetric}
            sessionMix={sessionMix}
            classMixByDrivers={classMixByDrivers}
            classMixByLaps={classMixByLaps}
            embeddedInEventDetails
            initialMetric={mixMetric}
          />
        </Modal>
      ) : null}
    </>
  )
}
