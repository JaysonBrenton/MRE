"use client"

import { useMemo, useState } from "react"
import {
  buildClassWinners,
  driverNamesMatchForClassWinner,
  type ClassWinnerHighlight,
} from "@/core/events/build-event-highlights"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { isEventMainSession } from "@/core/events/main-bracket-overall"
import { buildTopQualifierOverviewCards } from "@/core/events/top-qualifier-overview-cards"
import {
  OVERVIEW_GLASS_SURFACE_CLASS,
  OVERVIEW_GLASS_SURFACE_STYLE,
} from "@/components/organisms/event-analysis/overview-glass-surface"
import { typography } from "@/lib/typography"
import { ClassWinnerStandingsModal } from "./ClassWinnerStandingsModal"
import { PodiumNameWithOptionalTq, PodiumSlotName } from "./OverviewPodiumNames"

const PODIUM_CARD_INTERACTIVE_CLASS = [
  "cursor-pointer transition-[box-shadow,filter]",
  "hover:brightness-[1.03] hover:shadow-lg",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)]",
].join(" ")

const NEED_MAIN_TEXT =
  "Main event results aren’t available for this event yet. Overall class podiums appear after at least one main or final is imported."

const EMPTY_OVERALL_TEXT =
  "No overall class results to show yet. They appear after final results are imported for this event."

export type OverviewOverallClassPodiumProps = {
  data: Pick<
    EventAnalysisData,
    | "races"
    | "multiMainResults"
    | "registrationClassNames"
    | "entryList"
    | "qualPointsTopQualifiers"
  >
}

export function OverviewOverallClassPodium({ data }: OverviewOverallClassPodiumProps) {
  const { races, multiMainResults, registrationClassNames, entryList, qualPointsTopQualifiers } =
    data

  const [classWinnerDetail, setClassWinnerDetail] = useState<ClassWinnerHighlight | null>(null)

  const eventHasMain = useMemo(() => races.some((r) => isEventMainSession(r)), [races])

  const tqCards = useMemo(() => {
    if (!qualPointsTopQualifiers || (qualPointsTopQualifiers.standings?.length ?? 0) === 0)
      return []
    return buildTopQualifierOverviewCards(qualPointsTopQualifiers, races, {
      entryList,
      multiMainResults,
      registrationClassNames,
    })
  }, [qualPointsTopQualifiers, races, entryList, multiMainResults, registrationClassNames])

  const classWinnerRows = useMemo(() => {
    return buildClassWinners({ races, multiMainResults, registrationClassNames, entryList })
  }, [races, multiMainResults, registrationClassNames, entryList])

  const classWinnerCardsOrdered = useMemo(() => {
    if (classWinnerRows.length === 0) return []
    const byClass = new Map(classWinnerRows.map((w) => [w.className.trim(), w]))
    const ordered: ClassWinnerHighlight[] = []
    const seen = new Set<string>()
    for (const card of tqCards) {
      const cn = card.className.trim()
      const w = byClass.get(cn)
      if (w && !seen.has(cn)) {
        ordered.push(w)
        seen.add(cn)
      }
    }
    for (const w of classWinnerRows) {
      const cn = w.className.trim()
      if (!seen.has(cn)) {
        ordered.push(w)
        seen.add(cn)
      }
    }
    return ordered
  }, [tqCards, classWinnerRows])

  const topQualifierCardByClass = useMemo(
    () => new Map(tqCards.map((c) => [c.className.trim(), c])),
    [tqCards]
  )

  const headingId = "event-overview-overall-class-results-heading"

  if (!eventHasMain) {
    return (
      <div className="min-w-0 w-full">
        <h3
          id={headingId}
          className="mb-3 w-full text-center text-lg font-semibold tracking-tight text-[var(--token-text-muted)]"
        >
          Event Results
        </h3>
        <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
          {NEED_MAIN_TEXT}
        </p>
      </div>
    )
  }

  if (classWinnerCardsOrdered.length === 0) {
    return (
      <div className="min-w-0 w-full">
        <h3
          id={headingId}
          className="mb-3 w-full text-center text-lg font-semibold tracking-tight text-[var(--token-text-muted)]"
        >
          Event Results
        </h3>
        <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
          {EMPTY_OVERALL_TEXT}
        </p>
      </div>
    )
  }

  return (
    <div className="min-w-0 w-full">
      <h3
        id={headingId}
        className="mb-3 w-full text-center text-lg font-semibold tracking-tight text-[var(--token-text-muted)]"
      >
        Event Results
      </h3>
      <ul
        className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-5"
        aria-labelledby={headingId}
      >
        {classWinnerCardsOrdered.map((cw) => {
          const isOpen =
            classWinnerDetail?.className === cw.className &&
            classWinnerDetail?.winnerName === cw.winnerName
          const tqCard = topQualifierCardByClass.get(cw.className.trim()) ?? null
          const podiumSlotIsTopQualifier = (name: string | null | undefined) =>
            Boolean(
              name && tqCard && driverNamesMatchForClassWinner(name, tqCard.driverDisplayName)
            )

          return (
            <li key={cw.className}>
              <button
                type="button"
                className={`flex min-h-0 min-w-0 w-full flex-col items-stretch gap-3 p-4 text-left ${OVERVIEW_GLASS_SURFACE_CLASS} ${PODIUM_CARD_INTERACTIVE_CLASS}`}
                style={OVERVIEW_GLASS_SURFACE_STYLE}
                onClick={() => setClassWinnerDetail(cw)}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-label={`Open class results: 1st ${cw.winnerName}${
                  podiumSlotIsTopQualifier(cw.winnerName) ? " (top qualifier)" : ""
                }${cw.secondPlaceName ? `, 2nd ${cw.secondPlaceName}` : ""}${
                  podiumSlotIsTopQualifier(cw.secondPlaceName) ? " (top qualifier)" : ""
                }${cw.thirdPlaceName ? `, 3rd ${cw.thirdPlaceName}` : ""}${
                  podiumSlotIsTopQualifier(cw.thirdPlaceName) ? " (top qualifier)" : ""
                } · ${cw.classDisplay}`}
              >
                <p className={`w-full text-center ${typography.overviewMetricLabel}`}>
                  {cw.classDisplay}
                </p>
                <ol className="m-0 flex w-full min-w-0 list-none flex-col gap-1.5 p-0">
                  <li className="grid min-h-0 min-w-0 grid-cols-[2.5rem_1fr] items-center gap-x-2.5 sm:grid-cols-[2.75rem_1fr]">
                    <span
                      className="inline-flex h-6 w-full shrink-0 items-center justify-center rounded-md bg-[var(--token-status-warning-bg)] text-[0.65rem] font-bold leading-none tabular-nums tracking-tight text-[var(--token-status-warning-text)] ring-1 ring-inset ring-[var(--token-status-warning-text)]/20"
                      aria-hidden
                    >
                      1st
                    </span>
                    <PodiumNameWithOptionalTq
                      name={cw.winnerName}
                      nameClassName="min-w-0 truncate text-sm font-bold leading-tight text-[var(--token-text-primary)] sm:text-[0.95rem]"
                      isTopQualifier={podiumSlotIsTopQualifier(cw.winnerName)}
                    />
                  </li>
                  <li className="grid min-h-0 min-w-0 grid-cols-[2.5rem_1fr] items-center gap-x-2.5 sm:grid-cols-[2.75rem_1fr]">
                    <span
                      className="inline-flex h-6 w-full shrink-0 items-center justify-center rounded-md bg-[var(--token-surface-raised)]/80 text-[0.65rem] font-bold leading-none tabular-nums tracking-tight text-[var(--token-text-secondary)] ring-1 ring-inset ring-[var(--token-border-default)]/80"
                      aria-hidden
                    >
                      2nd
                    </span>
                    <PodiumSlotName
                      name={cw.secondPlaceName}
                      filledClassName="min-w-0 truncate text-xs font-semibold leading-tight text-[var(--token-text-primary)] sm:text-sm"
                      emptyHint="No 2nd place in imported results for this class"
                      isTopQualifier={podiumSlotIsTopQualifier(cw.secondPlaceName)}
                    />
                  </li>
                  <li className="grid min-h-0 min-w-0 grid-cols-[2.5rem_1fr] items-center gap-x-2.5 sm:grid-cols-[2.75rem_1fr]">
                    <span
                      className="inline-flex h-6 w-full shrink-0 items-center justify-center rounded-md bg-[var(--token-surface-raised)]/60 text-[0.65rem] font-bold leading-none tabular-nums tracking-tight text-[var(--token-text-secondary)] ring-1 ring-inset ring-[var(--token-border-default)]/80"
                      aria-hidden
                    >
                      3rd
                    </span>
                    <PodiumSlotName
                      name={cw.thirdPlaceName}
                      filledClassName="min-w-0 truncate text-xs font-semibold leading-tight text-[var(--token-text-primary)]/95 sm:text-sm"
                      emptyHint="No 3rd place in imported results for this class"
                      isTopQualifier={podiumSlotIsTopQualifier(cw.thirdPlaceName)}
                    />
                  </li>
                </ol>
              </button>
            </li>
          )
        })}
      </ul>
      <ClassWinnerStandingsModal
        detail={classWinnerDetail}
        onClose={() => setClassWinnerDetail(null)}
        races={races}
        multiMainResults={multiMainResults}
      />
    </div>
  )
}
