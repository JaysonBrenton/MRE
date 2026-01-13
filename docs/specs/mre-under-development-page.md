---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2026-01-27
description: Specification for the /under-development placeholder page
purpose: Defines the complete, strict specification for the Under Development Page used
         throughout the My Race Engineer (MRE) application. Ensures consistent behaviour
         across all placeholder navigation items and prevents LLM or developer feature
         drift during the Alpha phase. Status: Authoritative (Alpha).
relatedFiles:
  - docs/specs/mre-v0.1-feature-scope.md
  - docs/design/mre-ux-principles.md
---

# MRE Under Development Page Specification

**Document Type:** Feature Specification
**Status:** Authoritative (Alpha)
**Location:** `docs/specs/mre-under-development-page.md`
**Scope:** Defines requirements for the `/under-development` placeholder page

This document defines the complete, strict specification for the **Under Development Page** used throughout the My Race Engineer (MRE) application.

It ensures consistent behaviour across all placeholder navigation items and prevents LLM or developer feature drift during the Alpha phase.

---

# 1. Purpose of the Under Development Page

The Under Development page serves as a unified placeholder for **all future** and **not-yet-implemented** features.

This includes any feature that:

* appears in navigation,
* is referenced in documentation,
* is planned for Beta or Production,
* has partial backend logic but no UI,
* is intentionally out of scope for Alpha,
* must not be implemented as a real screen yet.

This prevents UI inconsistency and ensures predictable navigation behaviour.

---

# 2. Route Definition

The page must be served at the following route:

```
/under-development
```

No alternate routes may be created.

If a user navigates to a future feature link, that link must redirect to this route.

---

# 3. Required User-Facing Message

The page must display the following message **exactly**:

```
We're still building this feature, the pit crew is working on it!
```

This text cannot be modified, stylised with emojis, expanded, shortened, or contextualised.

### 3.1 Feature-Specific Descriptions

When route information is provided via the `from` query parameter, the page may display additional feature-specific information below the core message. This information must:

* Be displayed in a separate section below the core message
* Include the feature name as a heading
* Include a description of what the feature will provide
* Use consistent styling with existing design tokens
* Not replace or modify the core message

If no route information is provided, only the core message should be displayed.

---

# 4. Layout Requirements (Consistent Wrapper)

To maintain uniformity across the application, this page must use the global layout wrapper.

### 4.1 Required Layout Elements

The page must:

* use the application's global layout shell,
* include top navigation (Alpha or Future, depending on release phase),
* include the same padding and spacing scale as all pages,
* use the same container components (flex or grid wrappers),
* follow the dark theme rules.

### 4.2 Centered Content Rules

The message must:

* be centered horizontally,
* be centered vertically (using flex or grid),
* follow typography scale from the design system.

### 4.3 Theme Compliance

* Background must use `--token-surface`.
* Text must use `--token-text-primary`.
* No pure black.
* No unapproved accent colors.

---

# 5. Accessibility Requirements

The page must:

* use semantic HTML (`<main>` wrapper recommended),
* meet AA contrast standards,
* avoid motion or animation,
* ensure screen readers read the message clearly.

Since this page contains no controls, there are no interactive accessibility concerns.

---

# 6. Component Usage Requirements

### 6.1 Allowed Components

* Layout wrapper
* Typography components
* Standard spacing utilities
* Dark theme visual tokens

### 6.2 Forbidden Components

* Buttons
* Links (except as part of breadcrumbs)
* Forms
* Images
* Icons (except as part of breadcrumbs)
* Interactive elements
* Navigation to features other than the landing page

### 6.3 Allowed Additional Content

* Feature description text (when route information is provided)
* Feature name headings (for context)
* Informational cards or sections displaying feature descriptions (non-interactive)

This page must remain minimal for clarity and consistency, but may include descriptive text to help users understand upcoming features.

---

# 7. Integration with Navigation

### 7.1 Alpha Navigation

In Alpha, **none** of the future features appear in navigation.

Only minimal authentication navigation is shown.

### 7.2 Beta / Production Navigation

Once full navigation is introduced, any unfinished feature **must** use the Under Development page until its implementation is complete.

### 7.3 Redirect Rules

All future feature links must:

* either navigate directly to `/under-development`, or
* redirect server-side to `/under-development`.

### 7.4 Route Information Passing

When redirecting to `/under-development`, pages should pass route information via the `from` query parameter:

* Client-side redirects: `router.replace(\`/under-development?from=\${encodeURIComponent(route)}\`)`
* Server-side redirects: `redirect(\`/under-development?from=\${encodeURIComponent(route)}\`)`
* Direct navigation links: `/under-development?from=/dashboard/my-feature`

The `from` parameter should contain the route path that the user was attempting to access (e.g., `/dashboard/my-telemetry`). This allows the under-development page to display feature-specific descriptions.

---

# 8. Testing Requirements

Tests must verify that:

* the `/under-development` route renders successfully,
* the exact message appears,
* the global layout wrapper is applied,
* the page passes mobile breakpoints,
* the page uses dark theme tokens,
* no interactive elements appear,
* feature descriptions appear when route information is provided via query parameter,
* feature descriptions do not appear when no route information is provided.

---

# 9. Future Enhancements (Non-Alpha)

These enhancements may not be added in Alpha but are allowed in later phases:

* A small pit-crew style illustration
* Roadmap items
* Feature teasers
* High-level product previews

These must not be implemented in Alpha.

---

# 10. LLM Guardrails

LLMs must:

* follow this specification exactly,
* refuse to add additional elements beyond feature descriptions,
* refuse to add buttons or interactive elements,
* refuse to introduce feature-specific placeholders that replace the core message,
* enforce the exact core message (section 3),
* allow feature descriptions as specified in section 3.1,
* validate that the layout uses global wrappers and tokens,
* ensure feature descriptions are sourced from `src/lib/feature-descriptions.ts`.

---

# 11. License

Internal use only. This document governs the Under Development route and UI for the Alpha release of MRE.
