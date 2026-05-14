"use client"

import { useMemo, useState } from "react"
import { buildClassWinners, type ClassWinnerHighlight } from "@/core/events/build-event-highlights"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { isEventMainSession } from "@/core/events/main-bracket-overall"
import { buildTopQualifierOverviewCards } from "@/core/events/top-qualifier-overview-cards"
import {
  OVERVIEW_GLASS_SURFACE_CLASS,
  OVERVIEW_GLASS_SURFACE_STYLE,
} from "@/components/organisms/event-analysis/overview-glass-surface"
import { typography } from "@/lib/typography"
import { ClassWinnerStandingsModal } from "./ClassWinnerStandingsModal"
import EventOverallResultsTable from "./EventOverallResultsTable"
import {
  OverviewResultsTabStrip,
  OVERVIEW_RESULTS_PANEL_IDS,
  OVERVIEW_RESULTS_TAB_IDS,
  type OverviewResultsTab,
} from "./overview-results-tab-strip"
import SessionRaceResultsTable from "./SessionRaceResultsTable"

const NEED_MAIN_TEXT =
  "Main event results aren’t available for this event yet. Overall class podiums appear after at least one main or final is imported."

const EMPTY_OVERALL_TEXT =
  "No overall class results to show yet. They appear after final results are imported for this event."

export type OverviewOverallClassPodiumProps = {
  data: Pick<
    EventAnalysisData,
    | "races"
    | "multiMainResults"
    | "overallFinalRankings"
    | "registrationClassNames"
    | "entryList"
    | "qualPointsTopQualifiers"
  >
  sessionClassFilter?: string | null
  onSessionClassFilterChange?: (className: string | null) => void
}

export function OverviewOverallClassPodium({
  data,
  sessionClassFilter,
  onSessionClassFilterChange,
}: OverviewOverallClassPodiumProps) {
  const {
    races,
    multiMainResults,
    overallFinalRankings,
    registrationClassNames,
    entryList,
    qualPointsTopQualifiers,
  } = data

  const [classWinnerDetail, setClassWinnerDetail] = useState<ClassWinnerHighlight | null>(null)
  const [activeResultsTab, setActiveResultsTab] = useState<OverviewResultsTab>("event-results")

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
    return buildClassWinners({
      races,
      multiMainResults,
      overallFinalRankings: overallFinalRankings ?? [],
      registrationClassNames,
      entryList,
    })
  }, [races, multiMainResults, overallFinalRankings, registrationClassNames, entryList])

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

  const raceClassNamesForFilter = useMemo(
    () =>
      Array.from(
        new Set(
          races
            .map((r) => r.className)
            .filter(
              (className): className is string =>
                typeof className === "string" && className.trim().length > 0
            )
            .map((c) => c.trim())
        )
      ).sort((a, b) => a.localeCompare(b)),
    [races]
  )

  const resultsTabStrip = (
    <OverviewResultsTabStrip activeTab={activeResultsTab} onTabChange={setActiveResultsTab} />
  )

  const eventResultsEmptyTableChrome = (message: string) => (
    <div className={OVERVIEW_GLASS_SURFACE_CLASS} style={OVERVIEW_GLASS_SURFACE_STYLE}>
      <div className="border-b border-[var(--token-border-default)] px-4 py-3">
        <div className="flex min-w-0 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 sm:min-w-[12rem] sm:flex-1 sm:pr-2">
            <h2 className={typography.overviewEventResultsToolbarTitle}>Event Results</h2>
            <p className="mt-1 text-left text-sm text-[var(--token-text-secondary)]">{message}</p>
          </div>
          <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-3">
            {resultsTabStrip}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-w-0 w-full">
      {activeResultsTab === "event-results" ? (
        <div
          id={OVERVIEW_RESULTS_PANEL_IDS["event-results"]}
          role="tabpanel"
          aria-labelledby={OVERVIEW_RESULTS_TAB_IDS["event-results"]}
        >
          {!eventHasMain ? (
            eventResultsEmptyTableChrome(NEED_MAIN_TEXT)
          ) : classWinnerCardsOrdered.length === 0 ? (
            eventResultsEmptyTableChrome(EMPTY_OVERALL_TEXT)
          ) : (
            <>
              <EventOverallResultsTable
                rows={classWinnerCardsOrdered}
                topQualifierByClass={topQualifierCardByClass}
                onRowActivate={setClassWinnerDetail}
                activeDetail={classWinnerDetail}
                classFilter={sessionClassFilter}
                onClassFilterChange={onSessionClassFilterChange}
                classFilterOptions={raceClassNamesForFilter}
                resultsTabStrip={resultsTabStrip}
              />
              <ClassWinnerStandingsModal
                detail={classWinnerDetail}
                onClose={() => setClassWinnerDetail(null)}
                races={races}
                multiMainResults={multiMainResults}
                overallFinalRankings={overallFinalRankings}
              />
            </>
          )}
        </div>
      ) : (
        <div
          id={OVERVIEW_RESULTS_PANEL_IDS["session-results"]}
          role="tabpanel"
          aria-labelledby={OVERVIEW_RESULTS_TAB_IDS["session-results"]}
        >
          <SessionRaceResultsTable
            races={races}
            raceLabelContextRaces={races}
            classFilter={sessionClassFilter}
            onClassFilterChange={onSessionClassFilterChange}
            classFilterOptions={raceClassNamesForFilter}
            resultsTabStrip={resultsTabStrip}
          />
        </div>
      )}
    </div>
  )
}
