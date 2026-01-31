import { PrismaClient } from "@prisma/client"
import argon2 from "argon2"

const prisma = new PrismaClient()

async function forceUpdatePassword(email: string, password: string) {
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      console.error(`User with email ${email} not found`)
      process.exit(1)
    }

    console.log(`Found user: ${user.email}, Driver: ${user.driverName}`)

    // Always update password hash to ensure it's correct
    console.log(`Updating password hash for ${email}...`)
    const newHash = await argon2.hash(password)

    // Update user
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash: newHash,
      },
    })

    console.log(`✓ Password updated successfully for ${email}`)

    // Verify it works
    const updatedUser = await prisma.user.findUnique({
      where: { email },
    })
    if (updatedUser) {
      const isValid = await argon2.verify(updatedUser.passwordHash, password)
      console.log(`✓ Password verification: ${isValid ? "PASSED" : "FAILED"}`)
    }
  } catch (error) {
    console.error("Error updating password:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

const email = process.argv[2]
const password = process.argv[3]

if (!email || !password) {
  console.error(
    'Usage: npx ts-node --compiler-options \'{"module":"commonjs"}\' scripts/force-update-password.ts <email> <password>'
  )
  process.exit(1)
}

forceUpdatePassword(email, password)
