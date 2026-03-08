// @fileoverview Prisma seed script (CommonJS) to avoid TS/ESM tooling issues
// Creates base personas and an admin user.

/* eslint-disable @typescript-eslint/no-var-requires */

const { PrismaClient } = require("@prisma/client")
const argon2 = require("argon2")

const prisma = new PrismaClient()

async function main() {
  const personas = [
    {
      type: "driver",
      name: "Driver",
      description: "Individual RC racer who participates in events and tracks their performance",
    },
    {
      type: "admin",
      name: "Administrator",
      description: "System administrator with elevated privileges for managing the application",
    },
    {
      type: "team_manager",
      name: "Team Manager",
      description: "Manager of a team of one or more drivers, coordinates team activities",
    },
    {
      type: "race_engineer",
      name: "Race Engineer",
      description: "AI-backed assistant providing setup and tuning guidance",
    },
  ]

  for (const personaData of personas) {
    const existingPersona = await prisma.persona.findUnique({
      where: { type: personaData.type },
    })

    if (!existingPersona) {
      await prisma.persona.create({ data: personaData })
      // eslint-disable-next-line no-console
      console.log(`Created persona: ${personaData.name}`)
    } else {
      // eslint-disable-next-line no-console
      console.log(`Persona already exists: ${personaData.name}`)
    }
  }

  const adminEmail = (process.env.ADMIN_EMAIL || "admin@mre.local").toLowerCase().trim()
  const adminPassword = process.env.ADMIN_PASSWORD || "Wilier2013"
  const adminDriverName = process.env.ADMIN_DRIVER_NAME || "Administrator"

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  })

  if (existingAdmin) {
    // eslint-disable-next-line no-console
    console.log(`Admin user with email ${adminEmail} already exists. Skipping creation.`)
    return
  }

  const passwordHash = await argon2.hash(adminPassword)

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      driverName: adminDriverName,
      teamName: null,
      isAdmin: true,
    },
  })

  // Assign admin persona if it exists
  const adminPersona = await prisma.persona.findUnique({
    where: { type: "admin" },
  })

  if (adminPersona) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { personaId: adminPersona.id },
    })
    // eslint-disable-next-line no-console
    console.log("Admin persona assigned to user")
  } else {
    // eslint-disable-next-line no-console
    console.warn("Admin persona not found; skipping persona assignment")
  }

  // eslint-disable-next-line no-console
  console.log("Admin user created successfully:")
  // eslint-disable-next-line no-console
  console.log(`  Email: ${admin.email}`)
  // eslint-disable-next-line no-console
  console.log(`  Driver Name: ${admin.driverName}`)
  // eslint-disable-next-line no-console
  console.log(`  Password: ${adminPassword} (change this after first login!)`)
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error("Error seeding database:", e)
    // eslint-disable-next-line n/no-process-exit
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

