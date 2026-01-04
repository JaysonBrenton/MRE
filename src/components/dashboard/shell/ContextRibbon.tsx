"use client"

import { useState } from "react"
import { useDashboardContext } from "@/components/dashboard/context/DashboardContext"
import EventSearchModal from "./EventSearchModal"

export default function ContextRibbon() {
  const {
    selectedEventId,
    selectEvent,
  } = useDashboardContext()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2 transition hover:border-[var(--token-accent)]"
        aria-label="Select or change event"
      >
        <svg className="h-5 w-5 text-[var(--token-text-muted)]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <EventSearchModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelectEvent={selectEvent}
        selectedEventId={selectedEventId}
      />
    </>
  )
}
