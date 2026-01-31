import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.driver.deleteMany({
    where: { source: "liverc" },
  })

  console.log(`Deleted ${result.count} LiveRC drivers`)
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
