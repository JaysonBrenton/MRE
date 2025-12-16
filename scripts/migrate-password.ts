/**
 * @fileoverview Password migration script - converts bcryptjs hashes to Argon2id
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Migrates user passwords from bcryptjs to Argon2id
 * 
 * @purpose This script updates existing user passwords that were hashed with bcryptjs
 *          to use Argon2id. This is a one-time migration script.
 * 
 * @usage node -r ts-node/register scripts/migrate-password.ts <email> <password>
 */

import { PrismaClient } from "@prisma/client"
import argon2 from "argon2"

const prisma = new PrismaClient()

async function migratePassword(email: string, password: string) {
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      console.error(`User with email ${email} not found`)
      process.exit(1)
    }

    // Check if password is already Argon2id (starts with $argon2)
    if (user.passwordHash.startsWith("$argon2")) {
      console.log(`Password for ${email} is already using Argon2id`)
      process.exit(0)
    }

    // Hash password with Argon2id
    console.log(`Migrating password for ${email}...`)
    const newHash = await argon2.hash(password)

    // Update user
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash: newHash
      }
    })

    console.log(`✓ Password migrated successfully for ${email}`)
  } catch (error) {
    console.error("Error migrating password:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

const email = process.argv[2]
const password = process.argv[3]

if (!email || !password) {
  console.error("Usage: node -r ts-node/register scripts/migrate-password.ts <email> <password>")
  process.exit(1)
}

migratePassword(email, password)

