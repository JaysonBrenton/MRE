/**
 * @fileoverview Environment variable validation and type-safe access
 *
 * @created 2025-01-27
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-01-27
 *
 * @description Validates and provides type-safe access to environment variables
 *
 * @purpose Ensures all required environment variables are set and valid at startup.
 *          Fails fast with clear error messages if configuration is invalid.
 *          Provides type-safe access to environment variables throughout the application.
 *
 * @relatedFiles
 * - docker-compose.yml (environment variable definitions)
 * - next.config.ts (Next.js configuration)
 */

import { z } from "zod"

/**
 * Environment variable schema
 * Validates all required environment variables at startup
 */
const envSchema = z
  .object({
    // Database
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

    // Authentication
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters long"),

    // Node environment
    NODE_ENV: z.enum(["development", "production", "test"], {
      message: "NODE_ENV must be 'development', 'production', or 'test'",
    }),

    // Application configuration
    APP_URL: z.string().url("APP_URL must be a valid URL"),

    // Optional configuration with defaults
    PORT: z.string().optional(),
    HOST: z.string().optional(),
    TZ: z.string().optional(),
    INGESTION_SERVICE_URL: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    // Only reject default AUTH_SECRET in production
    if (
      data.NODE_ENV === "production" &&
      data.AUTH_SECRET === "development-secret-change-in-production"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AUTH_SECRET must not use the default development value in production",
        path: ["AUTH_SECRET"],
      })
    }

    // INGESTION_SERVICE_URL is required in production, optional in development
    if (data.NODE_ENV === "production" && !data.INGESTION_SERVICE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "INGESTION_SERVICE_URL is required in production environment",
        path: ["INGESTION_SERVICE_URL"],
      })
    }

    // APP_URL validation: should be HTTPS in production (warning, not error)
    if (data.NODE_ENV === "production" && data.APP_URL.startsWith("http://")) {
      // Note: This is a warning-level issue, not blocking
      // In strict production deployments, you may want to enforce HTTPS
    }
  })

/**
 * Validated environment variables
 * Throws error at import time if validation fails
 */
export const env = (() => {
  try {
    return envSchema.parse({
      DATABASE_URL: process.env.DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET,
      NODE_ENV: process.env.NODE_ENV || "development",
      APP_URL: process.env.APP_URL || "http://localhost:3001",
      PORT: process.env.PORT,
      HOST: process.env.HOST,
      TZ: process.env.TZ,
      INGESTION_SERVICE_URL: process.env.INGESTION_SERVICE_URL,
    })
  } catch (error) {
    // Handle ZodError - check for errors array in multiple ways for compatibility
    if (error && typeof error === "object") {
      const errorObj = error as { errors?: unknown[]; issues?: unknown[] }

      // Try to get errors array (ZodError uses 'errors', some versions use 'issues')
      const errors = Array.isArray(errorObj.errors)
        ? errorObj.errors
        : Array.isArray(errorObj.issues)
          ? errorObj.issues
          : null

      if (errors && errors.length > 0) {
        const errorMessages = errors
          .map((err: unknown) => {
            if (err && typeof err === "object") {
              const zodErr = err as { path?: (string | number)[]; message?: string }
              const path = Array.isArray(zodErr.path) ? zodErr.path.join(".") : "unknown"
              const message = zodErr.message || "validation failed"
              return `${path}: ${message}`
            }
            return "validation failed"
          })
          .join("\n")
        throw new Error(`Environment variable validation failed:\n${errorMessages}`)
      }
    }

    // Re-throw non-Zod errors as-is
    throw error
  }
})()

/**
 * Type-safe environment variable access
 * Use this instead of process.env throughout the application
 */
export type Env = z.infer<typeof envSchema>
