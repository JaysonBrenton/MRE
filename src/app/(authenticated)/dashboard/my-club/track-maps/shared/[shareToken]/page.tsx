/**
 * @fileoverview Shared Track Map page
 * 
 * @created 2026-01-24
 * @creator Auto-generated
 * @lastModified 2026-01-24
 * 
 * @description Page for viewing shared track maps
 * 
 * @purpose Allows users to view track maps shared via share tokens
 */

"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Breadcrumbs from "@/components/Breadcrumbs"
import type { TrackMapWithRelations } from "@/core/track-maps/repo"

export default function SharedTrackMapPage() {
  const params = useParams()
  const shareToken = params.shareToken as string
  const [map, setMap] = useState<TrackMapWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (shareToken) {
      loadSharedMap()
    }
  }, [shareToken])

  async function loadSharedMap() {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/track-maps/shared/${shareToken}`)
      if (!response.ok) {
        throw new Error("Failed to load shared map")
      }
      const data = await response.json()
      if (data.success) {
        setMap(data.data.map)
      } else {
        throw new Error(data.message || "Failed to load shared map")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }


  if (loading) {
    return (
      <section className="content-wrapper mx-auto w-full min-w-0 max-w-6xl flex-shrink-0">
        <div className="text-center py-12 text-[var(--token-text-secondary)]">
          Loading shared track map...
        </div>
      </section>
    )
  }

  if (error || !map) {
    return (
      <section className="content-wrapper mx-auto w-full min-w-0 max-w-6xl flex-shrink-0">
        <Breadcrumbs
          items={[
            { label: "My Event Analysis", href: "/dashboard" },
            { label: "My Club", href: "/under-development?from=/dashboard/my-club" },
            { label: "Track Maps", href: "/dashboard/my-club/track-maps" },
            { label: "Shared Map" },
          ]}
        />
        <div className="rounded-lg border border-red-500 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-200 mt-6">
          {error || "Track map not found"}
        </div>
      </section>
    )
  }

  return (
    <section className="content-wrapper mx-auto w-full min-w-0 max-w-6xl flex-shrink-0">
      <Breadcrumbs
        items={[
          { label: "My Event Analysis", href: "/dashboard" },
          { label: "My Club", href: "/under-development?from=/dashboard/my-club" },
          { label: "Track Maps", href: "/dashboard/my-club/track-maps" },
          { label: map.name },
        ]}
      />
      <div className="w-full min-w-0 flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-[var(--token-text-primary)]">
              {map.name}
            </h1>
            <p className="mt-2 text-base text-[var(--token-text-secondary)]">
              Shared by {map.user.driverName} • {map.track.trackName}
            </p>
            {map.description && (
              <p className="mt-2 text-base text-[var(--token-text-secondary)]">
                {map.description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6">
          <p className="text-sm text-[var(--token-text-secondary)]">
            This is a shared track map. You can view it here.
          </p>
        </div>
      </div>
    </section>
  )
}
