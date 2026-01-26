/**
 * Script to create a user in the database
 * 
 * Usage: docker exec mre-app npx ts-node --compiler-options '{"module":"commonjs"}' scripts/create-user.ts
 */

import { PrismaClient } from "@prisma/client"
import argon2 from "argon2"

const prisma = new PrismaClient()

/**
 * Normalize email to lowercase and trim whitespace
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

/**
 * Normalize driver name using strong normalization
 */
function normalizeDriverName(name: string): string {
  if (!name) {
    return ""
  }
  
  // Step 1: Lowercase
  let normalized = name.toLowerCase()
  
  // Step 2: Replace special separators with spaces before collapsing whitespace
  normalized = normalized
    .replace(/&/g, " and ")
    .replace(/[-_]/g, " ")
    .replace(/'/g, "")
  
  // Step 3: Strip punctuation (except spaces) and collapse whitespace
  normalized = normalized
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .join(" ")
    .trim()
  
  const hadHyphen = /-/g.test(name)

  // Step 6: Remove common suffix noise tokens
  const noiseTokens = ["rc", "raceway", "club", "inc", "team"]
  const tokens = normalized.split(" ")
  // Remove noise tokens from end of name
  while (tokens.length > 0 && noiseTokens.includes(tokens[tokens.length - 1])) {
    tokens.pop()
  }
  normalized = tokens.join(" ")
  
  // Step 7: Token sorting for multi-word names
  if (tokens.length > 1) {
    const shouldSortTokens = tokens.length <= 2 || !hadHyphen
    const sortedTokens = shouldSortTokens ? [...tokens].sort() : tokens
    normalized = sortedTokens.join(" ")
  }
  
  // Final trim
  return normalized.trim()
}

async function main() {
  const email = "Jimmy.Horne@local.com"
  const driverName = "Jimmy Horne"
  const password = "Wilier2013"

  // Normalize email to lowercase for consistent storage
  const normalizedEmail = normalizeEmail(email)

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  })

  if (existingUser) {
    console.log(`User with email ${normalizedEmail} already exists.`)
    console.log(`  ID: ${existingUser.id}`)
    console.log(`  Driver Name: ${existingUser.driverName}`)
    return
  }

  // Hash password using Argon2id
  const passwordHash = await argon2.hash(password)

  // Get Driver persona
  const driverPersona = await prisma.persona.findUnique({
    where: { type: "driver" }
  })
  
  if (!driverPersona) {
    console.error("Driver persona not found in database. Please run seed script first.")
    process.exit(1)
  }

  // Normalize driver name
  const normalizedName = normalizeDriverName(driverName)

  // Create user and assign persona in a transaction
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        driverName,
        normalizedName,
        teamName: null,
        isAdmin: false,
        transponderNumber: null,
        personaId: driverPersona.id,
      },
      select: {
        id: true,
        email: true,
        driverName: true,
        teamName: true,
        isAdmin: true,
        personaId: true,
        createdAt: true,
      },
    })

    return newUser
  })

  console.log(`User created successfully:`)
  console.log(`  ID: ${user.id}`)
  console.log(`  Email: ${user.email}`)
  console.log(`  Driver Name: ${user.driverName}`)
  console.log(`  Persona ID: ${user.personaId}`)
  console.log(`  Created At: ${user.createdAt}`)
}

main()
  .catch((e) => {
    console.error("Error creating user:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
