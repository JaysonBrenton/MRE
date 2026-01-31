---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-29
description: Visual standards and token system for MRE theme implementation
purpose:
  Defines the visual standards, token system, and rules for implementing themes
  in MRE. Dark theme is the default, but the token system supports theme
  experimentation. Applies to all UI in version 0.1.1 and beyond.
relatedFiles:
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/design/mre-ux-principles.md
---

# MRE Dark Theme Guidelines

**Document Status:** Updated and aligned with MRE version 0.1.1 directives
**Authoritative Scope:** Applies to all UI in version 0.1.1 **Purpose:** Define
the visual standards, token system, and rules for implementing themes in MRE.
Dark theme is the default, but the token system is designed to support theme
experimentation. Both dark and light themes are implemented and accessible via
theme toggle component. The semantic token system enables creation of additional
themes while maintaining consistency and accessibility.

---

# 1. Design Philosophy

The My Race Engineer dark theme is designed to feel:

- Premium
- Technical
- Minimal
- High contrast without strain
- Suitable for both web and future native apps

This dark theme follows guidance from the UX Planet article _"Dark Theme: 5 UI
Design Tips"_, combined with MRE-specific branding requirements.

The MRE dark theme **must not** resemble a generic, cookie-cutter dark mode. It
must visually communicate performance, speed, and clarity.

---

# 2. Authoritative Token Naming Standard

## 2.1 Final Naming Convention

After alignment with the broader MRE documentation strategy, **the authoritative
naming scheme is:**

### **`--token-*` tokens for all semantic design variables**

This naming scheme:

- Matches the mobile-safe architecture requirement to keep logic and rendering
  environments consistent
- Avoids hard-coded colours in components
- Ensures compatibility with future design layers
- Ensures a consistent mapping when porting UI to native apps

## 2.2 Relationship to Tailwind

If Tailwind is used, token values may be mapped via the theme extension, but
**the authoritative source must always be the CSS variables**, not Tailwind.

Example:

```css
:root {
  --token-surface: #0a0a0b;
  --token-surface-elevated: #111214;
  --token-surface-raised: #18191c;
  --token-border-default: #26272e;
  --token-text-primary: #f2f2f3;
  --token-text-secondary: #b8bbc2;
  --token-accent: #3a8eff;
  --token-accent-hover: #5aa2ff;
}
```

Tailwind mapping example:

```js
theme: {
  colors: {
    surface: "var(--token-surface)",
    text: {
      primary: "var(--token-text-primary)",
      secondary: "var(--token-text-secondary)",
    },
    accent: "var(--token-accent)",
  }
}
```

## 2.3 Removal of `--color-*` token references

The previous `--color-*` naming standard is officially deprecated. All
components, documentation, and future design work must reference the `--token-*`
variables.

---

# 3. Core Dark Theme Rules

## 3.1 Avoid Pure Black

Pure black (#000000) may cause:

- Eye strain
- Visible banding
- Harsh contrast
- Poor readability in dim lighting

MRE must **never** use pure black.

Correct surfaces must be:

- Very dark grays
- Slightly tinted neutrals
- Low-contrast dark layers

## 3.2 Maintain Proper Contrast Ratios

Text must meet WCAG AA contrast at minimum.

Examples:

- Primary text on main surface: **ratio 12:1 or greater**
- Secondary text: **7:1 or greater**
- Disabled text: still readable but reduced opacity

Accent colours must pass contrast on focus states.

## 3.3 Use Depth Through Layered Surfaces

Use a tiered system:

- `--token-surface` (base background)
- `--token-surface-elevated` (cards, containers)
- `--token-surface-raised` (overlays, drawers)

Each layer should differ by **3–6 percent luminance**.

## 3.4 Elevation and Shadows

Light, subtle shadows only. No heavy drop shadows or glowing effects.

This ensures the design remains sharp and clean in both web and mobile contexts.

---

# 4. Typography Rules

Typography must:

- Use semantic text tokens
- Avoid custom per-component sizing
- Maintain consistent hierarchy across screens

### Required tokens:

- `--token-text-primary`
- `--token-text-secondary`
- `--token-text-muted`

### Size hierarchy:

- Headings: larger, bold, consistent across screens
- Body text: 14–16px depending on context
- Labels: 12–13px, never smaller
- Buttons: always readable at mobile sizes

---

# 5. Spacing and Layout

Spacing must follow a consistent scale:

- 4px
- 8px
- 12px
- 16px
- 20px
- 24px

Rules:

- Never invent new spacing values
- Maintain consistent breathing room around inputs and buttons
- Ensure layouts function on mobile without horizontal scrolling

---

# 6. Forms and Interactive Elements

All forms must:

- Use semantic theme tokens for backgrounds and borders (not hard-coded colors)
- Use clear focus rings (light or accent-coloured)
- Have appropriate sizing for desktop interaction
- Have clear error messaging following UX principles

Buttons:

- Primary buttons must use `--token-accent`
- Hover state must use `--token-accent-hover`
- Text on primary buttons must use `--token-text-primary` or an inverse text
  token

---

# 7. Mobile Requirements

All theme rules must translate cleanly to mobile screens.

Mobile constraints:

- Larger tap targets
- Reduced horizontal padding
- No tiny, low-contrast text
- No hover-only behaviours

Components must degrade gracefully on narrow layouts.

---

# 8. Do and Do Not Examples

### Do:

- Use subtle layered surfaces to create depth
- Use semantic tokens everywhere
- Maintain consistent spacing
- Ensure high readability in dim and bright environments
- Use accent colour sparingly for hierarchy

### Do Not:

- Use pure black backgrounds
- Hardcode colours in components
- Invent new shades of grey
- Use inconsistent spacing
- Overuse accent colours or glowing effects

---

# 9. Testing Requirements

All UI components must be checked for:

- Theme correctness (works with all available themes)
- Token usage (no hard-coded values)
- Mobile readability
- WCAG contrast compliance
- Consistent use of spacing and typography

Screenshots should be taken in:

- Desktop
- Tablet
- Mobile
- Light glare simulation (optional)

---

# 10. Theme Toggle and Light Theme Support

**Status:** ✅ **Implemented** in version 0.1.1

Light theme support and theme switching are implemented:

- **Theme Toggle Component:** `src/app/components/ThemeToggle.tsx` provides a
  button to switch between dark and light themes
- **Light Theme Values:** Defined in `.light` class override in
  `src/app/globals.css`
- **Theme Persistence:** Theme preference is stored in localStorage as
  `mre-theme` (values: "dark" or "light")
- **Default Theme:** Dark theme is the default (defined in `:root`)
- **Theme Application:** Theme toggle adds/removes `.light` class on `<html>`
  element

**Implementation Details:**

- All semantic tokens (`--token-*`) have both dark and light theme values
- Dark theme values are defined in `:root`
- Light theme values override dark theme values when `.light` class is present
- Theme toggle is accessible from the header/navigation on authenticated pages

# 11. Theme Experimentation

The MRE theme system is designed to support experimentation while maintaining
consistency and accessibility.

## 11.1 Creating New Themes

The semantic token system (`--token-*`) enables creation of additional themes
beyond dark and light:

1. **Define theme class**: Create a new CSS class (e.g., `.theme-custom`) in
   `src/app/globals.css`
2. **Override tokens**: Define all semantic tokens for the new theme
3. **Maintain contrast**: Ensure all themes meet WCAG AA contrast requirements
4. **Test thoroughly**: Verify all components work correctly with the new theme

## 11.2 Theme Best Practices

When experimenting with themes:

- **Always use semantic tokens**: Never hard-code colors in components
- **Maintain accessibility**: All themes must meet WCAG AA contrast minimums
- **Test across components**: Ensure new themes work with all UI components
- **Document custom themes**: If creating project-wide themes, document them in
  this file
- **Preserve dark theme as default**: Dark theme remains the default for
  consistency

## 11.3 Token System Benefits

The semantic token system provides:

- **Flexibility**: Easy to create new themes by overriding token values
- **Consistency**: Components automatically adapt to theme changes
- **Maintainability**: Single source of truth for color values
- **Accessibility**: Centralized contrast management

---

# 12. Future Expansion

Future versions may include:

- High-contrast accessibility mode
- Expanded accent palette
- Adaptive colour tokens for hardware telemetry displays
- System theme detection (respect OS preference)
- Additional pre-built themes (e.g., high-contrast, sepia, custom brand themes)

---

# 13. License

Internal use only. This document defines the theme system standards for all
version 0.1.1 screens and beyond.
