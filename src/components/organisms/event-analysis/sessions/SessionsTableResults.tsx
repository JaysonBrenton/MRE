/**
 * @fileoverview Expandable session results table component
 *
 * @created 2025-01-07
 * @creator System
 * @lastModified 2025-01-07
 *
 * @description Displays full race results within an expanded table row
 *
 * @purpose Shows detailed driver results with sorting for expanded session rows
 *
 * @relatedFiles
 * - src/components/event-analysis/sessions/SessionsTableRow.tsx
 * - src/lib/format-session-data.ts
 */

"use client"

import { useState, useMemo, useEffect } from "react"
import {
  formatConsistency,
  behindSortKey,
  formatRaceBehind,
  formatLapTime,
  formatLapsSlashTime,
} from "@/lib/format-session-data"
import type { SessionData } from "@/core/events/get-sessions-data"

export interface SessionsTableResultsProps {
  session: SessionData
  selectedDriverIds?: string[]
}

type SortField =
  | "position"
  | "driverName"
  | "qual"
  | "totalTime"
  | "behind"
  | "fastLap"
  | "avgLap"
  | "avgTop5"
  | "avgTop10"
  | "avgTop15"
  | "top3Consecutive"
  | "stdDeviation"
  | "consistency"
type SortDirection = "asc" | "desc"

function fmtQualCell(n: number | null): string {
  if (n == null || !Number.isFinite(n)) {
    return "—"
  }
  return String(n)
}

function fmtLapStat(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—"
  }
  return formatLapTime(value)
}

export default function SessionsTableResults({
  session,
  selectedDriverIds: _selectedDriverIds = [],
}: SessionsTableResultsProps) {
  const [sortField, setSortField] = useState<SortField>("position")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  // Log session structure on mount
  useEffect(() => {
    console.log("[SessionsTableResults] Component mounted with session:", {
      sessionId: session?.id,
      raceLabel: session?.raceLabel,
      hasResults: !!session?.results,
      resultsType: Array.isArray(session?.results) ? "array" : typeof session?.results,
      resultsLength: Array.isArray(session?.results) ? session.results.length : "N/A",
      sessionKeys: session ? Object.keys(session) : [],
      firstResult:
        Array.isArray(session?.results) && session.results.length > 0 ? session.results[0] : null,
    })
  }, [session])

  // Validate and normalize results data - ensure driverName always exists
  const normalizedResults = useMemo(() => {
    if (!session.results || !Array.isArray(session.results) || session.results.length === 0) {
      console.warn("[SessionsTableResults] No results array or empty results", { session })
      return []
    }

    // Log raw data for debugging
    console.log("[SessionsTableResults] Raw results data:", {
      sessionId: session.id,
      raceLabel: session.raceLabel,
      resultsCount: session.results.length,
      firstResult: session.results[0],
      allResults: session.results.map((r) => ({
        raceResultId: r.raceResultId,
        driverId: r.driverId,
        driverName: r.driverName,
        driverNameType: typeof r.driverName,
        hasDriverName: "driverName" in r,
      })),
    })

    const normalized = session.results.map((result, index) => {
      // Ensure driverName property exists and is a non-empty string
      let driverName: string
      const rawDriverName = result.driverName

      // Check if driverName exists and is valid
      if (
        rawDriverName !== undefined &&
        rawDriverName !== null &&
        typeof rawDriverName === "string"
      ) {
        const trimmed = rawDriverName.trim()
        if (trimmed.length > 0) {
          driverName = trimmed
        } else {
          // Empty string - use fallback
          console.warn(`[SessionsTableResults] Empty string driverName for result ${index}:`, {
            raceResultId: result.raceResultId,
            driverId: result.driverId,
            lapsCompleted: result.lapsCompleted,
            rawDriverName,
          })
          driverName = "Unknown Driver"
        }
      } else {
        // Missing or invalid - use fallback
        console.warn(`[SessionsTableResults] Missing/invalid driverName for result ${index}:`, {
          raceResultId: result.raceResultId,
          driverId: result.driverId,
          lapsCompleted: result.lapsCompleted,
          rawDriverName,
          rawDriverNameType: typeof rawDriverName,
          hasDriverName: "driverName" in result,
          resultKeys: Object.keys(result),
        })
        driverName = "Unknown Driver"
      }

      // Create new object to ensure driverName is always present
      const normalizedResult = {
        ...result,
        driverName: driverName,
      }

      // Verify the property is actually set
      if (!normalizedResult.driverName || normalizedResult.driverName.trim().length === 0) {
        console.error(
          `[SessionsTableResults] CRITICAL: driverName still missing after normalization for result ${index}:`,
          {
            raceResultId: result.raceResultId,
            driverId: result.driverId,
            lapsCompleted: result.lapsCompleted,
            normalizedResult,
          }
        )
        normalizedResult.driverName = "Unknown Driver"
      }

      return normalizedResult
    })

    // Log comparison of 0-lap vs non-zero-lap drivers
    const zeroLapResults = normalized.filter((r) => r.lapsCompleted === 0)
    const nonZeroLapResults = normalized.filter((r) => r.lapsCompleted > 0)

    console.log("[SessionsTableResults] Normalized results summary:", {
      totalCount: normalized.length,
      zeroLapCount: zeroLapResults.length,
      nonZeroLapCount: nonZeroLapResults.length,
      zeroLapDriverNames: zeroLapResults.map((r) => ({
        driverId: r.driverId,
        driverName: r.driverName,
        laps: r.lapsCompleted,
      })),
      nonZeroLapDriverNames: nonZeroLapResults.map((r) => ({
        driverId: r.driverId,
        driverName: r.driverName,
        laps: r.lapsCompleted,
      })),
    })

    // Log normalized data
    console.log("[SessionsTableResults] Normalized results:", {
      normalizedCount: normalized.length,
      firstNormalized: normalized[0],
      allDriverNames: normalized.map((r) => r.driverName),
    })

    return normalized
  }, [session])

  // Sort results
  const sortedResults = useMemo(() => {
    const results = [...normalizedResults]

    try {
      results.sort((a, b) => {
        let comparison = 0

        switch (sortField) {
          case "position":
            comparison = a.positionFinal - b.positionFinal
            break
          case "driverName":
            // Handle null/undefined/empty driver names safely
            const nameA = (a.driverName?.trim() || "").toLowerCase()
            const nameB = (b.driverName?.trim() || "").toLowerCase()
            comparison = nameA.localeCompare(nameB)
            break
          case "qual":
            comparison = (a.qualifyingPosition ?? Infinity) - (b.qualifyingPosition ?? Infinity)
            break
          case "totalTime":
            comparison = (a.totalTimeSeconds ?? Infinity) - (b.totalTimeSeconds ?? Infinity)
            break
          case "behind":
            comparison =
              behindSortKey(a.secondsBehind, a.behindDisplay) -
              behindSortKey(b.secondsBehind, b.behindDisplay)
            break
          case "fastLap":
            comparison = (a.fastLapTime ?? Infinity) - (b.fastLapTime ?? Infinity)
            break
          case "avgLap":
            comparison = (a.avgLapTime ?? Infinity) - (b.avgLapTime ?? Infinity)
            break
          case "avgTop5":
            comparison = (a.liveRcStats?.avgTop5 ?? Infinity) - (b.liveRcStats?.avgTop5 ?? Infinity)
            break
          case "avgTop10":
            comparison =
              (a.liveRcStats?.avgTop10 ?? Infinity) - (b.liveRcStats?.avgTop10 ?? Infinity)
            break
          case "avgTop15":
            comparison =
              (a.liveRcStats?.avgTop15 ?? Infinity) - (b.liveRcStats?.avgTop15 ?? Infinity)
            break
          case "top3Consecutive":
            comparison =
              (a.liveRcStats?.top3Consecutive ?? Infinity) -
              (b.liveRcStats?.top3Consecutive ?? Infinity)
            break
          case "stdDeviation":
            comparison =
              (a.liveRcStats?.stdDeviation ?? Infinity) - (b.liveRcStats?.stdDeviation ?? Infinity)
            break
          case "consistency":
            comparison = (b.consistency ?? 0) - (a.consistency ?? 0) // Higher is better
            break
        }

        return sortDirection === "asc" ? comparison : -comparison
      })
    } catch (error) {
      console.error("[SessionsTableResults] Error during sort:", error, {
        sortField,
        resultsSample: results.slice(0, 3),
      })
      // Return unsorted results if sort fails
      return results
    }

    // Log sorted results to verify driverName exists
    console.log("[SessionsTableResults] Sorted results:", {
      sortedCount: results.length,
      firstSorted: results[0],
      allDriverNames: results.map((r) => ({
        raceResultId: r.raceResultId,
        driverId: r.driverId,
        driverName: r.driverName,
        hasDriverName: "driverName" in r,
        driverNameType: typeof r.driverName,
      })),
    })

    return results
  }, [normalizedResults, sortField, sortDirection])

  // Log what's being rendered
  useEffect(() => {
    if (sortedResults.length > 0) {
      console.log("[SessionsTableResults] Rendering with sortedResults:", {
        count: sortedResults.length,
        firstResult: sortedResults[0],
        firstDriverName: sortedResults[0]?.driverName,
        firstDriverNameType: typeof sortedResults[0]?.driverName,
      })
    }
  }, [sortedResults])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return "↕"
    }
    return sortDirection === "asc" ? "↑" : "↓"
  }

  return (
    <div className="px-4 py-4 bg-[var(--token-surface-alt)]">
      <div className="scrollbar-none overflow-x-auto">
        <table
          className="w-full min-w-[1100px]"
          aria-label={`Full results for ${session.raceLabel}`}
        >
          <thead>
            <tr className="border-b border-[var(--token-border-default)]">
              <th
                scope="col"
                className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-[var(--token-text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--token-text-primary)] transition-colors sm:px-3"
                onClick={() => handleSort("position")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleSort("position")
                  }
                }}
                tabIndex={0}
                aria-sort={
                  sortField === "position"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="flex items-center gap-1">Pos {getSortIcon("position")}</span>
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-[var(--token-text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--token-text-primary)] transition-colors sm:px-3"
                onClick={() => handleSort("driverName")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleSort("driverName")
                  }
                }}
                tabIndex={0}
                aria-sort={
                  sortField === "driverName"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="flex items-center gap-1">Driver {getSortIcon("driverName")}</span>
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-[var(--token-text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--token-text-primary)] transition-colors sm:px-3"
                onClick={() => handleSort("qual")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleSort("qual")
                  }
                }}
                tabIndex={0}
                aria-sort={
                  sortField === "qual"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="flex items-center gap-1">Qual {getSortIcon("qual")}</span>
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-[var(--token-text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--token-text-primary)] transition-colors sm:px-3"
                onClick={() => handleSort("totalTime")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleSort("totalTime")
                  }
                }}
                tabIndex={0}
                aria-sort={
                  sortField === "totalTime"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="flex items-center gap-1">
                  Laps/Time {getSortIcon("totalTime")}
                </span>
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-[var(--token-text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--token-text-primary)] transition-colors sm:px-3"
                onClick={() => handleSort("behind")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleSort("behind")
                  }
                }}
                tabIndex={0}
                aria-sort={
                  sortField === "behind"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="flex items-center gap-1">Behind {getSortIcon("behind")}</span>
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-[var(--token-text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--token-text-primary)] transition-colors sm:px-3"
                onClick={() => handleSort("fastLap")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleSort("fastLap")
                  }
                }}
                tabIndex={0}
                aria-sort={
                  sortField === "fastLap"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="flex items-center gap-1">
                  Fastest Lap {getSortIcon("fastLap")}
                </span>
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-[var(--token-text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--token-text-primary)] transition-colors sm:px-3"
                onClick={() => handleSort("avgLap")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleSort("avgLap")
                  }
                }}
                tabIndex={0}
                aria-sort={
                  sortField === "avgLap"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="flex items-center gap-1">Avg Lap {getSortIcon("avgLap")}</span>
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-[var(--token-text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--token-text-primary)] transition-colors sm:px-3"
                onClick={() => handleSort("avgTop5")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleSort("avgTop5")
                  }
                }}
                tabIndex={0}
                aria-sort={
                  sortField === "avgTop5"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="flex items-center gap-1">Avg Top 5 {getSortIcon("avgTop5")}</span>
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-[var(--token-text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--token-text-primary)] transition-colors sm:px-3"
                onClick={() => handleSort("avgTop10")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleSort("avgTop10")
                  }
                }}
                tabIndex={0}
                aria-sort={
                  sortField === "avgTop10"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="flex items-center gap-1">
                  Avg Top 10 {getSortIcon("avgTop10")}
                </span>
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-[var(--token-text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--token-text-primary)] transition-colors sm:px-3"
                onClick={() => handleSort("avgTop15")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleSort("avgTop15")
                  }
                }}
                tabIndex={0}
                aria-sort={
                  sortField === "avgTop15"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="flex items-center gap-1">
                  Avg Top 15 {getSortIcon("avgTop15")}
                </span>
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-[var(--token-text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--token-text-primary)] transition-colors sm:px-3"
                onClick={() => handleSort("top3Consecutive")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleSort("top3Consecutive")
                  }
                }}
                tabIndex={0}
                aria-sort={
                  sortField === "top3Consecutive"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="flex items-center gap-1">
                  Top 3 Consecutive {getSortIcon("top3Consecutive")}
                </span>
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-[var(--token-text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--token-text-primary)] transition-colors sm:px-3"
                onClick={() => handleSort("stdDeviation")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleSort("stdDeviation")
                  }
                }}
                tabIndex={0}
                aria-sort={
                  sortField === "stdDeviation"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="flex items-center gap-1">
                  Std. Deviation {getSortIcon("stdDeviation")}
                </span>
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-[var(--token-text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--token-text-primary)] transition-colors sm:px-3"
                onClick={() => handleSort("consistency")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleSort("consistency")
                  }
                }}
                tabIndex={0}
                aria-sort={
                  sortField === "consistency"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <span className="flex items-center gap-1">
                  Consistency {getSortIcon("consistency")}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((result, index) => {
              // Debug log for each render
              if (index === 0) {
                console.log("[SessionsTableResults] RENDERING ROW:", {
                  index,
                  raceResultId: result.raceResultId,
                  driverId: result.driverId,
                  driverName: result.driverName,
                  driverNameType: typeof result.driverName,
                  hasDriverName: "driverName" in result,
                  resultKeys: Object.keys(result),
                  fullResult: result,
                })
              }

              const ls = result.liveRcStats

              return (
                <tr
                  key={result.raceResultId}
                  className={`border-b border-[var(--token-border-default)] transition-colors ${
                    index % 2 === 0 ? "bg-[var(--token-surface)]" : "bg-[var(--token-surface-alt)]"
                  }`}
                >
                  <td className="px-2 py-2 text-sm tabular-nums text-[var(--token-text-primary)] sm:px-3">
                    {result.positionFinal}
                  </td>
                  <td
                    className="px-2 py-2 text-sm text-[var(--token-text-primary)] sm:px-3"
                    style={{ color: "var(--token-text-primary)" }}
                  >
                    {(() => {
                      // Get driver name with explicit checks
                      const name = result?.driverName

                      // Log for debugging - log EVERY row, not just first
                      console.log(`[SessionsTableResults] RENDERING ROW ${index} DRIVER NAME:`, {
                        index,
                        raceResultId: result?.raceResultId,
                        driverName: name,
                        driverNameType: typeof name,
                        hasDriverName: result ? "driverName" in result : false,
                        resultKeys: result ? Object.keys(result) : [],
                        result: result,
                      })

                      const displayName =
                        name && typeof name === "string" && name.trim().length > 0
                          ? name.trim()
                          : `[MISSING-${index}]`

                      return displayName
                    })()}
                  </td>
                  <td className="px-2 py-2 text-sm tabular-nums text-[var(--token-text-primary)] sm:px-3">
                    {fmtQualCell(result.qualifyingPosition)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-primary)] sm:px-3">
                    {formatLapsSlashTime(result.lapsCompleted, result.totalTimeSeconds)}
                  </td>
                  <td className="px-2 py-2 text-sm tabular-nums text-[var(--token-text-primary)] sm:px-3">
                    {formatRaceBehind(result.secondsBehind, result.behindDisplay)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-primary)] sm:px-3">
                    {formatLapTime(result.fastLapTime)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-primary)] sm:px-3">
                    {formatLapTime(result.avgLapTime)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-primary)] sm:px-3">
                    {fmtLapStat(ls?.avgTop5)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-primary)] sm:px-3">
                    {fmtLapStat(ls?.avgTop10)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-primary)] sm:px-3">
                    {fmtLapStat(ls?.avgTop15)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-primary)] sm:px-3">
                    {fmtLapStat(ls?.top3Consecutive)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-primary)] sm:px-3">
                    {fmtLapStat(ls?.stdDeviation)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-primary)] sm:px-3">
                    {formatConsistency(result.consistency)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
