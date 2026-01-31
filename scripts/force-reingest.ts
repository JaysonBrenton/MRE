import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const eventId = "67affaa1-f667-4d22-9621-9d1cc189f7a0"

  // Reset ingest depth to force re-ingestion
  const result = await prisma.$executeRaw`
    UPDATE events 
    SET ingest_depth = 'none', last_ingested_at = NULL 
    WHERE id = ${eventId}
  `

  console.log(`Updated ${result} row(s)`)

  // Verify
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { ingestDepth: true, lastIngestedAt: true },
  })

  console.log(
    `After update - Ingest Depth: ${event?.ingestDepth}, Last Ingested: ${event?.lastIngestedAt}`
  )

  console.log(`Reset event ${eventId} to ingest_depth=none. Ready for re-ingestion.`)

  await prisma.$disconnect()
}

main().catch(console.error)
