/**
 * @fileoverview Driver Details client component
 * 
 * @created 2025-12-24
 * @creator Jayson Brenton
 * @lastModified 2025-12-24
 * 
 * @description Client component for driver details page with transponder display and override management
 */

"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { DriverWithEventEntries } from "@/core/drivers/repo"
import TransponderOverrideForm from "./TransponderOverrideForm"

export interface DriverDetailsClientProps {
  driver: DriverWithEventEntries
  eventId?: string
}

export default function DriverDetailsClient({ driver, eventId }: DriverDetailsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showOverrideForm, setShowOverrideForm] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(eventId)
  const [driverData, setDriverData] = useState(driver)

  // Sync selectedEventId with URL search params
  useEffect(() => {
    const eventIdFromUrl = searchParams.get("eventId") || undefined
    setSelectedEventId(eventIdFromUrl)
  }, [searchParams])

  // Refresh driver data after override operations
  const refreshDriverData = async () => {
    try {
      const response = await fetch(`/api/v1/drivers/${driver.id}${selectedEventId ? `?eventId=${selectedEventId}` : ""}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          // Transform API response to match DriverWithEventEntries structure
          setDriverData({
            id: data.data.id,
            displayName: data.data.display_name,
            sourceDriverId: data.data.source_driver_id,
            transponderNumber: data.data.transponder_number,
            eventEntries: data.data.event_entries.map((entry: any) => ({
              eventId: entry.event_id,
              eventName: entry.event_name,
              className: entry.class_name,
              transponderNumber: entry.transponder_number,
              carNumber: entry.car_number,
              override: entry.override
                ? {
                    transponderNumber: entry.override.transponder_number,
                    effectiveFromRaceId: entry.override.effective_from_race_id,
                    effectiveFromRaceLabel: entry.override.effective_from_race_label,
                    createdAt: new Date(entry.override.created_at),
                  }
                : undefined,
            })),
          })
        }
      }
    } catch (error) {
      console.error("Failed to refresh driver data:", error)
    }
  }

  // Group entries by event
  const entriesByEvent = driverData.eventEntries.reduce((acc, entry) => {
    if (!acc[entry.eventId]) {
      acc[entry.eventId] = {
        eventId: entry.eventId,
        eventName: entry.eventName,
        entries: [],
      }
    }
    acc[entry.eventId].entries.push(entry)
    return acc
  }, {} as Record<string, { eventId: string; eventName: string; entries: typeof driverData.eventEntries }>)

  return (
    <div className="space-y-6">
      {/* Driver Header */}
      <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--token-text-primary)] mb-2">
          {driverData.displayName}
        </h1>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Driver ID: {driverData.sourceDriverId}
        </p>
        {driverData.transponderNumber && (
          <p className="text-sm text-[var(--token-text-secondary)] mt-1">
            Default Transponder: {driverData.transponderNumber}
          </p>
        )}
      </div>

      {/* Event Filter (if multiple events) */}
      {Object.keys(entriesByEvent).length > 1 && (
        <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4">
          <label className="block text-sm font-medium text-[var(--token-text-primary)] mb-2">
            Filter by Event:
          </label>
          <select
            value={selectedEventId || ""}
            onChange={(e) => {
              const newEventId = e.target.value || undefined
              setSelectedEventId(newEventId)
              const newUrl = `/drivers/${driver.id}${newEventId ? `?eventId=${newEventId}` : ""}`
              router.push(newUrl)
              // Refresh data after navigation
              setTimeout(() => {
                refreshDriverData()
              }, 100)
            }}
            className="w-full sm:w-auto px-3 py-2 border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            <option value="">All Events</option>
            {Object.values(entriesByEvent).map((event) => (
              <option key={event.eventId} value={event.eventId}>
                {event.eventName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Transponder Numbers Section */}
      <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[var(--token-text-primary)]">
            Transponder Numbers
          </h2>
          {selectedEventId && (
            <button
              onClick={() => setShowOverrideForm(!showOverrideForm)}
              className="px-4 py-2 bg-[var(--token-accent)] text-white rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] transition-opacity"
            >
              {showOverrideForm ? "Cancel" : "Add Override"}
            </button>
          )}
        </div>

        {showOverrideForm && selectedEventId && (
          <div className="mb-6">
            <TransponderOverrideForm
              driverId={driver.id}
              eventId={selectedEventId}
              onSuccess={() => {
                setShowOverrideForm(false)
                refreshDriverData()
              }}
              onCancel={() => setShowOverrideForm(false)}
            />
          </div>
        )}

        {driverData.eventEntries.length === 0 ? (
          <p className="text-[var(--token-text-secondary)]">No event entries found.</p>
        ) : (
          <div className="space-y-4">
            {Object.values(entriesByEvent).map((event) => (
              <div key={event.eventId} className="space-y-3">
                <h3 className="text-lg font-medium text-[var(--token-text-primary)]">
                  {event.eventName}
                </h3>
                <div className="space-y-2">
                  {event.entries.map((entry) => (
                    <div
                      key={`${entry.eventId}-${entry.className}`}
                      className="p-4 border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface)]"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-[var(--token-text-primary)]">
                            {entry.className}
                          </p>
                          {entry.carNumber && (
                            <p className="text-sm text-[var(--token-text-secondary)]">
                              Car #{entry.carNumber}
                            </p>
                          )}
                          <div className="mt-2">
                            {entry.override ? (
                              <div className="space-y-1">
                                <p className="text-sm text-[var(--token-text-secondary)]">
                                  Original: {entry.transponderNumber || "N/A"}
                                </p>
                                <p className="text-sm font-medium text-[var(--token-text-primary)]">
                                  Override: {entry.override.transponderNumber}
                                  <span className="ml-2 text-xs text-[var(--token-text-secondary)]">
                                    (changed in {entry.override.effectiveFromRaceLabel})
                                  </span>
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-[var(--token-text-primary)]">
                                Transponder: {entry.transponderNumber || "N/A"}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Classes Participated Section */}
      <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-6">
        <h2 className="text-xl font-semibold text-[var(--token-text-primary)] mb-4">
          Classes Participated
        </h2>
        {driverData.eventEntries.length === 0 ? (
          <p className="text-[var(--token-text-secondary)]">No classes found.</p>
        ) : (
          <div className="space-y-2">
            {driverData.eventEntries.map((entry) => (
              <div
                key={`${entry.eventId}-${entry.className}`}
                className="flex items-center justify-between p-3 border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface)]"
              >
                <div>
                  <p className="font-medium text-[var(--token-text-primary)]">
                    {entry.className}
                  </p>
                  <p className="text-sm text-[var(--token-text-secondary)]">
                    {entry.eventName}
                  </p>
                </div>
                <a
                  href={`/events/analyse/${entry.eventId}`}
                  className="text-sm text-[var(--token-accent)] hover:underline"
                >
                  View Event →
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

