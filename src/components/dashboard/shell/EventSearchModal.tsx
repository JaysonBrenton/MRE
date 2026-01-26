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

import { useEffect, useRef } from "react"
import EventSearchContainer from "@/components/event-search/EventSearchContainer"
import { getModalContainerStyles, MODAL_MAX_WIDTHS } from "@/lib/modal-styles"

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
  const modalRef = useRef<HTMLDivElement>(null)

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  // Trap focus within the modal while it is open
  useEffect(() => {
    if (!isOpen) return
    const modalElement = modalRef.current
    if (!modalElement) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const focusableElements = modalElement.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
      if (focusableElements.length === 0) {
        return
      }
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    modalElement.addEventListener("keydown", handleKeyDown)
    return () => {
      modalElement.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  const handleSelectForDashboard = (eventId: string) => {
    onSelectEvent(eventId)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/75 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-search-modal-title"
      style={{ minWidth: 0, overflowY: 'auto' }}
    >
      <div
        ref={modalRef}
        className="max-h-[calc(100vh-2rem)] my-4 bg-[var(--token-surface-raised)] rounded-lg shadow-2xl flex flex-col border border-[var(--token-border-accent-soft)]"
        onClick={(e) => e.stopPropagation()}
        style={getModalContainerStyles(MODAL_MAX_WIDTHS['4xl'])}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-4 border-b border-[var(--token-border-accent-soft)]"
          style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}
        >
          <h2 
            id="event-search-modal-title"
            className="text-lg font-semibold text-[var(--token-text-primary)]"
            style={{ minWidth: 0, flex: '1 1 auto' }}
          >
            Event Search
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 flex items-center justify-center text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md flex-shrink-0"
            aria-label="Close modal"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body: flex column so form stays fixed, only results scroll */}
        <div 
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
          style={{ 
            minWidth: '20rem',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div
            className="flex-1 min-h-0 flex flex-col p-6"
            style={{ minWidth: '20rem', width: '100%', boxSizing: 'border-box' }}
          >
            <EventSearchContainer onSelectForDashboard={handleSelectForDashboard} />
          </div>
        </div>
      </div>
    </div>
  )
}

