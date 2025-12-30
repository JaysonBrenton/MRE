/**
 * @fileoverview Persona repository functions
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Repository functions for persona data access
 * 
 * @purpose This file contains database access functions for personas,
 *          following the mobile-safe architecture requirement that database
 *          access must reside in src/core/<domain>/repo.ts. These functions
 *          can be reused by API routes, server actions, and future mobile clients.
 * 
 * @relatedFiles
 * - prisma/schema.prisma (Persona model)
 * - src/core/personas/assign.ts (persona assignment logic)
 */

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import type { Persona, PersonaType } from "@prisma/client"

/**
 * Get persona by ID
 * 
 * @param id - Persona ID
 * @returns Persona or null if not found
 */
export async function getPersonaById(id: string): Promise<Persona | null> {
  return prisma.persona.findUnique({
    where: { id }
  })
}

/**
 * Get persona by type
 * 
 * @param type - Persona type
 * @returns Persona or null if not found
 */
export async function getPersonaByType(type: PersonaType): Promise<Persona | null> {
  return prisma.persona.findUnique({
    where: { type }
  })
}

/**
 * Get all available personas
 * 
 * @returns List of all personas
 */
export async function getAllPersonas(): Promise<Persona[]> {
  return prisma.persona.findMany({
    orderBy: { createdAt: "asc" }
  })
}

/**
 * Get user's current persona
 * 
 * @param userId - User ID
 * @returns Persona or null if user has no persona assigned
 */
export async function getUserPersona(userId: string): Promise<Persona | null> {
  // Defensive check to ensure prisma client is initialized
  if (!prisma) {
    throw new Error("Prisma client is not initialized")
  }

  try {
    const result = await prisma.$queryRaw<Array<{ persona_id: string | null }>>(
      Prisma.sql`
        SELECT "persona_id"
        FROM "users"
        WHERE "id" = ${userId}
        LIMIT 1
      `
    )

    const personaId = result[0]?.persona_id
    if (!personaId) {
      return null
    }

    return prisma.persona.findUnique({
      where: { id: personaId }
    })
  } catch (error) {
    // Provide helpful error message if prisma.persona is undefined
    if (error instanceof TypeError && 
        (error.message.includes("Cannot read properties of undefined") || 
         error.message.includes("Cannot read property"))) {
      throw new Error(`Prisma client persona model is not available. This usually means the Prisma client needs to be regenerated or the dev server needs to be restarted. Try running: npx prisma generate and restart the dev server. Original error: ${error.message}`)
    }
    throw error
  }
}
