/**
 * @fileoverview Spacing shell for ListPagination in the Event Search modal.
 */

import type { ReactNode } from "react"

export default function EventSearchPaginationFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 shrink-0 border-t border-[var(--token-border-accent-soft)] pt-6">
      {children}
    </div>
  )
}
