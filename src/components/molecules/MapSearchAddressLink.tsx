/**
 * @fileoverview Venue address (plain text) plus an optional small link to open the location in Google Maps.
 * The full address is not interactive — only the “Open in Google Maps” action is a link.
 */

import { ExternalLink } from "lucide-react"
import { splitAddressForDisplay } from "@/lib/address-normalization"

const MAPS_SEARCH_BASE = "https://www.google.com/maps/search/?api=1&query="

export type MapSearchAddressLinkProps = {
  address: string
  /** Optional class on the root wrapper (e.g. from parent flex) */
  className?: string
}

/**
 * Renders a readable multi-line address; map search is a separate secondary control.
 */
export function MapSearchAddressLink({ address, className = "" }: MapSearchAddressLinkProps) {
  const lines = splitAddressForDisplay(address)
  if (lines.length === 0) return null
  const href = `${MAPS_SEARCH_BASE}${encodeURIComponent(address)}`

  return (
    <div
      className={[`min-w-0 max-w-full text-left`, className].filter(Boolean).join(" ")}
      title={address}
    >
      <div className="flex min-w-0 flex-col gap-0.5 [text-wrap:balance]">
        {lines.map((line, i) => (
          <span
            key={i}
            className="block min-w-0 break-words leading-snug text-[var(--token-text-primary)]"
          >
            {line}
          </span>
        ))}
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--token-accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--token-accent)]/50"
      >
        Open in Google Maps
        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2.25} aria-hidden />
      </a>
    </div>
  )
}
