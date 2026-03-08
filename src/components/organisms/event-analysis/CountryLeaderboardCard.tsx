"use client"

/**
 * @fileoverview Country Leader Board card – main-race points leaderboard by country
 *
 * @description Displays drivers ranked by points from main races at tracks in a
 *              selected country for a calendar year. Filterable by country and class.
 *
 * @relatedFiles
 * - src/app/api/v1/leaderboards/country/route.ts
 * - src/app/api/v1/leaderboards/countries/route.ts
 */

import { useEffect, useMemo, useState } from "react"
import ListPagination from "./ListPagination"
import { formatClassName } from "@/lib/format-class-name"

interface CountryLeaderboardRow {
  driverId: string
  driverName: string
  className: string
  points: number
  wins: number
  podiums: number
  eventsCount: number
}

interface CountryLeaderboardResponse {
  country: string
  year: number
  total: number
  rows: CountryLeaderboardRow[]
  classes: string[]
}

interface CountriesResponse {
  countries: string[]
}

interface CountryLeaderboardCardProps {
  defaultCountry?: string
  defaultYear?: number
}

export default function CountryLeaderboardCard({
  defaultCountry = "",
  defaultYear,
}: CountryLeaderboardCardProps) {
  const now = useMemo(() => new Date(), [])
  const initialYear = defaultYear ?? now.getFullYear()

  const [countries, setCountries] = useState<string[]>([])
  const [countryQuery, setCountryQuery] = useState(defaultCountry)
  const [selectedCountry, setSelectedCountry] = useState(defaultCountry)
  const [year] = useState(initialYear)
  const [className, setClassName] = useState<string | "">("")

  const [data, setData] = useState<CountryLeaderboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Load available countries once.
  useEffect(() => {
    let cancelled = false

    async function loadCountries() {
      try {
        const res = await fetch("/api/v1/leaderboards/countries", {
          cache: "no-store",
          credentials: "include",
        })
        if (!res.ok) {
          return
        }
        const json = await res.json()
        if (!cancelled && json?.success && json?.data) {
          setCountries((json.data as CountriesResponse).countries ?? [])
        }
      } catch {
        // Silent failure – filter will still allow manual country text entry.
      }
    }

    loadCountries()
    return () => {
      cancelled = true
    }
  }, [])

  // Fetch leaderboard whenever selectedCountry or className changes.
  useEffect(() => {
    const sc = selectedCountry.trim()
    if (!sc) {
      setData(null)
      setError(null)
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function loadLeaderboard() {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set("country", sc)
        params.set("year", String(year))
        // Fetch all rows; pagination is client-side for now.
        params.set("limit", "500")
        if (className) {
          params.set("class_name", className)
        }
        const url = `/api/v1/leaderboards/country?${params.toString()}`
        const res = await fetch(url, { cache: "no-store", credentials: "include" })
        if (!res.ok) {
          let message = `Failed to load country leaderboard (${res.status})`
          try {
            const errJson = await res.json()
            const apiMessage = errJson?.error?.message ?? errJson?.message
            if (typeof apiMessage === "string") {
              message = apiMessage
            }
          } catch {
            // ignore
          }
          throw new Error(message)
        }
        const json = await res.json()
        if (!cancelled && json?.success && json?.data) {
          setData(json.data as CountryLeaderboardResponse)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load country leaderboard")
          setData(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadLeaderboard()
    return () => {
      cancelled = true
    }
  }, [selectedCountry, year, className])

  // Reset pagination on filter change.
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCountry, className])

  const allClasses = data?.classes ?? []
  const rows = data?.rows ?? []

  const totalPages = Math.max(1, Math.ceil(rows.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedRows = rows.slice(startIndex, startIndex + itemsPerPage)

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setItemsPerPage(newRowsPerPage)
    setCurrentPage(1)
  }

  const handleApplyCountrySearch = () => {
    setSelectedCountry(countryQuery)
  }

  return (
    <div className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6">
      <h2 className="text-lg font-medium text-[var(--token-text-primary)] mb-4">
        Country Leader Board{selectedCountry ? `: ${selectedCountry}` : ""}
      </h2>
      <p className="text-sm text-[var(--token-text-secondary)] mb-4">
        Drivers ranked by points from main races at tracks in{" "}
        {selectedCountry || "the selected country"} (Calendar year {year}). Points: 1st=25, 2nd=18,
        3rd=15, 4th=12, 5th=10, then 8–1 for 6th–10th. Points are summed across all main races per
        driver and class. Ranking order: total points, then wins, then podiums.
      </p>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4 mb-4 pb-3 border-b border-[var(--token-border-default)]">
        {/* Country filter – simple searchable combo (text + select) */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="country-leaderboard-country"
            className="text-sm text-[var(--token-text-secondary)]"
          >
            Country:
          </label>
          <input
            id="country-leaderboard-country"
            value={countryQuery}
            onChange={(e) => setCountryQuery(e.target.value)}
            placeholder="Type a country (e.g. Australia)"
            className="rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1.5 text-sm text-[var(--token-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
          />
          <button
            type="button"
            onClick={handleApplyCountrySearch}
            className="rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] px-3 py-1.5 text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
          >
            Apply
          </button>
          {countries.length > 0 && (
            <select
              aria-label="Select from known countries"
              value={countries.includes(selectedCountry) ? selectedCountry : ""}
              onChange={(e) => {
                const value = e.target.value
                setCountryQuery(value)
                setSelectedCountry(value)
              }}
              className="rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1.5 text-sm text-[var(--token-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
            >
              <option value="">Choose known country</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Class filter – mirrors TrackLeaderboardTab styling */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="country-leaderboard-class"
            className="text-sm text-[var(--token-text-secondary)]"
          >
            Class:
          </label>
          <select
            id="country-leaderboard-class"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1.5 text-sm text-[var(--token-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
          >
            <option value="">All classes</option>
            {allClasses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-[var(--token-text-muted)]">Loading country leaderboard…</p>
      )}
      {error && <p className="text-sm text-[var(--token-text-error)]">{error}</p>}

      {!isLoading && !error && !selectedCountry && (
        <p className="text-sm text-[var(--token-text-muted)]">
          Enter a country and click Apply to view the leaderboard.
        </p>
      )}

      {!isLoading && !error && selectedCountry && rows.length === 0 && (
        <p className="text-sm text-[var(--token-text-muted)]">
          No main race results found for {selectedCountry} in {year}.
        </p>
      )}

      {!isLoading && !error && selectedCountry && rows.length > 0 && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--token-border-default)] text-left text-[var(--token-text-secondary)]">
                  <th className="pb-2 pr-4">Rank</th>
                  <th className="pb-2 pr-4">Driver</th>
                  <th className="pb-2 pr-4">Class</th>
                  <th className="pb-2 pr-4">Points</th>
                  <th className="pb-2 pr-4">Wins</th>
                  <th className="pb-2 pr-4">Podiums</th>
                  <th className="pb-2">Events</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, idx) => (
                  <tr
                    key={`${row.driverId}:${row.className}`}
                    className="border-b border-[var(--token-border-default)] last:border-0"
                  >
                    <td className="py-2 pr-4 font-medium">{startIndex + idx + 1}</td>
                    <td className="py-2 pr-4">{row.driverName}</td>
                    <td className="py-2 pr-4">{formatClassName(row.className)}</td>
                    <td className="py-2 pr-4">{row.points}</td>
                    <td className="py-2 pr-4">{row.wins}</td>
                    <td className="py-2 pr-4">{row.podiums}</td>
                    <td className="py-2">{row.eventsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={rows.length}
            itemLabel="drivers"
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        </div>
      )}
    </div>
  )
}
