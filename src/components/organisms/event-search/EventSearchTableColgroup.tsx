import {
  EVENT_SEARCH_ACTIONS_COL_WIDTH,
  EVENT_SEARCH_DATE_COL_WIDTH,
  EVENT_SEARCH_EVENT_NAME_COL_PERCENT,
  EVENT_SEARCH_STATUS_COL_WIDTH,
  EVENT_SEARCH_TRACK_NAME_COL_PERCENT,
} from "./event-search-table-layout"

/** Viewport-first column widths — identical on header and body tables (split scroll). */
export default function EventSearchTableColgroup() {
  return (
    <colgroup>
      <col style={{ width: EVENT_SEARCH_EVENT_NAME_COL_PERCENT }} />
      <col style={{ width: EVENT_SEARCH_TRACK_NAME_COL_PERCENT }} />
      <col style={{ width: EVENT_SEARCH_STATUS_COL_WIDTH }} />
      <col style={{ width: EVENT_SEARCH_DATE_COL_WIDTH }} />
      <col style={{ width: EVENT_SEARCH_ACTIONS_COL_WIDTH }} />
    </colgroup>
  )
}
