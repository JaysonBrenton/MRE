/**
 * Shared layout for event search results tables (events + practice days).
 * Viewport-first: utility columns are fixed width; name columns share the remainder.
 */

export const EVENT_SEARCH_TABLE_CLASS = "w-full min-w-0 table-fixed border-collapse"

/** Share of table width for event / track name columns (utility cols use rem). */
export const EVENT_SEARCH_EVENT_NAME_COL_PERCENT = "34%"
export const EVENT_SEARCH_TRACK_NAME_COL_PERCENT = "24%"

/** Status badge track width (see EventStatusBadge). */
export const EVENT_SEARCH_STATUS_COL_WIDTH = "8rem"

/** Fits dd-MM-YYYY and "Date not available". */
export const EVENT_SEARCH_DATE_COL_WIDTH = "7.5rem"

/** Fits Download/Open (6.5rem) and Retry import. */
export const EVENT_SEARCH_ACTIONS_COL_WIDTH = "8.5rem"

export const EVENT_SEARCH_TABLE_HEAD_CELL_CLASS =
  "px-4 py-3 text-sm font-medium text-[var(--token-text-secondary)] border-b border-[var(--token-border-default)] bg-[var(--token-surface-raised)]"

export const EVENT_SEARCH_TABLE_BODY_CELL_CLASS =
  "px-4 py-4 align-top border-b border-[var(--token-border-default)]"

/** Lets table-fixed % columns shrink; long names scroll inside the cell. */
export const EVENT_SEARCH_TABLE_NAME_CELL_CLASS = "max-w-0 overflow-hidden"

export const EVENT_SEARCH_TABLE_BODY_ROW_CLASS =
  "transition-colors duration-200 hover:bg-[var(--token-surface-raised)]"

/** Scroll wrapper for single-line names that exceed the allocated column width. */
export const EVENT_SEARCH_TABLE_NAME_SCROLL_CLASS = "max-w-full overflow-x-auto scrollbar-none"

/** Event and track names: single line; scroll horizontally inside the cell when needed. */
export const EVENT_SEARCH_TABLE_NAME_TEXT_CLASS =
  "inline-block whitespace-nowrap text-sm text-[var(--token-text-secondary)]"

export const EVENT_SEARCH_TABLE_EVENT_NAME_TEXT_CLASS =
  "inline-block whitespace-nowrap text-sm text-[var(--token-text-primary)]"
