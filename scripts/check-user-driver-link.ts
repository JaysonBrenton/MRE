import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst({
    select: {
      id: true,
      driverName: true,
      normalizedName: true,
    },
  })

  if (!user) {
    console.log("No user found")
    return
  }

  // Get the Batemans Bay driver (the one with EventDriverLink)
  const batemansDriver = await prisma.driver.findFirst({
    where: {
      id: "9528167e-864b-4254-a98c-2b2eb874e701",
    },
  })

  // Get the Cormcc driver
  const cormccDriver = await prisma.driver.findFirst({
    where: {
      id: "304002f5-bff1-4b87-9ee8-db393b394cea",
    },
  })

  console.log(`\n=== User ===`)
  console.log(`User ID: ${user.id}`)
  console.log(`Driver Name: ${user.driverName}`)
  console.log(`Normalized Name: ${user.normalizedName}`)

  if (batemansDriver) {
    console.log(`\n=== Batemans Bay Driver ===`)
    console.log(`Driver ID: ${batemansDriver.id}`)
    console.log(`Display Name: ${batemansDriver.displayName}`)
    console.log(`Normalized Name: ${batemansDriver.normalizedName}`)
    console.log(`Source Driver ID: ${batemansDriver.sourceDriverId}`)

    const userDriverLink = await prisma.userDriverLink.findFirst({
      where: {
        driverId: batemansDriver.id,
        userId: user.id,
      },
    })

    console.log(`\nUserDriverLink:`)
    if (userDriverLink) {
      console.log(`  ID: ${userDriverLink.id}`)
      console.log(`  Status: ${userDriverLink.status}`)
      console.log(`  Created At: ${userDriverLink.createdAt}`)
      console.log(`  Matched At: ${userDriverLink.matchedAt}`)
      console.log(`  Confirmed At: ${userDriverLink.confirmedAt}`)
    } else {
      console.log(`  NOT FOUND`)
    }
  }

  if (cormccDriver) {
    console.log(`\n=== Cormcc Driver ===`)
    console.log(`Driver ID: ${cormccDriver.id}`)
    console.log(`Display Name: ${cormccDriver.displayName}`)
    console.log(`Normalized Name: ${cormccDriver.normalizedName}`)
    console.log(`Source Driver ID: ${cormccDriver.sourceDriverId}`)

    const userDriverLink = await prisma.userDriverLink.findFirst({
      where: {
        driverId: cormccDriver.id,
        userId: user.id,
      },
    })

    console.log(`\nUserDriverLink:`)
    if (userDriverLink) {
      console.log(`  ID: ${userDriverLink.id}`)
      console.log(`  Status: ${userDriverLink.status}`)
      console.log(`  Created At: ${userDriverLink.createdAt}`)
      console.log(`  Matched At: ${userDriverLink.matchedAt}`)
      console.log(`  Confirmed At: ${userDriverLink.confirmedAt}`)
    } else {
      console.log(`  NOT FOUND`)
    }
  }

  // Check all UserDriverLinks for this user
  const allUserDriverLinks = await prisma.userDriverLink.findMany({
    where: {
      userId: user.id,
    },
    include: {
      driver: {
        select: {
          id: true,
          displayName: true,
          normalizedName: true,
          sourceDriverId: true,
        },
      },
    },
  })

  console.log(`\n=== All UserDriverLinks for User ===`)
  console.log(`Count: ${allUserDriverLinks.length}`)
  for (const link of allUserDriverLinks) {
    console.log(`\n  UserDriverLink ID: ${link.id}`)
    console.log(`  Driver ID: ${link.driverId}`)
    console.log(`  Driver Name: ${link.driver.displayName}`)
    console.log(`  Driver Normalized: ${link.driver.normalizedName}`)
    console.log(`  Driver Source ID: ${link.driver.sourceDriverId}`)
    console.log(`  Status: ${link.status}`)
    console.log(`  Created At: ${link.createdAt}`)
    console.log(`  Matched At: ${link.matchedAt}`)
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
