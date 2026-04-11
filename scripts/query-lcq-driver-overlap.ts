/**
 * Raw DB check: drivers in LCQ race who also appear in any earlier race (same event).
 * Usage: docker exec mre-app sh -c 'cd /app && npx tsx scripts/query-lcq-driver-overlap.ts 491882'
 */

import { PrismaClient } from "@prisma/client"

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

  const races = await prisma.race.findMany({
    where: { eventId: event.id },
    include: {
      results: {
        select: { positionFinal: true, raceDriver: { select: { driverId: true } } },
      },
    },
    orderBy: [{ raceOrder: "asc" }, { startTime: "asc" }],
  })

  const lcqRaces = races.filter(
    (r) => /\blcq\b|last\s*chance/i.test(r.raceLabel) || /last\s*chance/i.test(r.className ?? "")
  )

  console.log(`${event.eventName}\nLCQ-like races: ${lcqRaces.length}\n`)

  for (const lcq of lcqRaces) {
    const lcqOrder = lcq.raceOrder ?? -1
    const lcqTime = lcq.startTime?.getTime() ?? 0
    const lcqDrivers = new Set(lcq.results.map((x) => x.raceDriver.driverId))

    const earlier = races.filter((r) => {
      if (r.id === lcq.id) return false
      const o = r.raceOrder ?? null
      if (o != null && lcqOrder >= 0) {
        if (o < lcqOrder) return true
        if (o > lcqOrder) return false
      }
      const t = r.startTime?.getTime() ?? 0
      return t < lcqTime || (t === lcqTime && r.raceLabel < lcq.raceLabel)
    })

    const overlaps: { driverId: string; earlierLabel: string; earlierClass: string }[] = []
    for (const d of lcqDrivers) {
      for (const er of earlier) {
        if (er.results.some((res) => res.raceDriver.driverId === d)) {
          overlaps.push({
            driverId: d,
            earlierLabel: er.raceLabel,
            earlierClass: er.className,
          })
          break
        }
      }
    }

    console.log(`LCQ race: ${lcq.className} | ${lcq.raceLabel}`)
    console.log(`  raceOrder=${lcq.raceOrder} drivers=${lcqDrivers.size}`)
    console.log(`  Drivers who also ran an earlier race in this event: ${overlaps.length}`)
    for (const o of overlaps.slice(0, 20)) {
      console.log(`    ${o.driverId} ← earlier: [${o.earlierClass}] ${o.earlierLabel}`)
    }
    if (overlaps.length > 20) console.log(`    ... +${overlaps.length - 20} more`)
    console.log("")
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
