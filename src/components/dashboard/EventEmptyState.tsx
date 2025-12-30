/**
 * @fileoverview Event empty state component for dashboard
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Empty state displayed when no event is selected on the dashboard
 * 
 * @purpose Prompts users to select an event from event-search to view analysis.
 *          Mobile-friendly layout following MRE design guidelines.
 * 
 * @relatedFiles
 * - src/app/dashboard/page.tsx (uses this)
 * - docs/design/mre-mobile-ux-guidelines.md (UX guidelines)
 */

"use client"

import Link from "next/link"

export default function EventEmptyState() {
  return (
    <div className="flex h-64 w-full min-w-0 flex-col justify-center" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div className="text-center space-y-4 w-full min-w-0 max-w-md mx-auto px-4">
        <p className="text-sm text-[var(--token-text-muted)]">
          No event selected
        </p>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Select an event from the event search to view telemetry visualization and analysis.
        </p>
        <Link
          href="/event-search"
          className="inline-flex items-center justify-center rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
        >
          Go to Event Search
        </Link>
      </div>
    </div>
  )
}

