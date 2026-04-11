/**
 * @fileoverview Shared list/table pagination defaults (ListPagination rows-per-page).
 */

/** Standard rows-per-page choices for all list/table pagination. */
export const TABLE_ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const

export const DEFAULT_TABLE_ROWS_PER_PAGE = 10

const ALLOWED = new Set<number>(TABLE_ROWS_PER_PAGE_OPTIONS)

/** Maps stored or legacy values onto {@link TABLE_ROWS_PER_PAGE_OPTIONS}. */
export function normalizeTableRowsPerPage(value: number): number {
  return ALLOWED.has(value) ? value : DEFAULT_TABLE_ROWS_PER_PAGE
}
