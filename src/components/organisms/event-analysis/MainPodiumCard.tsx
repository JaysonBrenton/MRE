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
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

const CARD_CLASS =
  "mb-6 w-fit rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2"
const SECTION_HEADING_CLASS = "text-sm font-semibold text-[var(--token-text-primary)] mb-2"
const GRID_CLASS =
  "grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm text-[var(--token-text-primary)]"
const LABEL_CLASS = "text-[var(--token-text-secondary)]"

function isMain(raceLabel: string): boolean {
  return raceLabel.toLowerCase().includes("main")
}

/**
 * Extract short main label for display (e.g. "A1-Main" from "1:8th Electric Buggy A1-Main")
 */
function mainDisplayLabel(raceLabel: string): string {
  const match = raceLabel.match(/[\w\d]+-Main$/i)
  return match ? match[0] : raceLabel
}

/**
 * Sort key for mains: A-Main, A1-Main, B-Main, B1-Main, C-Main, ... D-Main.
 * Returns [letterIndex, number] so comparator can sort A before B before C before D, then by number.
 */
function mainSortKey(raceLabel: string): [number, number] {
  const label = mainDisplayLabel(raceLabel)
  const match = label.match(/^([A-Za-z])(\d*)-Main$/i)
  if (!match) return [999, 0]
  const letter = match[1].toUpperCase()
  const num = match[2] === "" ? 0 : parseInt(match[2], 10)
  const letterIndex = letter.charCodeAt(0) - "A".charCodeAt(0)
  return [letterIndex, num]
}

interface MainPodium {
  raceId: string
  raceLabel: string
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
    .filter((r) => isMain(r.raceLabel))
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
      const [letterA, numA] = mainSortKey(a.raceLabel)
      const [letterB, numB] = mainSortKey(b.raceLabel)
      if (letterA !== letterB) return letterA - letterB
      return numA - numB
    }),
  }))
}

export interface MainPodiumCardProps {
  races: EventAnalysisData["races"]
}

export default function MainPodiumCard({ races }: MainPodiumCardProps) {
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

  return (
    <div className="w-full space-y-4">
      {podiumsByClass.map(({ className, podiums }) => {
        const open = isClassOpen(className)
        const contentId = `main-podium-class-${className
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")}`

        return (
          <div key={className} className="space-y-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-left text-sm font-semibold text-[var(--token-text-primary)] mb-2"
              aria-expanded={open}
              aria-controls={contentId}
              onClick={() => toggleClass(className)}
            >
              <span>{className}</span>
              <span
                className={`transition-transform duration-150 ${
                  open ? "rotate-0" : "-rotate-90"
                }`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>
            {open && (
              <div id={contentId} className="flex flex-wrap gap-4">
                {podiums.map((podium) => (
                  <div key={podium.raceId} className={CARD_CLASS}>
                    <div className={GRID_CLASS}>
                      <span className={LABEL_CLASS}>Main:</span>
                      <span>{mainDisplayLabel(podium.raceLabel)}</span>
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
