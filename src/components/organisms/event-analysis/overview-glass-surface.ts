/** Full glass — shared chrome (toolbars, tables, charts) outside Event Overview section shells. */
export const OVERVIEW_GLASS_SURFACE_CLASS =
  "rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/95 shadow-md"

export const OVERVIEW_GLASS_SURFACE_STYLE = {
  backgroundColor: "var(--glass-bg)",
  backdropFilter: "var(--glass-blur)",
  WebkitBackdropFilter: "var(--glass-blur)",
  borderRadius: 16,
  border: "1px solid var(--glass-border)",
  boxShadow: "var(--glass-shadow-stack)",
} as const

/** Level 2: Event details / Event highlights outer shells — opaque lift from page, no blur. */
export const OVERVIEW_SECTION_SURFACE_CLASS =
  "rounded-2xl border border-[var(--token-border-muted)] bg-[color-mix(in_oklab,var(--token-surface-elevated)_84%,var(--token-surface))] shadow-[0_16px_46px_-18px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.04)]"

/** Level 3: Nested strips and cards inside overview sections — soft well, lighter than section shell. */
export const OVERVIEW_INNER_WELL_SURFACE_CLASS =
  "rounded-xl border border-[color-mix(in_oklab,var(--token-border-muted)_78%,transparent)] bg-[color-mix(in_oklab,var(--token-surface-alt)_88%,var(--token-surface))] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.055),0_3px_18px_-10px_rgba(0,0,0,0.42)]"
