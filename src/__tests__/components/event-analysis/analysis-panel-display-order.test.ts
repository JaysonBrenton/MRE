import { describe, expect, it } from "vitest"
import {
  computePanelDisplayOrder,
  expandSequenceFromHomeOrder,
} from "@/components/organisms/event-analysis/analysis-panel-order"

const HOME = ["a", "b", "c", "d"] as const

describe("computePanelDisplayOrder", () => {
  it("returns home order when nothing is expanded", () => {
    const order = computePanelDisplayOrder(HOME, [])
    expect([...order.entries()].sort((x, y) => x[1] - y[1]).map(([id]) => id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ])
  })

  it("places expanded panels first in expand-stack order", () => {
    const order = computePanelDisplayOrder(HOME, ["c", "a"])
    expect([...order.entries()].sort((x, y) => x[1] - y[1]).map(([id]) => id)).toEqual([
      "c",
      "a",
      "b",
      "d",
    ])
  })

  it("ignores expanded ids not in home order", () => {
    const order = computePanelDisplayOrder(HOME, ["z", "b"])
    expect([...order.entries()].sort((x, y) => x[1] - y[1]).map(([id]) => id)).toEqual([
      "b",
      "a",
      "c",
      "d",
    ])
  })
})

describe("expandSequenceFromHomeOrder", () => {
  it("assigns indices matching home order", () => {
    expect(expandSequenceFromHomeOrder(HOME)).toEqual({
      a: 0,
      b: 1,
      c: 2,
      d: 3,
    })
  })
})
