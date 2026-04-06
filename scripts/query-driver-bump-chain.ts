/**
 * Print inferred bump-up edges for a driver (by name) for an event, ordered by schedule.
 * Usage: docker exec mre-app sh -c 'cd /app && npx tsx scripts/query-driver-bump-chain.ts 491882 "DARREN CAINS"'
 */

import { PrismaClient } from "@prisma/client"
import { getRaceClassNamesForBumpUpChips } from "../src/core/events/class-validator"
import { getEventAnalysisData } from "../src/core/events/get-event-analysis-data"
import { getSessionsForBumpUpInference } from "../src/core/events/get-sessions-data"
import { inferBumpUpsFromSessions } from "../src/core/events/infer-bump-ups"

const prisma = new PrismaClient()

async function main() {
  const sourceEventId = process.argv[2] ?? "491882"
  const nameQuery = (process.argv[3] ?? "DARREN CAINS").trim().toLowerCase()

  const event = await prisma.event.findFirst({
    where: { source: "liverc", sourceEventId },
    select: { id: true, eventName: true },
  })
  if (!event) {
    console.error("Event not found")
    process.exit(1)
  }

  const data = await getEventAnalysisData(event.id)
  if (!data) {
    console.error("No analysis data")
    process.exit(1)
  }

  const chips = getRaceClassNamesForBumpUpChips(data)

  type Edge = {
    className: string
    fromRaceLabel: string
    toRaceLabel: string
    fromPosition: number | null
    toPosition: number | null
    kind: string
    fromOrder: number
    toOrder: number
    driverId: string
    driverName: string
  }

  const edges: Edge[] = []

  for (const cn of chips) {
    const sessions = getSessionsForBumpUpInference(data, cn)
    const sessionOrder = new Map<string, number>()
    sessions.forEach((s, i) => {
      sessionOrder.set(s.id, s.raceOrder ?? i)
    })

    for (const r of inferBumpUpsFromSessions(sessions)) {
      if (!r.driverName.toLowerCase().includes(nameQuery)) continue

      const fromS = sessions.find((s) => s.raceLabel === r.fromRaceLabel && s.className === cn)
      const toS = sessions.find((s) => s.raceLabel === r.toRaceLabel && s.className === cn)
      const fromOrder = fromS?.raceOrder ?? sessionOrder.get(fromS?.id ?? "") ?? -1
      const toOrder = toS?.raceOrder ?? sessionOrder.get(toS?.id ?? "") ?? -1

      edges.push({
        className: cn,
        fromRaceLabel: r.fromRaceLabel,
        toRaceLabel: r.toRaceLabel,
        fromPosition: r.fromPosition,
        toPosition: r.toPosition,
        kind: r.kind,
        fromOrder,
        toOrder,
        driverId: r.driverId,
        driverName: r.driverName,
      })
    }
  }

  if (edges.length === 0) {
    console.log(`No bump-up rows matching "${nameQuery}" in event ${event.eventName}`)
    process.exit(0)
  }

  const d0 = edges[0]!
  console.log(`${event.eventName}`)
  console.log(`Driver: ${d0.driverName} (${d0.driverId})\n`)

  edges.sort((a, b) => {
    if (a.className !== b.className) return a.className.localeCompare(b.className)
    if (a.fromOrder !== b.fromOrder) return a.fromOrder - b.fromOrder
    return a.toOrder - b.toOrder
  })

  for (const e of edges) {
    console.log(`[${e.className}] (${e.kind})`)
    console.log(
      `  ${e.fromRaceLabel}  pos=${e.fromPosition ?? "?"}  →  ${e.toRaceLabel}  pos=${e.toPosition ?? "?"}  (raceOrder ~${e.fromOrder}→${e.toOrder})`
    )
    console.log("")
  }

  // Build a simple chain within each class: order edges by fromOrder
  const byClass = new Map<string, Edge[]>()
  for (const e of edges) {
    if (!byClass.has(e.className)) byClass.set(e.className, [])
    byClass.get(e.className)!.push(e)
  }

  console.log("--- Chain summary (per class) ---\n")
  for (const [cn, list] of [...byClass.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    list.sort((a, b) => a.fromOrder - b.fromOrder)
    const labels: string[] = []
    if (list.length > 0) {
      labels.push(list[0]!.fromRaceLabel)
      for (const x of list) {
        labels.push(x.toRaceLabel)
      }
    }
    console.log(`${cn}:`)
    console.log(`  ${labels.join(" → ")}`)
    console.log("")
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
