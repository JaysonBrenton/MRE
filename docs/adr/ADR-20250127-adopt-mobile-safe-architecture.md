---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-12-28
description: ADR documenting adoption of mobile-safe architecture guidelines
purpose: Documents the architectural decision to adopt the Architecture Guidelines
         as the authoritative standard for the MRE codebase. Status: Accepted.
         This decision mandates API-first backend, separation of UI and business logic,
         browser-independent core, and cookie-based authentication. Note: "Mobile-safe"
         refers to architectural patterns (API-first, separation of concerns), not mobile UI support.
relatedFiles:
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/specs/mre-v0.1-feature-scope.md
  - docs/standards/file-headers-and-commenting-guidelines.md
---

# ADR-20250127-adopt-mobile-safe-architecture

## Status

Accepted

## Context

The My Race Engineer (MRE) application requires a robust, scalable architecture
that enforces separation of concerns between UI and business logic. The current
codebase structure does not enforce this separation, which creates several
risks:

1. **Testing Challenges**: Tightly coupled code makes unit testing difficult
2. **Architectural Drift**: Without clear boundaries, the codebase may evolve in
   ways that reduce maintainability
3. **LLM Confusion**: AI coding assistants need clear, enforceable patterns to
   maintain consistency
4. **Code Reusability**: Business logic embedded in React components or Next.js
   API routes cannot be easily reused

The project requires an architecture that:

- Separates business logic from UI components
- Provides clean, versioned JSON APIs
- Prevents browser-specific dependencies in core logic
- Supports cookie-based authentication for web clients

## Decision

We adopt the **Architecture Guidelines** as defined in
`docs/architecture/mobile-safe-architecture-guidelines.md` as the authoritative
architectural standard for the MRE codebase.

**Note:** The term "mobile-safe" in the document name refers to architectural
patterns (API-first, separation of concerns) that enable clean architecture, not
mobile UI support. The application is desktop-only for UI, but these
architectural patterns remain valuable for maintainability and future
flexibility.

This decision mandates:

1. **API-First Backend**: All features exposed via `/api/v1/...` JSON endpoints
2. **Separation of UI and Business Logic**: Business logic must reside in
   `src/core/<domain>/` directories, never in UI components or API routes
3. **Browser-Independent Core**: Core logic must not depend on DOM APIs, browser
   events, or browser-specific features
4. **Cookie-Based Authentication**: Architecture supports cookie-based
   authentication for web clients

The folder structure must follow:

```
src/
  core/
    auth/          # Authentication business logic
    users/         # User domain logic
    common/        # Shared utilities
  app/             # Next.js App Router
  lib/             # Shared libraries
```

**Database Access Rules:**

- **API Routes**: API routes must never contain Prisma queries. All database
  access must go through core functions.
- **Repository Files**: Simple CRUD operations and reusable query functions must
  exist in `src/core/<domain>/repo.ts` files.
- **Core Business Logic Files**: Core business logic files
  (`src/core/<domain>/*.ts`) may use Prisma directly for complex queries that:
  - Combine multiple entities with joins
  - Perform aggregations across multiple tables
  - Require complex query logic that is part of business logic rather than
    simple data access
  - Examples: `src/core/users/driver-links.ts`,
    `src/core/personas/driver-events.ts`,
    `src/core/events/get-event-analysis-data.ts`
- **Preference**: When possible, core business logic files should prefer
  delegating to repo functions. Direct Prisma usage is acceptable for complex
  multi-entity operations that are inherently part of the business logic.

All validation must occur in `src/core/<domain>/validate-*.ts` files.

API routes must only handle HTTP concerns and call core functions.

## Consequences

### Positive

- **Improved Testability**: Separated business logic can be unit tested
  independently
- **Clear Boundaries**: Developers and LLMs have explicit rules preventing
  architectural violations
- **Consistent Patterns**: All features follow the same architectural pattern,
  reducing cognitive load
- **Future-Proof**: The structure supports scaling to multiple client types
  (web, CLI tools, automation scripts)
- **Maintainability**: Clean separation makes code easier to understand and
  modify

### Negative

- **Initial Restructuring Required**: Existing code must be refactored to match
  the new structure
- **Learning Curve**: Team members must understand and follow the new
  architecture rules
- **Stricter Constraints**: Some Next.js conventions (like keeping `app/` at
  root) conflict with the `src/` structure requirement
- **Additional Abstraction Layers**: More files and imports required for simple
  operations

### Neutral

- **Code Volume**: More files, but better organization
- **Import Paths**: Longer import paths, but clearer dependencies
- **Development Speed**: Slightly slower initial development, but faster
  long-term maintenance

## Alternatives Considered

### Alternative 1: Keep Current Next.js Structure

**Rejected because**: Business logic in `app/` and `lib/` cannot be easily
extracted or tested independently. Next.js App Router convention conflicts with
clean architecture requirements.

### Alternative 2: Monorepo with Shared Packages

**Rejected because**: Over-engineered for Alpha phase. Adds complexity
(workspace management, build tooling) without immediate benefit. Can be adopted
later if needed.

### Alternative 3: API-Only Backend with Separate Frontend

**Rejected because**: Premature separation. Alpha phase benefits from integrated
Next.js development. Can be split in future if needed.

### Alternative 4: Hybrid Approach (Some Logic in Components)

**Rejected because**: Violates core principle of separation of concerns. Allows
architectural drift and reduces testability and maintainability.

## Implementation Notes

This ADR requires:

1. Restructuring existing codebase to match `src/` folder structure
2. Extracting business logic from API routes and components to `src/core/`
3. Creating repository pattern files (`repo.ts`) for simple CRUD operations and
   reusable queries
4. Core business logic files may use Prisma directly for complex multi-entity
   queries
5. Versioning API routes to `/api/v1/...` (except framework-required exceptions
   like NextAuth)
6. Updating all import paths throughout the codebase
7. Adding file headers per
   `docs/standards/file-headers-and-commenting-guidelines.md`

**Current Status:**

- Core business logic files using Prisma directly for complex queries is an
  accepted pattern
- All API routes must be under `/api/v1/` except NextAuth
  (`/api/auth/[...nextauth]`)
- Health endpoint has been migrated to `/api/v1/health`

## References

- `docs/architecture/mobile-safe-architecture-guidelines.md` - Authoritative
  architecture document
- `docs/specs/mre-v0.1-feature-scope.md` - version 0.1.1 feature requirements
- `docs/standards/file-headers-and-commenting-guidelines.md` - Code
  documentation standards
