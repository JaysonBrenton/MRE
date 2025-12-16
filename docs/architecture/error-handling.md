---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Comprehensive error handling and error codes catalog for MRE application
purpose: Provides complete documentation of error handling patterns, error codes, error
         response formats, and error handling best practices. Ensures consistent error
         handling across the application and provides clear guidance for developers.
relatedFiles:
  - src/lib/api-utils.ts (error response utilities)
  - docs/architecture/liverc-ingestion/05-api-contracts.md (error shape)
  - docs/architecture/liverc-ingestion/11-ingestion-error-handling.md (ingestion errors)
  - docs/api/api-reference.md (API error documentation)
---

# Error Handling and Error Codes Catalog

**Last Updated:** 2025-01-27  
**Scope:** All API endpoints and application error handling

This document provides comprehensive documentation of error handling patterns, error codes, and error handling best practices for the MRE application.

---

## Table of Contents

1. [Standard Error Response Format](#standard-error-response-format)
2. [Error Code Catalog](#error-code-catalog)
3. [HTTP Status Code Mappings](#http-status-code-mappings)
4. [Error Handling Patterns](#error-handling-patterns)
5. [When to Use Each Error Code](#when-to-use-each-error-code)
6. [Client-Side Error Handling](#client-side-error-handling)
7. [Server-Side Error Handling](#server-side-error-handling)
8. [Error Logging and Observability](#error-logging-and-observability)
9. [User-Facing vs Technical Errors](#user-facing-vs-technical-errors)
10. [Error Recovery Strategies](#error-recovery-strategies)

---

## Standard Error Response Format

All API errors follow a standardized format defined in `src/lib/api-utils.ts`:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Response Fields

- **`success`** (boolean): Always `false` for errors
- **`error.code`** (string): Machine-readable error code (see catalog below)
- **`error.message`** (string): Human-readable error message for display
- **`error.details`** (object, optional): Additional error context for debugging

### Example Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email and password are required",
    "details": {
      "field": "email",
      "reason": "missing"
    }
  }
}
```

---

## Error Code Catalog

### Application Error Codes

| Error Code | HTTP Status | Description | When to Use |
|------------|-------------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters or body | Missing required fields, invalid format, type mismatches |
| `INVALID_INPUT` | 400 | Invalid input data | Input validation failures in business logic |
| `INVALID_CREDENTIALS` | 401 | Invalid email or password | Authentication failures (prevents user enumeration) |
| `EMAIL_ALREADY_EXISTS` | 409 | Email is already registered | Duplicate email during registration |
| `NOT_FOUND` | 404 | Requested resource does not exist | Resource not found by ID or identifier |
| `INGESTION_IN_PROGRESS` | 409 | Ingestion already running | Concurrent ingestion attempts |
| `INGESTION_FAILED` | 500 | Ingestion process failed | Ingestion service errors |
| `INTERNAL_ERROR` | 500 | Unexpected server error | Unhandled exceptions, system errors |

### Ingestion-Specific Error Codes

See `docs/architecture/liverc-ingestion/11-ingestion-error-handling.md` for detailed ingestion error codes:

- `ConnectorHTTPError` - HTTP errors from LiveRC
- `EventPageFormatError` - Malformed event page
- `RacePageFormatError` - Malformed race page
- `LapTableMissingError` - Missing lap data
- `UnsupportedLiveRCVariantError` - Unsupported LiveRC format
- `NormalisationError` - Data normalization failures
- `PersistenceError` - Database errors

---

## HTTP Status Code Mappings

### Standard Mappings

| Error Code | HTTP Status | Rationale |
|------------|-------------|------------|
| `VALIDATION_ERROR` | 400 Bad Request | Client error - invalid input |
| `INVALID_INPUT` | 400 Bad Request | Client error - invalid input |
| `INVALID_CREDENTIALS` | 401 Unauthorized | Authentication failure |
| `NOT_FOUND` | 404 Not Found | Resource doesn't exist |
| `EMAIL_ALREADY_EXISTS` | 409 Conflict | Resource conflict |
| `INGESTION_IN_PROGRESS` | 409 Conflict | Operation conflict |
| `INGESTION_FAILED` | 500 Internal Server Error | Server-side processing error |
| `INTERNAL_ERROR` | 500 Internal Server Error | Unexpected server error |

### Status Code Guidelines

- **4xx (Client Errors):** User can fix the request
- **5xx (Server Errors):** Server-side issue, user should retry

---

## Error Handling Patterns

### Server-Side Pattern (API Routes)

```typescript
import { errorResponse, serverErrorResponse } from "@/lib/api-utils"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    if (!body.email || !body.password) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Email and password are required",
        undefined,
        400
      )
    }
    
    // Business logic
    const result = await someBusinessLogic(body)
    
    if (!result.success) {
      // Map business error to HTTP error
      const statusCode = result.error.code === "EMAIL_ALREADY_EXISTS" ? 409 : 400
      return errorResponse(
        result.error.code,
        result.error.message,
        undefined,
        statusCode
      )
    }
    
    return successResponse(result.data)
  } catch (error: unknown) {
    // Handle unexpected errors
    console.error("Unexpected error:", error)
    return serverErrorResponse("Failed to process request")
  }
}
```

### Business Logic Pattern (Core Functions)

```typescript
export type Result<T> = {
  success: true
  data: T
} | {
  success: false
  error: {
    code: string
    message: string
  }
}

export async function someBusinessLogic(input: Input): Promise<Result<Output>> {
  try {
    // Validation
    if (!input.email) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Email is required"
        }
      }
    }
    
    // Business logic
    const data = await processData(input)
    
    return {
      success: true,
      data
    }
  } catch (error: unknown) {
    // Handle unexpected errors
    console.error("Business logic error:", error)
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to process request"
      }
    }
  }
}
```

---

## When to Use Each Error Code

### VALIDATION_ERROR

**Use when:**
- Required fields are missing
- Field format is invalid (e.g., invalid email format)
- Type mismatches (e.g., string instead of number)
- Value out of range

**Example:**
```typescript
if (!body.email || !body.password) {
  return errorResponse(
    "VALIDATION_ERROR",
    "Email and password are required",
    undefined,
    400
  )
}
```

### INVALID_INPUT

**Use when:**
- Input passes format validation but fails business logic validation
- Cross-field validation fails
- Business rule violations

**Example:**
```typescript
if (startDate > endDate) {
  return {
    success: false,
    error: {
      code: "INVALID_INPUT",
      message: "Start date must be before end date"
    }
  }
}
```

### INVALID_CREDENTIALS

**Use when:**
- Authentication fails (wrong password)
- User not found (to prevent enumeration, return same error)

**Example:**
```typescript
const user = await findUserByEmail(email)
if (!user || !await verifyPassword(user, password)) {
  return {
    success: false,
    error: {
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password" // Generic message
    }
  }
}
```

**Security Note:** Always return the same error message for "user not found" and "wrong password" to prevent user enumeration attacks.

### EMAIL_ALREADY_EXISTS

**Use when:**
- User attempts to register with an existing email
- Unique constraint violation on email field

**Example:**
```typescript
const existingUser = await findUserByEmail(email)
if (existingUser) {
  return errorResponse(
    "EMAIL_ALREADY_EXISTS",
    "Email already registered",
    undefined,
    409
  )
}
```

### NOT_FOUND

**Use when:**
- Resource doesn't exist (by ID or identifier)
- Foreign key reference is invalid

**Example:**
```typescript
const event = await findEventById(eventId)
if (!event) {
  return errorResponse(
    "NOT_FOUND",
    "Event not found",
    undefined,
    404
  )
}
```

### INGESTION_IN_PROGRESS

**Use when:**
- Ingestion is already running for the same resource
- Concurrent ingestion attempts detected

**Example:**
```typescript
if (await isIngestionInProgress(eventId)) {
  return errorResponse(
    "INGESTION_IN_PROGRESS",
    "Ingestion already in progress for this event",
    undefined,
    409
  )
}
```

### INGESTION_FAILED

**Use when:**
- Ingestion service returns an error
- Ingestion process fails (connector, normalization, persistence errors)

**Example:**
```typescript
try {
  await ingestionClient.ingestEvent(eventId, depth)
} catch (error) {
  return errorResponse(
    "INGESTION_FAILED",
    error.message || "Ingestion failed",
    undefined,
    500
  )
}
```

### INTERNAL_ERROR

**Use when:**
- Unexpected exceptions
- System errors
- Unhandled errors

**Example:**
```typescript
catch (error: unknown) {
  console.error("Unexpected error:", error)
  return serverErrorResponse("Failed to process request")
  // serverErrorResponse uses INTERNAL_ERROR code
}
```

---

## Client-Side Error Handling

### Basic Pattern

```typescript
async function callAPI() {
  try {
    const response = await fetch('/api/v1/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    
    const result = await response.json()
    
    if (!result.success) {
      // Handle error
      handleError(result.error)
      return
    }
    
    // Handle success
    handleSuccess(result.data)
  } catch (error) {
    // Handle network errors
    handleNetworkError(error)
  }
}
```

### Error Handling Function

```typescript
function handleError(error: { code: string; message: string; details?: unknown }) {
  switch (error.code) {
    case 'VALIDATION_ERROR':
      // Show validation errors to user
      showValidationErrors(error.details)
      break
      
    case 'INVALID_CREDENTIALS':
      // Show generic authentication error
      showError('Invalid email or password')
      break
      
    case 'NOT_FOUND':
      // Show not found message
      showError('Resource not found')
      break
      
    case 'INTERNAL_ERROR':
      // Show generic error, log for debugging
      console.error('Server error:', error)
      showError('An error occurred. Please try again.')
      break
      
    default:
      // Show generic error
      showError(error.message || 'An error occurred')
  }
}
```

### Retry Logic

```typescript
async function callAPIWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('/api/v1/endpoint')
      const result = await response.json()
      
      if (result.success) {
        return result.data
      }
      
      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(result.error.message)
      }
      
      // Retry server errors (5xx)
      if (i < maxRetries - 1) {
        await sleep(1000 * (i + 1)) // Exponential backoff
        continue
      }
      
      throw new Error(result.error.message)
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error
      }
      await sleep(1000 * (i + 1))
    }
  }
}
```

---

## Server-Side Error Handling

### Error Response Utilities

Use `src/lib/api-utils.ts` utilities:

```typescript
import { errorResponse, serverErrorResponse } from "@/lib/api-utils"

// Standard error response
return errorResponse(
  "ERROR_CODE",
  "Error message",
  { /* optional details */ },
  400 // HTTP status
)

// Server error response (defaults to 500)
return serverErrorResponse("Internal server error")
```

### Error Logging

```typescript
try {
  // Business logic
} catch (error: unknown) {
  // Log error with context
  console.error("Operation failed:", {
    operation: "operationName",
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: { /* additional context */ }
  })
  
  // Return user-friendly error
  return serverErrorResponse("Failed to process request")
}
```

### Type Guards for Error Handling

```typescript
function hasErrorMessage(error: unknown): error is { message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  )
}

function isZodError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError
}

function isPrismaError(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  )
}
```

---

## Error Logging and Observability

### Logging Standards

**Always log:**
- Error code and message
- Stack trace (for unexpected errors)
- Request context (user ID, endpoint, parameters)
- Timestamp

**Example:**
```typescript
console.error("API Error:", {
  code: error.code,
  message: error.message,
  endpoint: "/api/v1/endpoint",
  method: "POST",
  userId: session?.user?.id,
  timestamp: new Date().toISOString(),
  stack: error.stack
})
```

### Error Observability

**Placeholder for future documentation:**
- Error tracking integration (e.g., Sentry)
- Error metrics and alerting
- Error dashboard setup
- Error rate monitoring

---

## User-Facing vs Technical Errors

### User-Facing Errors

Errors that should be displayed to users:

- `VALIDATION_ERROR` - Show specific field errors
- `INVALID_CREDENTIALS` - Show generic authentication error
- `EMAIL_ALREADY_EXISTS` - Show email already registered message
- `NOT_FOUND` - Show resource not found message

**Guidelines:**
- Use clear, actionable language
- Avoid technical jargon
- Provide guidance on how to fix the error
- Don't expose internal system details

### Technical Errors

Errors for logging and debugging:

- `INTERNAL_ERROR` - Log full details, show generic message to user
- `INGESTION_FAILED` - Log ingestion details, show generic message
- Database errors - Log full error, show generic message

**Guidelines:**
- Log full error details (stack trace, context)
- Show generic user-friendly message
- Include error code in logs for correlation
- Don't expose sensitive information to users

---

## Error Recovery Strategies

### Retryable Errors

Errors that can be retried:

- `INTERNAL_ERROR` (5xx) - Transient server errors
- `INGESTION_FAILED` - May succeed on retry
- Network errors - Transient connectivity issues

**Strategy:**
- Exponential backoff
- Maximum retry limit
- User notification on failure

### Non-Retryable Errors

Errors that should not be retried:

- `VALIDATION_ERROR` (4xx) - User must fix input
- `INVALID_CREDENTIALS` - User must provide correct credentials
- `NOT_FOUND` - Resource doesn't exist
- `EMAIL_ALREADY_EXISTS` - Conflict that won't resolve

**Strategy:**
- Show error immediately
- Provide guidance on how to fix
- Don't retry automatically

### Recovery Patterns

**Placeholder for future documentation:**
- Circuit breaker patterns
- Fallback strategies
- Graceful degradation
- Error recovery workflows

---

## Related Documentation

- [API Reference](../api/api-reference.md) - API endpoint error documentation
- [LiveRC Ingestion Error Handling](../architecture/liverc-ingestion/11-ingestion-error-handling.md) - Ingestion-specific errors
- [API Contracts](../architecture/liverc-ingestion/05-api-contracts.md) - Error shape specification
- [Observability Guide](../operations/observability-guide.md) - Error logging and monitoring

---

**End of Error Handling Documentation**

