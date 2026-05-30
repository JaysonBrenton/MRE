/**
 * @fileoverview Typography utilities following MRE design system
 *
 * @created 2025-01-27
 * @creator UI Review Implementation
 * @lastModified 2026-05-09
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
  /** Small uppercase labels (10px) - for section labels, badges */
  uppercase: "text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]",
  /** 11px uppercase with secondary color */
  uppercaseSecondary:
    "text-[11px] uppercase tracking-[0.4em] font-medium text-[var(--token-text-secondary)]",
  /** 11px uppercase with accent color */
  uppercaseAccent: "text-[11px] uppercase tracking-[0.4em] font-medium text-[var(--token-accent)]",
  /** Small non-uppercase text (10px) - for badges, compact labels */
  captionSmall: "text-[10px] text-[var(--token-text-muted)]",
  /** Large KPI/display numbers (e.g. lap times, positions) */
  kpi: "text-3xl font-semibold text-[var(--token-text-primary)]",

  /** Data table column headers (secondary); pair with layout classes (padding, text-align) */
  tableHeader: "text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]",
  /** Data table column headers on muted / inset surfaces */
  tableHeaderMuted: "text-xs font-semibold uppercase tracking-wide text-[var(--token-text-muted)]",

  /** Event Overview: centered card titles (tri-column summary) */
  overviewSectionCardTitle:
    "min-w-0 w-full text-center text-lg font-semibold tracking-tight text-[var(--token-text-muted)]",
  /** Event Overview: results table toolbar title (left, same row as filters) */
  overviewEventResultsToolbarTitle:
    "min-w-0 shrink text-left text-lg font-semibold tracking-tight text-[var(--token-text-muted)]",
  /** Event Overview: toolbar filter labels (Class, Driver, View, …) */
  overviewToolbarLabel: "shrink-0 text-sm font-medium text-[var(--token-text-secondary)]",
  /** Event Overview: toolbar selects and text inputs */
  overviewToolbarControl:
    "rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-3 py-1.5 text-sm text-[var(--token-text-primary)] placeholder:text-[var(--token-text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]",
  /** Event Overview: segmented tab buttons (Event Results / Session Results) */
  overviewToolbarTabButton:
    "shrink-0 rounded-[0.25rem] px-3 py-1.5 text-sm font-medium transition-colors",
  /** Event Overview: small eyebrow above section titles (minimal tracking, no all-caps) */
  overviewEyebrow: "text-[11px] font-medium tracking-[0.04em] text-[var(--token-text-muted)]",
  /** Event Overview: grid metric label (Races, Drivers, …) */
  overviewMetricLabel:
    "text-[17px] font-medium leading-snug text-[var(--token-text-muted)] shrink-0",
  /** Event Overview: primary stat values beside labels */
  overviewMetricValue:
    "text-base font-bold tabular-nums leading-snug text-[var(--token-text-primary)]",
  /** Event Overview highlights: class / race name above driver on cards */
  overviewCardClassLabel: "text-[11px] font-medium leading-snug text-[var(--token-text-muted)]",
  /** Event Overview highlights: emphasized driver / winner line */
  overviewCardDriverName: "text-base font-bold leading-snug text-[var(--token-text-primary)]",
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
 * - tableHeader / tableHeaderMuted: xs uppercase column titles in data tables
 * - overviewSectionCardTitle: centered muted lg titles on overview glass cards
 * - overviewEventResultsToolbarTitle: left title on event results toolbar row
 * - overviewToolbarLabel / overviewToolbarControl / overviewToolbarTabButton: results toolbar controls
 * - overviewEyebrow / overviewCardClassLabel / overviewCardDriverName: Event Overview hierarchy
 * - overviewMetricLabel (17px) / overviewMetricValue (base): Event Overview stat grid
 */
export type TypographyKey = keyof typeof typography
