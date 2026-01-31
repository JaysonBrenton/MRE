/**
 * @fileoverview Geocoding candidate resolver for weather lookup
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Generates ordered candidate query strings for geocoding when track names
 *              are not geocodable (e.g., series/championship names instead of locations)
 *
 * @purpose Provides a deterministic strategy to extract location hints from event names
 *          when track names fail geocoding. This handles cases where LiveRC track names
 *          are series names rather than actual locations.
 *
 * @relatedFiles
 * - src/core/weather/get-weather-for-event.ts (uses this helper)
 * - src/core/weather/geocode-track.ts (geocoding service)
 */

import type { Event, Track } from "@prisma/client"

export interface EventWithTrack extends Event {
  track: Track
}

// Minimum length for a valid geocoding candidate
const MIN_CANDIDATE_LENGTH = 2

// Regex to detect series/championship style track names
// Matches common patterns like "Championship", "Series", "Cup", "Tour", "Round", "Rnd", "League", "Masters", "Grand Prix"
const SERIES_PATTERN = /\b(championship|series|cup|tour|round|rnd|league|masters|grand prix)\b/i

// Patterns to remove from event names (noise segments)
const NOISE_PATTERNS = [
  /\bw\/\s+.*$/i, // "w/" and anything after
  /\bwith\s+.*$/i, // "with" and anything after
  /\bpresented by\s+.*$/i, // "presented by" and anything after
]

// Patterns to remove from event names (round/series prefixes)
const ROUND_PATTERNS = [
  /^[A-Z]{2,}\s+/, // Leading acronyms like "ABC "
  /\bRnd\s+\d+\s+/i, // "Rnd 4 "
  /\bRound\s+\d+\s+/i, // "Round 4 "
  /\bRd\s+\d+\s+/i, // "Rd 4 "
]

/**
 * Checks if a track name looks like a series/championship name rather than a location
 *
 * @param trackName - The track name to check
 * @returns true if the track name matches series patterns
 */
function isSeriesTrackName(trackName: string): boolean {
  return SERIES_PATTERN.test(trackName)
}

/**
 * Extracts location candidates from an event name
 *
 * Strategy:
 * 1. Remove noise segments (w/, with, presented by)
 * 2. Remove round/series prefixes (ABC, Rnd 4, Round 4, etc.)
 * 3. Extract trailing words that could be locations (1-4 words)
 * 4. Also extract comma-separated location patterns if present
 *
 * @param eventName - The event name to extract locations from
 * @returns Array of location candidate strings (may be empty)
 */
function extractLocationCandidates(eventName: string): string[] {
  let cleaned = eventName.trim()

  // Remove noise segments
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "").trim()
  }

  // Remove round/series prefixes
  for (const pattern of ROUND_PATTERNS) {
    cleaned = cleaned.replace(pattern, "").trim()
  }

  if (!cleaned) {
    return []
  }

  const candidates: string[] = []

  // Extract comma-separated location patterns (e.g., "City, Country")
  const commaMatch = cleaned.match(/([^,]+,\s*[^,]+(?:,\s*[^,]+)?)$/)
  if (commaMatch) {
    const commaLocation = commaMatch[1].trim()
    if (commaLocation.length >= MIN_CANDIDATE_LENGTH) {
      candidates.push(commaLocation)
    }
  }

  // Extract trailing words (1-4 words) as location candidates
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0)

  // Try different lengths: 4 words, 3 words, 2 words, 1 word
  for (let length = Math.min(4, words.length); length >= 1; length--) {
    const candidate = words.slice(-length).join(" ").trim()
    if (candidate.length >= MIN_CANDIDATE_LENGTH) {
      // Skip if it's the same as a comma-separated candidate we already added
      if (!candidates.includes(candidate)) {
        candidates.push(candidate)
      }
    }
  }

  return candidates
}

/**
 * Validates that a candidate is suitable for geocoding
 *
 * @param candidate - The candidate string to validate
 * @returns true if the candidate is valid
 */
function isValidCandidate(candidate: string): boolean {
  const trimmed = candidate.trim()

  // Must be non-empty and meet minimum length
  if (!trimmed || trimmed.length < MIN_CANDIDATE_LENGTH) {
    return false
  }

  // Skip candidates that match the series pattern (they're not locations)
  if (SERIES_PATTERN.test(trimmed)) {
    return false
  }

  return true
}

/**
 * Resolves geocoding candidates for an event
 *
 * Returns an ordered list of candidate query strings to try for geocoding.
 * The order depends on whether the track name looks like a series:
 * - If track name looks like a series: prioritize eventName-derived candidates, then trackName
 * - Otherwise: prioritize trackName, then eventName-derived candidates
 *
 * All candidates are deduplicated and validated.
 *
 * @param event - Event with track information
 * @returns Ordered array of candidate query strings to try for geocoding
 *
 * @example
 * // Series track name
 * resolveGeocodeCandidates({
 *   eventName: "ABC Rnd 4 Jakarta Indonesia w/ Scotty Ernst",
 *   track: { trackName: "Asian Buggy Championship" }
 * })
 * // Returns: ["Jakarta Indonesia", "Jakarta", "Asian Buggy Championship"]
 *
 * @example
 * // Normal track name
 * resolveGeocodeCandidates({
 *   eventName: "Test Race",
 *   track: { trackName: "Sydney Motorsport Park" }
 * })
 * // Returns: ["Sydney Motorsport Park", "Test Race"]
 */
export function resolveGeocodeCandidates(event: EventWithTrack): string[] {
  const trackName = event.track.trackName.trim()
  const eventName = event.eventName.trim()

  const candidates: string[] = []
  const seen = new Set<string>()

  // Extract location candidates from event name
  const eventCandidates = extractLocationCandidates(eventName)

  // Determine if track name looks like a series
  const isSeries = isSeriesTrackName(trackName)

  if (isSeries) {
    // For series tracks: prioritize eventName-derived candidates, then trackName as fallback
    for (const candidate of eventCandidates) {
      if (isValidCandidate(candidate) && !seen.has(candidate)) {
        candidates.push(candidate)
        seen.add(candidate)
      }
    }

    // Add trackName as fallback (even if it's a series name, it might still work)
    // Skip series pattern check for trackName itself - we always want to try it
    if (trackName.length >= MIN_CANDIDATE_LENGTH && !seen.has(trackName)) {
      candidates.push(trackName)
      seen.add(trackName)
    }
  } else {
    // For normal tracks: prioritize trackName, then eventName-derived candidates
    if (trackName.length >= MIN_CANDIDATE_LENGTH && !seen.has(trackName)) {
      candidates.push(trackName)
      seen.add(trackName)
    }

    for (const candidate of eventCandidates) {
      if (isValidCandidate(candidate) && !seen.has(candidate)) {
        candidates.push(candidate)
        seen.add(candidate)
      }
    }
  }

  return candidates
}
