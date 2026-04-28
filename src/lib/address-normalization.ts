/**
 * @fileoverview Venue / track address display normalisation
 *
 * @purpose Produces a single clean line for UI and Google Maps queries from
 *          possibly redundant DB fields (free-text `address` plus structured
 *          city/state/postal/country). Strips phone-only comma segments and
 *          `Phone:`/`P:`-labelled values that were concatenated into address text.
 *          Does not geocode or verify against a postal authority.
 */

/** Placeholder values that should not appear in address display */
const ADDRESS_PLACEHOLDERS = new Set(
  ["none", "n/a", "null", "na", "undefined", "—", "–", "-"].map((s) => s.toLowerCase())
)

/** Postal codes that are placeholders (invalid for address display) */
const PLACEHOLDER_POSTAL_CODES = new Set(["00000", "0000", "000000", "0"])

/** Regex to detect email addresses (exclude from address) */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "Phone: …" / "Tel: …" / "P: …" (LiveRC) — remainder is treated as the phone value */
const PHONE_VALUE_LABEL = /^(?:(?:phone|tel|telephone|mobile|cell|fax)\s*:|p\s*:)\s*/i

/** Country strings that imply Australian address conventions for postcode fixes */
const AU_COUNTRY_HINT = /\baustralia\b|^au$/i

function looksLikeEmail(s: string): boolean {
  return EMAIL_REGEX.test(s.trim())
}

function digitCount(s: string): number {
  return (s.match(/\d/g) || []).length
}

/**
 * True when `segment` is (or is clearly labeled as) a phone number only, not a street/city line.
 * Used to drop tel numbers mistakenly concatenated into free-text address fields.
 */
function looksLikePhoneOnlySegment(raw: string): boolean {
  let t = raw.trim()
  if (!t) return false
  t = t.replace(PHONE_VALUE_LABEL, "").trim()
  if (!t) return false
  if (t.includes("@")) return false

  if (/^\+[\d\s().-]+$/.test(t)) {
    const n = digitCount(t)
    return n >= 8 && n <= 15
  }
  if (/^1[\s().-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(t)) return true
  if (/^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(t)) return true
  if (/^\d{10}$/.test(t) && t[0] !== "0") return true
  if (/^04\d{8}$/.test(t) || /^0[23478]\d{8}$/.test(t)) return true
  return false
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function isValidAddressPart(part: string): boolean {
  const t = part.trim()
  if (!t || t.length === 0) return false
  const lower = t.toLowerCase()
  if (ADDRESS_PLACEHOLDERS.has(lower)) return false
  if (looksLikeEmail(t)) return false
  if (PLACEHOLDER_POSTAL_CODES.has(t)) return false
  if (looksLikePhoneOnlySegment(t)) return false
  return true
}

/** Strip trailing placeholder postals from a segment, e.g. "Brisbane 00000" → "Brisbane" */
function cleanAddressPart(part: string): string {
  let t = part.trim()
  for (const code of PLACEHOLDER_POSTAL_CODES) {
    const suffix = ` ${code}`
    if (t.endsWith(suffix)) {
      t = t.slice(0, -suffix.length).trim()
      break
    }
  }
  return t
}

function hasAustraliaHint(...chunks: (string | null | undefined)[]): boolean {
  return chunks.some((c) => c && AU_COUNTRY_HINT.test(c))
}

export type AustraliaPostcodeFixOptions = {
  /** When true, apply the 0-prefix fix without requiring "Australia" (or AU) in the string. */
  assumeAustralia?: boolean
}

/**
 * If text suggests Australia (or `assumeAustralia`), fix common 5-digit typo: leading 0 + four digits
 * (e.g. 02604 → 2604). Skipped when no hint and not assumed, to avoid mangling other countries' formats.
 */
export function applyAustraliaPostcodeTypoFix(
  text: string,
  options?: AustraliaPostcodeFixOptions
): string {
  if (!options?.assumeAustralia && !AU_COUNTRY_HINT.test(text)) {
    return text
  }
  return text.replace(/\b0(\d{4})\b/g, "$1")
}

/**
 * Normalise a stored postal code field (trim; optional AU leading-zero fix when context is Australia).
 */
export function normalizePostalCodeField(
  postalCode: string | null | undefined,
  country: string | null | undefined,
  addressLine?: string | null | undefined
): string | null {
  if (postalCode == null || typeof postalCode !== "string") return null
  let t = postalCode.trim()
  if (!t) return null
  if (PLACEHOLDER_POSTAL_CODES.has(t)) return null
  const auContext = hasAustraliaHint(country, addressLine)
  if (auContext && /^0(\d{4})$/.test(t)) {
    t = t.slice(1)
  }
  return t
}

/**
 * True if `segment` is already expressed in `haystack` (comma-separated venue text),
 * using case-insensitive whole-word matching.
 */
export function isSegmentAlreadyInAddress(haystack: string, segment: string): boolean {
  const seg = segment.trim()
  if (!seg) return true
  const hay = haystack.toLowerCase()
  const s = seg.toLowerCase()
  if (s.length <= 2) {
    return new RegExp(`\\b${escapeRegExp(s)}\\b`).test(hay)
  }
  return new RegExp(`\\b${escapeRegExp(s)}\\b`).test(hay)
}

export type TrackAddressFields = {
  address?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
}

/**
 * Merge free-text `address` with structured fields without repeating segments
 * already present in the free-text line (e.g. city + postcode duplicated from ingestion).
 */
export function formatTrackAddress(track: TrackAddressFields): string | null {
  const country = track.country?.trim() || null
  const rawAddressLine = track.address?.trim() || null
  const auContext = hasAustraliaHint(country, rawAddressLine)
  const addressLine =
    rawAddressLine && auContext
      ? applyAustraliaPostcodeTypoFix(rawAddressLine, { assumeAustralia: true })
      : rawAddressLine

  const normPostal = normalizePostalCodeField(track.postalCode, country, rawAddressLine)
  const city = track.city?.trim() || null
  const state = track.state?.trim() || null

  const structured: string[] = []
  for (const seg of [city, state, normPostal, country]) {
    if (!seg) continue
    structured.push(seg)
  }

  if (!addressLine && structured.length === 0) {
    return null
  }

  let combined: string
  if (!addressLine) {
    combined = structured.join(", ")
  } else if (structured.length === 0) {
    combined = addressLine
  } else {
    const extras: string[] = []
    for (const seg of structured) {
      const checkBase = [addressLine, ...extras].join(", ")
      if (!isSegmentAlreadyInAddress(checkBase, seg)) {
        extras.push(seg)
      }
    }
    combined = extras.length > 0 ? `${addressLine}, ${extras.join(", ")}` : addressLine
  }

  const postcodeFixed = applyAustraliaPostcodeTypoFix(combined)
  return normalizeAddressForDisplay(postcodeFixed)
}

/**
 * Remove shorter comma-separated segments that are wholly contained in a longer segment
 * (e.g. "Narrabundah" when "Narrabundah 2604" exists).
 */
function dedupeSemanticOverlaps(parts: string[]): string[] {
  return parts.filter((p, i) => {
    return !parts.some(
      (q, j) =>
        j !== i &&
        q.length > p.length &&
        new RegExp(`\\b${escapeRegExp(p.toLowerCase())}\\b`).test(q.toLowerCase())
    )
  })
}

/**
 * Normalise address string for display: remove non-address data (emails, phone segments,
 * placeholders), deduplicate exact segments, fix AU-style postcodes in text, and drop
 * redundant shorter segments.
 */
export function normalizeAddressForDisplay(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const withAuFix = applyAustraliaPostcodeTypoFix(trimmed)

  const parts = withAuFix
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)

  const seen = new Set<string>()
  const filtered: string[] = []
  for (const part of parts) {
    if (!isValidAddressPart(part)) continue
    const cleaned = cleanAddressPart(part)
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    filtered.push(cleaned)
  }

  const deduped = dedupeSemanticOverlaps(filtered)
  return deduped.length > 0 ? deduped.join(", ") : null
}

/**
 * Splits a comma-separated address (already normalised) into display lines.
 */
export function splitAddressForDisplay(address: string): string[] {
  if (!address || typeof address !== "string") return []
  return address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
}
