/**
 * @fileoverview Next.js configuration
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Next.js build and runtime configuration
 *
 * @purpose Configures Next.js build settings, including:
 *          - Webpack polling for file watching (enables hot reload in Docker/Colima)
 *          - Excluding argon2 from Edge Runtime and client-side bundling
 *          - Request size limits for DoS protection
 *          Argon2 is a native Node.js module that cannot run in Edge Runtime or
 *          browser environments. This configuration ensures argon2 is only used
 *          in Node.js runtime contexts (API routes and server components) where
 *          it's needed for password hashing.
 *
 * @relatedFiles
 * - src/core/auth/register.ts (uses argon2 for password hashing)
 * - src/core/auth/login.ts (uses argon2 for password verification)
 * - docs/architecture/mobile-safe-architecture-guidelines.md (security requirements)
 */

import type { NextConfig } from "next"

// Import env to trigger build-time validation
// This ensures all required environment variables are set before the app starts
import "./src/lib/env"

const nextConfig: NextConfig = {
  // Exclude argon2 from Edge Runtime bundling
  // argon2 is a native Node.js module that cannot run in Edge Runtime
  // It should only be used in API routes and server components (Node.js runtime)
  serverExternalPackages: ["argon2"],
  webpack: (config, { isServer }) => {
    // Enable polling for file watching (required for Docker/Colima environments)
    // Polling is more reliable than native file system events in containerized environments
    config.watchOptions = {
      poll: 1000, // Check for file changes every 1 second
      aggregateTimeout: 300, // Wait 300ms after detecting changes before rebuilding (batches rapid edits)
      ignored: /node_modules/, // Ignore node_modules to reduce polling overhead
    }

    // Exclude argon2 and Prisma from client-side bundling
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
      // Exclude Prisma client from client bundles
      config.externals = config.externals || []
      if (Array.isArray(config.externals)) {
        config.externals.push("@prisma/client")
      } else {
        config.externals = [config.externals, "@prisma/client"]
      }
    }
    return config
  },
  // Request size limits to protect against DoS attacks
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb", // Limit server actions body size
    },
  },
  // Note: API route body size limits are handled at the route level
  // or via middleware in Next.js App Router. Individual routes should
  // validate request sizes as needed.
}

export default nextConfig
