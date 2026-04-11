import { describe, expect, it } from "vitest"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import {
  UNCLASSIFIED_CLASS_KEY,
  UNCLASSIFIED_VEHICLE_KEY,
  classChipLabel,
  effectiveClassKey,
  effectiveVehicleKey,
  eventHasVehicleDenormalization,
  getSessionAnalysisClassKeys,
  getSkillTierOptionsForLiveRcClassName,
  raceMatchesLiveRcClassAndSkill,
  raceMatchesSessionClassAndSkill,
} from "@/core/events/session-analysis-filters"

function minimalRace(
  overrides: Partial<EventAnalysisData["races"][number]>
): EventAnalysisData["races"][number] {
  return {
    id: "r1",
    raceId: "r1",
    className: "Buggy",
    raceLabel: "Q1",
    raceOrder: 1,
    completedAt: null,
    startTime: null,
    durationSeconds: null,
    sessionType: "qualifying",
    sectionHeader: null,
    raceUrl: "https://x",
    vehicleType: null,
    skillTier: null,
    vehicleClassNormalizationNeedsReview: false,
    eventRaceClassId: null,
    results: [],
    ...overrides,
  }
}

const minimalData = (races: EventAnalysisData["races"][number][]): EventAnalysisData =>
  ({
    event: { id: "e1", eventName: "Test", eventDate: new Date(), sourceEventId: "1" },
    races,
    drivers: [],
    entryList: [],
    raceClasses: new Map(),
    multiMainResults: [],
    summary: {
      totalRaces: races.length,
      totalDrivers: 0,
      totalLaps: 0,
      dateRange: { earliest: null, latest: null },
    },
  }) as unknown as EventAnalysisData

describe("session-analysis-filters", () => {
  it("effectiveVehicleKey uses unclassified when vehicleType missing", () => {
    expect(effectiveVehicleKey(minimalRace({ vehicleType: null }))).toBe(UNCLASSIFIED_VEHICLE_KEY)
    expect(effectiveVehicleKey(minimalRace({ vehicleType: "1/8 Nitro Buggy" }))).toBe(
      "1/8 Nitro Buggy"
    )
  })

  it("effectiveVehicleKey prefers user taxonomy slug over ingestion vehicleType", () => {
    expect(
      effectiveVehicleKey(
        minimalRace({
          vehicleType: "from-ingestion",
          userCarTaxonomy: {
            taxonomyNodeId: "x",
            slug: "off-road-1-8-nitro-buggy",
            pathLabels: ["1/8 Off-Road Nitro Buggy"],
            pathLabel: "1/8 Off-Road Nitro Buggy",
          },
        })
      )
    ).toBe("off-road-1-8-nitro-buggy")
  })

  it("effectiveClassKey uses className and unclassified when empty", () => {
    expect(effectiveClassKey(minimalRace({ className: "EP Buggy" }))).toBe("EP Buggy")
    expect(effectiveClassKey(minimalRace({ className: "" }))).toBe(UNCLASSIFIED_CLASS_KEY)
  })

  it("classChipLabel maps unclassified key", () => {
    expect(classChipLabel(UNCLASSIFIED_CLASS_KEY)).toBe("Unclassified")
    expect(classChipLabel("EP Buggy")).toBe("EP Buggy")
  })

  it("classChipLabel uses taxonomy path when key matches slug", () => {
    const data = minimalData([
      minimalRace({
        userCarTaxonomy: {
          taxonomyNodeId: "x",
          slug: "leaf-slug",
          pathLabels: ["1/8 Off-Road Nitro Buggy"],
          pathLabel: "1/8 Off-Road Nitro Buggy",
        },
      }),
    ])
    expect(classChipLabel("leaf-slug", data)).toBe("1/8 Off-Road Nitro Buggy")
  })

  it("eventHasVehicleDenormalization detects populated rows", () => {
    expect(eventHasVehicleDenormalization(minimalData([minimalRace({ vehicleType: null })]))).toBe(
      false
    )
    expect(
      eventHasVehicleDenormalization(minimalData([minimalRace({ vehicleType: "1/8 Nitro Buggy" })]))
    ).toBe(true)
    expect(
      eventHasVehicleDenormalization(
        minimalData([
          minimalRace({
            vehicleType: null,
            eventRaceClassId: null,
            userCarTaxonomy: {
              taxonomyNodeId: "x",
              slug: "s",
              pathLabels: [],
              pathLabel: "p",
            },
          }),
        ])
      )
    ).toBe(true)
  })

  it("getSessionAnalysisClassKeys skips placeholders and keys by className", () => {
    const keys = getSessionAnalysisClassKeys(
      minimalData([
        minimalRace({ className: "Track Maintenance", vehicleType: null }),
        minimalRace({ className: "EP Buggy", vehicleType: "1/8 Buggy" }),
        minimalRace({ className: "Buggy", vehicleType: "1/8 Buggy" }),
      ])
    )
    expect(keys).toContain("EP Buggy")
    expect(keys).toContain("Buggy")
    expect(keys.length).toBe(2)
  })

  it("getSessionAnalysisClassKeys uses taxonomy slug when user mapping exists", () => {
    const keys = getSessionAnalysisClassKeys(
      minimalData([
        minimalRace({
          className: "Buggy",
          userCarTaxonomy: {
            taxonomyNodeId: "x",
            slug: "leaf-slug",
            pathLabels: ["Canonical Leaf"],
            pathLabel: "Canonical Leaf",
          },
        }),
      ])
    )
    expect(keys).toEqual(["leaf-slug"])
  })

  it("raceMatchesSessionClassAndSkill respects skill tier", () => {
    const r = minimalRace({
      className: "Buggy",
      vehicleType: "1/8 Nitro Buggy",
      skillTier: "Junior",
    })
    expect(raceMatchesSessionClassAndSkill(r, "Buggy", null)).toBe(true)
    expect(raceMatchesSessionClassAndSkill(r, "Buggy", "Junior")).toBe(true)
    expect(raceMatchesSessionClassAndSkill(r, "Buggy", "Senior")).toBe(false)
    expect(raceMatchesSessionClassAndSkill(r, "EP Buggy", null)).toBe(false)
  })

  it("raceMatchesSessionClassAndSkill uses taxonomy slug as class key when mapped", () => {
    const r = minimalRace({
      className: "Buggy",
      userCarTaxonomy: {
        taxonomyNodeId: "x",
        slug: "leaf-slug",
        pathLabels: [],
        pathLabel: "P",
      },
      skillTier: "Junior",
    })
    expect(raceMatchesSessionClassAndSkill(r, "leaf-slug", null)).toBe(true)
    expect(raceMatchesSessionClassAndSkill(r, "Buggy", null)).toBe(false)
  })

  it("getSkillTierOptionsForLiveRcClassName ignores taxonomy and uses className", () => {
    const data = minimalData([
      minimalRace({
        className: "Buggy",
        skillTier: "Junior",
        userCarTaxonomy: {
          taxonomyNodeId: "x",
          slug: "leaf-slug",
          pathLabels: [],
          pathLabel: "Canonical",
        },
      }),
    ])
    expect(getSkillTierOptionsForLiveRcClassName(data, "Buggy")).toEqual(["Junior"])
    expect(getSkillTierOptionsForLiveRcClassName(data, "leaf-slug")).toEqual([])
  })

  it("raceMatchesLiveRcClassAndSkill matches LiveRC className and optional tier", () => {
    const r = minimalRace({ className: "Buggy", skillTier: "Junior" })
    expect(raceMatchesLiveRcClassAndSkill(r, "Buggy", null)).toBe(true)
    expect(raceMatchesLiveRcClassAndSkill(r, "Buggy", "Junior")).toBe(true)
    expect(raceMatchesLiveRcClassAndSkill(r, "Buggy", "Senior")).toBe(false)
    expect(raceMatchesLiveRcClassAndSkill(r, "EP Buggy", null)).toBe(false)
  })

  it("raceMatchesLiveRcClassAndSkill ignores taxonomy slug for class match", () => {
    const r = minimalRace({
      className: "Buggy",
      userCarTaxonomy: {
        taxonomyNodeId: "x",
        slug: "leaf-slug",
        pathLabels: [],
        pathLabel: "P",
      },
      skillTier: "Junior",
    })
    expect(raceMatchesLiveRcClassAndSkill(r, "Buggy", null)).toBe(true)
    expect(raceMatchesLiveRcClassAndSkill(r, "leaf-slug", null)).toBe(false)
  })
})
