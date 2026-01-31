/**
 * @fileoverview Read-only view of user driver links
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Displays user driver links grouped by status (confirmed, suggested, conflicts)
 *
 * @purpose Provides read-only visibility into driver link status. Links are automatically
 *          created and confirmed server-side, so this component only displays status.
 *
 * @relatedFiles
 * - src/components/users/DriverLinkCard.tsx (individual link card)
 * - src/app/api/v1/users/[userId]/driver-links/route.ts (API endpoint)
 */

"use client"

import { useEffect, useState } from "react"
import { DriverLinkCard } from "./DriverLinkCard"
import type { DriverLinkStatus } from "@/core/users/driver-links"

type DriverLinksViewProps = {
  userId: string
}

export function DriverLinksView({ userId }: DriverLinksViewProps) {
  const [links, setLinks] = useState<DriverLinkStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLinks() {
      try {
        setLoading(true)
        const response = await fetch(`/api/v1/users/${userId}/driver-links`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error?.message || "Failed to fetch driver links")
        }

        setLinks(data.data.links || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchLinks()
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-[var(--token-text-muted)]">Loading driver links...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-[var(--token-status-error-text)]">Error: {error}</div>
      </div>
    )
  }

  // Group links by status
  const confirmedLinks = links.filter((link) => link.status === "confirmed")
  const suggestedLinks = links.filter((link) => link.status === "suggested")
  const conflictLinks = links.filter(
    (link) => link.status === "conflict" || link.status === "rejected"
  )

  return (
    <div className="space-y-6">
      {/* Confirmed Links */}
      {confirmedLinks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--token-status-success-text)] mb-3">
            Confirmed Links ({confirmedLinks.length})
          </h2>
          <div className="space-y-2">
            {confirmedLinks.map((link) => (
              <DriverLinkCard key={link.driverId} link={link} />
            ))}
          </div>
        </div>
      )}

      {/* Suggested Links */}
      {suggestedLinks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--token-status-warning-text)] mb-3">
            Suggested Links ({suggestedLinks.length})
          </h2>
          <div className="space-y-2">
            {suggestedLinks.map((link) => (
              <DriverLinkCard key={link.driverId} link={link} />
            ))}
          </div>
        </div>
      )}

      {/* Conflicts */}
      {conflictLinks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--token-status-error-text)] mb-3">
            Conflicts ({conflictLinks.length})
          </h2>
          <div className="space-y-2">
            {conflictLinks.map((link) => (
              <DriverLinkCard key={link.driverId} link={link} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {links.length === 0 && (
        <div className="text-center p-8 text-[var(--token-text-muted)]">
          No driver links found. Links will be created automatically when race data is ingested.
        </div>
      )}
    </div>
  )
}
