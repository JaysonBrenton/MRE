/**
 * Public API path checks (no NextAuth / server-only imports).
 */

export const publicApiPrefixes = [
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/health",
  "/api/v1/health",
  "/api/v1/telemetry/share",
] as const

export function isPublicApi(pathname: string): boolean {
  return publicApiPrefixes.some((prefix) => pathname.startsWith(prefix))
}
