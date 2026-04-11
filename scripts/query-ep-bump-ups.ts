/**
 * Report inferred bump-up row counts per class for an event (esp. EP* vs nitro).
 * Usage: docker exec mre-app sh -c 'cd /app && npx tsx scripts/query-ep-bump-ups.ts 491882'
 */

import { PrismaClient } from "@prisma/client"
import { getRaceClassNamesForBumpUpChips } from "../src/core/events/class-validator"
import { getEventAnalysisData } from "../src/core/events/get-event-analysis-data"
import { getSessionsForBumpUpInference } from "../src/core/events/get-sessions-data"
import { inferBumpUpsFromSessions } from "../src/core/events/infer-bump-ups"

const prisma = new PrismaClient()

async function main() {
  const sourceEventId = process.argv[2] ?? "491882"
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
  console.log(`${event.eventName}\n`)

  const rows: { className: string; vehicleType: string; count: number; epLike: boolean }[] = []

  for (const cn of chips) {
    const vt = data.raceClasses.get(cn)?.vehicleType ?? "(none)"
    const epLike = /^ep\s/i.test(cn.trim()) || /\belectric\b/i.test(cn)
    const sessions = getSessionsForBumpUpInference(data, cn)
    const count = inferBumpUpsFromSessions(sessions).length
    rows.push({ className: cn, vehicleType: vt, count, epLike })
  }

  rows.sort((a, b) => a.className.localeCompare(b.className))

  console.log("className | vehicleType | bump-up rows | EP-like name")
  for (const r of rows) {
    console.log(`${r.className} | ${r.vehicleType} | ${r.count} | ${r.epLike ? "yes" : "no"}`)
  }

  const epRows = rows.filter((r) => r.epLike)
  const epTotal = epRows.reduce((s, r) => s + r.count, 0)
  console.log(`\nEP-like / electric-in-name classes: ${epRows.length}, total bump rows: ${epTotal}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
