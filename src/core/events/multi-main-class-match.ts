/**
 * Match LiveRC multi-main `classLabel` to dashboard class filters (entry list / race class names).
 *
 * @see docs/domain/triple-a-main-scoring.md
 */

/**
 * Returns true when a multi-main result row should be shown for the current class chip.
 * Empty or null filter means "all classes".
 */
export function multiMainResultMatchesClassFilter(
  multiMainClassLabel: string,
  activeClassFilter: string | null | undefined
): boolean {
  if (activeClassFilter == null || activeClassFilter.trim() === "") {
    return true
  }
  return multiMainClassLabel.trim().toLowerCase() === activeClassFilter.trim().toLowerCase()
}
