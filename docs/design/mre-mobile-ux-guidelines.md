---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Mobile UX guidelines ensuring all screens are touch-friendly and mobile-compliant
purpose: Ensures all MRE screens are fully mobile-compliant, touch-friendly, and aligned
         with enterprise UX standards. These guidelines are mandatory for all Alpha screens:
         Registration, Login, User Welcome, Admin Console Welcome, and Under Development Page.
relatedFiles:
  - docs/design/mre-dark-theme-guidelines.md
  - docs/design/mre-ux-principles.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
---

# MRE Mobile UX Guidelines

**Document Status:** Updated and aligned with MRE Alpha directives
**Authoritative Scope:** Applies to all UI in Alpha
**Purpose:** Ensure all MRE screens are fully mobile-compliant, touch-friendly, and aligned with enterprise UX standards.

These guidelines are mandatory for all Alpha screens:

* Registration
* Login
* User Welcome
* Admin Console Welcome
* Under Development Page

Future features (e.g., Analytics, Telemetry, Setup Sheets) use this file for early planning but must NOT be implemented during Alpha.

---

# 1. Mobile-First Foundation

All screens must be designed mobile-first.
Desktop behaviour is a progressive enhancement.

Key principles:

* Layouts must work flawlessly on a **narrow viewport first** (375–430px)
* UI must respect touch ergonomics
* No hover-only behaviours
* All important elements must be reachable with natural thumb movement

---

# 2. Viewport and Breakpoints

MRE uses a simple breakpoint strategy aligned with Alpha needs:

* **Mobile:** 0–599px
* **Tablet:** 600–899px
* **Desktop:** 900px+

All Alpha screens must function perfectly within **Mobile**.

Tablet and desktop adaptations are optional but recommended.

---

# 3. Touch Target Requirements

Every interactive element must meet the minimum touch size:

* **44px height** (Apple HIG)
* **48px height** recommended (Material Design)
* Minimum **8–12px spacing** between touch targets

Applies to:

* Buttons
* Form fields
* Toggles, checkboxes (if present in future phases)

Alpha note: No checkboxes or toggles exist yet.

---

# 4. Layout and Spacing Rules

Spacing scale (must be consistent across all screens):

* 4px
* 8px
* 12px
* 16px
* 20px
* 24px

Rules:

* No inconsistent margins
* Forms must have clear vertical rhythm
* Avoid dense UI clusters
* Always allow comfortable breathing room above and below input groups

---

# 5. Forms on Mobile

All Alpha forms (registration and login) must follow these rules:

## 5.1 Single-Column Only

* Multi-column layouts are **not allowed** in Alpha
* Inputs must stack vertically
* No side-by-side fields

## 5.2 Label Placement

* Use **top-aligned labels**, never placeholders-only
* Labels must use semantic text tokens

## 5.3 Input Field Rules

* Minimum height 44px
* Use dark theme tokens for fields and borders
* Use clear error states
* Validation messages must appear directly beneath the field

## 5.4 Keyboard-Friendly Behaviour

Mobile keyboards must not obstruct fields:

* Ensure bottom padding allows input visibility
* Avoid fixed-position buttons near the keyboard

---

# 6. Navigation on Mobile

For Alpha, navigation is minimal.

Rules:

* Avoid hamburger menus during Alpha
* Use simple top-aligned navigation
* Avoid sticky nav bars unless necessary

In Beta and beyond, this section will expand to support:

* Multi-item navigation
* Collapsible menus
* Tab bars

**Alpha Restriction:** Future navigation items must all route to `/under-development` until implemented.

---

# 7. Typography on Mobile

Text must be legible:

* Minimum body text size: **14–16px**
* Minimum label size: **12–13px**
* Large headings should not exceed 28–32px
* Do not use overly thin font weights

Font tokens must come from the design system.

---

# 8. Buttons on Mobile

Buttons must:

* Be full-width or nearly full-width on mobile
* Use consistent height, padding, and typography
* Use the primary accent token for primary actions

Hover behaviour on desktop must not be required for usability.

Active and focus states must be visible.

---

# 9. Error Handling and Messaging

Error messages on mobile must:

* Be concise
* Use clear and predictable placement
* Avoid pop-ups or modal-only errors

Inline errors must:

* Use semantic error tokens (future feature)
* Maintain spacing rules

System-level errors must appear at the top of the form on mobile.

---

# 10. Responsive Behaviour

Responsive adjustments must not break layout.

For Alpha forms:

* Avoid multi-column patterns
* Avoid complex flex arrangements
* Keep a consistent vertical flow

Future features may have richer responsive layouts:

* Data grids
* Cards
* Graph components

These must be tagged as **future-phase** below.

---

# 11. Future Features (Not Allowed in Alpha)

Some mobile patterns are documented here for future readiness but must NOT be implemented during Alpha.

These include:

* Data tables (Alpha has none)
* Multi-column dashboards
* Tab-based navigation
* Metrics cards
* Telemetry overlays
* LiveRC screens
* Setup-sheet editors

These sections are included only for planning and consistency.
Alpha must ignore them.

---

# 12. Testing Requirements

Mobile UX tests must verify:

* Layout correctness at 375px width
* All touch targets meet size requirements
* No horizontal scrolling
* Labels are readable
* Error messages do not overflow
* Buttons are tappable without overlap
* The dark theme remains legible on mobile displays

Viewport screenshots are required for:

* Registration
* Login
* User welcome
* Admin console welcome
* Under development page

---

# 13. Integration with Other MRE Standards

All mobile UX decisions must be consistent with:

* **Dark theme guidelines:** `docs/design/mre-dark-theme-guidelines.md`
* **UX principles:** `docs/design/mre-ux-principles.md`
* **Architecture:** `docs/architecture/mobile-safe-architecture-guidelines.md`

If any conflict arises, the Architecture document takes precedence.

---

# 14. License

Internal use only. This document defines mandatory mobile UX rules for all Alpha screens.
