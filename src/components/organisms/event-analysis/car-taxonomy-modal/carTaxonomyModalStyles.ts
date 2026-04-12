/**
 * Shared Tailwind class strings for CarTaxonomyModal tables and controls.
 * Keeps the main modal file readable and ensures visual consistency.
 */

/** Matches SessionRaceResultsTable toolbar selects (session / driver filters). */
export const modalFilterSelectClass =
  "min-w-[10rem] max-w-[min(100%,22rem)] rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"

export const modalTableHeaderCell =
  "px-3 py-2.5 text-left text-xs font-semibold text-[var(--token-text-primary)]"

/** Full-width button inside a sortable `<th>` for the event-class mapping table. */
export const modalTableSortableHeaderButtonClass =
  "inline-flex w-full min-w-0 items-center justify-between gap-1 rounded px-0 py-0 text-left text-xs font-semibold text-[var(--token-text-primary)] hover:bg-[var(--token-surface)]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface-elevated)]"
export const modalTableBodyCell = "px-3 py-3 text-xs text-[var(--token-text-primary)]"
export const modalTableBodyCellMuted = "px-3 py-3 text-xs text-[var(--token-text-secondary)]"
export const modalTableBodyCellAction = "px-3 py-3 text-right align-middle"

/** Shared footprint for Mapped / Suggested / Unmapped pills in the event-class table. */
export const modalTableStatusPillBaseClass =
  "inline-flex h-5 min-h-5 min-w-[5.5rem] shrink-0 items-center justify-center whitespace-nowrap rounded-md border px-2 text-[11px] font-medium leading-none"

export const modalTableStatusPillMappedClass = `${modalTableStatusPillBaseClass} border-[var(--token-border-subtle)] bg-[var(--token-surface)]/80 text-[var(--token-text-secondary)]`

export const modalTableStatusPillSuggestedClass = `${modalTableStatusPillBaseClass} border-[var(--token-accent)]/30 bg-[var(--token-accent-soft-bg)]/50 text-[var(--token-accent)]`

export const modalTableStatusPillUnmappedClass = `${modalTableStatusPillBaseClass} border-[var(--token-border-default)] bg-[var(--token-surface)]/60 text-[var(--token-text-muted)]`

/**
 * Compact `StandardButton` in modal tables (Remove, Use suggestion, etc.).
 * Same height, min-width, and padding at all breakpoints (`sm:!px-3` overrides base `sm:px-5`).
 */
export const modalTableCompactButtonClass =
  "!inline-flex !h-8 !min-h-8 !min-w-[9.5rem] !shrink-0 !items-center !justify-center !whitespace-nowrap !px-3 !py-0 !text-xs !font-medium !leading-tight sm:!px-3"

/** Primary accent action in the event-class table (e.g. Use suggestion). */
export const modalTableCompactButtonAccentClass = `${modalTableCompactButtonClass} border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)] hover:bg-[var(--token-accent-soft-bg)]/80`
