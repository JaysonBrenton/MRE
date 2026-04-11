/**
 * Normalize user rule patterns and LiveRC strings for consistent matching.
 */
export function normalizeCarTaxonomyPattern(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ")
}

/** Composite key: normalized class + normalized race label (LiveRC session title). */
export function buildClassAndLabelPattern(className: string, raceLabel: string): string {
  return `${normalizeCarTaxonomyPattern(className)}||${normalizeCarTaxonomyPattern(raceLabel)}`
}
