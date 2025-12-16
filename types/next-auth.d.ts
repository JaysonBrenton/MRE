/**
 * @fileoverview NextAuth TypeScript type declarations
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description TypeScript module augmentation for NextAuth Session, User, and JWT types
 * 
 * @purpose This file extends NextAuth's default types to include the isAdmin field
 *          in Session, User, and JWT interfaces. This ensures type safety when
 *          accessing admin status throughout the application. The types are
 *          consistent with the database schema and authentication logic.
 * 
 * @relatedFiles
 * - src/lib/auth.ts (NextAuth configuration using these types)
 * - prisma/schema.prisma (User model with isAdmin field)
 * - src/core/auth/session.ts (session management functions)
 */

import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      isAdmin: boolean
    }
  }

  interface User {
    id: string
    email: string
    name: string
    isAdmin: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    email: string
    name: string
    isAdmin: boolean
  }
}

