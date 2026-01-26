/**
 * @fileoverview Feature descriptions for under-development pages
 *
 * @created 2026-01-27
 * @creator Auto-generated
 * @lastModified 2026-01-27
 *
 * @description Centralized mapping of routes to feature descriptions for display
 *              on the under-development page. Descriptions are extracted from
 *              navigation labels and existing documentation.
 *
 * @purpose Provides feature-specific context when users navigate to features
 *          that are not yet implemented, enhancing user understanding of
 *          upcoming functionality.
 */

/**
 * Feature description mapping
 * Maps route patterns to feature names and descriptions
 */
export const FEATURE_DESCRIPTIONS: Record<string, { name: string; description: string }> = {
  "/dashboard/my-telemetry": {
    name: "My Telemetry",
    description: "Connect data sources and view telemetry traces",
  },
  "/dashboard/my-engineer": {
    name: "My Engineer",
    description: "Racing intelligence hub",
  },
  "/dashboard/profile": {
    name: "Profile",
    description: "Manage your account settings and preferences",
  },
  "/dashboard/data-sources": {
    name: "Data Sources",
    description: "Configure and manage telemetry data sources",
  },
  "/dashboard/all-events": {
    name: "All Events",
    description: "View and manage all your racing events",
  },
  "/dashboard/my-club": {
    name: "My Club",
    description: "Home club dashboard & community",
  },
  "/dashboard/my-club/track-maps": {
    name: "Track Maps",
    description: "Build and share track layouts",
  },
  "/dashboard/my-team": {
    name: "My Team",
    description: "Team dashboard & insights",
  },
}

/**
 * Pattern-based matching for dynamic routes
 * These patterns are matched against routes that contain parameters
 */
export const FEATURE_PATTERNS: Array<{
  pattern: RegExp
  name: string
  description: string
}> = [
  {
    pattern: /^\/drivers\/[^/]+$/,
    name: "Driver Profile",
    description: "View detailed driver profile and statistics",
  },
  {
    pattern: /^\/dashboard\/my-club\/track-maps\/[^/]+$/,
    name: "Track Map Editor",
    description: "Edit and customize track map layouts",
  },
  {
    pattern: /^\/dashboard\/my-club\/track-maps\/shared\/[^/]+$/,
    name: "Shared Track Map",
    description: "View shared track map",
  },
]

/**
 * Get feature description for a given route
 * @param route - The route path (e.g., "/dashboard/my-telemetry")
 * @returns Feature information with name and description, or null if not found
 */
export function getFeatureDescription(
  route: string | null | undefined,
): { name: string; description: string } | null {
  if (!route) {
    return null
  }

  // Normalize route (remove query params, trailing slashes)
  const normalizedRoute = route.split("?")[0].replace(/\/$/, "")

  // Check exact matches first
  if (FEATURE_DESCRIPTIONS[normalizedRoute]) {
    return FEATURE_DESCRIPTIONS[normalizedRoute]
  }

  // Check pattern matches for dynamic routes
  for (const { pattern, name, description } of FEATURE_PATTERNS) {
    if (pattern.test(normalizedRoute)) {
      return { name, description }
    }
  }

  return null
}

