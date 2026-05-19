import type { MainBracketLadderNode } from "./main-bracket-ladder-model"

export interface BracketLaneLayoutOptions {
  nodeHeight: number
  stackLaneGap: number
  oddRowCenterY: number
  evenRowCenterY: number
  centerRowCenterY: number
}

/**
 * Assign vertical center Y per session so cards in the same tier never overlap.
 * - One node: odd/even/center branch lanes (single track).
 * - Two nodes: upper/lower lanes (same as split finals).
 * - Three or more: vertical stack below the top lane with fixed spacing.
 */
export function assignCenterYBySessionId(
  modelNodes: MainBracketLadderNode[],
  options: BracketLaneLayoutOptions
): Map<string, number> {
  const { nodeHeight, stackLaneGap, oddRowCenterY, evenRowCenterY, centerRowCenterY } = options

  const byTier = new Map<number, MainBracketLadderNode[]>()
  for (const n of modelNodes) {
    const list = byTier.get(n.tierIndex) ?? []
    list.push(n)
    byTier.set(n.tierIndex, list)
  }

  const out = new Map<string, number>()
  const step = nodeHeight + stackLaneGap

  for (const [, columnNodes] of byTier) {
    const sorted = [...columnNodes].sort((a, b) => {
      if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex
      const oa = a.raceOrder
      const ob = b.raceOrder
      if (oa != null && ob != null && oa !== ob) return oa - ob
      if (oa != null && ob == null) return -1
      if (oa == null && ob != null) return 1
      return a.raceLabel.localeCompare(b.raceLabel, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    })

    if (sorted.length === 1) {
      const only = sorted[0]!
      if (only.branch === "odd") out.set(only.sessionId, oddRowCenterY)
      else if (only.branch === "even") out.set(only.sessionId, evenRowCenterY)
      else out.set(only.sessionId, centerRowCenterY)
      continue
    }

    if (sorted.length === 2) {
      const a = sorted[0]!
      const b = sorted[1]!
      if (a.branch === "odd" && b.branch === "even") {
        out.set(a.sessionId, oddRowCenterY)
        out.set(b.sessionId, evenRowCenterY)
        continue
      }
      if (a.branch === "even" && b.branch === "odd") {
        out.set(a.sessionId, evenRowCenterY)
        out.set(b.sessionId, oddRowCenterY)
        continue
      }
      out.set(a.sessionId, oddRowCenterY)
      out.set(b.sessionId, evenRowCenterY)
      continue
    }

    const startCenter = oddRowCenterY
    sorted.forEach((n, i) => {
      out.set(n.sessionId, startCenter + i * step)
    })
  }

  return out
}
