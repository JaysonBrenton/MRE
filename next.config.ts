/**
 * @fileoverview Next.js configuration
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Next.js build and runtime configuration
 * 
 * @purpose Configures Next.js build settings, specifically excluding argon2
 *          from Edge Runtime and client-side bundling. Argon2 is a native Node.js
 *          module that cannot run in Edge Runtime or browser environments. This
 *          configuration ensures argon2 is only used in Node.js runtime contexts
 *          (API routes and server components) where it's needed for password hashing.
 * 
 * @relatedFiles
 * - src/core/auth/register.ts (uses argon2 for password hashing)
 * - src/core/auth/login.ts (uses argon2 for password verification)
 * - docs/architecture/mobile-safe-architecture-guidelines.md (security requirements)
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude argon2 from Edge Runtime bundling
  // argon2 is a native Node.js module that cannot run in Edge Runtime
  // It should only be used in API routes and server components (Node.js runtime)
  serverExternalPackages: ["argon2"],
  webpack: (config, { isServer }) => {
    // Exclude argon2 from client-side bundling
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
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
};

export default nextConfig;
