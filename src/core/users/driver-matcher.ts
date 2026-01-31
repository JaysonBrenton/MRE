/**
 * @fileoverview Driver matching utility for user-driver fuzzy matching
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Matches User accounts to Driver records using fuzzy matching
 *
 * @purpose Provides fuzzy matching logic consistent with Python implementation
 *          using Jaro-Winkler algorithm for similarity scoring
 *
 * @relatedFiles
 * - ingestion/ingestion/driver_matcher.py (Python implementation)
 * - src/core/users/name-normalizer.ts (normalization utility)
 */

import { normalizeDriverName } from "./name-normalizer"

// Global constants matching Python implementation
export const AUTO_CONFIRM_MIN = 0.95
export const SUGGEST_MIN = 0.85
export const MIN_EVENTS_FOR_AUTO_CONFIRM = 2
export const NAME_COMPATIBILITY_MIN = 0.85
export const MATCHER_ID = "jaro-winkler"
export const MATCHER_VERSION = "1.0.0"

export type MatchType = "transponder" | "exact" | "fuzzy"

export type MatchResult = {
  driverId: string
  similarityScore: number
  matchType: MatchType
  matcherId: string
  matcherVersion: string
}

export type Driver = {
  id: string
  displayName: string
  normalizedName?: string | null
  transponderNumber?: string | null
}

export type User = {
  id: string
  driverName: string
  normalizedName?: string | null
  transponderNumber?: string | null
}

/**
 * Jaro-Winkler similarity implementation.
 *
 * @param s1 - First string
 * @param s2 - Second string
 * @returns Similarity score between 0.0 and 1.0
 */
function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0
  if (!s1 || !s2) return 0.0

  // Jaro distance
  const jaro = jaroDistance(s1, s2)

  // Winkler modification: boost for common prefix
  const prefixLength = commonPrefixLength(s1, s2, 4) // Max prefix length 4
  const winklerBoost = 0.1 * prefixLength * (1 - jaro)

  return jaro + winklerBoost
}

/**
 * Jaro distance calculation.
 */
function jaroDistance(s1: string, s2: string): number {
  const len1 = s1.length
  const len2 = s2.length

  if (len1 === 0 && len2 === 0) return 1.0
  if (len1 === 0 || len2 === 0) return 0.0

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1
  const s1Matches = new Array(len1).fill(false)
  const s2Matches = new Array(len2).fill(false)

  let matches = 0
  let transpositions = 0

  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, len2)

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0.0

  // Find transpositions
  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3.0

  return jaro
}

/**
 * Calculate common prefix length (up to max length).
 */
function commonPrefixLength(s1: string, s2: string, maxLength: number): number {
  let prefixLength = 0
  const minLength = Math.min(s1.length, s2.length, maxLength)
  for (let i = 0; i < minLength; i++) {
    if (s1[i] === s2[i]) {
      prefixLength++
    } else {
      break
    }
  }
  return prefixLength
}

/**
 * Match User to Driver using fuzzy matching.
 *
 * Matching priority:
 * 1. Transponder number match (if both exist, unless skipTransponderMatch is true)
 * 2. Exact normalized name match
 * 3. Fuzzy name match (Jaro-Winkler >= SUGGEST_MIN)
 *
 * @param user - User to match
 * @param driver - Driver to match against
 * @param skipTransponderMatch - If true, skip transponder matching (for LiveRC matching)
 * @returns Match result or null if no match
 */
export function fuzzyMatchUserToDriver(
  user: User,
  driver: Driver,
  skipTransponderMatch: boolean = false
): { matchType: MatchType; similarityScore: number; status: "confirmed" | "suggested" } | null {
  // Strategy 1: Transponder match (primary) - skip if requested
  if (!skipTransponderMatch && user.transponderNumber && driver.transponderNumber) {
    if (user.transponderNumber === driver.transponderNumber) {
      // Transponder match - create suggested link (will be auto-confirmed if found across 2+ events)
      return {
        matchType: "transponder",
        similarityScore: 1.0,
        status: "suggested",
      }
    }
  }

  // Strategy 2: Exact normalized name match
  const userNormalized = user.normalizedName || normalizeDriverName(user.driverName)
  const driverNormalized = driver.normalizedName || normalizeDriverName(driver.displayName)

  if (userNormalized && driverNormalized) {
    if (userNormalized === driverNormalized) {
      // Exact match - auto-confirm
      return {
        matchType: "exact",
        similarityScore: 1.0,
        status: "confirmed",
      }
    }

    // Strategy 3: Fuzzy name match
    const similarity = jaroWinklerSimilarity(userNormalized, driverNormalized)

    if (similarity >= AUTO_CONFIRM_MIN) {
      // High similarity - auto-confirm
      return {
        matchType: "fuzzy",
        similarityScore: similarity,
        status: "confirmed",
      }
    } else if (similarity >= SUGGEST_MIN) {
      // Medium similarity - suggest
      return {
        matchType: "fuzzy",
        similarityScore: similarity,
        status: "suggested",
      }
    }
  }

  return null
}

/**
 * Find matching drivers for a user.
 *
 * @param user - User to find matches for
 * @param drivers - List of drivers to search
 * @returns Array of match results sorted by similarity score (descending)
 */
export function findMatchingDrivers(user: User, drivers: Driver[]): MatchResult[] {
  const matches: MatchResult[] = []

  for (const driver of drivers) {
    const match = fuzzyMatchUserToDriver(user, driver)
    if (match) {
      matches.push({
        driverId: driver.id,
        similarityScore: match.similarityScore,
        matchType: match.matchType,
        matcherId: MATCHER_ID,
        matcherVersion: MATCHER_VERSION,
      })
    }
  }

  // Sort by similarity score (descending)
  matches.sort((a, b) => b.similarityScore - a.similarityScore)

  return matches
}
