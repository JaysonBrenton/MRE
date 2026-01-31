/**
 * @fileoverview NextAuth API route handler
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description NextAuth catch-all route for authentication endpoints
 *
 * @purpose This route handler exports NextAuth's handlers for GET and POST requests.
 *          NextAuth uses this catch-all route pattern to handle all authentication
 *          endpoints (e.g., /api/auth/signin, /api/auth/session). This is a
 *          NextAuth-specific pattern that doesn't follow the /api/v1/ structure
 *          but is required for NextAuth to function correctly.
 *
 * @relatedFiles
 * - src/lib/auth.ts (NextAuth configuration)
 * - docs/architecture/mobile-safe-architecture-guidelines.md (architecture rules)
 */

import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers
