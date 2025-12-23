// @fileoverview ESLint configuration for MRE project
// 
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
// 
// @description ESLint configuration using Next.js recommended rules
// 
// @purpose Configures ESLint with Next.js core web vitals and TypeScript rules.
//          This ensures code quality, consistency, and catches common errors
//          during development. The configuration uses Next.js recommended
//          settings for both web vitals and TypeScript linting.
// 
// @relatedFiles
// - package.json (ESLint dependencies)
// - tsconfig.json (TypeScript configuration)

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Repo-specific: skip large Python virtualenv + reports folders that break ESLint
    "ingestion/.venv/**",
    "ingestion/venv/**",
    "reports/**",
  ]),
]);

export default eslintConfig;
