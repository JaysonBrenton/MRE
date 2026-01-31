/**
 * @fileoverview Admin dashboard statistics component
 *
 * @created 2025-01-29
 * @creator System
 * @lastModified 2025-01-29
 *
 * @description Displays system statistics cards for the admin dashboard
 *
 * @purpose Shows key metrics including user counts, event counts, track counts, and database size
 *
 * @relatedFiles
 * - src/app/(authenticated)/admin/page.tsx (admin dashboard page)
 * - src/app/api/v1/admin/stats/route.ts (stats API endpoint)
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface SystemStats {
  users: {
    total: number
    admins: number
    regular: number
  }
  events: {
    total: number
    ingested: number
    notIngested: number
  }
  tracks: {
    total: number
    followed: number
    active: number
  }
  database: {
    size: string | null
    connectionPool: {
      active: number
      idle: number
    }
  }
}

export default function AdminDashboardStats() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/v1/admin/stats")
        const data = await response.json()
        if (data.success) {
          setStats(data.data)
        } else {
          setError(data.error?.message || "Failed to load statistics")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-6"
          >
            <div className="h-4 w-24 bg-[var(--token-surface)] rounded animate-pulse mb-2" />
            <div className="h-8 w-16 bg-[var(--token-surface)] rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--token-border-error)] bg-[var(--token-surface-elevated)] p-6">
        <p className="text-[var(--token-text-error)]">Error: {error}</p>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Users Card */}
      <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--token-text-secondary)]">Users</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--token-text-primary)]">
              {stats.users.total}
            </p>
            <p className="mt-1 text-xs text-[var(--token-text-muted)]">
              {stats.users.admins} admins, {stats.users.regular} regular
            </p>
          </div>
          <Link
            href="/admin/users"
            className="text-sm text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
          >
            Manage →
          </Link>
        </div>
      </div>

      {/* Events Card */}
      <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--token-text-secondary)]">Events</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--token-text-primary)]">
              {stats.events.total}
            </p>
            <p className="mt-1 text-xs text-[var(--token-text-muted)]">
              {stats.events.ingested} ingested, {stats.events.notIngested} pending
            </p>
          </div>
          <Link
            href="/admin/events"
            className="text-sm text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
          >
            View →
          </Link>
        </div>
      </div>

      {/* Tracks Card */}
      <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--token-text-secondary)]">Tracks</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--token-text-primary)]">
              {stats.tracks.total}
            </p>
            <p className="mt-1 text-xs text-[var(--token-text-muted)]">
              {stats.tracks.followed} followed, {stats.tracks.active} active
            </p>
          </div>
          <Link
            href="/admin/tracks"
            className="text-sm text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
          >
            Manage →
          </Link>
        </div>
      </div>

      {/* Database Card */}
      <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-6">
        <div>
          <p className="text-sm font-medium text-[var(--token-text-secondary)]">Database</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--token-text-primary)]">
            {stats.database.size || "N/A"}
          </p>
          <p className="mt-1 text-xs text-[var(--token-text-muted)]">Total size</p>
        </div>
      </div>
    </div>
  )
}
