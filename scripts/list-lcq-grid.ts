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

  const lcq = await prisma.race.findFirst({
    where: {
      eventId: event.id,
      OR: [
        { raceLabel: { contains: "Last Chance", mode: "insensitive" } },
        { className: { contains: "Last Chance", mode: "insensitive" } },
      ],
    },
    include: {
      results: {
        include: { raceDriver: { include: { driver: true } } },
        orderBy: { positionFinal: "asc" },
      },
    },
  })

  if (!lcq) {
    console.log("No LCQ race found")
    process.exit(0)
  }

  console.log(`${event.eventName}\n${lcq.className} | ${lcq.raceLabel}\n`)
  for (const r of lcq.results) {
    console.log(`${r.positionFinal}. ${r.raceDriver.driver.displayName}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
