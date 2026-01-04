---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-29
description: Mandatory UX principles for all MRE version 0.1.1 features
purpose: Defines the mandatory User Experience principles for My Race Engineer (MRE).
         These rules apply to all version 0.1.1 features and will remain the baseline foundation
         for Beta and Production. Ensures every screen behaves consistently, LLM
         contributors follow predictable UX patterns, and version 0.1.1 UI remains simple,
         desktop-optimized, and enterprise-grade. This document is fully authoritative.
         No UX deviations are allowed in version 0.1.1.
relatedFiles:
  - docs/design/mre-dark-theme-guidelines.md
  - docs/design/navigation-patterns.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/adr/ADR-20251228-allow-sidebar-navigation.md
  - docs/roles/senior-ui-ux-expert.md
  - docs/roles/nextjs-front-end-engineer.md
  - docs/roles/quality-automation-engineer.md
  - docs/roles/documentation-knowledge-steward.md
---

# MRE UX Principles (Authoritative Guide)

This document defines the mandatory User Experience principles for **My Race Engineer (MRE)**. These rules apply to **all version 0.1.1 features** and will remain the baseline foundation for Beta and Production.

The purpose of this document is to ensure that:

* Every screen behaves consistently
* Cursor and other LLM contributors follow predictable UX patterns
* Version 0.1.1 UI remains simple, desktop-optimized, and enterprise‑grade

This document is fully authoritative. No UX deviations are allowed in version 0.1.1.

---

# 1. Core UX Philosophy

MRE follows these principles:

* **Clarity over cleverness**
* **Consistency over creativity**
* **Predictability over novelty**
* **Speed of comprehension over density**
* **Cognitive load must remain low**

Users must always understand:

* Where they are
* What they can do
* What the system expects from them

There must be no surprises.

---

# 2. Laws of UX (Required)

The following UX laws **must** be followed on every screen:

### 2.1 Jakob’s Law

Users expect your app to behave like other apps they already use.

* Do not invent new form layouts
* Do not rearrange standard login/register patterns

### 2.2 Fitts's Law

Interactive targets must be easy to click.

* Minimum 44px click target height
* Buttons must not be placed too close together

### 2.3 Hick's Law

Reduce choices.

* Version 0.1.1 screens should focus on clear primary actions

### 2.4 Miller’s Law

Limit cognitive load.

* No more than one decision per screen

### 2.5 Law of Prägnanz

Keep layouts simple.

* Avoid ornamentation
* Use consistent shapes and spacing

### 2.6 Law of Proximity

Related elements must be grouped together.

* Labels always directly above inputs

### 2.7 Aesthetic–Usability Effect

Clean design must reinforce trust.

* Consistent dark theme usage
* No randomly sized typography

---

# 3. Foundational Layout Rules

### 3.1 Layout Rules (Desktop)

All version 0.1.1 screens are optimized for desktop viewports (1280px+).

**Content Layout:**
* Main content areas use desktop-optimized layouts
* Multi-column layouts are allowed where appropriate
* Sidebars are allowed for navigation purposes
* Sidebars may be persistent or collapsible
* All sidebar implementations must:
  * Comply with WCAG 2.1 AA accessibility standards
  * Support keyboard navigation and screen readers
  * Complement (not replace) breadcrumb navigation
* See `docs/design/navigation-patterns.md` for detailed sidebar implementation guidelines

### 3.2 Predictable Page Structure

Every screen follows this skeleton:

```
<header />
<main class="page-container">
  <section class="content-wrapper">
    ... content ...
  </section>
</main>
```

### 3.3 Vertical Rhythm

Vertical spacing must follow the spacing scale defined in the dark theme guidelines.

* No arbitrary margins
* Use consistent spacing tokens

### 3.4 Alignment

* Content must be left-aligned for readability
* Titles centered only where specified (e.g., welcome screens)

---

# 4. Forms (Login and Registration)

Forms must follow strict patterns:

### 4.1 Inputs

* Labels must appear directly above inputs
* Inputs must fill the container width
* Inputs must use semantic tokens—for background, border, and text

### 4.2 Error Handling

Errors must:

* Be shown beneath the relevant field
* Use the error token colours
* Contain a short, precise message
* Avoid humour, filler, or multi-line descriptions

Examples of allowed errors:

* "Email is required"
* "Password must be at least 8 characters"

Examples of disallowed errors:

* "Oops, something went wrong!" (too vague)
* "We could not process your request right now" (not field-level)

### 4.3 Buttons

#### 4.3.1 Button Style Standard

All buttons in MRE must use the **standard outlined/secondary style** for consistency. This style provides a clean, professional appearance that aligns with the dark theme guidelines.

**Required Base Classes:**
```
mobile-button flex items-center justify-center rounded-md
```

**Required Styling Tokens:**
* Border: `border border-[var(--token-border-default)]`
* Background: `bg-[var(--token-surface-elevated)]`
* Text: `text-[var(--token-text-primary)]`
* Hover: `hover:bg-[var(--token-surface)]`
* Focus: `focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]`
* Transitions: `transition-colors`
* Active state: `active:opacity-90` (optional, for form buttons)

**Padding:**
* Standard: `px-4 sm:px-5` (responsive padding)
* Compact: `px-4` (for smaller buttons like logout)

**Complete Standard Button Example:**
```tsx
<button
  className="mobile-button flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] sm:px-5"
>
  Button Text
</button>
```

#### 4.3.2 Button Width Guidelines

* **Full-width buttons**: Use `w-full` for form submit buttons and primary actions where appropriate
* **Auto-width buttons**: Omit `w-full` for navigation buttons and secondary actions that should size to content

#### 4.3.4 Disabled States

Form buttons must include disabled state handling:
* `disabled:opacity-50 disabled:cursor-not-allowed`
* Always maintain the same visual style (outlined/secondary) when disabled

#### 4.3.5 Button Text Requirements

* Only one primary button per screen
* Button text must be explicit and action-oriented

**Allowed button text:**
* "Create Account"
* "Sign in" / "Log In"
* "Sign out"
* "Save Changes"
* "Cancel"

**Avoid generic labels:**
* "Submit"
* "Continue"
* "Next"
* "OK"

#### 4.3.6 Token Reference

All button styling must use semantic tokens from the dark theme guidelines. Never hard-code colors or use primary button tokens (`--token-button-primary-bg`, `--token-button-primary-text`, etc.) as these are deprecated in favor of the standard outlined style.

See `docs/design/mre-dark-theme-guidelines.md` for complete token reference.

---

# 5. Content Rules

### 5.1 Tone

The tone must be:

* Professional
* Calm
* Direct
* Friendly without being informal

Examples of allowed tone:

* "Welcome back Jason"
* "Please enter your login details"

Examples of disallowed tone:

* "Hey there, racer!"
* "Let’s get you on the track!"

### 5.2 Microcopy

Microcopy must:

* Be short
* Avoid jargon
* Explain exactly what the user needs to do

### 5.3 No Marketing Copy in Version 0.1.1

The version 0.1.1 experience must stay strictly functional.

---

# 6. Navigation and Flow Rules

### 6.1 After Register → Welcome Page

Immediately redirect to:

```
Welcome back <Driver Name>
```

### 6.2 After Login → User or Admin Page

* Standard user → Welcome Page
* Admin user → Admin Console

### 6.3 Navigation Scope

Version 0.1.1 includes:

* Dashboard
* Event pages
* Driver pages
* Admin console
* Navigation patterns as documented in `docs/design/navigation-patterns.md`

---

# 7. Visual Consistency

### 7.1 Typography

Typography must follow the dark theme guidelines exactly.

* Heading sizes must not be invented
* Body text uses the base token

### 7.2 Colours

Only use:

* Semantic dark theme tokens
* No arbitrary hex colours

### 7.3 Shadows and Borders

Minimal. Used only where needed.

---

# 8. Desktop-Specific Requirements

These rules are mandatory:

* Buttons should have appropriate sizing for desktop interaction
* Inputs must not truncate text
* Layout must be optimized for desktop viewports (1280px+)
* Hover interactions are allowed for desktop

---

# 9. What Not To Do (Critical Section)

The following must **never** appear in version 0.1.1:

* Multi-step forms
* Carousels
* Images or illustrations (except as specified in design guidelines)
* Animations (except minimal transitions)
* Tooltips (unless required for accessibility)
* Accordions
* Additional pages beyond version 0.1.1 scope

**Note:** Side navigation (sidebars) and tabs are allowed per ADR-20251228-allow-sidebar-navigation and feature scope. See section 3.1 for sidebar requirements.

If a feature is not listed as required, it is **not allowed**.

---

# 10. Testing Requirements

UX tests must validate:

* Alignment of elements
* Field validation behaviour
* Mobile breakpoints
* No unexpected UI components
* Consistent spacing and typography

---

# 11. Future Expansion Notes (Beta+)

These rules remain strict in version 0.1.1 but may expand later to include:

* Additional form screens
* Multi-step onboarding
* Hero sections
* Additional interactive widgets beyond current dashboard system

No Beta features may be added in version 0.1.1.

---

# 12. Role Responsibilities

The following roles have specific responsibilities for implementing and maintaining these UX principles:

* **Senior UI/UX Expert** (`docs/roles/senior-ui-ux-expert.md`): Primary owner of UX principles. Establishes and evolves UX principles, design patterns, and component guidelines. Ensures WCAG 2.1 AA compliance, defines information architecture, and guides design decisions for data visualization. Reviews UI/UX implementations for consistency and usability.

* **Next.js Front-End Engineer** (`docs/roles/nextjs-front-end-engineer.md`): Implements UX principles in code. Ensures UI components follow documented UX patterns, maintains design token usage, implements error boundaries with user-facing recovery paths, and upholds performance budgets. Works closely with Senior UI/UX Expert to translate design principles into implementation.

* **Quality & Automation Engineer** (`docs/roles/quality-automation-engineer.md`): Ensures UX principles are validated through automated testing. Implements accessibility checks, validates mobile breakpoints, and maintains test coverage for UX requirements.

* **Documentation & Knowledge Steward** (`docs/roles/documentation-knowledge-steward.md`): Maintains UX documentation, ensures UX principles stay current, and facilitates updates when UX patterns evolve.

All roles must coordinate to ensure UX consistency across the application.

---

# 13. License

Internal use only. This specification governs internal UX behaviour for MRE.
