/**
 * @fileoverview Visual details utilities following MRE design system
 * 
 * @created 2025-01-27
 * @creator UI Review Implementation
 * @lastModified 2025-01-27
 * 
 * @description Utilities for consistent icon sizes, border radius, focus rings, and shadows
 * 
 * @purpose Provides consistent visual detail patterns across the application
 * 
 * @relatedFiles
 * - docs/design/mre-dark-theme-guidelines.md (design guidelines)
 * - docs/design/mre-ux-principles.md (UX principles)
 */

/**
 * Icon size scale for consistent icon sizing:
 * - xs: 12px (h-3 w-3) - Very small icons
 * - sm: 16px (h-4 w-4) - Small icons (buttons, inline)
 * - md: 20px (h-5 w-5) - Medium icons (navigation, cards)
 * - lg: 24px (h-6 w-6) - Large icons (headers, prominent)
 * - xl: 32px (h-8 w-8) - Extra large icons (hero sections)
 */
export const iconSizes = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
} as const

/**
 * Border radius scale for consistent rounding:
 * - sm: 0.375rem (6px) - Small elements (badges, small buttons)
 * - md: 0.5rem (8px) - Standard elements (buttons, inputs, cards)
 * - lg: 1rem (16px) - Large elements (cards, containers)
 * - xl: 1.5rem (24px) - Extra large elements (hero sections, major containers)
 * - 2xl: 1.5rem (24px) - Dashboard cards
 * - 3xl: 1.875rem (30px) - Large dashboard sections
 * - full: 9999px - Fully rounded (pills, avatars)
 */
export const borderRadius = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
  full: "rounded-full",
} as const

/**
 * Focus ring pattern for consistent accessibility:
 * - Standard: focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]
 * - Inline: focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]
 */
export const focusRing = {
  standard: "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]",
  inline: "focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]",
} as const

/**
 * Shadow usage guidelines:
 * 
 * MRE follows a minimal design philosophy:
 * - Avoid shadows in favor of elevation through surface tokens
 * - Use border and background color differences for depth
 * - If shadows are absolutely necessary, use very subtle shadows
 * - Prefer: border-[var(--token-border-default)] and bg-[var(--token-surface-elevated)]
 *   over shadow-lg or similar
 */
export const shadows = {
  // Shadows are discouraged - use surface tokens instead
  none: "shadow-none",
} as const

export type IconSize = keyof typeof iconSizes
export type BorderRadius = keyof typeof borderRadius
export type FocusRingType = keyof typeof focusRing

