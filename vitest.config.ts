/**
 * @fileoverview Vitest configuration for MRE project
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Vitest configuration for testing Next.js application
 *
 * @purpose Configures Vitest with Next.js path aliases, test environment,
 *          and coverage settings. Ensures tests can import from @/* paths
 *          and run in a Node.js environment suitable for testing API routes
 *          and core business logic.
 *
 * @relatedFiles
 * - package.json (test dependencies and scripts)
 * - tsconfig.json (TypeScript path aliases)
 */

import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/__tests__/",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
        ".next/",
        "prisma/",
        "ingestion/",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
