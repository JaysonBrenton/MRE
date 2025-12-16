/**
 * @fileoverview Validation schemas (deprecated - use src/core/auth/validate-*.ts)
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Legacy validation schemas - these now re-export from core
 * 
 * @purpose This file provides backward-compatible validation exports that
 *          re-export from core validation files. New code should import
 *          directly from src/core/auth/validate-*.ts.
 * 
 * @deprecated Use src/core/auth/validate-register.ts instead
 * 
 * @relatedFiles
 * - src/core/auth/validate-register.ts (authoritative registration validation)
 */

import { z } from "zod"

// Re-export register schema from core for backward compatibility
export { registerSchema, type RegisterInput } from "@/core/auth/validate-register"

// Login schema (kept here for now, may move to core/auth/validate-login.ts in future)
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export type LoginInput = z.infer<typeof loginSchema>

