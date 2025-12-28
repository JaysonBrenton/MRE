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

import { useEffect, useState } from "react"

export interface TransponderOverrideFormProps {
  driverId: string
  eventId: string
  onSuccess: () => void
  onCancel: () => void
}

interface EventRaceResponse {
  id: string
  race_label: string
  race_order: number | null
}

export default function TransponderOverrideForm({
  driverId,
  eventId,
  onSuccess,
  onCancel,
}: TransponderOverrideFormProps) {
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
          if (data.success && Array.isArray(data.data.races)) {
            setRaces(
              (data.data.races as EventRaceResponse[]).map((race) => ({
                id: race.id,
                label: `${race.race_label} (Race ${race.race_order || "?"})`,
                order: race.race_order,
              }))
            )
          }
        }
      } catch {
        setError("Unable to load race list. Please try again.")
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
    } catch {
      setError("An error occurred while creating the override")
      setLoading(false)
    }
  }

  const scopeOptionClass = (currentScope: "all" | "race") =>
    `flex items-center gap-3 rounded-md border ${
      scope === currentScope
        ? "border-[var(--token-accent)]"
        : "border-[var(--token-border-default)]"
    } bg-[var(--token-surface-elevated)] px-3 py-3 min-h-[44px] transition-colors focus-within:ring-2 focus-within:ring-[var(--token-interactive-focus-ring)]`

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface)]">
      <h3 className="text-lg font-semibold text-[var(--token-text-primary)]">
        Add Transponder Override
      </h3>

      {error && (
        <div className="p-3 rounded-md border border-[var(--token-error-text)] bg-[var(--token-error-background)] text-sm text-[var(--token-error-text)]">
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
          <p className="mt-1 text-sm text-[var(--token-error-text)]">{validationError}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--token-text-primary)] mb-2">
          Scope *
        </label>
        <div className="space-y-2">
          <label className={scopeOptionClass("all")}>
            <input
              type="radio"
              name="scope"
              value="all"
              checked={scope === "all"}
              onChange={() => {
                setScope("all")
                setEffectiveFromRaceId(null)
              }}
              className="h-4 w-4 text-[var(--token-accent)] focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
            />
            <span className="text-sm text-[var(--token-text-primary)]">
              All remaining races (from first race onwards)
            </span>
          </label>
          <label className={scopeOptionClass("race")}>
            <input
              type="radio"
              name="scope"
              value="race"
              checked={scope === "race"}
              onChange={() => setScope("race")}
              className="h-4 w-4 text-[var(--token-accent)] focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
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
          className="mobile-button inline-flex flex-1 items-center justify-center rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)] px-4 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Creating..." : "Create Override"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="mobile-button inline-flex flex-1 items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
