/**
 * @fileoverview Name normalization utility for driver name fuzzy matching
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Strong normalization for driver names (for fuzzy matching)
 *
 * @purpose Provides same normalization logic as Python implementation to ensure
 *          consistency across both languages. Normalization steps:
 *          1. Lowercase
 *          2. Trim whitespace
 *          3. Collapse multiple whitespace to single space
 *          4. Strip punctuation (except spaces)
 *          5. Replace & with and
 *          6. Remove common suffix noise tokens: rc, raceway, club, inc, team
 *          7. Token sorting for multi-word names (handle "Smith John" vs "John Smith")
 *
 * @relatedFiles
 * - ingestion/ingestion/normalizer.py (Python implementation)
 * - src/core/users/driver-matcher.ts (uses this utility)
 */

/**
 * Normalize driver name using strong normalization.
 *
 * Normalization steps:
 * 1. Lowercase
 * 2. Trim whitespace
 * 3. Collapse multiple whitespace to single space
 * 4. Strip punctuation (except spaces)
 * 5. Replace & with and
 * 6. Remove common suffix noise tokens: rc, raceway, club, inc, team
 * 7. Token sorting for multi-word names (handle "Smith John" vs "John Smith")
 *
 * @param name - Driver name to normalize
 * @returns Normalized name string
 */
export function normalizeDriverName(name: string): string {
  if (!name) {
    return ""
  }

  // Step 1: Lowercase
  let normalized = name.toLowerCase()

  // Step 2: Replace special separators with spaces before collapsing whitespace
  normalized = normalized.replace(/&/g, " and ").replace(/[-_]/g, " ").replace(/'/g, "")

  // Step 3: Strip punctuation (except spaces) and collapse whitespace
  normalized = normalized
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .join(" ")
    .trim()

  const hadHyphen = /-/g.test(name)

  // Step 6: Remove common suffix noise tokens
  const noiseTokens = ["rc", "raceway", "club", "inc", "team"]
  const tokens = normalized.split(" ")
  // Remove noise tokens from end of name
  while (tokens.length > 0 && noiseTokens.includes(tokens[tokens.length - 1])) {
    tokens.pop()
  }
  normalized = tokens.join(" ")

  // Step 7: Token sorting for multi-word names
  if (tokens.length > 1) {
    const shouldSortTokens = tokens.length <= 2 || !hadHyphen
    const sortedTokens = shouldSortTokens ? [...tokens].sort() : tokens
    normalized = sortedTokens.join(" ")
  }

  // Final trim
  return normalized.trim()
}
