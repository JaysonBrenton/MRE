/**
 * @fileoverview Script to populate normalizedName for existing users
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description One-time script to compute and populate normalizedName
 *              for all existing users in the database
 *
 * @purpose After migration adds normalizedName column, this script
 *          populates it for existing users using the normalization logic
 */

import { PrismaClient } from "@prisma/client"
import { normalizeDriverName } from "../src/core/users/name-normalizer"

const prisma = new PrismaClient()

async function main() {
  console.log("Fetching all users...")
  const users = await prisma.user.findMany({
    where: {
      normalizedName: null, // Only update users without normalizedName
    },
  })

  console.log(`Found ${users.length} users to update`)

  let updated = 0
  for (const user of users) {
    const normalizedName = normalizeDriverName(user.driverName)
    await prisma.user.update({
      where: { id: user.id },
      data: { normalizedName },
    })
    updated++
    console.log(`Updated user ${user.email}: "${user.driverName}" -> "${normalizedName}"`)
  }

  console.log(`\nUpdated ${updated} users`)
}

main()
  .catch((e) => {
    console.error("Error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
