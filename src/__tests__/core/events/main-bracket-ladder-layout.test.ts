import { describe, expect, it } from "vitest"
import type { MainBracketLadderNode } from "@/core/events/main-bracket-ladder-model"
import { assignCenterYBySessionId } from "@/core/events/main-bracket-ladder-layout"

const OPT = {
  nodeHeight: 82,
  stackLaneGap: 14,
  oddRowCenterY: 92,
  evenRowCenterY: 248,
  centerRowCenterY: 170,
} as const

function makeNode(
  sessionId: string,
  tierIndex: number,
  branch: MainBracketLadderNode["branch"],
  rowIndex: number,
  extras: Partial<MainBracketLadderNode> = {}
): MainBracketLadderNode {
  return {
    sessionId,
    raceLabel: extras.raceLabel ?? "Race",
    className: extras.className ?? "Buggy",
    roundLabel: extras.roundLabel ?? "Round",
    roundKind: extras.roundKind ?? "Main",
    raceOrder: extras.raceOrder ?? null,
    branch,
    tierIndex,
    rowIndex,
    hasResults: extras.hasResults ?? true,
    drivers: extras.drivers ?? [],
    advancedDriverCount: extras.advancedDriverCount ?? 0,
    startTime: extras.startTime ?? null,
  }
}

describe("assignCenterYBySessionId", () => {
  it("places two lettered-mains lanes without vertical overlap", () => {
    const nodes: MainBracketLadderNode[] = [
      makeNode("o", 0, "center", 0),
      makeNode("n", 0, "stacked", 1),
    ]
    const m = assignCenterYBySessionId(nodes, OPT)
    const yO = m.get("o")!
    const yN = m.get("n")!
    expect(yO).toBe(92)
    expect(yN).toBe(248)
    expect(Math.abs(yN - yO) >= OPT.nodeHeight + OPT.stackLaneGap).toBe(true)
  })

  it("keeps odd on top and even on bottom when raceOrder lists even first", () => {
    const nodes: MainBracketLadderNode[] = [
      makeNode("e", 0, "even", 0, {
        raceOrder: 1,
        raceLabel: "Buggy 1/2 Even Final",
      }),
      makeNode("o", 0, "odd", 1, {
        raceOrder: 2,
        raceLabel: "Buggy 1/2 Odd Final",
      }),
    ]
    const m = assignCenterYBySessionId(nodes, OPT)
    expect(m.get("o")).toBe(92)
    expect(m.get("e")).toBe(248)
  })

  it("stacks three or more sessions with at least nodeHeight+gap between centers", () => {
    const nodes: MainBracketLadderNode[] = [
      makeNode("a1", 0, "center", 0),
      makeNode("a2", 0, "stacked", 1),
      makeNode("a3", 0, "stacked", 2),
    ]
    const m = assignCenterYBySessionId(nodes, OPT)
    const c0 = m.get("a1")!
    const c1 = m.get("a2")!
    const c2 = m.get("a3")!
    expect(c1 - c0).toBeGreaterThanOrEqual(OPT.nodeHeight + OPT.stackLaneGap - 0.001)
    expect(c2 - c1).toBeGreaterThanOrEqual(OPT.nodeHeight + OPT.stackLaneGap - 0.001)
  })
})
