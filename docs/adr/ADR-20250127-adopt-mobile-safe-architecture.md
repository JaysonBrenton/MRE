---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: ADR documenting adoption of mobile-safe architecture guidelines
purpose: Documents the architectural decision to adopt the Mobile-Safe Architecture
         Guidelines as the authoritative standard for the MRE codebase. Status: Accepted.
         This decision mandates API-first backend, separation of UI and business logic,
         browser-independent core, mobile-first UI, and dual authentication support.
relatedFiles:
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/specs/mre-v0.1-feature-scope.md
  - docs/standards/file-headers-and-commenting-guidelines.md
---

# ADR-20250127-adopt-mobile-safe-architecture

## Status
Accepted

## Context

The My Race Engineer (MRE) application requires a robust, scalable architecture that supports both web and future mobile clients (iOS/Android). The current codebase structure does not enforce separation of concerns between UI and business logic, which creates several risks:

1. **Mobile Incompatibility**: Business logic embedded in React components or Next.js API routes cannot be reused by mobile clients
2. **Testing Challenges**: Tightly coupled code makes unit testing difficult
3. **Architectural Drift**: Without clear boundaries, the codebase may evolve in ways that prevent mobile app development
4. **LLM Confusion**: AI coding assistants need clear, enforceable patterns to maintain consistency

The project requires an architecture that:
- Separates business logic from UI components
- Provides clean, versioned JSON APIs accessible to mobile clients
- Prevents browser-specific dependencies in core logic
- Enforces mobile-first UI design
- Supports both cookie-based (web) and token-based (mobile) authentication

## Decision

We adopt the **Mobile-Safe Architecture Guidelines** as defined in `docs/architecture/mobile-safe-architecture-guidelines.md` as the authoritative architectural standard for the MRE codebase.

This decision mandates:

1. **API-First Backend**: All features exposed via `/api/v1/...` JSON endpoints
2. **Separation of UI and Business Logic**: Business logic must reside in `src/core/<domain>/` directories, never in UI components or API routes
3. **Browser-Independent Core**: Core logic must not depend on DOM APIs, browser events, or browser-specific features
4. **Mobile-First UI**: All UI must be touch-safe, one-column-first, and free of hover-only interactions
5. **Dual Authentication Support**: Architecture must support both cookie-based (web) and token-based (mobile) authentication

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

All Prisma queries must exist only in `src/core/<domain>/repo.ts` files.

All validation must occur in `src/core/<domain>/validate-*.ts` files.

API routes must only handle HTTP concerns and call core functions.

## Consequences

### Positive

- **Mobile-Ready Foundation**: The architecture enables future iOS/Android app development without major refactoring
- **Improved Testability**: Separated business logic can be unit tested independently
- **Clear Boundaries**: Developers and LLMs have explicit rules preventing architectural violations
- **Consistent Patterns**: All features follow the same architectural pattern, reducing cognitive load
- **Future-Proof**: The structure supports scaling to multiple client types (web, mobile, CLI tools)

### Negative

- **Initial Restructuring Required**: Existing code must be refactored to match the new structure
- **Learning Curve**: Team members must understand and follow the new architecture rules
- **Stricter Constraints**: Some Next.js conventions (like keeping `app/` at root) conflict with the `src/` structure requirement
- **Additional Abstraction Layers**: More files and imports required for simple operations

### Neutral

- **Code Volume**: More files, but better organization
- **Import Paths**: Longer import paths, but clearer dependencies
- **Development Speed**: Slightly slower initial development, but faster long-term maintenance

## Alternatives Considered

### Alternative 1: Keep Current Next.js Structure
**Rejected because**: Business logic in `app/` and `lib/` cannot be easily extracted for mobile clients. Next.js App Router convention conflicts with mobile-safe requirements.

### Alternative 2: Monorepo with Shared Packages
**Rejected because**: Over-engineered for Alpha phase. Adds complexity (workspace management, build tooling) without immediate benefit. Can be adopted later if needed.

### Alternative 3: API-Only Backend with Separate Frontend
**Rejected because**: Premature separation. Alpha phase benefits from integrated Next.js development. Can be split in future if needed.

### Alternative 4: Hybrid Approach (Some Logic in Components)
**Rejected because**: Violates core principle of mobile-safety. Allows architectural drift and prevents mobile client development.

## Implementation Notes

This ADR requires:

1. Restructuring existing codebase to match `src/` folder structure
2. Extracting business logic from API routes and components to `src/core/`
3. Creating repository pattern files (`repo.ts`) for all database access
4. Versioning API routes to `/api/v1/...`
5. Updating all import paths throughout the codebase
6. Adding file headers per `docs/standards/file-headers-and-commenting-guidelines.md`

The implementation will be completed as part of the documentation and codebase alignment effort.

## References

- `docs/architecture/mobile-safe-architecture-guidelines.md` - Authoritative architecture document
- `docs/specs/mre-v0.1-feature-scope.md` - version 0.1.0 feature requirements
- `docs/standards/file-headers-and-commenting-guidelines.md` - Code documentation standards

