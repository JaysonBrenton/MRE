import { describe, expect, it } from "vitest"
import {
  getEntryListClassOptions,
  getSessionAnalysisNavClassOptions,
} from "@/core/events/entry-list-class-options"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

describe("entry-list-class-options", () => {
  it("getEntryListClassOptions dedupes and sorts with localeCompare", () => {
    const opts = getEntryListClassOptions([
      {
        className: "Truggy",
        id: "1",
        driverId: "a",
        driverName: "x",
        transponderNumber: null,
        carNumber: null,
      },
      {
        className: "Buggy",
        id: "2",
        driverId: "b",
        driverName: "y",
        transponderNumber: null,
        carNumber: null,
      },
      {
        className: "Truggy",
        id: "3",
        driverId: "c",
        driverName: "z",
        transponderNumber: null,
        carNumber: null,
      },
    ])
    expect(opts).toEqual(["Buggy", "Truggy"])
  })

  it("getEntryListClassOptions skips scheduling placeholder classes", () => {
    const opts = getEntryListClassOptions([
      {
        className: "1/8 EP Buggy",
        id: "1",
        driverId: "a",
        driverName: "x",
        transponderNumber: null,
        carNumber: null,
      },
      {
        className: "TRACK WATERING",
        id: "2",
        driverId: "b",
        driverName: "y",
        transponderNumber: null,
        carNumber: null,
      },
    ])
    expect(opts).toEqual(["1/8 EP Buggy"])
  })

  it("getSessionAnalysisNavClassOptions unions entry list and races when no programBucketOrder", () => {
    const data = {
      entryList: [
        {
          className: "Zebra",
          id: "1",
          driverId: "a",
          driverName: "n",
          transponderNumber: null,
          carNumber: null,
        },
      ],
      races: [
        {
          id: "r1",
          raceId: "r1",
          className: "Apple",
          raceLabel: "x",
          raceOrder: 1,
          completedAt: null,
          startTime: null,
          durationSeconds: null,
          sessionType: null,
          sectionHeader: null,
          raceUrl: "",
          results: [],
        },
      ],
    } as unknown as EventAnalysisData
    expect(getSessionAnalysisNavClassOptions(data)).toEqual(["Apple", "Zebra"])
  })

  it("getSessionAnalysisNavClassOptions uses programBucketOrder then merges extras sorted", () => {
    const data = {
      programBucketOrder: ["Open Etruggy", "Pro Buggy"],
      entryList: [
        {
          className: "Zebra",
          id: "1",
          driverId: "a",
          driverName: "n",
          transponderNumber: "1",
          carNumber: null,
        },
      ],
      races: [
        {
          id: "r1",
          raceId: "r1",
          className: "Apple",
          raceLabel: "x",
          raceOrder: 1,
          completedAt: null,
          startTime: null,
          durationSeconds: null,
          sessionType: null,
          sectionHeader: null,
          raceUrl: "",
          results: [],
        },
      ],
    } as unknown as EventAnalysisData
    expect(getSessionAnalysisNavClassOptions(data)).toEqual([
      "Open Etruggy",
      "Pro Buggy",
      "Apple",
      "Zebra",
    ])
  })

  it("getSessionAnalysisNavClassOptions falls back to race class names when entry list empty", () => {
    const data = {
      entryList: [],
      races: [
        {
          id: "r1",
          raceId: "r1",
          className: "Truggy",
          raceLabel: "x",
          raceOrder: 1,
          completedAt: null,
          startTime: null,
          durationSeconds: null,
          sessionType: null,
          sectionHeader: null,
          raceUrl: "",
          results: [],
        },
        {
          id: "r2",
          raceId: "r2",
          className: "Buggy",
          raceLabel: "y",
          raceOrder: 2,
          completedAt: null,
          startTime: null,
          durationSeconds: null,
          sessionType: null,
          sectionHeader: null,
          raceUrl: "",
          results: [],
        },
      ],
    } as unknown as EventAnalysisData
    expect(getSessionAnalysisNavClassOptions(data)).toEqual(["Buggy", "Truggy"])
  })

  it("getSessionAnalysisNavClassOptions omits track watering from programBucketOrder", () => {
    const data = {
      programBucketOrder: ["Pro Buggy", "TRACK WATERING", "Open Truck"],
      entryList: [],
      races: [],
    } as unknown as EventAnalysisData
    expect(getSessionAnalysisNavClassOptions(data)).toEqual(["Pro Buggy", "Open Truck"])
  })
})
