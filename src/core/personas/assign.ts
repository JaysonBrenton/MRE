/**
 * @fileoverview Persona assignment logic
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Business logic for assigning personas to users
 *
 * @purpose This file contains persona assignment logic, following the mobile-safe
 *          architecture requirement that business logic must reside in src/core/<domain>/.
 *          This logic can be reused by API routes, server actions, and future mobile clients.
 *
 * @relatedFiles
 * - src/core/personas/repo.ts (persona repository functions)
 * - src/core/auth/register.ts (registration integration)
 * - prisma/seed.ts (admin creation integration)
 */

import { prisma } from "@/lib/prisma"
import { getPersonaByType } from "./repo"
import type { PersonaType, User } from "@prisma/client"
import { logger } from "@/lib/logger"

/**
 * Assign Driver persona to user
 *
 * @param userId - User ID
 */
export async function assignDriverPersona(userId: string): Promise<void> {
  const driverPersona = await getPersonaByType("driver")
  if (!driverPersona) {
    logger.error("Driver persona not found in database", { userId })
    throw new Error("Driver persona not found")
  }

  await prisma.user.update({
    where: { id: userId },
    data: { personaId: driverPersona.id },
  })

  logger.info("Driver persona assigned to user", { userId, personaId: driverPersona.id })
}

/**
 * Assign Admin persona to user
 *
 * @param userId - User ID
 */
export async function assignAdminPersona(userId: string): Promise<void> {
  const adminPersona = await getPersonaByType("admin")
  if (!adminPersona) {
    logger.error("Admin persona not found in database", { userId })
    throw new Error("Admin persona not found")
  }

  await prisma.user.update({
    where: { id: userId },
    data: { personaId: adminPersona.id },
  })

  logger.info("Admin persona assigned to user", { userId, personaId: adminPersona.id })
}

/**
 * Assign Team Manager persona to user
 *
 * @param userId - User ID
 */
export async function assignTeamManagerPersona(userId: string): Promise<void> {
  const teamManagerPersona = await getPersonaByType("team_manager")
  if (!teamManagerPersona) {
    logger.error("Team Manager persona not found in database", { userId })
    throw new Error("Team Manager persona not found")
  }

  await prisma.user.update({
    where: { id: userId },
    data: { personaId: teamManagerPersona.id },
  })

  logger.info("Team Manager persona assigned to user", { userId, personaId: teamManagerPersona.id })
}

/**
 * Assign Race Engineer persona to user
 *
 * @param userId - User ID
 */
export async function assignRaceEngineerPersona(userId: string): Promise<void> {
  const raceEngineerPersona = await getPersonaByType("race_engineer")
  if (!raceEngineerPersona) {
    logger.error("Race Engineer persona not found in database", { userId })
    throw new Error("Race Engineer persona not found")
  }

  await prisma.user.update({
    where: { id: userId },
    data: { personaId: raceEngineerPersona.id },
  })

  logger.info("Race Engineer persona assigned to user", {
    userId,
    personaId: raceEngineerPersona.id,
  })
}

/**
 * Determine persona for user based on user properties
 *
 * Priority: Admin > Team Manager > Driver
 *
 * @param user - User object
 * @returns Persona type to assign
 */
export function getPersonaForUser(user: User): PersonaType {
  // Priority: Admin > Team Manager > Driver
  if (user.isAdmin) {
    return "admin"
  }

  if (user.isTeamManager && user.teamName) {
    return "team_manager"
  }

  return "driver"
}

/**
 * Auto-assign persona to user based on user properties
 *
 * @param userId - User ID
 */
export async function autoAssignPersona(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    throw new Error("User not found")
  }

  const personaType = getPersonaForUser(user)

  switch (personaType) {
    case "admin":
      await assignAdminPersona(userId)
      break
    case "team_manager":
      await assignTeamManagerPersona(userId)
      break
    case "driver":
      await assignDriverPersona(userId)
      break
    default:
      // Race Engineer is manually selectable, not auto-assigned
      logger.warn("No auto-assignment for persona type", { userId, personaType })
  }
}
