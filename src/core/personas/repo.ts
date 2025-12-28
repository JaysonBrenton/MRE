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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { persona: true }
  })

  return user?.persona || null
}

