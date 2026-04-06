/**
 * List inferred bump-up rows whose *to* session is LCQ (drivers who advanced into the LCQ).
 * Usage: docker exec mre-app sh -c 'cd /app && npx tsx scripts/query-bumps-to-lcq.ts [sourceEventId]'
 */

import { PrismaClient } from "@prisma/client"
import { getRaceClassNamesForBumpUpChips } from "../src/core/events/class-validator"
import { getEventAnalysisData } from "../src/core/events/get-event-analysis-data"
import { getSessionsForBumpUpInference } from "../src/core/events/get-sessions-data"
import { inferBumpUpsFromSessions, labelLooksLikeLcq } from "../src/core/events/infer-bump-ups"

const prisma = new PrismaClient()

async function main() {
  const arg = process.argv[2] ?? "491882"
  const event = await prisma.event.findFirst({
    where: { source: "liverc", sourceEventId: /^\d+$/.test(arg) ? arg : "491882" },
    select: { id: true, eventName: true, sourceEventId: true },
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

  console.log(`${event.eventName} (sourceEventId=${event.sourceEventId})\n`)

  const chips = getRaceClassNamesForBumpUpChips(data)
  const toLcq: Array<{
    className: string
    driverName: string
    fromRaceLabel: string
    toRaceLabel: string
    kind: string
  }> = []

  for (const cn of chips) {
    const sessions = getSessionsForBumpUpInference(data, cn)
    for (const r of inferBumpUpsFromSessions(sessions)) {
      if (labelLooksLikeLcq(r.toRaceLabel)) {
        toLcq.push({
          className: cn,
          driverName: r.driverName,
          fromRaceLabel: r.fromRaceLabel,
          toRaceLabel: r.toRaceLabel,
          kind: r.kind,
        })
      }
    }
  }

  if (toLcq.length === 0) {
    console.log(
      "No inferred bump-up rows where the destination race is LCQ (same driver, lower tier → LCQ)."
    )
    console.log(
      "(Checked all getRaceClassNamesForBumpUpChips classes with mergeLcqSessionsForClass.)"
    )
  } else {
    console.log(`Rows with advancement *into* LCQ (${toLcq.length}):\n`)
    for (const x of toLcq) {
      console.log(
        `- [${x.className}] ${x.driverName}: ${x.fromRaceLabel} → ${x.toRaceLabel} (kind=${x.kind})`
      )
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
