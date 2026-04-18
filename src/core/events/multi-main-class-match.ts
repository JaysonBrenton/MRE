/**
 * Match LiveRC multi-main `classLabel` to dashboard class filters (entry list / race class names).
 *
 * @see docs/domain/triple-a-main-scoring.md
 */

/**
 * Returns true when a multi-main result row should be shown for the current class chip.
 * Empty or null filter means "all classes". When `activeClassFilter` is a non-empty array,
 * the label must case-insensitively match any entry (e.g. car taxonomy chip → several classes).
 */
export function multiMainResultMatchesClassFilter(
  multiMainClassLabel: string,
  activeClassFilter: string | string[] | null | undefined
): boolean {
  if (activeClassFilter == null) {
    return true
  }
  if (Array.isArray(activeClassFilter)) {
    if (activeClassFilter.length === 0) {
      return false
    }
    const mm = multiMainClassLabel.trim().toLowerCase()
    return activeClassFilter.some(
      (f) => typeof f === "string" && f.trim() !== "" && f.trim().toLowerCase() === mm
    )
  }
  if (activeClassFilter.trim() === "") {
    return true
  }
  return multiMainClassLabel.trim().toLowerCase() === activeClassFilter.trim().toLowerCase()
}
