/**
 * @fileoverview Geocoding service for track locations
 * 
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 * 
 * @description Converts track names to geographic coordinates using Nominatim (OpenStreetMap)
 * 
 * @purpose Provides geocoding functionality to determine track locations for weather API calls.
 *          Uses Nominatim as a free geocoding service with rate limiting to respect their
 *          usage policy (1 request per second).
 * 
 * @relatedFiles
 * - docs/architecture/mobile-safe-architecture-guidelines.md (architecture patterns)
 */

interface GeocodeResult {
  latitude: number
  longitude: number
  displayName: string
}

interface NominatimResponse {
  lat: string
  lon: string
  display_name: string
}

// In-memory cache for geocoding results (track name -> coordinates)
// This avoids repeated API calls for the same track
const geocodeCache = new Map<string, GeocodeResult>()

// Rate limiting: track last request time to enforce 1 req/sec limit
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL_MS = 1000

/**
 * Geocodes a track name to geographic coordinates
 * 
 * Uses Nominatim (OpenStreetMap) geocoding service. Results are cached in memory
 * to avoid repeated API calls for the same track name.
 * 
 * Rate limiting: Enforces 1 request per second to respect Nominatim's usage policy.
 * 
 * @param trackName - The name of the track to geocode
 * @returns Promise resolving to coordinates and display name
 * @throws Error if geocoding fails or no results found
 */
export async function geocodeTrack(trackName: string): Promise<GeocodeResult> {
  // Check cache first
  const cached = geocodeCache.get(trackName)
  if (cached) {
    return cached
  }

  // Rate limiting: ensure at least 1 second between requests
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest
    await new Promise((resolve) => setTimeout(resolve, waitTime))
  }

  const geocodingUrl = process.env.GEOCODING_SERVICE_URL || "https://nominatim.openstreetmap.org/search"
  const params = new URLSearchParams({
    q: trackName,
    format: "json",
    limit: "1",
    addressdetails: "0",
  })

  try {
    lastRequestTime = Date.now()
    const response = await fetch(`${geocodingUrl}?${params.toString()}`, {
      headers: {
        "User-Agent": "My Race Engineer/0.1.1 (contact: info@raceengineer.app)", // Required by Nominatim
      },
    })

    if (!response.ok) {
      throw new Error(`Geocoding API returned status ${response.status}`)
    }

    const data: NominatimResponse[] = await response.json()

    if (!data || data.length === 0) {
      throw new Error(`No geocoding results found for track: ${trackName}`)
    }

    const result = data[0]
    const geocodeResult: GeocodeResult = {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      displayName: result.display_name,
    }

    // Cache the result
    geocodeCache.set(trackName, geocodeResult)

    return geocodeResult
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Geocoding failed for track "${trackName}": ${error.message}`)
    }
    throw new Error(`Geocoding failed for track "${trackName}": Unknown error`)
  }
}

