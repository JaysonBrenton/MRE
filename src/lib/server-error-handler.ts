/**
 * @fileoverview Server-side error handling utilities
 * 
 * @created 2025-01-27
 * @creator Auto (AI Code Reviewer)
 * @lastModified 2025-01-27
 * 
 * @description Utilities for handling and logging server-side errors
 * 
 * @purpose Provides standardized error handling for API routes and server actions.
 *          Categorizes errors and logs them with appropriate context.
 * 
 * @relatedFiles
 * - src/lib/logger.ts (structured logging)
 * - src/lib/request-context.ts (request context)
 */

import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { logger, createLoggerWithContext } from "./logger"
import { getRequestContext } from "./request-context"

/**
 * Handle API route errors with logging
 * 
 * @param error - The error to handle
 * @param request - Next.js request object
 * @param requestId - Optional request ID
 * @param userId - Optional user ID
 * @returns Error information for API response
 */
export function handleApiError(
  error: unknown,
  request: NextRequest,
  requestId?: string,
  userId?: string
): { message: string; code: string; statusCode: number } {
  const context = getRequestContext(request, requestId, userId)
  const requestLogger = createLoggerWithContext(context)

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(error, requestLogger)
  }

  // Handle Prisma connection errors
  if (error instanceof Prisma.PrismaClientInitializationError) {
    requestLogger.error("Database connection error", {
      error: {
        name: error.name,
        message: error.message,
      },
    })
    return {
      message: "Database connection failed",
      code: "DATABASE_ERROR",
      statusCode: 500,
    }
  }

  // Handle Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    requestLogger.error("Database validation error", {
      error: {
        name: error.name,
        message: error.message,
      },
    })
    return {
      message: "Invalid database query",
      code: "VALIDATION_ERROR",
      statusCode: 400,
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    requestLogger.error("API error", {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    })
    return {
      message: error.message || "Internal server error",
      code: "INTERNAL_ERROR",
      statusCode: 500,
    }
  }

  // Handle unknown errors
  requestLogger.error("Unknown API error", {
    error: String(error),
  })
  return {
    message: "Internal server error",
    code: "INTERNAL_ERROR",
    statusCode: 500,
  }
}

/**
 * Handle Prisma database errors
 * 
 * @param error - Prisma error
 * @param requestLogger - Logger instance with request context
 * @returns Error information for API response
 */
export function handlePrismaError(
  error: Prisma.PrismaClientKnownRequestError,
  requestLogger: ReturnType<typeof createLoggerWithContext>
): { message: string; code: string; statusCode: number } {
  const errorContext: Record<string, unknown> = {
    code: error.code,
    meta: error.meta,
  }

  switch (error.code) {
    case "P2002":
      // Unique constraint violation
      requestLogger.warn("Database unique constraint violation", errorContext)
      return {
        message: "A record with this value already exists",
        code: "DUPLICATE_ENTRY",
        statusCode: 409,
      }

    case "P2025":
      // Record not found
      requestLogger.warn("Database record not found", errorContext)
      return {
        message: "Record not found",
        code: "NOT_FOUND",
        statusCode: 404,
      }

    case "P2003":
      // Foreign key constraint violation
      requestLogger.warn("Database foreign key constraint violation", errorContext)
      return {
        message: "Invalid reference to related record",
        code: "FOREIGN_KEY_ERROR",
        statusCode: 400,
      }

    case "P2014":
      // Required relation violation
      requestLogger.warn("Database required relation violation", errorContext)
      return {
        message: "Required relation is missing",
        code: "RELATION_ERROR",
        statusCode: 400,
      }

    case "P2021":
      // Table does not exist
      requestLogger.error("Database table does not exist", errorContext)
      return {
        message: "Database configuration error",
        code: "DATABASE_ERROR",
        statusCode: 500,
      }

    case "P2024":
      // Connection timeout
      requestLogger.error("Database connection timeout", errorContext)
      return {
        message: "Database connection timeout",
        code: "DATABASE_TIMEOUT",
        statusCode: 503,
      }

    default:
      // Unknown Prisma error
      requestLogger.error("Unknown Prisma error", {
        ...errorContext,
        error: {
          name: error.name,
          message: error.message,
        },
      })
      return {
        message: "Database error occurred",
        code: "DATABASE_ERROR",
        statusCode: 500,
      }
  }
}

/**
 * Handle external service errors
 * 
 * @param error - The error from external service
 * @param serviceName - Name of the external service
 * @param endpoint - Endpoint that failed
 * @param requestLogger - Logger instance with request context
 * @returns Error information
 */
export function handleExternalServiceError(
  error: unknown,
  serviceName: string,
  endpoint: string,
  requestLogger: ReturnType<typeof createLoggerWithContext>
): { message: string; code: string; statusCode: number } {
  if (error instanceof Error) {
    // Check for timeout errors
    if (error.message.includes("timeout") || error.name === "TimeoutError") {
      requestLogger.error("External service timeout", {
        service: serviceName,
        endpoint,
        error: {
          name: error.name,
          message: error.message,
        },
      })
      return {
        message: `${serviceName} service timeout`,
        code: "SERVICE_TIMEOUT",
        statusCode: 504,
      }
    }

    // Check for connection errors
    if (
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("network")
    ) {
      requestLogger.error("External service connection error", {
        service: serviceName,
        endpoint,
        error: {
          name: error.name,
          message: error.message,
        },
      })
      return {
        message: `${serviceName} service unavailable`,
        code: "SERVICE_UNAVAILABLE",
        statusCode: 503,
      }
    }

    // Generic error
    requestLogger.error("External service error", {
      service: serviceName,
      endpoint,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    })
  } else {
    requestLogger.error("Unknown external service error", {
      service: serviceName,
      endpoint,
      error: String(error),
    })
  }

  return {
    message: `${serviceName} service error`,
    code: "EXTERNAL_SERVICE_ERROR",
    statusCode: 502,
  }
}

