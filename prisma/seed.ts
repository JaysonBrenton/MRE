import { PrismaClient } from "@prisma/client"
import argon2 from "argon2"
import { assignAdminPersona } from "../src/core/personas/assign"

const prisma = new PrismaClient()

async function main() {
  // Create default personas if they don't exist
  const personas = [
    {
      type: "driver" as const,
      name: "Driver",
      description: "Individual RC racer who participates in events and tracks their performance"
    },
    {
      type: "admin" as const,
      name: "Administrator",
      description: "System administrator with elevated privileges for managing the application"
    },
    {
      type: "team_manager" as const,
      name: "Team Manager",
      description: "Manager of a team of one or more drivers, coordinates team activities"
    },
    {
      type: "race_engineer" as const,
      name: "Race Engineer",
      description: "AI-backed assistant providing setup and tuning guidance"
    }
  ]

  for (const personaData of personas) {
    const existingPersona = await prisma.persona.findUnique({
      where: { type: personaData.type }
    })

    if (!existingPersona) {
      await prisma.persona.create({
        data: personaData
      })
      console.log(`Created persona: ${personaData.name}`)
    } else {
      console.log(`Persona already exists: ${personaData.name}`)
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@mre.local"
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123456"
  const adminDriverName = process.env.ADMIN_DRIVER_NAME || "Administrator"

  // Normalize email to lowercase for consistent storage
  const normalizedEmail = adminEmail.toLowerCase().trim()

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  })

  if (existingAdmin) {
    console.log(`Admin user with email ${normalizedEmail} already exists. Skipping creation.`)
    return
  }

  // Hash password using Argon2id (required by mobile-safe architecture guidelines)
  const passwordHash = await argon2.hash(adminPassword)

  // Create admin user (email is already normalized)
  const admin = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      driverName: adminDriverName,
      teamName: null,
      isAdmin: true,
    }
  })

  // Auto-assign Admin persona
  try {
    await assignAdminPersona(admin.id)
    console.log(`Admin persona assigned to user`)
  } catch (error) {
    console.error(`Failed to assign Admin persona:`, error)
    // Continue even if persona assignment fails
  }

  console.log(`Admin user created successfully:`)
  console.log(`  Email: ${admin.email}`)
  console.log(`  Driver Name: ${admin.driverName}`)
  console.log(`  Password: ${adminPassword} (change this after first login!)`)
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

