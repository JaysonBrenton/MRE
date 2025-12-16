/**
 * @fileoverview Registration validation logic
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Validation schema and functions for user registration
 * 
 * @purpose Contains registration-specific validation logic, following the
 *          architecture requirement that all validation must occur in
 *          src/core/<domain>/validate-*.ts files. This ensures validation
 *          is separated from API routes and can be reused.
 * 
 * @relatedFiles
 * - src/core/auth/register.ts (uses this validation)
 * - src/core/users/repo.ts (checks for existing users)
 */

import { z } from "zod"
import { PASSWORD_REQUIREMENTS, COMMON_PASSWORDS } from "./constants"
import { normalizeEmail } from "../common/email"

/**
 * Zod schema for user registration input validation
 * 
 * Email is normalized to lowercase during validation to ensure consistent storage
 * and lookups, as email addresses should be treated as case-insensitive per RFC 5321.
 * 
 * Password validation includes complexity requirements to prevent weak passwords.
 */
export const registerSchema = z.object({
  email: z.string().email("Invalid email address").transform((val) => normalizeEmail(val)),
  password: z
    .string()
    .min(PASSWORD_REQUIREMENTS.minLength, `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`)
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .refine(
      (pwd) => !COMMON_PASSWORDS.includes(pwd.toLowerCase() as typeof COMMON_PASSWORDS[number]),
      {
        message: "Password is too common. Please choose a more secure password.",
      }
    ),
  driverName: z.string().min(1, "Driver name is required"),
  teamName: z.string().optional(),
})

/**
 * Type inference from register schema
 */
export type RegisterInput = z.infer<typeof registerSchema>

/**
 * Validates registration input data
 * 
 * @param data - Raw registration data to validate
 * @returns Validated data or throws ZodError
 */
export function validateRegisterInput(data: unknown): RegisterInput {
  return registerSchema.parse(data)
}

