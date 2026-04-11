import type { CarTaxonomyMatchType } from "@prisma/client"
import {
  buildClassAndLabelPattern,
  normalizeCarTaxonomyPattern,
} from "@/core/car-taxonomy/normalize"

export type CarTaxonomyNodeLite = {
  id: string
  parentId: string | null
  slug: string
  label: string
}

export type ResolvedUserCarTaxonomy = {
  taxonomyNodeId: string
  slug: string
  pathLabels: string[]
  pathLabel: string
}

const MATCH_ORDER: CarTaxonomyMatchType[] = [
  "CLASS_AND_LABEL",
  "CLASS_NAME",
  "RACE_LABEL",
  "SECTION_HEADER",
  "SESSION_TYPE",
]

function resolveNode(
  taxonomyNodeId: string,
  nodeById: Map<string, CarTaxonomyNodeLite>
): ResolvedUserCarTaxonomy | null {
  const node = nodeById.get(taxonomyNodeId)
  if (!node) return null
  // Single canonical display name (leaf label); hierarchy lives in taxonomy tree / picker only.
  const leafLabel = node.label
  return {
    taxonomyNodeId,
    slug: node.slug,
    pathLabels: [leafLabel],
    pathLabel: leafLabel,
  }
}

export type RaceMatchInput = {
  className: string
  raceLabel: string
  sectionHeader: string | null | undefined
  sessionType: string | null | undefined
}

function isCarTaxonomyMatchType(s: string): s is CarTaxonomyMatchType {
  return (MATCH_ORDER as readonly string[]).includes(s)
}

/**
 * True when this rule's pattern would match at least one race row in the event
 * (same logic as {@link resolveUserCarTaxonomyForRace} indexing).
 */
export function userCarTaxonomyRuleAppliesToEvent(
  rule: { matchType: string; patternNormalized: string },
  races: RaceMatchInput[]
): boolean {
  if (!races.length) return false
  if (!isCarTaxonomyMatchType(rule.matchType)) return false
  const mt = rule.matchType
  for (const race of races) {
    const pattern = patternForMatchType(race, mt)
    if (pattern !== null && pattern === rule.patternNormalized) {
      return true
    }
  }
  return false
}

/**
 * Build maps: matchType -> (patternNormalized -> taxonomyNodeId).
 */
export function indexUserCarTaxonomyRules(
  rules: Array<{
    matchType: CarTaxonomyMatchType
    patternNormalized: string
    taxonomyNodeId: string
  }>
): Map<CarTaxonomyMatchType, Map<string, string>> {
  const out = new Map<CarTaxonomyMatchType, Map<string, string>>()
  for (const r of rules) {
    let m = out.get(r.matchType)
    if (!m) {
      m = new Map()
      out.set(r.matchType, m)
    }
    m.set(r.patternNormalized, r.taxonomyNodeId)
  }
  return out
}

function patternForMatchType(race: RaceMatchInput, matchType: CarTaxonomyMatchType): string | null {
  switch (matchType) {
    case "CLASS_AND_LABEL": {
      const cn = race.className?.trim()
      const rl = race.raceLabel?.trim()
      if (!cn || !rl) return null
      return buildClassAndLabelPattern(cn, rl)
    }
    case "CLASS_NAME": {
      const cn = race.className?.trim()
      if (!cn) return null
      return normalizeCarTaxonomyPattern(cn)
    }
    case "RACE_LABEL": {
      const rl = race.raceLabel?.trim()
      if (!rl) return null
      return normalizeCarTaxonomyPattern(rl)
    }
    case "SECTION_HEADER": {
      const sh = race.sectionHeader?.trim()
      if (!sh) return null
      return normalizeCarTaxonomyPattern(sh)
    }
    case "SESSION_TYPE": {
      const st = race.sessionType?.trim()
      if (!st) return null
      return normalizeCarTaxonomyPattern(st)
    }
    default:
      return null
  }
}

export function resolveUserCarTaxonomyForRace(
  race: RaceMatchInput,
  ruleIndex: Map<CarTaxonomyMatchType, Map<string, string>>,
  nodeById: Map<string, CarTaxonomyNodeLite>
): ResolvedUserCarTaxonomy | null {
  for (const mt of MATCH_ORDER) {
    const pattern = patternForMatchType(race, mt)
    if (!pattern) continue
    const nodeId = ruleIndex.get(mt)?.get(pattern)
    if (nodeId) {
      return resolveNode(nodeId, nodeById)
    }
  }
  return null
}
