/**
 * @fileoverview Collapsed-tile summary for Event / Session Level Analysis cards.
 *
 * @description Replaces the shrunk "mini chart" preview in a collapsed analysis
 * tile with a legible, non-interactive headline summary (metric + supporting
 * detail + optional chips + a tap-to-expand hint). One shared presentation so
 * every collapsed card reads consistently regardless of the underlying chart or
 * bracket it expands into. Compound values use middle dot (` · `), never em dash;
 * see `docs/design/mre-ux-principles.md` §1.1.
 *
 * @relatedFiles
 * - docs/implimentation_plans/analysis-card-collapse-mini-chart-2026-05.md (D2/D4)
 * - src/components/organisms/event-analysis/OverviewCollapsibleGlassCard.tsx (host tile)
 * - src/components/organisms/event-analysis/OverviewTab.tsx (consumer)
 */

"use client"

import type { ReactNode } from "react"

export type AnalysisCardMiniSummaryTone = "neutral" | "positive" | "warning" | "negative"

export type AnalysisCardMiniSummaryPrimary = {
  label: string
  value: ReactNode
  tone?: AnalysisCardMiniSummaryTone
}

export type AnalysisCardMiniSummaryFact = {
  id: string
  label: string
  value: ReactNode
  tone?: AnalysisCardMiniSummaryTone
}

export interface AnalysisCardMiniSummaryProps {
  /** Tiny uppercase context label (e.g. the resolved class). */
  eyebrow?: ReactNode
  /** Headline value (rendered large). */
  metric: ReactNode
  /** Short caption beside the headline metric. */
  metricLabel: ReactNode
  /** One key/value line (most important single piece of info). */
  primary?: AnalysisCardMiniSummaryPrimary
  /** Small facts grid (aim for 3–4 items). */
  facts?: AnalysisCardMiniSummaryFact[]
  /** Muted call-to-action shown at the bottom of the tile. */
  hint?: string
}

const TONE_CLASS: Record<AnalysisCardMiniSummaryTone, string> = {
  neutral: "text-[var(--token-text-secondary)]",
  positive: "text-green-300",
  warning: "text-amber-300",
  negative: "text-red-300",
}

/** Static, non-interactive headline summary for a collapsed analysis tile. */
export default function AnalysisCardMiniSummary({
  eyebrow,
  metric,
  metricLabel,
  primary,
  facts,
  hint,
}: AnalysisCardMiniSummaryProps) {
  return (
    <div className="flex h-full w-full min-w-0 flex-col gap-2">
      {eyebrow ? (
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--token-text-tertiary)]">
          {eyebrow}
        </span>
      ) : null}

      <div className="flex min-w-0 items-baseline gap-2">
        <span className="text-2xl font-semibold leading-none text-[var(--token-text-primary)]">
          {metric}
        </span>
        <span className="min-w-0 truncate text-sm text-[var(--token-text-secondary)]">
          {metricLabel}
        </span>
      </div>

      {primary ? (
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-xs font-medium text-[var(--token-text-tertiary)]">
            {primary.label}
          </span>
          <span
            className={`min-w-0 truncate text-xs ${TONE_CLASS[primary.tone ?? "neutral"]}`}
            title={typeof primary.value === "string" ? primary.value : undefined}
          >
            {primary.value}
          </span>
        </div>
      ) : null}

      {facts && facts.length > 0 ? (
        <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-1">
          {facts.slice(0, 4).map((fact) => (
            <div key={fact.id} className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 text-[11px] text-[var(--token-text-tertiary)]">
                {fact.label}
              </span>
              <span
                className={`min-w-0 truncate text-[11px] ${TONE_CLASS[fact.tone ?? "neutral"]}`}
                title={typeof fact.value === "string" ? fact.value : undefined}
              >
                {fact.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {hint ? (
        <span className="mt-auto text-[11px] text-[var(--token-text-tertiary)]">{hint}</span>
      ) : null}
    </div>
  )
}
