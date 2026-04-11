import { describe, expect, it } from "vitest"
import {
  indexUserCarTaxonomyRules,
  resolveUserCarTaxonomyForRace,
  userCarTaxonomyRuleAppliesToEvent,
} from "@/core/car-taxonomy/resolve"
import type { CarTaxonomyMatchType } from "@prisma/client"

describe("resolveUserCarTaxonomyForRace", () => {
  const nodes = [
    { id: "n1", parentId: null, slug: "off-road", label: "Off-Road" },
    { id: "n2", parentId: "n1", slug: "off-road-nitro", label: "Nitro" },
  ]
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  it("matches CLASS_AND_LABEL before RACE_LABEL", () => {
    const rules: Array<{
      matchType: CarTaxonomyMatchType
      patternNormalized: string
      taxonomyNodeId: string
    }> = [
      {
        matchType: "RACE_LABEL",
        patternNormalized: "lcq",
        taxonomyNodeId: "n2",
      },
      {
        matchType: "CLASS_AND_LABEL",
        patternNormalized: "buggy||lcq",
        taxonomyNodeId: "n1",
      },
    ]
    const idx = indexUserCarTaxonomyRules(rules)
    const r = resolveUserCarTaxonomyForRace(
      {
        className: "Buggy",
        raceLabel: "LCQ",
        sectionHeader: null,
        sessionType: "main",
      },
      idx,
      nodeById
    )
    expect(r?.taxonomyNodeId).toBe("n1")
  })

  it("falls back to RACE_LABEL", () => {
    const rules: Array<{
      matchType: CarTaxonomyMatchType
      patternNormalized: string
      taxonomyNodeId: string
    }> = [
      {
        matchType: "RACE_LABEL",
        patternNormalized: "last chance",
        taxonomyNodeId: "n2",
      },
    ]
    const idx = indexUserCarTaxonomyRules(rules)
    const r = resolveUserCarTaxonomyForRace(
      {
        className: "Buggy",
        raceLabel: "Last Chance",
        sectionHeader: null,
        sessionType: "main",
      },
      idx,
      nodeById
    )
    expect(r?.taxonomyNodeId).toBe("n2")
  })
})

describe("userCarTaxonomyRuleAppliesToEvent", () => {
  const races = [
    {
      className: "40+ Electric Buggy",
      raceLabel: "A-Main",
      sectionHeader: "Main Events",
      sessionType: "main",
    },
  ]

  it("returns true when CLASS_NAME pattern matches a race class", () => {
    expect(
      userCarTaxonomyRuleAppliesToEvent(
        { matchType: "CLASS_NAME", patternNormalized: "40+ electric buggy" },
        races
      )
    ).toBe(true)
  })

  it("returns false when no race has that class", () => {
    expect(
      userCarTaxonomyRuleAppliesToEvent(
        { matchType: "CLASS_NAME", patternNormalized: "stock buggy" },
        races
      )
    ).toBe(false)
  })

  it("returns true when CLASS_AND_LABEL matches composite pattern", () => {
    expect(
      userCarTaxonomyRuleAppliesToEvent(
        {
          matchType: "CLASS_AND_LABEL",
          patternNormalized: "40+ electric buggy||a-main",
        },
        races
      )
    ).toBe(true)
  })

  it("returns false for empty races", () => {
    expect(
      userCarTaxonomyRuleAppliesToEvent(
        { matchType: "CLASS_NAME", patternNormalized: "40+ electric buggy" },
        []
      )
    ).toBe(false)
  })
})
