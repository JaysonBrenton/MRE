/**
 * @fileoverview Test setup file for Vitest
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Global test setup and configuration
 * 
 * @purpose Configures test environment, mocks, and global test utilities.
 *          This file runs before all tests and sets up the testing environment.
 */

// Mock environment variables for tests
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test"
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "test-secret-key-for-testing-only"
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || "http://localhost:3001"

