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

  it("getSessionAnalysisNavClassOptions prefers entry list over races", () => {
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
    expect(getSessionAnalysisNavClassOptions(data)).toEqual(["Zebra"])
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
})
