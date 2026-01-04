/**
 * @fileoverview Event Search modal component
 * 
 * @created 2025-02-09
 * @creator System
 * @lastModified 2025-02-09
 * 
 * @description Modal wrapper for EventSearchContainer that allows users to search
 *              for events and select one to set as the dashboard's active event.
 * 
 * @purpose Provides the full Event Search interface in a modal, allowing users
 *          to search by track and date range, then select an event to activate
 *          in the dashboard context.
 */

"use client"

import Modal from "@/components/ui/Modal"
import EventSearchContainer from "@/components/event-search/EventSearchContainer"

interface EventSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectEvent: (eventId: string) => void
  selectedEventId: string | null
}

export default function EventSearchModal({
  isOpen,
  onClose,
  onSelectEvent,
  selectedEventId,
}: EventSearchModalProps) {
  const handleSelectForDashboard = (eventId: string) => {
    onSelectEvent(eventId)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Event Search"
      maxWidth="4xl"
      ariaLabel="Event search modal"
    >
      <div className="p-6">
        <EventSearchContainer onSelectForDashboard={handleSelectForDashboard} />
      </div>
    </Modal>
  )
}

