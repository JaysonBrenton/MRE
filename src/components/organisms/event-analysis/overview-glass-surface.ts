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

/** Event details outer shell only (Overview “Event details” card). Highlights keep {@link OVERVIEW_SECTION_SURFACE_CLASS}. */
export const EVENT_DETAILS_SECTION_SURFACE_CLASS =
  "rounded-2xl border border-[color-mix(in_oklab,var(--token-border-muted)_92%,transparent)] bg-[color-mix(in_oklab,var(--token-surface-elevated)_86%,var(--token-surface))] shadow-[0_20px_54px_-22px_rgba(0,0,0,0.64),inset_0_1px_0_0_rgba(255,255,255,0.046)]"

/** Segmented Host / Track / Weather / Mix control — step down from section shell. */
export const EVENT_DETAILS_TAB_STRIP_WELL_CLASS =
  "rounded-xl border border-[color-mix(in_oklab,var(--token-border-muted)_74%,transparent)] bg-[color-mix(in_oklab,var(--token-surface-alt)_50%,var(--token-surface))] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.032)]"

/** Metrics summary strip wrapper (recessed band below tabs). */
export const EVENT_DETAILS_STATS_STRIP_WELL_CLASS =
  "rounded-xl border border-[color-mix(in_oklab,var(--token-border-muted)_70%,transparent)] bg-[color-mix(in_oklab,var(--token-surface-alt)_42%,var(--token-surface))] p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.028)] sm:p-3.5"

/** Inner grid for Races / Drivers / … counts — lifts slightly inside the stats strip. */
export const EVENT_DETAILS_STATS_GRID_CLASS =
  "rounded-lg border border-[color-mix(in_oklab,var(--token-border-muted)_55%,transparent)] bg-[color-mix(in_oklab,var(--token-surface-raised)_22%,var(--token-surface-alt))] px-3 py-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]"

/** Tab panel body (Host, Track, Weather, Mix) — deepest recessed floor in the card. */
export const EVENT_DETAILS_TAB_PANEL_WELL_CLASS =
  "rounded-xl border border-[color-mix(in_oklab,var(--token-border-muted)_66%,transparent)] bg-[color-mix(in_oklab,var(--token-surface)_48%,var(--token-surface-alt))] p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.024)]"

/** Empty / fallback copy inside Event details tab panels. */
export const EVENT_DETAILS_EMPTY_STATE_CLASS =
  "rounded-lg border border-dashed border-[color-mix(in_oklab,var(--token-border-muted)_56%,transparent)] bg-[color-mix(in_oklab,var(--token-surface-alt)_22%,var(--token-surface))] px-4 py-5 text-center text-sm leading-relaxed text-[var(--token-text-secondary)]"

/** One more inset step for mix summary tiles & chart block when nested inside {@link EVENT_DETAILS_TAB_PANEL_WELL_CLASS}. */
export const EVENT_DETAILS_NESTED_SURFACE_CLASS =
  "rounded-xl border border-[color-mix(in_oklab,var(--token-border-muted)_78%,transparent)] bg-[color-mix(in_oklab,var(--token-surface-elevated)_55%,var(--token-surface))] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.036)]"

/** Weather “at a glance” band inside Event details (single consumer). */
export const EVENT_DETAILS_WEATHER_GLANCE_CLASS =
  "rounded-xl border border-[color-mix(in_oklab,var(--token-border-muted)_72%,transparent)] bg-[color-mix(in_oklab,var(--token-surface-alt)_58%,var(--token-surface))] px-3 py-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.034)]"

export const EVENT_DETAILS_WEATHER_INFO_CALLOUT_CLASS =
  "rounded-xl border border-[color-mix(in_oklab,var(--token-border-muted)_70%,transparent)] bg-[color-mix(in_oklab,var(--token-surface-alt)_52%,var(--token-surface))] px-3 py-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]"

/** Host / Track Location, Contact, and Actions blocks — subtle lift inside tab panel well. */
export const EVENT_DETAILS_VENUE_SECTION_WELL_CLASS =
  "rounded-lg border border-[color-mix(in_oklab,var(--token-border-muted)_60%,transparent)] bg-[color-mix(in_oklab,var(--token-surface-raised)_14%,var(--token-surface))] p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] sm:p-4"
