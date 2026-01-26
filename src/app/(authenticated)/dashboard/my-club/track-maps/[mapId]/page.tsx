/**
 * @fileoverview Track Map Editor page
 * 
 * @created 2026-01-24
 * @creator Auto-generated
 * @lastModified 2026-01-24
 * 
 * @description Page for editing track maps
 * 
 * @purpose Provides the track map editor interface with canvas and tools
 */

"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Breadcrumbs from "@/components/Breadcrumbs"
import TrackMapEditor from "@/components/track-maps/TrackMapEditor"
import type { TrackMapWithRelations, TrackMapData } from "@/core/track-maps/repo"

export default function TrackMapEditorPage() {
  const params = useParams()
  const router = useRouter()
  const mapId = params.mapId as string
  const [map, setMap] = useState<TrackMapWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mapId && mapId !== "new") {
      loadTrackMap()
    } else {
      setLoading(false)
    }
  }, [mapId])

  async function loadTrackMap() {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/track-maps/${mapId}`)
      if (!response.ok) {
        throw new Error("Failed to load track map")
      }
      const data = await response.json()
      if (data.success) {
        setMap(data.data.map)
      } else {
        throw new Error(data.message || "Failed to load track map")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <section className="content-wrapper mx-auto w-full min-w-0 max-w-full flex-shrink-0">
        <div className="text-center py-12 text-[var(--token-text-secondary)]">
          Loading track map...
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="content-wrapper mx-auto w-full min-w-0 max-w-6xl flex-shrink-0">
        <Breadcrumbs
          items={[
            { label: "My Event Analysis", href: "/dashboard" },
            { label: "My Club", href: "/under-development?from=/dashboard/my-club" },
            { label: "Track Maps", href: "/dashboard/my-club/track-maps" },
            { label: "Editor" },
          ]}
        />
        <div className="rounded-lg border border-red-500 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-200 mt-6">
          {error}
        </div>
      </section>
    )
  }

  return (
    <section className="content-wrapper mx-auto w-full min-w-0 max-w-full flex-shrink-0">
      <Breadcrumbs
        items={[
          { label: "My Event Analysis", href: "/dashboard" },
          { label: "My Club", href: "/under-development?from=/dashboard/my-club" },
          { label: "Track Maps", href: "/dashboard/my-club/track-maps" },
          { label: map?.name || "New Map" },
        ]}
      />
      <TrackMapEditor
        mapId={mapId === "new" ? null : mapId}
        initialMap={map}
        onSave={(savedMap) => {
          if (mapId === "new") {
            router.push(`/dashboard/my-club/track-maps/${savedMap.id}`)
          }
        }}
      />
    </section>
  )
}
