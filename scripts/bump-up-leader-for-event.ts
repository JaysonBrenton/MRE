/**
 * Report drivers ranked by inferred bump-up count for an event (same logic as OverviewTab
 * bumpUpRowsAggregated: union per race.className from getRaceClassNamesForBumpUpChips).
 *
 * Usage (inside mre-app): npx tsx scripts/bump-up-leader-for-event.ts [sourceEventId|nameSubstring]
 *
 * Examples:
 *   npx tsx scripts/bump-up-leader-for-event.ts 491882
 *   npx tsx scripts/bump-up-leader-for-event.ts RCRA
 */

import { PrismaClient } from "@prisma/client"
import { getRaceClassNamesForBumpUpChips } from "../src/core/events/class-validator"
import { getEventAnalysisData } from "../src/core/events/get-event-analysis-data"
import { getSessionsForBumpUpInference } from "../src/core/events/get-sessions-data"
import { inferBumpUpsFromSessions } from "../src/core/events/infer-bump-ups"

const prisma = new PrismaClient()

async function main() {
  const arg = process.argv[2]

  let event: {
    id: string
    eventName: string
    sourceEventId: string
    eventDate: Date
  } | null = null

  if (arg && /^\d+$/.test(arg)) {
    event = await prisma.event.findFirst({
      where: { source: "liverc", sourceEventId: arg },
      select: { id: true, eventName: true, sourceEventId: true, eventDate: true },
    })
  }

  if (!event) {
    const term = arg?.trim() || "RCRA Nationals"
    const events = await prisma.event.findMany({
      where: {
        eventName: { contains: term, mode: "insensitive" },
        eventDate: {
          gte: new Date(Date.UTC(2026, 0, 1)),
          lt: new Date(Date.UTC(2027, 0, 1)),
        },
      },
      select: { id: true, eventName: true, sourceEventId: true, eventDate: true },
      orderBy: { eventDate: "desc" },
      take: 25,
    })
    if (events.length === 0) {
      console.error(`No event found for "${term}" in calendar year 2026`)
      process.exit(1)
    }
    if (events.length > 1) {
      console.error(`Multiple events matched "${term}" in 2026; pass liverc sourceEventId:\n`)
      events.forEach((e) => {
        console.error(
          `  ${e.sourceEventId}  ${e.eventDate.toISOString().slice(0, 10)}  ${e.eventName}`
        )
      })
      process.exit(2)
    }
    event = events[0]!
  }

  console.log(`Event: ${event.eventName}`)
  console.log(
    `  id=${event.id} sourceEventId=${event.sourceEventId} date=${event.eventDate.toISOString().slice(0, 10)}\n`
  )

  const data = await getEventAnalysisData(event.id)
  if (!data) {
    console.error("getEventAnalysisData returned null")
    process.exit(1)
  }

  const bumpUpClassNames = getRaceClassNamesForBumpUpChips(data)
  console.log(`Bump-up ladder classes: ${bumpUpClassNames.length}\n`)

  const counts = new Map<string, { name: string; rows: number }>()

  for (const cn of bumpUpClassNames) {
    const sessions = getSessionsForBumpUpInference(data, cn)
    for (const r of inferBumpUpsFromSessions(sessions)) {
      const cur = counts.get(r.driverId) ?? { name: r.driverName, rows: 0 }
      cur.rows += 1
      cur.name = r.driverName
      counts.set(r.driverId, cur)
    }
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1].rows - a[1].rows)

  console.log("Top drivers by total bump-up rows (all classes):\n")
  sorted.slice(0, 25).forEach(([id, v], i) => {
    console.log(`${i + 1}. ${v.rows}  ${v.name}  (${id})`)
  })

  if (sorted.length === 0) {
    console.log("\n(no bump-ups inferred)")
  } else {
    const maxRows = sorted[0]![1].rows
    const leaders = sorted.filter(([, v]) => v.rows === maxRows)
    console.log(`\nMaximum bump-ups: ${maxRows}`)
    if (leaders.length === 1) {
      console.log(`Leader: ${leaders[0]![1].name}`)
    } else {
      console.log(`Tied (${leaders.length} drivers):`)
      leaders.forEach(([, v]) => console.log(`  - ${v.name}`))
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
