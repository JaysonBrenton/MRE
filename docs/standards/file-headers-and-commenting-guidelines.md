---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Mandatory standards for file headers and code commenting
purpose: Establishes mandatory standards for file headers and code commenting across all
         files in the MRE project (code, documentation, configuration). These standards
         ensure consistency, maintainability, clear documentation of code ownership and
         purpose, and facilitate collaboration between developers and AI assistants. All
         files created or modified must comply with these guidelines.
relatedFiles:
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/adr/ADR-20250127-adopt-mobile-safe-architecture.md
---

# File Headers and Code Commenting Guidelines

**Last updated:** 2025-01-27  
**Owner:** Jayson Brenton  
**Applies to:** All files in the MRE project (code, documentation, configuration)

This document establishes mandatory standards for file headers and code commenting across all files in the MRE project. These standards ensure consistency, maintainability, clear documentation of code ownership and purpose, and facilitate collaboration between developers and AI assistants.

All files created or modified must comply with these guidelines.

---

## Table of Contents

1. [File Header Standards](#1-file-header-standards)
2. [Header Format Examples](#2-header-format-examples)
3. [Code Commenting Standards](#3-code-commenting-standards)
4. [Maintenance Guidelines](#4-maintenance-guidelines)
5. [LLM Behavior and Guardrails](#5-llm-behavior-and-guardrails)
6. [Quick Reference Checklist](#6-quick-reference-checklist)

---

## 1. File Header Standards

### 1.1 Required Header Fields

Every file in the MRE project must include a header with the following fields:

1. **Date Created** - The date the file was originally created (ISO 8601 format: YYYY-MM-DD)
2. **Creator** - The name of the person who created the file (default: Jayson Brenton)
3. **Last Modified** - The date the file was last modified (ISO 8601 format: YYYY-MM-DD)
4. **Description** - A brief one-line description of what the file contains or does
5. **Purpose** - A more detailed explanation of the file's purpose and role in the system
6. **Related Files** - Optional list of related files or dependencies (useful for understanding context)

### 1.2 Header Format by File Type

#### TypeScript and JavaScript Files

Use JSDoc-style block comments at the top of the file:

```typescript
/**
 * @fileoverview Brief description of the file
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description One-line description of what this file does
 * 
 * @purpose Detailed explanation of the file's purpose, its role in the system,
 *          and any important architectural considerations.
 * 
 * @relatedFiles
 * - Related file paths or module names
 * - Additional context or dependencies
 */
```

#### Markdown Documentation Files

Use YAML frontmatter at the top of the file:

```markdown
---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Brief description of the document
purpose: Detailed explanation of the document's purpose and scope
relatedFiles:
  - Path to related files
  - Additional context
---

# Document Title
```

#### JSON Configuration Files

JSON does not support comments natively. For JSON files:

- Include metadata in a `_meta` object at the top (if the JSON structure allows)
- Or maintain header information in a separate README or documentation file
- For JSON files that support comments (like `.jsonc`), use the same format as TypeScript

#### YAML Configuration Files

Use YAML comments at the top:

```yaml
# @fileoverview Brief description of the file
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description One-line description
# 
# @purpose Detailed explanation of purpose
# 
# @relatedFiles
# - Related file paths

# Actual YAML content starts here
```

#### Prisma Schema Files

Use Prisma comments (double slashes) at the top:

```prisma
// @fileoverview Brief description of the schema
// 
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
// 
// @description One-line description
// 
// @purpose Detailed explanation of the database schema and its purpose
// 
// @relatedFiles
// - Related migration files
// - Related seed files

// Actual Prisma schema starts here
```

#### CSS and Style Files

Use CSS comments at the top:

```css
/**
 * @fileoverview Brief description of the stylesheet
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description One-line description
 * 
 * @purpose Detailed explanation of the stylesheet's purpose
 * 
 * @relatedFiles
 * - Related component files
 * - Related theme files
 */

/* Actual CSS starts here */
```

### 1.3 Header Placement

- Headers must be the **first content** in the file (after any shebang lines in shell scripts)
- No code, imports, or other content should appear before the header
- Headers should be immediately followed by the actual file content

---

## 2. Header Format Examples

### 2.1 TypeScript React Component

```typescript
/**
 * @fileoverview Logout button component for user authentication
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Provides a sign-out button that triggers the logout server action
 * 
 * @purpose This component handles user logout functionality. It renders a button
 *          that, when clicked, calls the logout server action and redirects the
 *          user to the login page. It is used across authenticated pages to
 *          provide consistent logout functionality.
 * 
 * @relatedFiles
 * - app/actions/auth.ts (logout server action)
 * - app/login/page.tsx (redirect destination)
 */

import { logout } from "@/app/actions/auth"

export default function LogoutButton() {
  // Component implementation
}
```

### 2.2 Next.js API Route

```typescript
/**
 * @fileoverview User registration API endpoint
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Handles POST requests for new user registration
 * 
 * @purpose This API route processes user registration requests. It validates
 *          input data, checks for existing users, hashes passwords, and creates
 *          new user accounts. It follows the API-first architecture pattern
 *          defined in mobile-safe-architecture-guidelines.md and is accessible
 *          to both web and future mobile clients.
 * 
 * @relatedFiles
 * - lib/validations.ts (registration schema)
 * - lib/prisma.ts (database client)
 * - lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
// ... rest of implementation
```

### 2.3 Library/Utility File

```typescript
/**
 * @fileoverview Authentication configuration and utilities
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description NextAuth configuration and authentication helpers
 * 
 * @purpose This file configures NextAuth for the MRE application. It sets up
 *          credential-based authentication, JWT session strategy, and authorization
 *          callbacks. It provides the core authentication logic that supports both
 *          web (cookie-based) and future mobile (token-based) authentication.
 *          This is a core service that must remain free of browser-only dependencies.
 * 
 * @relatedFiles
 * - lib/prisma.ts (user database access)
 * - middleware.ts (route protection)
 * - app/api/auth/[...nextauth]/route.ts (NextAuth route handler)
 */

import NextAuth from "next-auth"
// ... rest of implementation
```

### 2.4 Markdown Documentation

```markdown
---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Guidelines for file headers and code commenting standards
purpose: Establishes mandatory standards for file headers and code commenting
         across all files in the MRE project to ensure consistency, maintainability,
         and clear documentation of code ownership and purpose.
relatedFiles:
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/design/mre-ux-principles.md
---

# File Headers and Code Commenting Guidelines

Document content starts here...
```

### 2.5 Prisma Schema

```prisma
// @fileoverview Database schema definition for MRE application
// 
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
// 
// @description Prisma schema defining all database models and relationships
// 
// @purpose This schema defines the core data models for the MRE application,
//          including User model with authentication fields. It serves as the
//          single source of truth for database structure and is used by Prisma
//          to generate the database client and migrations.
// 
// @relatedFiles
// - prisma/migrations/ (database migration files)
// - prisma/seed.ts (database seeding script)
// - lib/prisma.ts (Prisma client instance)

generator client {
  provider = "prisma-client-js"
}

// Schema content starts here...
```

---

## 3. Code Commenting Standards

### 3.1 Function and Method Documentation

All functions, methods, and classes must be documented with JSDoc comments:

```typescript
/**
 * Registers a new user account in the system
 * 
 * @param email - User's email address (must be unique)
 * @param password - User's plain text password (will be hashed)
 * @param driverName - User's display name
 * @param teamName - Optional team name
 * @returns Promise resolving to the created user object (without password hash)
 * @throws {Error} If email already exists or validation fails
 * 
 * @example
 * ```typescript
 * const user = await registerUser({
 *   email: "user@example.com",
 *   password: "securePassword123",
 *   driverName: "John Doe",
 *   teamName: "Team Alpha"
 * })
 * ```
 */
export async function registerUser(params: RegisterParams): Promise<User> {
  // Implementation
}
```

### 3.2 Class Documentation

```typescript
/**
 * Manages user authentication and session handling
 * 
 * This class provides methods for user registration, login, session validation,
 * and logout. It abstracts authentication logic from the API layer and ensures
 * consistent behavior across web and mobile clients.
 * 
 * @example
 * ```typescript
 * const authService = new AuthService(prisma)
 * const user = await authService.login(email, password)
 * ```
 */
export class AuthService {
  // Class implementation
}
```

### 3.3 Inline Comments

Use inline comments to explain **why** code does something, not **what** it does:

**Good:**
```typescript
// Explicitly set isAdmin to false to prevent privilege escalation
// through registration endpoint (security requirement)
const user = await prisma.user.create({
  data: {
    // ... other fields
    isAdmin: false,
  }
})
```

**Bad:**
```typescript
// Set isAdmin to false
const user = await prisma.user.create({
  data: {
    isAdmin: false, // false
  }
})
```

### 3.4 Complex Logic Comments

For complex algorithms or business logic, provide detailed explanations:

```typescript
/**
 * Validates user authorization for admin routes
 * 
 * This function implements a multi-step authorization check:
 * 1. Verifies the session exists and is valid
 * 2. Checks that the user has admin privileges (stored in database, not inferred)
 * 3. Returns user context if authorized, throws error otherwise
 * 
 * This follows the security requirement that admin state must be stored
 * in Postgres and checked centrally (see mobile-safe-architecture-guidelines.md).
 */
export async function requireAdmin(session: Session): Promise<AdminUser> {
  // Implementation
}
```

### 3.5 TODO and FIXME Comments

Use standardized TODO/FIXME comments with context:

```typescript
// TODO: Implement rate limiting for this endpoint (see security requirements)
// TODO: Add unit tests for edge cases (see testing requirements)
// FIXME: Handle database connection errors more gracefully
// NOTE: This temporary workaround should be replaced in v2.0
```

Format: `[TYPE]: [Description] ([Context/Reference])`

Types:
- `TODO` - Planned future work
- `FIXME` - Known issue that needs fixing
- `NOTE` - Important information or temporary workaround
- `HACK` - Temporary solution that should be refactored
- `XXX` - Critical issue requiring immediate attention

### 3.6 Comment Style and Tone

- **Be clear and concise** - Comments should add value, not noise
- **Use proper grammar and spelling** - Comments are part of the codebase
- **Explain intent, not implementation** - Focus on why, not what
- **Keep comments up to date** - Outdated comments are worse than no comments
- **Avoid obvious comments** - Don't comment self-explanatory code
- **Use professional language** - Maintain a professional tone

### 3.7 When to Comment

**Always comment:**
- Public APIs and exported functions
- Complex algorithms or business logic
- Non-obvious code decisions or workarounds
- Security-related code
- Performance optimizations and their rationale
- Integration points with external systems

**Consider commenting:**
- Type definitions and interfaces (if not self-explanatory)
- Configuration values with non-obvious purposes
- Error handling logic

**Don't comment:**
- Self-explanatory code
- Obvious variable names or simple operations
- Code that will be removed soon (just remove it)

---

## 4. Maintenance Guidelines

### 4.1 Updating "Last Modified" Field

The "Last Modified" field must be updated when:

- **Any code changes** are made to the file (functions, logic, structure)
- **Comments are added or updated** significantly
- **Header information is updated** (description, purpose, related files)
- **Dependencies or imports change** in a meaningful way

The "Last Modified" field should **NOT** be updated for:

- Minor formatting changes (whitespace, indentation)
- Comment-only changes that don't affect understanding
- Git merge conflict resolutions that don't change functionality

### 4.2 File Ownership Changes

When a file's primary maintainer changes:

1. Update the "Creator" field to reflect the original creator (do not change)
2. Add a note in the "Purpose" or create a "Maintainer" field if needed
3. Update "Last Modified" with the current date
4. Document the ownership change in commit messages

### 4.3 Comment Maintenance

- **Update comments when code changes** - Ensure comments accurately reflect the current implementation
- **Remove outdated comments** - Delete comments that no longer apply
- **Refactor commented code** - If code needs extensive comments to be understood, consider refactoring
- **Review comments during code review** - Treat comments as part of the code quality

### 4.4 Header Maintenance Checklist

When modifying a file, ensure:

- [ ] Header is present and complete
- [ ] "Last Modified" date is updated if code changed
- [ ] "Description" and "Purpose" still accurately reflect the file
- [ ] "Related Files" list is current
- [ ] All functions have appropriate JSDoc comments
- [ ] Complex logic has explanatory comments
- [ ] TODO/FIXME comments are addressed or updated

---

## 5. LLM Behavior and Guardrails

### 5.1 Mandatory Requirements for AI Assistants

When an LLM or AI coding assistant creates or modifies files for MRE:

1. **Always include complete headers** - Every new file must have a header with all required fields
2. **Update "Last Modified"** - When modifying existing files, update the last modified date
3. **Add appropriate comments** - Document all functions, complex logic, and non-obvious code
4. **Follow format standards** - Use the exact header format specified for each file type
5. **Maintain consistency** - Ensure headers and comments match the style of existing code

### 5.2 Header Requirements

**For new files:**
- Set "Date Created" to the current date (YYYY-MM-DD format)
- Set "Creator" to "Jayson Brenton" (unless explicitly told otherwise)
- Set "Last Modified" to the same as "Date Created" for new files
- Provide a clear, concise "Description"
- Write a detailed "Purpose" explaining the file's role
- List relevant "Related Files" when applicable

**For modified files:**
- Keep original "Date Created" and "Creator" unchanged
- Update "Last Modified" to the current date
- Update "Description" and "Purpose" if the file's role has changed
- Update "Related Files" if dependencies have changed

### 5.3 Commenting Requirements

**When creating new code:**
- Add JSDoc comments to all exported functions and classes
- Comment complex logic and business rules
- Explain non-obvious code decisions
- Include examples in JSDoc when helpful

**When modifying existing code:**
- Update comments if functionality changes
- Add comments to newly added complex logic
- Remove or update outdated comments
- Ensure comment accuracy matches implementation

### 5.4 What LLMs Must Not Do

LLMs must **not**:

- Create files without headers
- Skip commenting new functions or complex logic
- Leave placeholder comments like "TODO: add comment"
- Use generic or vague descriptions in headers
- Ignore existing header formats in the codebase
- Create inconsistent header styles

### 5.5 Example LLM Workflow

When asked to create a new file:

1. **Determine file type** (TypeScript, Markdown, etc.)
2. **Select appropriate header format** from this document
3. **Create header with all required fields:**
   - Date Created: [current date]
   - Creator: Jayson Brenton
   - Last Modified: [current date]
   - Description: [clear one-liner]
   - Purpose: [detailed explanation]
   - Related Files: [if applicable]
4. **Write code with appropriate comments:**
   - JSDoc for all functions
   - Inline comments for complex logic
   - Clear, professional language
5. **Verify compliance** with this guideline

When asked to modify an existing file:

1. **Check for existing header** - If missing, add one
2. **Update "Last Modified"** date
3. **Update header fields** if file purpose changed
4. **Add/update comments** for new or changed code
5. **Maintain consistency** with existing style

### 5.6 Enforcement

- All code reviews must check for header and comment compliance
- Automated tools should flag files missing headers (if configured)
- LLM prompts should reference this document for MRE projects
- This document should be included in project onboarding materials

---

## 6. Quick Reference Checklist

Use this checklist when creating or modifying files:

### File Header Checklist

- [ ] Header is the first content in the file
- [ ] Date Created is in YYYY-MM-DD format
- [ ] Creator is specified (default: Jayson Brenton)
- [ ] Last Modified is current date (for new files) or updated (for modified files)
- [ ] Description is clear and concise (one line)
- [ ] Purpose explains the file's role in detail
- [ ] Related Files are listed (if applicable)
- [ ] Header format matches the file type (TypeScript, Markdown, etc.)

### Code Commenting Checklist

- [ ] All exported functions have JSDoc comments
- [ ] All classes have JSDoc comments
- [ ] Complex logic has explanatory comments
- [ ] Non-obvious code decisions are explained
- [ ] TODO/FIXME comments follow the standard format
- [ ] Comments are accurate and up to date
- [ ] Comments use professional, clear language
- [ ] No obvious or redundant comments

### Maintenance Checklist

- [ ] Last Modified date updated when code changes
- [ ] Header information still accurate
- [ ] Comments match current implementation
- [ ] Outdated comments removed
- [ ] Related files list is current

---

## 7. Examples Summary

### TypeScript/JavaScript Header Template

```typescript
/**
 * @fileoverview [Brief description]
 * 
 * @created YYYY-MM-DD
 * @creator Jayson Brenton
 * @lastModified YYYY-MM-DD
 * 
 * @description [One-line description]
 * 
 * @purpose [Detailed explanation of purpose and role]
 * 
 * @relatedFiles
 * - [Related file paths]
 */
```

### Markdown Header Template

```markdown
---
created: YYYY-MM-DD
creator: Jayson Brenton
lastModified: YYYY-MM-DD
description: [One-line description]
purpose: [Detailed explanation]
relatedFiles:
  - [Related file paths]
---
```

### Function Documentation Template

```typescript
/**
 * [Brief description of what the function does]
 * 
 * @param paramName - [Parameter description]
 * @returns [Return value description]
 * @throws {ErrorType} [When this error is thrown]
 * 
 * @example
 * ```typescript
 * [Example usage]
 * ```
 */
```

---

## 8. Versioning and Changes

Any change to these standards must:

1. Be discussed and agreed upon
2. Be captured in this document with a summary and date
3. Be communicated to all developers and LLM prompt templates
4. Include a migration plan for existing files (if needed)

**Change Log:**
- 2025-01-27: Initial version with comprehensive header and commenting standards

---

**End of Document**

