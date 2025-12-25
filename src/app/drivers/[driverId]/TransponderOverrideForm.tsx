/**
 * @fileoverview Transponder Override Form component
 * 
 * @created 2025-12-24
 * @creator Jayson Brenton
 * @lastModified 2025-12-24
 * 
 * @description Form component for creating transponder overrides
 */

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export interface TransponderOverrideFormProps {
  driverId: string
  eventId: string
  onSuccess: () => void
  onCancel: () => void
}

export default function TransponderOverrideForm({
  driverId,
  eventId,
  onSuccess,
  onCancel,
}: TransponderOverrideFormProps) {
  const router = useRouter()
  const [transponderNumber, setTransponderNumber] = useState("")
  const [effectiveFromRaceId, setEffectiveFromRaceId] = useState<string | null>(null)
  const [scope, setScope] = useState<"all" | "race">("all")
  const [races, setRaces] = useState<Array<{ id: string; label: string; order: number | null }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Fetch races for the event
  useEffect(() => {
    const fetchRaces = async () => {
      try {
        const response = await fetch(`/api/v1/events/${eventId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data.races) {
            setRaces(
              data.data.races.map((race: any) => ({
                id: race.id,
                label: `${race.race_label} (Race ${race.race_order || "?"})`,
                order: race.race_order,
              }))
            )
          }
        }
      } catch (err) {
        console.error("Failed to fetch races:", err)
      }
    }

    fetchRaces()
  }, [eventId])

  const validateTransponder = (value: string): boolean => {
    // Format: numeric, 1-20 characters
    if (!/^\d{1,20}$/.test(value)) {
      setValidationError("Transponder number must be numeric and 1-20 characters")
      return false
    }
    setValidationError(null)
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateTransponder(transponderNumber)) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/v1/transponder-overrides", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          driverId,
          effectiveFromRaceId: scope === "race" ? effectiveFromRaceId : null,
          transponderNumber,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || "Failed to create override")
        setLoading(false)
        return
      }

      // Success
      onSuccess()
    } catch (err) {
      setError("An error occurred while creating the override")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface)]">
      <h3 className="text-lg font-semibold text-[var(--token-text-primary)]">
        Add Transponder Override
      </h3>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[var(--token-text-primary)] mb-2">
          Transponder Number *
        </label>
        <input
          type="text"
          value={transponderNumber}
          onChange={(e) => {
            setTransponderNumber(e.target.value)
            if (validationError) {
              validateTransponder(e.target.value)
            }
          }}
          onBlur={() => validateTransponder(transponderNumber)}
          className="w-full px-3 py-2 border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
          placeholder="e.g., 1234567"
          required
        />
        {validationError && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationError}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--token-text-primary)] mb-2">
          Scope *
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="scope"
              value="all"
              checked={scope === "all"}
              onChange={() => {
                setScope("all")
                setEffectiveFromRaceId(null)
              }}
              className="mr-2"
            />
            <span className="text-sm text-[var(--token-text-primary)]">
              All remaining races (from first race onwards)
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="scope"
              value="race"
              checked={scope === "race"}
              onChange={() => setScope("race")}
              className="mr-2"
            />
            <span className="text-sm text-[var(--token-text-primary)]">
              From specific race onwards
            </span>
          </label>
        </div>
      </div>

      {scope === "race" && (
        <div>
          <label className="block text-sm font-medium text-[var(--token-text-primary)] mb-2">
            Effective From Race *
          </label>
          <select
            value={effectiveFromRaceId || ""}
            onChange={(e) => setEffectiveFromRaceId(e.target.value || null)}
            className="w-full px-3 py-2 border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
            required={scope === "race"}
          >
            <option value="">Select a race</option>
            {races
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((race) => (
                <option key={race.id} value={race.id}>
                  {race.label}
                </option>
              ))}
          </select>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-[var(--token-accent)] text-white rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] transition-opacity disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Override"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

