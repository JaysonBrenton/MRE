/**
 * @fileoverview Track Maps list page
 * 
 * @created 2026-01-24
 * @creator Auto-generated
 * @lastModified 2026-01-24
 * 
 * @description Page for managing track maps
 * 
 * @purpose Displays a list of user's track maps and allows creating new ones
 *          and managing existing maps.
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Breadcrumbs from "@/components/Breadcrumbs"
import type { TrackMapWithRelations } from "@/core/track-maps/repo"

export default function TrackMapsPage() {
  const [maps, setMaps] = useState<TrackMapWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTrackMaps()
  }, [])

  async function loadTrackMaps() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/v1/track-maps")
      if (!response.ok) {
        // Only show error for non-200 status codes (actual errors)
        // 200 with empty array is fine - that means no maps yet
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Failed to load track maps (${response.status})`)
      }
      const data = await response.json()
      if (data.success) {
        // Empty array is valid - means user has no maps yet
        setMaps(data.data.maps || [])
        setError(null)
      } else {
        throw new Error(data.message || "Failed to load track maps")
      }
    } catch (err) {
      // Only set error for actual errors, not empty results
      setError(err instanceof Error ? err.message : "An error occurred while loading track maps")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(mapId: string) {
    if (!confirm("Are you sure you want to delete this track map?")) {
      return
    }

    try {
      const response = await fetch(`/api/v1/track-maps/${mapId}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        throw new Error("Failed to delete track map")
      }
      // Reload maps
      await loadTrackMaps()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete track map")
    }
  }


  return (
    <section className="content-wrapper mx-auto w-full min-w-0 max-w-6xl flex-shrink-0">
      <Breadcrumbs
        items={[
          { label: "My Event Analysis", href: "/dashboard" },
          { label: "My Club", href: "/under-development?from=/dashboard/my-club" },
          { label: "Track Maps" },
        ]}
      />
      <div className="w-full min-w-0 flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-[var(--token-text-primary)]">
              Track Maps
            </h1>
            <p className="mt-2 text-base text-[var(--token-text-secondary)]">
              Build and share track layouts
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/my-club/track-maps/new"
              className="px-4 py-2 bg-[var(--token-accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Create New Map
            </Link>
          </div>
        </div>

        {loading && (
          <div className="text-center py-12 text-[var(--token-text-secondary)]">
            Loading track maps...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {maps.length === 0 ? (
              <div className="mt-8 w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-12 text-center">
                <h2 className="text-xl font-semibold text-[var(--token-text-primary)] mb-3">
                  No Track Maps Yet
                </h2>
                <p className="text-[var(--token-text-secondary)] mb-6">
                  Create your first track map to get started
                </p>
                <Link
                  href="/dashboard/my-club/track-maps/new"
                  className="inline-block px-6 py-3 bg-[var(--token-accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Create Your First Map
                </Link>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {maps.map((map) => (
                  <div
                    key={map.id}
                    className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6 hover:border-[var(--token-accent)] transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-[var(--token-text-primary)] mb-1">
                          {map.name}
                        </h3>
                        <p className="text-sm text-[var(--token-text-secondary)]">
                          {map.track.trackName}
                        </p>
                      </div>
                      {map.isPublic && (
                        <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                          Public
                        </span>
                      )}
                    </div>
                    {map.description && (
                      <p className="text-sm text-[var(--token-text-secondary)] mb-4 line-clamp-2">
                        {map.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-[var(--token-text-secondary)] mb-4">
                      <span>
                        Updated {new Date(map.updatedAt).toLocaleDateString()}
                      </span>
                      <span>
                        {(map.mapData.shapes || []).length} shapes
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/dashboard/my-club/track-maps/${map.id}`}
                        className="flex-1 px-3 py-2 text-sm bg-[var(--token-accent)] text-white rounded hover:opacity-90 transition-opacity text-center"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(map.id)}
                        className="px-3 py-2 text-sm border border-[var(--token-border-default)] rounded hover:bg-[var(--token-surface-raised)] transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
