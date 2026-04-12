/**
 * Turns raw suggestion reasons from {@link suggestCarTaxonomyLeaves} into shorter helper lines
 * for the modal (UI-only; does not change matching logic).
 */
export function humanizeSuggestionReason(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  if (t === "Keyword overlap") {
    return "Based on overlap between your event text and this vehicle class."
  }
  const prefix = "Matches: "
  if (t.startsWith(prefix)) {
    const rest = t.slice(prefix.length).trim()
    return rest ? `Keywords matched: ${rest}` : t
  }
  return t
}
