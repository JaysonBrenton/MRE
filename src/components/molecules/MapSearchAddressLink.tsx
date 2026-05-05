/**
 * @fileoverview Venue address display with optional Google Maps link.
 * Default: plain address lines plus a separate “Open in Google Maps” control.
 * {@link MapSearchAddressLinkProps.linkFullAddress}: entire address opens Maps (Event Overview strip).
 */

import { ExternalLink } from "lucide-react"
import { splitAddressForDisplay } from "@/lib/address-normalization"

const MAPS_SEARCH_BASE = "https://www.google.com/maps/search/?api=1&query="

const fullAddressLinkClass =
  "block min-w-0 max-w-full rounded-sm no-underline decoration-[var(--token-accent)]/50 underline-offset-2 transition-colors hover:text-[var(--token-accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--token-accent)]/50"

export type MapSearchAddressLinkProps = {
  address: string
  /** Optional class on the root wrapper (e.g. from parent flex) */
  className?: string
  /** When false, only address lines are shown (no Google Maps link). Default true. */
  showMapLink?: boolean
  /** When true, the address block is one link to Google Maps (implies no separate map link). */
  linkFullAddress?: boolean
  /** When true, center lines (e.g. under a centered heading). */
  centered?: boolean
  /** Extra classes on the full-address `<a>` (e.g. `text-sm`). */
  linkClassName?: string
}

/**
 * Renders a readable multi-line address; optionally the block or a secondary control links to Maps.
 */
export function MapSearchAddressLink({
  address,
  className = "",
  showMapLink = true,
  linkFullAddress = false,
  centered = false,
  linkClassName = "",
}: MapSearchAddressLinkProps) {
  const lines = splitAddressForDisplay(address)
  if (lines.length === 0) return null
  const href = `${MAPS_SEARCH_BASE}${encodeURIComponent(address)}`
  const showSecondaryMapLink = showMapLink && !linkFullAddress

  const linesBlock = (
    <div
      className={`flex min-w-0 flex-col gap-0.5 [text-wrap:balance] ${centered ? "items-center" : "items-stretch"}`}
    >
      {lines.map((line, i) => (
        <span
          key={i}
          className={`block min-w-0 break-words leading-snug ${linkFullAddress ? "text-inherit" : "text-[var(--token-text-primary)]"}`}
        >
          {line}
        </span>
      ))}
    </div>
  )

  return (
    <div
      className={["min-w-0 max-w-full", centered ? "text-center" : "text-left", className]
        .filter(Boolean)
        .join(" ")}
      title={address}
    >
      {linkFullAddress ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={[fullAddressLinkClass, "text-[var(--token-text-primary)]", linkClassName]
            .filter(Boolean)
            .join(" ")}
          aria-label={`Open address in Google Maps (opens in new tab): ${address}`}
        >
          {linesBlock}
        </a>
      ) : (
        linesBlock
      )}
      {showSecondaryMapLink ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--token-accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--token-accent)]/50"
        >
          Open in Google Maps
          <ExternalLink
            className="h-3.5 w-3.5 shrink-0 opacity-80"
            strokeWidth={2.25}
            aria-hidden
          />
        </a>
      ) : null}
    </div>
  )
}
