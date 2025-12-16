import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const event = await prisma.event.findFirst({
    where: {
      eventName: {
        contains: '2024 US Carpet Off Road Championship by Hobbywing',
        mode: 'insensitive',
      },
    },
    include: {
      races: {
        select: {
          className: true,
        },
      },
    },
  })

  if (!event) {
    console.log('Event not found')
    return
  }

  const uniqueClasses = [...new Set(event.races.map((r) => r.className))]
  
  console.log(`Event: ${event.eventName}`)
  console.log(`Total races: ${event.races.length}`)
  console.log(`Number of distinct classes: ${uniqueClasses.length}`)
  console.log(`Classes: ${uniqueClasses.sort().join(', ')}`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
