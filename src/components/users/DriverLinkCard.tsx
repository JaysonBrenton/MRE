/**
 * @fileoverview Individual driver link card component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Displays a single driver link with status, similarity score, and details
 * 
 * @purpose Provides read-only display of driver link information with color-coded status
 * 
 * @relatedFiles
 * - src/components/users/DriverLinksView.tsx (parent component)
 */

"use client"

import type { DriverLinkStatus } from "@/core/users/driver-links"

type DriverLinkCardProps = {
  link: DriverLinkStatus
}

export function DriverLinkCard({ link }: DriverLinkCardProps) {
  // Color coding based on status using semantic tokens
  const statusConfig = {
    confirmed: {
      border: "border-[var(--token-status-success-text)]",
      bg: "bg-[var(--token-status-success-bg)]",
      badgeBg: "bg-[var(--token-status-success-bg)]",
      badgeText: "text-[var(--token-status-success-text)]",
    },
    suggested: {
      border: "border-[var(--token-status-warning-text)]",
      bg: "bg-[var(--token-status-warning-bg)]",
      badgeBg: "bg-[var(--token-status-warning-bg)]",
      badgeText: "text-[var(--token-status-warning-text)]",
    },
    rejected: {
      border: "border-[var(--token-status-error-text)]",
      bg: "bg-[var(--token-status-error-bg)]",
      badgeBg: "bg-[var(--token-status-error-bg)]",
      badgeText: "text-[var(--token-status-error-text)]",
    },
    conflict: {
      border: "border-[var(--token-status-error-text)]",
      bg: "bg-[var(--token-status-error-bg)]",
      badgeBg: "bg-[var(--token-status-error-bg)]",
      badgeText: "text-[var(--token-status-error-text)]",
    },
  }

  const statusLabels = {
    confirmed: "Confirmed",
    suggested: "Suggested",
    rejected: "Rejected",
    conflict: "Conflict",
  }

  const matchTypeLabels = {
    transponder: "Transponder Match",
    exact: "Exact Name Match",
    fuzzy: "Fuzzy Match",
  }

  const config = statusConfig[link.status] || statusConfig.suggested
  const statusLabel = statusLabels[link.status] || "Unknown"

  return (
    <div className={`border rounded-lg p-4 ${config.border} ${config.bg}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-[var(--token-text-primary)]">{link.driverName}</h3>
            <span
              className={`px-2 py-1 text-xs font-medium rounded ${config.badgeBg} ${config.badgeText}`}
            >
              {statusLabel}
            </span>
          </div>

          <div className="space-y-1 text-sm text-[var(--token-text-secondary)]">
            <div>
              <span className="font-medium">Match Type:</span>{" "}
              {matchTypeLabels[link.matchType]}
            </div>
            <div>
              <span className="font-medium">Similarity:</span>{" "}
              {(link.similarityScore * 100).toFixed(1)}%
            </div>
            <div>
              <span className="font-medium">Events Found:</span> {link.eventCount}
            </div>
            {link.confirmedAt && (
              <div>
                <span className="font-medium">Confirmed:</span>{" "}
                {new Date(link.confirmedAt).toLocaleDateString()}
              </div>
            )}
            {link.conflictReason && (
              <div className="text-[var(--token-status-error-text)] mt-2">
                <span className="font-medium">Reason:</span> {link.conflictReason}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

