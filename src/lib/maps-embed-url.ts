/**
 * @fileoverview Helpers for iframe-based Google Maps links.
 *
 * The Event Overview venue widget uses {@link buildGoogleMapsClassicVenueEmbedSrc} — Google's
 * public `maps?q=…&output=embed` flow (no Maps Embed API key). {@link buildGoogleMapsPlaceEmbedSrc}
 * remains available for Embed API v1 if you explicitly enable Maps Embed API and billing.
 */

export type BuildMapsPlaceEmbedUrlParams = {
  apiKey: string
  /** Free-text address / venue query */
  query: string
  /** Zoom suitable for venues; clamped within Embed API-supported range where possible */
  zoom?: number
}

/**
 * Venue map iframe URL without API credentials. Google's server redirects to `/maps/embed?pb=…`.
 * Use this instead of Embed v1 when key setup yields 403 (API disabled / billing / referrers).
 */
export function buildGoogleMapsClassicVenueEmbedSrc(query: string, zoom = 15): string {
  const q = query.trim()
  if (!q) {
    throw new Error("Maps classic embed URL requires non-empty query")
  }
  const z = Math.min(22, Math.max(1, zoom))
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed&z=${String(z)}`
}

/** Embed API v1 (requires Maps Embed API + billing for the browser key). */
export function buildGoogleMapsPlaceEmbedSrc({
  apiKey,
  query,
  zoom = 15,
}: BuildMapsPlaceEmbedUrlParams): string {
  const q = query.trim()
  const key = apiKey.trim()
  if (!q || !key) {
    throw new Error("Maps embed URL requires non-empty apiKey and query")
  }
  const z = Math.min(22, Math.max(0, zoom))
  const params = new URLSearchParams({
    key,
    q,
    zoom: String(z),
  })
  return `https://www.google.com/maps/embed/v1/place?${params.toString()}`
}
