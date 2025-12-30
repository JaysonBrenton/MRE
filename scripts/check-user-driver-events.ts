import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const userEmail = process.argv[2] || 'jaysoncareybrenton@gmail.com'

  console.log(`\nChecking driver events for user: ${userEmail}\n`)

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email: userEmail.toLowerCase().trim() },
    select: {
      id: true,
      email: true,
      driverName: true,
      normalizedName: true,
      personaId: true,
    },
  })

  if (!user) {
    console.error(`❌ User not found: ${userEmail}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log(`✅ Found user:`)
  console.log(`   ID: ${user.id}`)
  console.log(`   Email: ${user.email}`)
  console.log(`   Driver Name: ${user.driverName}`)
  console.log(`   Normalized Name: ${user.normalizedName || '(not set)'}`)
  console.log(`   Persona ID: ${user.personaId || '(not set)'}\n`)

  // Check persona
  if (user.personaId) {
    const persona = await prisma.persona.findUnique({
      where: { id: user.personaId },
    })
    console.log(`✅ Persona: ${persona?.type || 'unknown'}\n`)
  }

  // Check UserDriverLinks
  const userDriverLinks = await prisma.userDriverLink.findMany({
    where: { userId: user.id },
    include: {
      driver: {
        select: {
          id: true,
          displayName: true,
          normalizedName: true,
        },
      },
      events: {
        include: {
          event: {
            include: {
              track: {
                select: {
                  trackName: true,
                },
              },
            },
          },
        },
      },
    },
  })

  console.log(`📊 UserDriverLinks: ${userDriverLinks.length}`)
  userDriverLinks.forEach((link) => {
    console.log(`   - Driver: ${link.driver.displayName}`)
    console.log(`     Status: ${link.status}`)
    console.log(`     Similarity: ${link.similarityScore}`)
    console.log(`     Events: ${link.events.length}`)
    link.events.forEach((eventLink) => {
      console.log(`       • ${eventLink.event.eventName} (${eventLink.matchType}, ${eventLink.similarityScore})`)
    })
  })

  // Check EventDriverLinks directly
  const eventDriverLinks = await prisma.eventDriverLink.findMany({
    where: { userId: user.id },
    include: {
      event: {
        include: {
          track: {
            select: {
              trackName: true,
            },
          },
        },
      },
      userDriverLink: {
        select: {
          status: true,
        },
      },
    },
    orderBy: {
      matchedAt: 'desc',
    },
  })

  console.log(`\n📊 EventDriverLinks: ${eventDriverLinks.length}`)
  if (eventDriverLinks.length > 0) {
    eventDriverLinks.forEach((link) => {
      console.log(`   - ${link.event.eventName}`)
      console.log(`     Track: ${link.event.track.trackName}`)
      console.log(`     Date: ${link.event.eventDate.toISOString().split('T')[0]}`)
      console.log(`     Match Type: ${link.matchType}`)
      console.log(`     Similarity: ${link.similarityScore}`)
      console.log(`     UserDriverLink Status: ${link.userDriverLink?.status || 'N/A'}`)
    })
  } else {
    console.log(`   ⚠️  No EventDriverLinks found`)
  }

  console.log(`\n`)
}

main()
  .catch((e) => {
    console.error('Error querying database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

