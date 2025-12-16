---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Specification for the /under-development placeholder page
purpose: Defines the complete, strict specification for the Under Development Page used
         throughout the My Race Engineer (MRE) application. Ensures consistent behaviour
         across all placeholder navigation items and prevents LLM or developer feature
         drift during the Alpha phase. Status: Authoritative (Alpha).
relatedFiles:
  - docs/specs/mre-alpha-feature-scope.md
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
* Links
* Forms
* Images
* Icons
* Cards
* Lists
* Navigation to features other than the landing page

This page must remain minimal for clarity and consistency.

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

---

# 8. Testing Requirements

Tests must verify that:

* the `/under-development` route renders successfully,
* the exact message appears,
* the global layout wrapper is applied,
* the page passes mobile breakpoints,
* the page uses dark theme tokens,
* no interactive elements appear.

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
* refuse to add additional elements,
* refuse to add buttons or interaction,
* refuse to introduce feature-specific placeholders,
* enforce the exact message,
* validate that the layout uses global wrappers and tokens.

---

# 11. License

Internal use only. This document governs the Under Development route and UI for the Alpha release of MRE.
