/**
 * @fileoverview Main podium card for Event Analysis Overview
 *
 * @description Displays 1st, 2nd, and 3rd place finishers for each main race
 * (e.g. A1-Main, A2-Main, B-Main). Grouped under class section headings.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/EventStats.tsx (styling reference)
 * - src/components/organisms/event-analysis/MainsCard.tsx (main detection)
 * - src/components/organisms/event-analysis/OverviewTab.tsx (uses this)
 * - docs/design/compact-label-value-card.md
 */

"use client"

import { useMemo, useState } from "react"
import { ExternalLink } from "lucide-react"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { formatClassName } from "@/lib/format-class-name"

const CARD_CLASS =
  "mb-6 w-fit rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2"
const _SECTION_HEADING_CLASS = "text-sm font-semibold text-[var(--token-text-primary)] mb-2"
const GRID_CLASS =
  "grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm text-[var(--token-text-primary)]"
const LABEL_CLASS = "text-[var(--token-text-secondary)]"

/**
 * True if race is a competitive main/final (e.g. A1-Main, B-Main, A-Final, B-Final),
 * excluding practice sessions even when the label contains "Main" (e.g. "Truggy A Main Practice").
 * Prefers sessionType when present and falls back to raceLabel for legacy data.
 */
function isMainOrFinal(raceLabel: string, sessionType?: string | null): boolean {
  const type = sessionType?.toLowerCase().trim()
  if (type) {
    if (type === "main" || type === "race") {
      return true
    }
    if (type === "practice" || type === "practiceday") {
      return false
    }
  }

  const lower = raceLabel.toLowerCase()
  const isClearlyPractice =
    lower.includes("practice") ||
    lower.includes("seeding") ||
    lower.includes("qualifying") ||
    lower.includes("warmup") ||
    lower.includes("shakedown")
  if (isClearlyPractice) {
    return false
  }

  return lower.includes("main") || lower.includes("final")
}

/**
 * Extract short label for display (e.g. "A1-Main" from "1:8th Electric Buggy A1-Main",
 * "A-Final" from "1:8th Electric Buggy A-Final").
 * When className contains "Semi B" (or similar) but raceLabel ends in "A-Main",
 * LiveRC may use "A-Main" for both semis—derive "B-Main" for correct display.
 */
function mainDisplayLabel(raceLabel: string, className?: string): string {
  const mainMatch = raceLabel.match(/[\w\d]+-Main$/i)
  let label = mainMatch ? mainMatch[0] : null
  if (!label) {
    const finalMatch = raceLabel.match(/[\w\d]+-Final$/i)
    label = finalMatch ? finalMatch[0] : null
  }
  if (!label) {
    if (/final$/i.test(raceLabel.trim())) return raceLabel.trim()
    return raceLabel
  }
  // LiveRC may label both Semi A and Semi B mains as "A-Main"—fix for Semi B
  const cn = (className ?? "").toLowerCase()
  if (
    label === "A-Main" &&
    (cn.includes("semi b") || cn.endsWith("semi b") || cn.includes("semi-b"))
  ) {
    return "B-Main"
  }
  return label
}

/**
 * Sort key for mains/finals: A-Main, A1-Main, B-Main, A-Final, B-Final, etc.
 * Returns [letterIndex, number] so comparator can sort A before B before C, then by number.
 */
function mainSortKey(raceLabel: string, className?: string): [number, number] {
  const label = mainDisplayLabel(raceLabel, className)
  const mainMatch = label.match(/^([A-Za-z])(\d*)-Main$/i)
  const finalMatch = label.match(/^([A-Za-z])(\d*)-Final$/i)
  const match = mainMatch ?? finalMatch
  if (!match) return [999, 0]
  const letter = match[1].toUpperCase()
  const num = match[2] === "" ? 0 : parseInt(match[2], 10)
  const letterIndex = letter.charCodeAt(0) - "A".charCodeAt(0)
  return [letterIndex, num]
}

interface MainPodium {
  raceId: string
  raceLabel: string
  raceUrl: string
  className: string
  first: string | null
  second: string | null
  third: string | null
}

interface ClassPodiums {
  className: string
  podiums: MainPodium[]
}

function computePodiumsByClass(races: EventAnalysisData["races"]): ClassPodiums[] {
  const mains = races
    .filter((r) => isMainOrFinal(r.raceLabel, r.sessionType))
    // Exclude LiveRC scheduling placeholders (e.g. track maintenance / breaks)
    // which have no competitive results or only non-starting entries.
    .filter((r) => r.results.some((result) => result.lapsCompleted > 0))
    .sort((a, b) => {
      const classCmp = a.className.localeCompare(b.className)
      if (classCmp !== 0) return classCmp
      const orderA = a.raceOrder ?? Infinity
      const orderB = b.raceOrder ?? Infinity
      if (orderA !== orderB) return orderA - orderB
      const timeA =
        a.startTime instanceof Date
          ? a.startTime.getTime()
          : a.startTime
            ? new Date(a.startTime).getTime()
            : Infinity
      const timeB =
        b.startTime instanceof Date
          ? b.startTime.getTime()
          : b.startTime
            ? new Date(b.startTime).getTime()
            : Infinity
      if (timeA !== timeB) return timeA - timeB
      return a.raceLabel.localeCompare(b.raceLabel, undefined, { numeric: true })
    })

  const podiums: MainPodium[] = mains.map((race) => {
    const sorted = [...race.results].sort((a, b) => a.positionFinal - b.positionFinal)
    const first = sorted.find((r) => r.positionFinal === 1)?.driverName ?? null
    const second = sorted.find((r) => r.positionFinal === 2)?.driverName ?? null
    const third = sorted.find((r) => r.positionFinal === 3)?.driverName ?? null

    return {
      raceId: race.id,
      raceLabel: race.raceLabel,
      raceUrl: race.raceUrl,
      className: race.className,
      first,
      second,
      third,
    }
  })

  const byClass = new Map<string, MainPodium[]>()
  for (const p of podiums) {
    const list = byClass.get(p.className) ?? []
    list.push(p)
    byClass.set(p.className, list)
  }

  return Array.from(byClass.entries()).map(([className, podiumsForClass]) => ({
    className,
    podiums: [...podiumsForClass].sort((a, b) => {
      const [letterA, numA] = mainSortKey(a.raceLabel, a.className)
      const [letterB, numB] = mainSortKey(b.raceLabel, b.className)
      if (letterA !== letterB) return letterA - letterB
      return numA - numB
    }),
  }))
}

export interface MainPodiumCardProps {
  races: EventAnalysisData["races"]
  /**
   * Optional filter by **display** class name (after `formatClassName`).
   * When provided, only that class section is rendered; when null/undefined, all classes are shown.
   */
  activeDisplayClass?: string | null
}

export default function MainPodiumCard({ races, activeDisplayClass }: MainPodiumCardProps) {
  const podiumsByClass = useMemo(() => computePodiumsByClass(races), [races])
  const [openClasses, setOpenClasses] = useState<Record<string, boolean>>({})

  const isClassOpen = (className: string) => {
    // Default to open when not yet toggled
    return openClasses[className] ?? true
  }

  const toggleClass = (className: string) => {
    setOpenClasses((prev) => ({
      ...prev,
      [className]: !(prev[className] ?? true),
    }))
  }

  if (podiumsByClass.length === 0) {
    return null
  }

  const filteredPodiumsByClass =
    activeDisplayClass && activeDisplayClass.trim().length > 0
      ? podiumsByClass.filter(({ className }) => formatClassName(className) === activeDisplayClass)
      : podiumsByClass

  const isFilteredView = !!activeDisplayClass && activeDisplayClass.trim().length > 0

  return (
    <div className="w-full space-y-4">
      {filteredPodiumsByClass.map(({ className, podiums }) => {
        const open = isFilteredView ? true : isClassOpen(className)
        const displayName = formatClassName(className)
        const contentId = `main-podium-class-${displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

        return (
          <div key={displayName} className={isFilteredView ? "" : "space-y-2"}>
            {!isFilteredView && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-left text-sm font-semibold text-[var(--token-text-primary)] mb-2"
                aria-expanded={open}
                aria-controls={contentId}
                onClick={() => toggleClass(className)}
              >
                <span>{displayName}</span>
                <span
                  className={`transition-transform duration-150 ${open ? "rotate-0" : "-rotate-90"}`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>
            )}
            {open && (
              <div id={contentId} className="flex flex-wrap gap-4">
                {podiums.map((podium) => (
                  <div key={podium.raceId} className={CARD_CLASS}>
                    <div className={GRID_CLASS}>
                      <span className={LABEL_CLASS}>Race:</span>
                      {podium.raceUrl ? (
                        <a
                          href={podium.raceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 underline hover:text-[var(--token-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] focus:ring-offset-2 rounded"
                          aria-label={`View ${mainDisplayLabel(podium.raceLabel, podium.className)} on LiveRC (opens in new tab)`}
                        >
                          {mainDisplayLabel(podium.raceLabel, podium.className)}
                          <ExternalLink className="size-3 shrink-0" aria-hidden />
                        </a>
                      ) : (
                        <span>{mainDisplayLabel(podium.raceLabel, podium.className)}</span>
                      )}
                      {podium.first != null && (
                        <>
                          <span className={LABEL_CLASS}>1st:</span>
                          <span>🥇 {podium.first}</span>
                        </>
                      )}
                      {podium.second != null && (
                        <>
                          <span className={LABEL_CLASS}>2nd:</span>
                          <span>🥈 {podium.second}</span>
                        </>
                      )}
                      {podium.third != null && (
                        <>
                          <span className={LABEL_CLASS}>3rd:</span>
                          <span>🥉 {podium.third}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
