import { normalizeCarTaxonomyPattern } from "@/core/car-taxonomy/normalize"
import { SLUG_EXTRA_HINT_WORDS } from "@/core/car-taxonomy/suggestion-keywords"

export type CarTaxonomySuggestion = {
  taxonomyNodeId: string
  slug: string
  label: string
  score: number
  reason: string
}

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "for",
  "to",
  "in",
  "on",
  "round",
  "race",
  "main",
  "qualifier",
])

function tokenizeHint(s: string): string[] {
  const n = normalizeCarTaxonomyPattern(s)
  return n
    .split(/[^a-z0-9/]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t))
}

function collectHints(input: {
  className?: string
  raceLabel?: string
  sectionHeader?: string | null
  sessionType?: string | null
  vehicleType?: string | null
}): string[] {
  const parts = [
    input.className,
    input.raceLabel,
    input.sectionHeader ?? "",
    input.sessionType ?? "",
    input.vehicleType ?? "",
  ]
    .join(" ")
    .trim()
  return tokenizeHint(parts)
}

/**
 * Lightweight keyword overlap between LiveRC-derived strings and seeded taxonomy labels/slugs.
 */
export function suggestCarTaxonomyLeaves(input: {
  leafNodes: Array<{ id: string; slug: string; label: string }>
  className?: string
  raceLabel?: string
  sectionHeader?: string | null
  sessionType?: string | null
  vehicleType?: string | null
}): CarTaxonomySuggestion[] {
  const hints = collectHints(input)
  if (hints.length === 0) return []

  const hintBlob = normalizeCarTaxonomyPattern(
    [
      input.className,
      input.raceLabel,
      input.sectionHeader ?? "",
      input.sessionType ?? "",
      input.vehicleType ?? "",
    ]
      .filter(Boolean)
      .join(" ")
  )

  const out: CarTaxonomySuggestion[] = []
  for (const leaf of input.leafNodes) {
    const slug = leaf.slug.toLowerCase()
    const label = leaf.label.toLowerCase()
    let score = 0
    const matched: string[] = []
    for (const h of hints) {
      const hl = h.toLowerCase()
      if (label.includes(hl) || slug.includes(hl.replace(/\//g, ""))) {
        score += 12
        matched.push(h)
        continue
      }
      if (hl.length >= 4 && (label.includes(hl.slice(0, -1)) || slug.includes(hl))) {
        score += 6
        matched.push(h)
      }
    }
    for (const phrase of SLUG_EXTRA_HINT_WORDS[leaf.slug] ?? []) {
      const p = phrase.toLowerCase()
      if (p.length >= 2 && hintBlob.includes(p)) {
        score += 10
        matched.push(phrase)
      }
    }
    if (score > 0) {
      out.push({
        taxonomyNodeId: leaf.id,
        slug: leaf.slug,
        label: leaf.label,
        score,
        reason:
          matched.length > 0 ? `Matches: ${matched.slice(0, 4).join(", ")}` : "Keyword overlap",
      })
    }
  }
  out.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
  return out.slice(0, 8)
}
