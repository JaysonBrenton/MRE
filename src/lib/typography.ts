/**
 * @fileoverview Typography utilities following MRE design system
 *
 * @created 2025-01-27
 * @creator UI Review Implementation
 * @lastModified 2025-01-27
 *
 * @description Typography utility classes and constants for consistent typography hierarchy
 *
 * @purpose Provides consistent typography patterns across the application
 *
 * @relatedFiles
 * - docs/design/mre-dark-theme-guidelines.md (typography rules)
 * - docs/design/mre-ux-principles.md (typography requirements)
 */

/**
 * Typography hierarchy definitions following MRE design system.
 *
 * All typography should use these consistent patterns:
 * - Headings: Use semantic h1-h6 tags with these classes
 * - Body: Use base text classes
 * - Labels: Use label classes
 */
export const typography = {
  // Heading styles
  h1: "text-3xl font-semibold text-[var(--token-text-primary)]",
  h2: "text-2xl font-semibold text-[var(--token-text-primary)]",
  h3: "text-xl font-semibold text-[var(--token-text-primary)]",
  h4: "text-lg font-semibold text-[var(--token-text-primary)]",
  h5: "text-base font-semibold text-[var(--token-text-primary)]",
  h6: "text-sm font-semibold text-[var(--token-text-primary)]",

  // Body text styles
  body: "text-base text-[var(--token-text-primary)]",
  bodySecondary: "text-sm text-[var(--token-text-secondary)]",
  bodyMuted: "text-sm text-[var(--token-text-muted)]",

  // Label styles
  label: "text-base font-medium text-[var(--token-text-secondary)]",
  labelSmall: "text-sm font-medium text-[var(--token-text-secondary)]",

  // Special text styles
  caption: "text-xs text-[var(--token-text-muted)]",
  uppercase: "text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]",
} as const

/**
 * Typography scale for consistent sizing:
 * - h1: 3xl (30px) - Page titles
 * - h2: 2xl (24px) - Section titles
 * - h3: xl (20px) - Subsection titles
 * - h4: lg (18px) - Card titles
 * - h5: base (16px) - Small headings
 * - h6: sm (14px) - Smallest headings
 * - body: base (16px) - Main content
 * - bodySecondary: sm (14px) - Secondary content
 * - caption: xs (12px) - Captions and helper text
 */
export type TypographyKey = keyof typeof typography
