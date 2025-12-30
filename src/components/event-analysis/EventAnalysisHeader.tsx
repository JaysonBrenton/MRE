/**
 * @fileoverview Event analysis header component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Page header component for event analysis page
 * 
 * @purpose Displays event name, date, track name, and back button.
 *          Desktop-optimized layout following MRE design guidelines.
 * 
 * @relatedFiles
 * - src/app/events/analyse/[eventId]/page.tsx (uses this)
 */

"use client"

import Link from "next/link"
import { formatDateLong } from "@/lib/date-utils"

export interface EventAnalysisHeaderProps {
  eventName: string
  eventDate: Date | string
  trackName: string
}

export default function EventAnalysisHeader({
  eventName,
  eventDate,
  trackName,
}: EventAnalysisHeaderProps) {
  return (
    <div className="space-y-4 mb-8">
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--token-text-secondary)]">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link
              href="/welcome"
              className="hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded"
            >
              Welcome
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href="/events"
              className="hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded"
            >
              Events
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--token-text-primary)]" aria-current="page">
            {eventName}
          </li>
        </ol>
      </nav>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">
          {eventName}
        </h1>
        <div className="flex items-center gap-4 text-sm text-[var(--token-text-secondary)]">
          <span>{formatDateLong(eventDate)}</span>
          <span>•</span>
          <span>{trackName}</span>
        </div>
      </div>
    </div>
  )
}
