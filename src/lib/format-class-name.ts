/**
 * @fileoverview Formats racing class names for display.
 *
 * @description Corrects known typos from LiveRC and other sources.
 *              Use when displaying class names to users.
 *
 * @purpose Ensures consistent, correct display of class names in the UI.
 */

/** Known typos in class names (wrong -> correct) */
const CLASS_NAME_TYPOS: Record<string, string> = {
  Maintainance: "Maintenance",
  maintainance: "maintenance",
}

/** Class names that are LiveRC scheduling placeholders, not racing classes */
const PLACEHOLDER_CLASS_NAMES = ["track maintenance", "track maintainance", "track watering"]

/**
 * Heuristics for banner text LiveRC sometimes stores in the class field or as the
 * “race” label (align with `labelLooksLikeScheduleBreakOrPlaceholder` in
 * main-bracket-overall.ts).
 */
function textLooksLikeLiveRcScheduleBreakOrBanner(text: string): boolean {
  if (/\*{3,}/.test(text)) return true
  const L = text.toLowerCase()
  if (/\bintermission\b/.test(L)) return true
  if (/\b(?:\d+\s*)?min(?:ute)?s?\s*break\b/.test(L)) return true
  return false
}

/**
 * True when a race row is a schedule placeholder (time block / intermission), not a
 * session with drivers. Checks both `className` and `raceLabel` so banner text in
 * either field is excluded from session chips and class lists.
 */
export function isSchedulePlaceholderLiveRcRow(
  className: string | null | undefined,
  raceLabel: string | null | undefined
): boolean {
  if (isPlaceholderClass(className)) return true
  const rl = (raceLabel ?? "").trim()
  if (rl.length > 0 && textLooksLikeLiveRcScheduleBreakOrBanner(rl)) return true
  return false
}

/**
 * Returns true if the class name is a known scheduling placeholder (e.g. Track Maintenance
 * or "**** 15 MIN BREAK ****"). LiveRC uses these for time blocks between races, not
 * actual races with drivers.
 */
export function isPlaceholderClass(className: string | null | undefined): boolean {
  if (className == null || typeof className !== "string") {
    return false
  }
  const raw = className.trim()
  if (raw.length === 0) {
    return false
  }
  const normalized = raw.toLowerCase()
  if (PLACEHOLDER_CLASS_NAMES.includes(normalized)) return true
  return textLooksLikeLiveRcScheduleBreakOrBanner(raw)
}

/**
 * Formats a class name for display, correcting known typos.
 *
 * @param className - Raw class name from API/database
 * @returns Formatted class name for display
 */
export function formatClassName(className: string | null | undefined): string {
  if (className == null || typeof className !== "string") {
    return ""
  }
  let formatted = className.trim()
  for (const [wrong, correct] of Object.entries(CLASS_NAME_TYPOS)) {
    formatted = formatted.replaceAll(wrong, correct)
  }
  return formatted
}

/**
 * Normalize class labels for comparing entry-list vs race rows when LiveRC uses inconsistent
 * spellings (e.g. "1:8th …" vs "1/8 …", colon vs slash for scale).
 */
export function normalizeClassNameForEntryMergeKey(className: string): string {
  let s = className.trim().toLowerCase()
  s = s.replace(/\s+/g, " ")
  // "1:8th …" → "1/8 …"
  s = s.replace(/\b(\d{1,2}):(\d{1,2})th\b/g, "$1/$2")
  // "1:8 …" → "1/8 …"
  s = s.replace(/\b(\d{1,2}):(\d{1,2})\b/g, "$1/$2")
  // "1/8th …" → "1/8 …"
  s = s.replace(/\b(\d{1,2}\/\d{1,2})th\b/g, "$1")
  return s
}
