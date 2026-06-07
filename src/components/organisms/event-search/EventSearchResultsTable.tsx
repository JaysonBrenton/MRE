/**
 * @fileoverview Event search results table shell — fixed header, scrollable body
 *
 * @description Header table sits outside the vertical scroll region so rows cannot
 *              paint above the header. Both tables use viewport-first column widths
 *              (fixed utility cols + proportional name cols).
 *
 * @relatedFiles
 * - src/components/organisms/event-search/EventSearchTableHeader.tsx
 * - src/components/organisms/event-search/EventTable.tsx
 */

"use client"

import type { ReactNode } from "react"
import { EVENT_SEARCH_TABLE_CLASS } from "./event-search-table-layout"
import EventSearchTableColgroup from "./EventSearchTableColgroup"

export interface EventSearchResultsTableProps {
  /** Renders a <tr> with <th> cells */
  header: ReactNode
  /** Renders <tr> rows */
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export default function EventSearchResultsTable({
  header,
  children,
  className = "",
  bodyClassName = "",
}: EventSearchResultsTableProps) {
  return (
    <div
      className={`flex min-h-0 w-full min-w-0 flex-1 flex-col ${className}`.trim()}
      style={{ minWidth: "20rem", boxSizing: "border-box" }}
    >
      <div className="shrink-0 overflow-hidden">
        <table className={EVENT_SEARCH_TABLE_CLASS}>
          <EventSearchTableColgroup />
          <thead>{header}</thead>
        </table>
      </div>
      <div
        className={`scrollbar-none min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${bodyClassName}`.trim()}
        style={{ overflowAnchor: "none", overscrollBehavior: "contain" }}
      >
        <table className={EVENT_SEARCH_TABLE_CLASS}>
          <EventSearchTableColgroup />
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}
