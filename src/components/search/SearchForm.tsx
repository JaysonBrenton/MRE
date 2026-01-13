/**
 * @fileoverview Search form component
 * 
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 * 
 * @description Search form with filters for unified search
 */

"use client"

import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  setQuery,
  setDriverName,
  setSessionType,
  setDateRange,
  clearSearch,
  performSearch,
} from "@/store/slices/searchSlice"
import type { SessionType } from "@/core/search/types"

export default function SearchForm() {
  const dispatch = useAppDispatch()
  const {
    query,
    driverName,
    sessionType,
    startDate,
    endDate,
    isLoading,
  } = useAppSelector((state) => state.search)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    dispatch(performSearch())
  }

  const handleClear = () => {
    dispatch(clearSearch())
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* General Search Query */}
      <div>
        <label htmlFor="query" className="block text-sm font-medium text-[var(--token-text-secondary)] mb-2">
          Search
        </label>
        <input
          id="query"
          type="text"
          value={query}
          onChange={(e) => dispatch(setQuery(e.target.value))}
          placeholder="Search events and sessions..."
          className="w-full px-4 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)]"
        />
      </div>

      {/* Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Driver Name Filter */}
        <div>
          <label htmlFor="driverName" className="block text-sm font-medium text-[var(--token-text-secondary)] mb-2">
            Driver Name
          </label>
          <input
            id="driverName"
            type="text"
            value={driverName}
            onChange={(e) => dispatch(setDriverName(e.target.value))}
            placeholder="Filter by driver..."
            className="w-full px-4 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)]"
          />
        </div>

        {/* Session Type Filter */}
        <div>
          <label htmlFor="sessionType" className="block text-sm font-medium text-[var(--token-text-secondary)] mb-2">
            Session Type
          </label>
          <select
            id="sessionType"
            value={sessionType || ""}
            onChange={(e) =>
              dispatch(setSessionType((e.target.value || null) as SessionType | null))
            }
            className="w-full px-4 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)]"
          >
            <option value="">All Types</option>
            <option value="race">Race</option>
            <option value="practice">Practice</option>
            <option value="qualifying">Qualifying</option>
          </select>
        </div>

        {/* Date Range - Start Date */}
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-[var(--token-text-secondary)] mb-2">
            Start Date
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate || ""}
            onChange={(e) =>
              dispatch(
                setDateRange({
                  startDate: e.target.value || null,
                  endDate: endDate,
                })
              )
            }
            className="w-full px-4 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)]"
          />
        </div>
      </div>

      {/* End Date */}
      <div>
        <label htmlFor="endDate" className="block text-sm font-medium text-[var(--token-text-secondary)] mb-2">
          End Date
        </label>
        <input
          id="endDate"
          type="date"
          value={endDate || ""}
          onChange={(e) =>
            dispatch(
              setDateRange({
                startDate: startDate,
                endDate: e.target.value || null,
              })
            )
          }
          className="w-full px-4 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)]"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 rounded-md bg-[var(--token-accent)] text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={isLoading}
          className="px-6 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] font-medium hover:bg-[var(--token-surface-raised)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
        >
          Clear
        </button>
      </div>
    </form>
  )
}
