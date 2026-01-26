/**
 * @fileoverview Driver cards and weather grid component for testing tab
 *
 * @created 2025-01-24
 * @creator Auto-generated
 * @lastModified 2025-01-24
 *
 * @description Driver cards carousel with progressive disclosure and enhanced UX
 *
 * @purpose Displays driver highlights with section heading, progressive disclosure
 *          (default one section, "More views" expandable), enhanced user metric
 *          cards with section context, tooltips, and improved empty states.
 *          Weather is removed (lives in context strip).
 *
 * @relatedFiles
 * - src/components/dashboard/DashboardClient.tsx (original DriverCardsAndWeatherGrid)
 * - src/components/dashboard/ImprovementDriverCard.tsx (used for improvement cards)
 */

"use client"

import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react"
import { formatLapTime, formatPositionImprovement, formatLapTimeImprovement } from "@/lib/date-utils"
import type { EventAnalysisSummary } from "@root-types/dashboard"
import ImprovementDriverCard from "./ImprovementDriverCard"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import Tooltip from "@/components/ui/Tooltip"

type DriverCardData =
  | NonNullable<EventAnalysisSummary["topDrivers"]>[number]
  | NonNullable<EventAnalysisSummary["mostConsistentDrivers"]>[number]
  | NonNullable<EventAnalysisSummary["bestAvgLapDrivers"]>[number]
  | NonNullable<EventAnalysisSummary["mostImprovedDrivers"]>[number]

function DriverCard({
  driver,
  index,
  type,
  sectionData,
}: {
  driver: DriverCardData
  index: number
  type: "fastest" | "consistency" | "avgLap" | "improvement"
  sectionData:
    | EventAnalysisSummary["topDrivers"]
    | EventAnalysisSummary["mostConsistentDrivers"]
    | EventAnalysisSummary["bestAvgLapDrivers"]
    | EventAnalysisSummary["mostImprovedDrivers"]
}) {
  let valueDisplay: string
  let gapDisplay: React.ReactNode = null

  if (type === "fastest" && "fastestLapTime" in driver) {
    valueDisplay = formatLapTime(driver.fastestLapTime)
    if (
      sectionData &&
      Array.isArray(sectionData) &&
      sectionData.length > 0 &&
      "fastestLapTime" in sectionData[0]
    ) {
      const fastestLapTime = (sectionData[0] as { fastestLapTime: number }).fastestLapTime
      const sameClass = driver.className === sectionData[0].className
      const gapToFastest = index > 0 && sameClass ? driver.fastestLapTime - fastestLapTime : 0
      if (gapToFastest > 0) {
        gapDisplay = (
          <Tooltip text="Time difference to the fastest driver in this class">
            <span className="text-[10px] font-medium text-[var(--token-text-muted)] bg-[var(--token-surface)] px-2 py-0.5 rounded-full cursor-help">
              +{formatLapTime(gapToFastest)}
            </span>
          </Tooltip>
        )
      }
    }
  } else if (type === "consistency" && "consistency" in driver) {
    valueDisplay = `${driver.consistency.toFixed(1)}%`
  } else if (type === "avgLap" && "avgLapTime" in driver) {
    valueDisplay = formatLapTime(driver.avgLapTime)
  } else if (type === "improvement" && "positionImprovement" in driver) {
    const improvedDriver = driver as NonNullable<EventAnalysisSummary["mostImprovedDrivers"]>[number]
    valueDisplay = formatPositionImprovement(improvedDriver.firstRacePosition, improvedDriver.lastRacePosition)
  } else {
    valueDisplay = "N/A"
  }

  return (
    <div className="rounded-2xl border border-[var(--token-border-default)] bg-gradient-to-br from-[var(--token-surface-elevated)] to-[var(--token-surface-raised)] px-5 py-5 h-full w-full transition-all duration-200 hover:border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.2),0_0_1px_rgba(255,255,255,0.1)] shadow-[0_2px_8px_rgba(0,0,0,0.1),0_0_1px_rgba(255,255,255,0.05)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-[var(--token-text-primary)] bg-[var(--token-surface)] px-2.5 py-1 rounded-full border border-[var(--token-border-default)] shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
          #{index + 1}
        </span>
        {gapDisplay}
      </div>
      <p className="text-base font-bold text-[var(--token-text-primary)] mb-2 truncate">
        {driver.driverName}
      </p>
      <p className="text-2xl font-bold text-[var(--token-text-primary)] mb-3 leading-tight">{valueDisplay}</p>
      <div className="space-y-1">
        <p className="text-[10px] text-[var(--token-text-muted)] font-medium truncate">{driver.raceLabel}</p>
        <p className="text-[10px] text-[var(--token-text-muted)] truncate">{driver.className}</p>
      </div>
    </div>
  )
}

export function DriverCardsAndWeatherGridTesting({
  event,
  topDrivers,
  mostConsistentDrivers,
  bestAvgLapDrivers,
  mostImprovedDrivers,
  userBestLap,
  userBestConsistency,
  userBestAvgLap,
  userBestImprovement,
  selectedClass,
  selectedDriverIds,
  races,
}: {
  event: EventAnalysisSummary["event"]
  topDrivers?: EventAnalysisSummary["topDrivers"]
  mostConsistentDrivers?: EventAnalysisSummary["mostConsistentDrivers"]
  bestAvgLapDrivers?: EventAnalysisSummary["bestAvgLapDrivers"]
  mostImprovedDrivers?: EventAnalysisSummary["mostImprovedDrivers"]
  userBestLap?: EventAnalysisSummary["userBestLap"]
  userBestConsistency?: EventAnalysisSummary["userBestConsistency"]
  userBestAvgLap?: EventAnalysisSummary["userBestAvgLap"]
  userBestImprovement?: EventAnalysisSummary["userBestImprovement"]
  selectedClass?: string | null
  selectedDriverIds?: string[]
  races?: EventAnalysisData["races"]
}) {
  const [currentSection, setCurrentSection] = useState(0)
  const [currentClassIndex, setCurrentClassIndex] = useState<number>(0)
  const [isExpanded, setIsExpanded] = useState(false) // Progressive disclosure: default collapsed
  const carouselRef = useRef<HTMLDivElement>(null)
  const sectionRef0 = useRef<HTMLDivElement>(null)
  const sectionRef1 = useRef<HTMLDivElement>(null)
  const sectionRef2 = useRef<HTMLDivElement>(null)
  const sectionRef3 = useRef<HTMLDivElement>(null)

  const sectionRefs = useMemo(() => [sectionRef0, sectionRef1, sectionRef2, sectionRef3], [])
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isUserInteractingRef = useRef(false)
  const currentSectionRef = useRef(0)
  const previousSectionRef = useRef<number>(0)
  const isProgrammaticScrollRef = useRef(false)
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const programmaticScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const sections = [
    { title: "Fastest Laps", data: topDrivers, type: "fastest" as const },
    { title: "Most Consistent Drivers", data: mostConsistentDrivers, type: "consistency" as const },
    { title: "Best Overall Average Lap", data: bestAvgLapDrivers, type: "avgLap" as const },
    { title: "Most Improved", data: mostImprovedDrivers, type: "improvement" as const },
  ]

  // Progressive disclosure: show only first section by default, or all if expanded
  const visibleSections = isExpanded ? sections : [sections[0]]
  
  // Reset currentSection to 0 when collapsing
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(() => {
    if (!isExpanded && currentSection > 0) {
      setCurrentSection(0)
      currentSectionRef.current = 0
    }
  }, [isExpanded, currentSection])

  const hasData =
    topDrivers?.length ||
    mostConsistentDrivers?.length ||
    bestAvgLapDrivers?.length ||
    mostImprovedDrivers?.length

  // Only show driver cards if a class is selected OR more than 1 driver is selected
  const shouldShowDriverCards =
    hasData &&
    ((selectedClass !== null && selectedClass !== undefined) ||
      (selectedDriverIds && selectedDriverIds.length > 1))

  // Get union of all classes from all sections (all classes that appear in any section)
  const getAllClasses = (): string[] => {
    const allClassesSet = new Set<string>()
    
    // Add all classes from each section
    topDrivers?.forEach((d) => allClassesSet.add(d.className))
    mostConsistentDrivers?.forEach((d) => allClassesSet.add(d.className))
    bestAvgLapDrivers?.forEach((d) => allClassesSet.add(d.className))
    mostImprovedDrivers?.forEach((d) => allClassesSet.add(d.className))

    // Add all classes from races data
    races?.forEach((race) => {
      if (race.className) {
        allClassesSet.add(race.className)
      }
    })

    // Return sorted array of all unique classes
    return Array.from(allClassesSet).sort()
  }

  const allClasses = getAllClasses()

  // Calculate user metrics filtered by selected class (same logic as original)
  const filteredUserMetrics = useMemo(() => {
    // If no class is selected (null, undefined, or empty string), use original metrics (show all classes)
    if (!selectedClass || selectedClass === "" || selectedClass === null || selectedClass === undefined) {
      return {
        userBestLap,
        userBestConsistency,
        userBestAvgLap,
        userBestImprovement,
      }
    }

    // If class is selected but we don't have races data, return original metrics (fallback)
    if (!races || races.length === 0) {
      return {
        userBestLap,
        userBestConsistency,
        userBestAvgLap,
        userBestImprovement,
      }
    }

    // If class is selected but we don't have userBestLap data, return null (hide card)
    if (!userBestLap) {
      return {
        userBestLap: null,
        userBestConsistency: null,
        userBestAvgLap: null,
        userBestImprovement: null,
      }
    }

    // Find user's driverId by matching userBestLap time in races
    let userDriverId: string | null = null
    
    // First pass: exact match (within floating point precision)
    for (const race of races) {
      for (const result of race.results) {
        if (
          result.fastLapTime !== null &&
          Math.abs(result.fastLapTime - userBestLap.lapTime) < 0.0001
        ) {
          userDriverId = result.driverId
          break
        }
      }
      if (userDriverId) break
    }

    // Second pass: if no exact match, try with tolerance (0.01s)
    if (!userDriverId) {
      for (const race of races) {
        for (const result of race.results) {
          if (
            result.fastLapTime !== null &&
            Math.abs(result.fastLapTime - userBestLap.lapTime) < 0.01
          ) {
            userDriverId = result.driverId
            break
          }
        }
        if (userDriverId) break
      }
    }

    // Third pass: if still no match, find the driver with the closest lap time
    if (!userDriverId) {
      let closestDriverId: string | null = null
      let closestDiff = Infinity
      for (const race of races) {
        for (const result of race.results) {
          if (result.fastLapTime !== null) {
            const diff = Math.abs(result.fastLapTime - userBestLap.lapTime)
            if (diff < closestDiff) {
              closestDiff = diff
              closestDriverId = result.driverId
            }
          }
        }
      }
      // Only use closest match if it's within 0.1s (reasonable tolerance)
      if (closestDiff < 0.1 && closestDriverId) {
        userDriverId = closestDriverId
      }
    }

    // If we still couldn't find the user's driverId, fall back to showing original metrics
    if (!userDriverId) {
      return {
        userBestLap,
        userBestConsistency,
        userBestAvgLap,
        userBestImprovement,
      }
    }

    // Filter races by selected class
    const classRaces = races.filter((r) => r.className === selectedClass)

    // Check if user has any results in the selected class
    const userHasResultsInClass = classRaces.some((race) =>
      race.results.some((result) => result.driverId === userDriverId)
    )

    // If user has no results in selected class, return null metrics (hide card)
    if (!userHasResultsInClass) {
      return {
        userBestLap: null,
        userBestConsistency: null,
        userBestAvgLap: null,
        userBestImprovement: null,
      }
    }

    // Calculate user's best lap in selected class
    let userBestLapInClass: number | null = null
    let userBestLapRaceLabel: string | null = null
    for (const race of classRaces) {
      for (const result of race.results) {
        if (
          result.driverId === userDriverId &&
          result.fastLapTime !== null &&
          (userBestLapInClass === null || result.fastLapTime < userBestLapInClass)
        ) {
          userBestLapInClass = result.fastLapTime
          userBestLapRaceLabel = race.raceLabel
        }
      }
    }

    // Calculate user's best consistency in selected class
    let userBestConsistencyInClass: number | null = null
    for (const race of classRaces) {
      for (const result of race.results) {
        if (
          result.driverId === userDriverId &&
          result.consistency !== null &&
          (userBestConsistencyInClass === null ||
            result.consistency > userBestConsistencyInClass)
        ) {
          userBestConsistencyInClass = result.consistency
        }
      }
    }

    // Calculate user's best average lap in selected class
    let userBestAvgLapInClass: number | null = null
    for (const race of classRaces) {
      for (const result of race.results) {
        if (
          result.driverId === userDriverId &&
          result.avgLapTime !== null &&
          (userBestAvgLapInClass === null ||
            result.avgLapTime < userBestAvgLapInClass)
        ) {
          userBestAvgLapInClass = result.avgLapTime
        }
      }
    }

    // Calculate user's improvement in selected class
    let userImprovementInClass: {
      positionImprovement: number
      lapTimeImprovement: number | null
      firstRacePosition: number
      lastRacePosition: number
      className: string
      raceLabel: string
    } | null = null

    // Get all user's results in selected class, sorted by race order
    const userResultsInClass: Array<{
      positionFinal: number
      fastLapTime: number | null
      raceOrder: number | null
      startTime: Date | null
      raceLabel: string
    }> = []

    for (const race of classRaces) {
      for (const result of race.results) {
        if (result.driverId === userDriverId) {
          userResultsInClass.push({
            positionFinal: result.positionFinal,
            fastLapTime: result.fastLapTime,
            raceOrder: race.raceOrder,
            startTime: race.startTime,
            raceLabel: race.raceLabel,
          })
        }
      }
    }

    // Sort by raceOrder, then by startTime
    userResultsInClass.sort((a, b) => {
      const orderA = a.raceOrder ?? 0
      const orderB = b.raceOrder ?? 0
      if (orderA !== orderB) {
        return orderA - orderB
      }
      const timeA = a.startTime?.getTime() ?? 0
      const timeB = b.startTime?.getTime() ?? 0
      return timeA - timeB
    })

    if (userResultsInClass.length >= 2) {
      const firstRace = userResultsInClass[0]
      const lastRace = userResultsInClass[userResultsInClass.length - 1]
      const positionImprovement = firstRace.positionFinal - lastRace.positionFinal
      const lapTimeImprovement =
        firstRace.fastLapTime !== null && lastRace.fastLapTime !== null
          ? firstRace.fastLapTime - lastRace.fastLapTime
          : null

      userImprovementInClass = {
        positionImprovement,
        lapTimeImprovement,
        firstRacePosition: firstRace.positionFinal,
        lastRacePosition: lastRace.positionFinal,
        className: selectedClass,
        raceLabel: lastRace.raceLabel,
      }
    }

    // Calculate positions and gaps relative to other drivers in the class
    let userBestLapPosition = 1
    let fastestLapInClass: number | null = null
    if (userBestLapInClass !== null) {
      const driverBestLaps = new Map<string, number>()
      for (const race of classRaces) {
        for (const result of race.results) {
          if (result.fastLapTime !== null) {
            const existing = driverBestLaps.get(result.driverId)
            if (!existing || result.fastLapTime < existing) {
              driverBestLaps.set(result.driverId, result.fastLapTime)
            }
          }
        }
      }
      const sortedBestLaps = Array.from(driverBestLaps.values()).sort((a, b) => a - b)
      fastestLapInClass = sortedBestLaps[0] ?? userBestLapInClass
      userBestLapPosition =
        sortedBestLaps.filter((time) => time < userBestLapInClass!).length + 1
    }

    let userConsistencyPosition = 1
    let bestConsistencyInClass: number | null = null
    if (userBestConsistencyInClass !== null) {
      const driverBestConsistencies = new Map<string, number>()
      for (const race of classRaces) {
        for (const result of race.results) {
          if (result.consistency !== null) {
            const existing = driverBestConsistencies.get(result.driverId)
            if (!existing || result.consistency > existing) {
              driverBestConsistencies.set(result.driverId, result.consistency)
            }
          }
        }
      }
      const sortedConsistencies = Array.from(driverBestConsistencies.values()).sort(
        (a, b) => b - a
      )
      bestConsistencyInClass = sortedConsistencies[0] ?? userBestConsistencyInClass
      userConsistencyPosition =
        sortedConsistencies.filter((consistency) => consistency > userBestConsistencyInClass!)
          .length + 1
    }

    let userAvgLapPosition = 1
    let bestAvgLapInClass: number | null = null
    if (userBestAvgLapInClass !== null) {
      const driverBestAvgLaps = new Map<string, number>()
      for (const race of classRaces) {
        for (const result of race.results) {
          if (result.avgLapTime !== null) {
            const existing = driverBestAvgLaps.get(result.driverId)
            if (!existing || result.avgLapTime < existing) {
              driverBestAvgLaps.set(result.driverId, result.avgLapTime)
            }
          }
        }
      }
      const sortedAvgLaps = Array.from(driverBestAvgLaps.values()).sort((a, b) => a - b)
      bestAvgLapInClass = sortedAvgLaps[0] ?? userBestAvgLapInClass
      userAvgLapPosition =
        sortedAvgLaps.filter((avgLap) => avgLap < userBestAvgLapInClass!).length + 1
    }

    let userImprovementPosition = 1
    let bestImprovementInClass = 0
    if (userImprovementInClass !== null) {
      const driverImprovements = new Map<
        string,
        {
          positionImprovement: number
          firstRacePosition: number
          lastRacePosition: number
        }
      >()

      for (const driverId of new Set(
        classRaces.flatMap((race) => race.results.map((r) => r.driverId))
      )) {
        const driverResults: Array<{
          positionFinal: number
          raceOrder: number | null
          startTime: Date | null
        }> = []

        for (const race of classRaces) {
          for (const result of race.results) {
            if (result.driverId === driverId) {
              driverResults.push({
                positionFinal: result.positionFinal,
                raceOrder: race.raceOrder,
                startTime: race.startTime,
              })
            }
          }
        }

        driverResults.sort((a, b) => {
          const orderA = a.raceOrder ?? 0
          const orderB = b.raceOrder ?? 0
          if (orderA !== orderB) {
            return orderA - orderB
          }
          const timeA = a.startTime?.getTime() ?? 0
          const timeB = b.startTime?.getTime() ?? 0
          return timeA - timeB
        })

        if (driverResults.length >= 2) {
          const firstRace = driverResults[0]
          const lastRace = driverResults[driverResults.length - 1]
          const positionImprovement = firstRace.positionFinal - lastRace.positionFinal

          driverImprovements.set(driverId, {
            positionImprovement,
            firstRacePosition: firstRace.positionFinal,
            lastRacePosition: lastRace.positionFinal,
          })
        }
      }

      const sortedImprovements = Array.from(driverImprovements.values()).sort(
        (a, b) => b.positionImprovement - a.positionImprovement
      )
      bestImprovementInClass = sortedImprovements[0]?.positionImprovement ?? userImprovementInClass.positionImprovement
      userImprovementPosition =
        sortedImprovements.filter(
          (imp) => imp.positionImprovement > userImprovementInClass!.positionImprovement
        ).length + 1
    }

    return {
      userBestLap:
        userBestLapInClass !== null
          ? {
              lapTime: userBestLapInClass,
              position: userBestLapPosition,
              gapToFastest:
                fastestLapInClass !== null
                  ? userBestLapInClass - fastestLapInClass
                  : 0,
            }
          : null,
      userBestConsistency:
        userBestConsistencyInClass !== null
          ? {
              consistency: userBestConsistencyInClass,
              position: userConsistencyPosition,
              gapToBest:
                bestConsistencyInClass !== null
                  ? bestConsistencyInClass - userBestConsistencyInClass
                  : 0,
            }
          : null,
      userBestAvgLap:
        userBestAvgLapInClass !== null
          ? {
              avgLapTime: userBestAvgLapInClass,
              position: userAvgLapPosition,
              gapToBest:
                bestAvgLapInClass !== null
                  ? userBestAvgLapInClass - bestAvgLapInClass
                  : 0,
            }
          : null,
      userBestImprovement: userImprovementInClass
        ? {
            ...userImprovementInClass,
            position: userImprovementPosition,
            gapToBest: bestImprovementInClass - userImprovementInClass.positionImprovement,
          }
        : null,
    }
  }, [
    selectedClass,
    races,
    userBestLap,
    userBestConsistency,
    userBestAvgLap,
    userBestImprovement,
  ])

  // Calculate top drivers for a class from race data
  const calculateTopDriversForClass = useMemo(() => {
    return (className: string): NonNullable<EventAnalysisSummary["topDrivers"]> => {
      if (!races) return []
      
      const classRaces = races.filter((r) => r.className === className)
      const driverMap = new Map<string, { fastestLapTime: number; driverName: string; driverId: string; className: string; raceLabel: string }>()
      
      classRaces.forEach((race) => {
        race.results.forEach((result) => {
          if (result.fastLapTime !== null && result.fastLapTime !== undefined) {
            const existing = driverMap.get(result.driverId)
            if (!existing || result.fastLapTime < existing.fastestLapTime) {
              driverMap.set(result.driverId, {
                fastestLapTime: result.fastLapTime,
                driverName: result.driverName,
                driverId: result.driverId,
                className: race.className,
                raceLabel: race.raceLabel,
              })
            }
          }
        })
      })
      
      return Array.from(driverMap.values())
        .sort((a, b) => a.fastestLapTime - b.fastestLapTime)
        .slice(0, 4)
    }
  }, [races])

  const calculateMostConsistentForClass = useMemo(() => {
    return (className: string): NonNullable<EventAnalysisSummary["mostConsistentDrivers"]> => {
      if (!races) return []
      
      const classRaces = races.filter((r) => r.className === className)
      const driverMap = new Map<string, { consistency: number; driverName: string; driverId: string; className: string; raceLabel: string }>()
      
      classRaces.forEach((race) => {
        race.results.forEach((result) => {
          if (result.consistency !== null && result.consistency !== undefined) {
            const existing = driverMap.get(result.driverId)
            if (!existing || result.consistency > existing.consistency) {
              driverMap.set(result.driverId, {
                consistency: result.consistency,
                driverName: result.driverName,
                driverId: result.driverId,
                className: race.className,
                raceLabel: race.raceLabel,
              })
            }
          }
        })
      })
      
      return Array.from(driverMap.values())
        .sort((a, b) => b.consistency - a.consistency)
        .slice(0, 4)
    }
  }, [races])

  const calculateBestAvgLapForClass = useMemo(() => {
    return (className: string): NonNullable<EventAnalysisSummary["bestAvgLapDrivers"]> => {
      if (!races) return []
      
      const classRaces = races.filter((r) => r.className === className)
      const driverMap = new Map<string, { avgLapTime: number; driverName: string; driverId: string; className: string; raceLabel: string }>()
      
      classRaces.forEach((race) => {
        race.results.forEach((result) => {
          if (result.avgLapTime !== null && result.avgLapTime !== undefined) {
            const existing = driverMap.get(result.driverId)
            if (!existing || result.avgLapTime < existing.avgLapTime) {
              driverMap.set(result.driverId, {
                avgLapTime: result.avgLapTime,
                driverName: result.driverName,
                driverId: result.driverId,
                className: race.className,
                raceLabel: race.raceLabel,
              })
            }
          }
        })
      })
      
      return Array.from(driverMap.values())
        .sort((a, b) => a.avgLapTime - b.avgLapTime)
        .slice(0, 4)
    }
  }, [races])

  // Group drivers by className for each section
  const groupDriversByClass = (
    drivers:
      | EventAnalysisSummary["topDrivers"]
      | EventAnalysisSummary["mostConsistentDrivers"]
      | EventAnalysisSummary["bestAvgLapDrivers"]
      | EventAnalysisSummary["mostImprovedDrivers"],
    type: "fastest" | "consistency" | "avgLap" | "improvement"
  ) => {
    if (!drivers || drivers.length === 0) return {}

    type DriverUnion =
      | NonNullable<EventAnalysisSummary["topDrivers"]>[number]
      | NonNullable<EventAnalysisSummary["mostConsistentDrivers"]>[number]
      | NonNullable<EventAnalysisSummary["bestAvgLapDrivers"]>[number]
      | NonNullable<EventAnalysisSummary["mostImprovedDrivers"]>[number]

    const grouped = drivers.reduce(
      (acc, driver) => {
        const className = driver.className
        if (!acc[className]) {
          acc[className] = []
        }
        acc[className].push(driver as DriverUnion)
        return acc
      },
      {} as Record<string, DriverUnion[]>
    )

    // Sort drivers within each class by their metric
    Object.keys(grouped).forEach((className) => {
      grouped[className].sort((a, b) => {
        if (type === "fastest" && "fastestLapTime" in a && "fastestLapTime" in b) {
          return (
            (a as { fastestLapTime: number }).fastestLapTime -
            (b as { fastestLapTime: number }).fastestLapTime
          )
        } else if (type === "consistency" && "consistency" in a && "consistency" in b) {
          return (
            (b as { consistency: number }).consistency - (a as { consistency: number }).consistency
          ) // Higher is better
        } else if (type === "avgLap" && "avgLapTime" in a && "avgLapTime" in b) {
          return (a as { avgLapTime: number }).avgLapTime - (b as { avgLapTime: number }).avgLapTime
        } else if (type === "improvement" && "improvementScore" in a && "improvementScore" in b) {
          return (
            (b as { improvementScore: number }).improvementScore -
            (a as { improvementScore: number }).improvementScore
          ) // Higher is better
        }
        return 0
      })
    })

    return grouped
  }

  // Get current class drivers for a section (using selectedClass prop or cycling)
  const getCurrentClassDrivers = (section: (typeof sections)[number]): DriverCardData[] => {
    // Use selectedClass prop when provided, otherwise use cycling with currentClassIndex
    const currentClass = selectedClass !== null && selectedClass !== undefined
      ? selectedClass
      : allClasses[currentClassIndex % allClasses.length]

    if (!currentClass) {
      // If no class selected and no classes available, show all drivers (top 4)
      if (allClasses.length === 0 && section.data) {
        return section.data.slice(0, 4) as DriverCardData[]
      }
      return []
    }

    // When a class is selected, always calculate from race data
    if (selectedClass !== null && selectedClass !== undefined && races) {
      let calculatedDrivers: DriverCardData[] = []
      
      if (section.type === "fastest") {
        calculatedDrivers = calculateTopDriversForClass(currentClass) as DriverCardData[]
      } else if (section.type === "consistency") {
        calculatedDrivers = calculateMostConsistentForClass(currentClass) as DriverCardData[]
      } else if (section.type === "avgLap") {
        calculatedDrivers = calculateBestAvgLapForClass(currentClass) as DriverCardData[]
      } else if (section.type === "improvement") {
        // For improvement, still use the summary data as it's calculated differently
        const grouped = groupDriversByClass(section.data, section.type)
        calculatedDrivers = (grouped[currentClass] || []).slice(0, 4) as DriverCardData[]
      }
      
      return calculatedDrivers.slice(0, 4)
    }

    // When cycling (no class selected), use summary data
    if (!section.data || section.data.length === 0) return []

    const grouped = groupDriversByClass(section.data, section.type)
    if (!grouped[currentClass]) return []

    // Return top 4 drivers from current class
    return grouped[currentClass].slice(0, 4) as DriverCardData[]
  }

  const scrollToSection = (index: number, isUserAction = false) => {
    if (isUserAction) {
      isUserInteractingRef.current = true
    } else {
      isProgrammaticScrollRef.current = true
      // Reset flag after scroll animation completes
      setTimeout(() => {
        isProgrammaticScrollRef.current = false
      }, 600)
    }
    const targetRef = sectionRefs[index]
    const carousel = carouselRef.current
    if (targetRef.current && carousel) {
      const sectionWidth = carousel.clientWidth
      carousel.scrollTo({
        left: index * sectionWidth,
        behavior: "smooth",
      })
      // Track previous section to detect cycle completion
      previousSectionRef.current = currentSection
      setCurrentSection(index)
      currentSectionRef.current = index
    }
  }

  const handlePrev = () => {
    if (currentSection > 0) {
      scrollToSection(currentSection - 1, true)
    }
  }

  const handleNext = () => {
    // When collapsed, clicking next should expand
    if (!isExpanded) {
      setIsExpanded(true)
      // After expanding, scroll to section 1
      setTimeout(() => {
        scrollToSection(1, true)
      }, 100)
    } else if (currentSection < visibleSections.length - 1) {
      scrollToSection(currentSection + 1, true)
    }
  }

  // Auto-scroll functionality (only when expanded)
  useEffect(() => {
    if (!shouldShowDriverCards || visibleSections.length === 0 || !isExpanded) return

    // Initialize the ref with current section
    currentSectionRef.current = currentSection

    const autoScroll = () => {
      if (isUserInteractingRef.current) {
        // Reset the flag after a delay so auto-scroll resumes
        if (userInteractionTimeoutRef.current) {
          clearTimeout(userInteractionTimeoutRef.current)
        }
        userInteractionTimeoutRef.current = setTimeout(() => {
          isUserInteractingRef.current = false
          userInteractionTimeoutRef.current = null
        }, 10000) // Resume auto-scroll 10 seconds after user interaction
        return
      }

      const carousel = carouselRef.current
      if (!carousel) return

      const currentSectionIndex = currentSectionRef.current
      const nextSection = (currentSectionIndex + 1) % visibleSections.length
      const targetRef = sectionRefs[nextSection]

      if (targetRef.current) {
        isProgrammaticScrollRef.current = true
        const sectionWidth = carousel.clientWidth
        carousel.scrollTo({
          left: nextSection * sectionWidth,
          behavior: "smooth",
        })

        // Detect cycle completion: when going from last section to first
        const isCycleComplete = currentSectionIndex === visibleSections.length - 1 && nextSection === 0

        // Only advance class index when cycling automatically (selectedClass is null/undefined)
        if (isCycleComplete && allClasses.length > 0 && (selectedClass === null || selectedClass === undefined)) {
          // Advance to next class when cycle completes
          setCurrentClassIndex((prev) => {
            const nextIndex = (prev + 1) % allClasses.length
            return nextIndex
          })
        }

        previousSectionRef.current = currentSectionIndex
        setCurrentSection(nextSection)
        currentSectionRef.current = nextSection

        // Reset flag after scroll animation completes
        if (programmaticScrollTimeoutRef.current) {
          clearTimeout(programmaticScrollTimeoutRef.current)
        }
        programmaticScrollTimeoutRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false
          programmaticScrollTimeoutRef.current = null
        }, 600)
      }
    }

    // Auto-scroll every 5 seconds (adjust as needed)
    autoScrollIntervalRef.current = setInterval(autoScroll, 5000)

    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current)
        autoScrollIntervalRef.current = null
      }
      if (userInteractionTimeoutRef.current) {
        clearTimeout(userInteractionTimeoutRef.current)
        userInteractionTimeoutRef.current = null
      }
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current)
        programmaticScrollTimeoutRef.current = null
      }
    }
  }, [shouldShowDriverCards, visibleSections.length, currentSection, allClasses.length, selectedClass, isExpanded])

  // Update current section based on scroll position
  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    const handleScroll = () => {
      // Ignore scroll events from programmatic scrolling
      if (isProgrammaticScrollRef.current) return

      const scrollLeft = carousel.scrollLeft
      const sectionWidth = carousel.clientWidth
      const newSection = Math.round(scrollLeft / sectionWidth)
      if (newSection !== currentSection && newSection >= 0 && newSection < visibleSections.length) {
        previousSectionRef.current = currentSection
        setCurrentSection(newSection)
        currentSectionRef.current = newSection
        // If scroll happened without using buttons, treat as user interaction
        isUserInteractingRef.current = true
        if (userInteractionTimeoutRef.current) {
          clearTimeout(userInteractionTimeoutRef.current)
        }
        userInteractionTimeoutRef.current = setTimeout(() => {
          isUserInteractingRef.current = false
          userInteractionTimeoutRef.current = null
        }, 10000)
      }
    }

    carousel.addEventListener("scroll", handleScroll, { passive: true })
    return () => carousel.removeEventListener("scroll", handleScroll)
  }, [currentSection, visibleSections.length])

  // Get section title for user metric card
  const getSectionTitle = (sectionIndex: number): string => {
    return sections[sectionIndex]?.title || ""
  }

  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold text-[var(--token-text-primary)] mb-4">
        Driver highlights
      </h2>

      <div 
        className="relative"
        style={{
          borderRadius: "24px",
          border: "1px solid var(--glass-border)",
          backgroundColor: "var(--glass-bg)",
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          boxShadow: "var(--glass-shadow), var(--glass-shadow-inset)",
          padding: "var(--dashboard-card-padding)",
          overflow: "hidden",
        }}
      >
        {/* Subtle gradient overlay for extra glass depth */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 100%)",
            borderRadius: "24px",
          }}
        />
        {/* Subtle top highlight for glass edge effect */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)",
            borderRadius: "24px 24px 0 0",
          }}
        />
        {/* Content wrapper */}
        <div className="relative z-10">

        {shouldShowDriverCards ? (
          <>
            <div className="mb-6">
              {/* Navigation header with chevrons and section indicators */}
              <div className="flex items-center gap-3 mb-5 max-w-full md:max-w-[880px] mx-auto">
                <button
                  onClick={handlePrev}
                  disabled={currentSection === 0}
                  className={`flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-200 ${
                    currentSection === 0
                      ? "border-[var(--token-border-muted)] text-[var(--token-text-muted)] cursor-not-allowed bg-[var(--token-surface)]"
                      : "border-[var(--token-border-default)] text-[var(--token-text-secondary)] bg-[var(--token-surface-elevated)] hover:border-[var(--token-accent)] hover:text-[var(--token-accent)] hover:bg-[var(--token-surface-raised)] hover:shadow-[0_2px_8px_rgba(58,142,255,0.2)] active:scale-95 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                  }`}
                  aria-label="Previous section"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--token-text-secondary)] font-medium">
                    {visibleSections[currentSection]?.title}
                  </p>
                  {allClasses.length > 0 ? (
                    <p className="text-sm text-[var(--token-text-primary)] mt-1.5 font-semibold truncate">
                      {selectedClass !== null && selectedClass !== undefined
                        ? selectedClass
                        : allClasses[currentClassIndex % allClasses.length]}
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--token-text-muted)] mt-1.5 italic">
                      No classes available
                    </p>
                  )}
                </div>
                
                {/* Section indicators */}
                <div className="flex items-center gap-1.5 mx-2">
                  {visibleSections.map((section, visibleIndex) => {
                    const actualSectionIndex = sections.findIndex(s => s.title === section.title)
                    return (
                      <button
                        key={actualSectionIndex}
                        onClick={() => scrollToSection(actualSectionIndex, true)}
                        className={`transition-all duration-200 rounded-full ${
                          actualSectionIndex === currentSection
                            ? "w-2 h-2 bg-[var(--token-accent)]"
                            : "w-1.5 h-1.5 bg-[var(--token-border-default)] hover:bg-[var(--token-text-muted)]"
                        }`}
                        aria-label={`Go to section ${visibleIndex + 1}`}
                        aria-current={actualSectionIndex === currentSection ? "true" : "false"}
                      />
                    )
                  })}
                </div>

                <button
                  onClick={handleNext}
                  disabled={!isExpanded && currentSection === 0 ? false : isExpanded && currentSection === sections.length - 1}
                  className={`flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-200 ${
                    (!isExpanded && currentSection === 0) || (isExpanded && currentSection === sections.length - 1)
                      ? "border-[var(--token-border-muted)] text-[var(--token-text-muted)] cursor-not-allowed bg-[var(--token-surface)]"
                      : "border-[var(--token-border-default)] text-[var(--token-text-secondary)] bg-[var(--token-surface-elevated)] hover:border-[var(--token-accent)] hover:text-[var(--token-accent)] hover:bg-[var(--token-surface-raised)] hover:shadow-[0_2px_8px_rgba(58,142,255,0.2)] active:scale-95 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                  }`}
                  aria-label={!isExpanded ? "Show more views" : "Next section"}
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {/* Carousel container */}
              <div
                ref={carouselRef}
                className="overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden transition-all duration-300"
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
              >
                <div className="flex">
                  {visibleSections.map((section, visibleIndex) => {
                    // Find the actual section index in the full sections array
                    const actualSectionIndex = sections.findIndex(s => s.title === section.title)
                    return (
                    <div
                      key={actualSectionIndex}
                      ref={sectionRefs[actualSectionIndex]}
                      className="w-full flex-shrink-0 snap-start transition-opacity duration-300"
                    >
                      {section.data && section.data.length > 0 ? (
                        (() => {
                          const currentClassDrivers = getCurrentClassDrivers(section)
                          if (currentClassDrivers.length === 0) {
                              return (
                                <div className="rounded-2xl border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-6 py-8 text-center">
                                  <p className="text-sm text-[var(--token-text-muted)]">
                                    No drivers available for this class
                                  </p>
                                </div>
                              )
                          }
                          return (
                            <div className="flex gap-4 justify-start items-stretch max-w-full md:max-w-[880px] mx-auto">
                              {currentClassDrivers.map((driver, driverIndex) => {
                                return (
                                  <div
                                    key={driver.driverId}
                                    className="flex-shrink-0 w-full md:w-[208px] flex transition-transform duration-200 hover:scale-[1.02]"
                                  >
                                    {section.type === "improvement" &&
                                    "improvementScore" in driver ? (
                                      <ImprovementDriverCard
                                        driver={
                                          driver as NonNullable<
                                            EventAnalysisSummary["mostImprovedDrivers"]
                                          >[number]
                                        }
                                        index={driverIndex}
                                      />
                                    ) : (
                                      <DriverCard
                                        driver={driver}
                                        index={driverIndex}
                                        type={section.type}
                                        sectionData={currentClassDrivers as typeof section.data}
                                      />
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()
                      ) : (
                        <div className="rounded-2xl border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-6 py-8 text-center">
                          <p className="text-sm text-[var(--token-text-muted)]">
                            No data available for {section.title.toLowerCase()}
                          </p>
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* More Views Button (Progressive Disclosure) */}
            {!isExpanded && sections.length > 1 && (
              <div className="mb-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  className="px-6 py-3 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] hover:bg-[var(--token-surface-raised)] text-sm font-medium text-[var(--token-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                >
                  More views ({sections.length - 1} more)
                </button>
              </div>
            )}

            {/* User Metric Card */}
            {(() => {
              // Use filtered user metrics (filtered by selected class)
              const {
                userBestLap: filteredUserBestLap,
                userBestConsistency: filteredUserBestConsistency,
                userBestAvgLap: filteredUserBestAvgLap,
                userBestImprovement: filteredUserBestImprovement,
              } = filteredUserMetrics

              // Determine which user metric to display based on current section
              let userMetric: {
                label: string
                value: string
                position: number
                gapLabel: string
                gapValue: string
                sectionTitle: string
              } | null = null

              if (currentSection === 0 && filteredUserBestLap) {
                // Top Performers section - show fastest lap
                userMetric = {
                  label: "Your Best Lap",
                  value: formatLapTime(filteredUserBestLap.lapTime),
                  position: filteredUserBestLap.position,
                  gapLabel: "Gap to fastest",
                  gapValue: `+${formatLapTime(filteredUserBestLap.gapToFastest)}`,
                  sectionTitle: getSectionTitle(0),
                }
              } else if (currentSection === 1 && filteredUserBestConsistency) {
                // Most Consistent Drivers section - show consistency
                userMetric = {
                  label: "Your Consistency",
                  value: `${filteredUserBestConsistency.consistency.toFixed(1)}%`,
                  position: filteredUserBestConsistency.position,
                  gapLabel: "Gap to best",
                  gapValue: `-${filteredUserBestConsistency.gapToBest.toFixed(1)}%`,
                  sectionTitle: getSectionTitle(1),
                }
              } else if (currentSection === 2 && filteredUserBestAvgLap) {
                // Best Overall Average Lap section - show average lap
                userMetric = {
                  label: "Your Average Lap",
                  value: formatLapTime(filteredUserBestAvgLap.avgLapTime),
                  position: filteredUserBestAvgLap.position,
                  gapLabel: "Gap to best",
                  gapValue: `+${formatLapTime(filteredUserBestAvgLap.gapToBest)}`,
                  sectionTitle: getSectionTitle(2),
                }
              } else if (currentSection === 3 && filteredUserBestImprovement) {
                // Most Improved section - show improvement with rich data like driver cards
                const positionDisplay = formatPositionImprovement(
                  filteredUserBestImprovement.firstRacePosition,
                  filteredUserBestImprovement.lastRacePosition
                )
                const lapTimeDisplay = filteredUserBestImprovement.lapTimeImprovement !== null
                  ? formatLapTimeImprovement(filteredUserBestImprovement.lapTimeImprovement)
                  : null

                userMetric = {
                  label: "Your Improvement",
                  value: positionDisplay,
                  position: filteredUserBestImprovement.position,
                  gapLabel: "Gap to best",
                  gapValue: filteredUserBestImprovement.gapToBest > 0
                    ? `-${filteredUserBestImprovement.gapToBest} positions`
                    : "Best!",
                  sectionTitle: getSectionTitle(3),
                }

                // Return custom layout for improvement section with extra details
                return (
                  <div className="max-w-full md:max-w-[880px] mx-auto">
                    <div className="mb-6 rounded-2xl border border-[var(--token-accent)]/40 bg-gradient-to-br from-[var(--token-accent)]/10 to-[var(--token-accent)]/5 px-5 py-5 transition-all duration-200 hover:border-[var(--token-accent)]/60 hover:shadow-[0_4px_16px_rgba(58,142,255,0.2)] shadow-[0_2px_8px_rgba(58,142,255,0.15)]">
                      <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--token-accent)] mb-1 font-medium">
                        {userMetric.label}
                      </p>
                      <p className="text-[10px] text-[var(--token-text-muted)] mb-3">
                        Your stats for {userMetric.sectionTitle}
                      </p>
                      <div className="flex items-baseline justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-3xl font-bold text-[var(--token-text-primary)] leading-tight">
                            {userMetric.value}
                          </p>
                          <div className="mt-2 space-y-1">
                            {lapTimeDisplay && (
                              <p className="text-xs text-[var(--token-text-secondary)] font-medium">
                                Lap Time: {lapTimeDisplay}
                              </p>
                            )}
                            <p className="text-xs text-[var(--token-text-muted)] font-medium">
                              {filteredUserBestImprovement.raceLabel}
                            </p>
                            <p className="text-xs text-[var(--token-text-muted)]">
                              {filteredUserBestImprovement.className}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-[var(--token-text-secondary)] mb-1 font-medium">
                            Position #{userMetric.position}
                          </p>
                          {filteredUserBestImprovement.gapToBest > 0 && (
                            <>
                          <Tooltip text="Position difference to the most improved driver">
                            <p className="text-xs text-[var(--token-text-muted)] mb-1 font-medium cursor-help">
                              {userMetric.gapLabel}
                            </p>
                          </Tooltip>
                              <p className="text-xl font-bold text-[var(--token-text-primary)]">
                                {userMetric.gapValue}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }

              if (!userMetric) return null

              return (
                <div className="max-w-full md:max-w-[880px] mx-auto">
                  <div className="mb-6 rounded-2xl border border-[var(--token-accent)]/40 bg-gradient-to-br from-[var(--token-accent)]/10 to-[var(--token-accent)]/5 px-5 py-5 transition-all duration-200 hover:border-[var(--token-accent)]/60 hover:shadow-[0_4px_16px_rgba(58,142,255,0.2)] shadow-[0_2px_8px_rgba(58,142,255,0.15)]">
                    <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--token-accent)] mb-1 font-medium">
                      {userMetric.label}
                    </p>
                    <p className="text-[10px] text-[var(--token-text-muted)] mb-3">
                      Your stats for {userMetric.sectionTitle}
                    </p>
                    <div className="flex items-baseline justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-3xl font-bold text-[var(--token-text-primary)] leading-tight">
                          {userMetric.value}
                        </p>
                        <p className="text-xs text-[var(--token-text-secondary)] mt-2 font-medium">
                          Position #{userMetric.position}
                        </p>
                      </div>
                      {((currentSection === 0 &&
                        filteredUserBestLap?.gapToFastest &&
                        filteredUserBestLap.gapToFastest > 0) ||
                        (currentSection === 1 &&
                          filteredUserBestConsistency?.gapToBest &&
                          filteredUserBestConsistency.gapToBest > 0) ||
                        (currentSection === 2 &&
                          filteredUserBestAvgLap?.gapToBest &&
                          filteredUserBestAvgLap.gapToBest > 0)) && (
                        <div className="text-right flex-shrink-0">
                          <Tooltip text={
                            currentSection === 0 
                              ? "Time difference to the fastest driver in this class"
                              : currentSection === 1
                              ? "Consistency difference to the most consistent driver"
                              : "Average lap time difference to the best average lap driver"
                          }>
                            <p className="text-xs text-[var(--token-text-muted)] mb-1 font-medium cursor-help">
                              {userMetric.gapLabel}
                            </p>
                          </Tooltip>
                          <p className="text-xl font-bold text-[var(--token-text-primary)]">
                            {userMetric.gapValue}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </>
        ) : hasData ? (
          <div className="flex flex-col items-center justify-center min-h-[200px] text-center px-4">
            <p className="text-sm text-[var(--token-text-secondary)] mb-2">
              Pick a class above to see top performers
            </p>
            <p className="text-xs text-[var(--token-text-muted)]">
              Select a class or multiple drivers in the filter section to view driver highlights
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[200px] text-[var(--token-text-secondary)]">
            No lap time data available for this event
          </div>
        )}
        </div>
      </div>
    </section>
  )
}
