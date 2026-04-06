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
 *          in the dashboard context. Panel uses the same native resize + backdrop
 *          pointer-dismiss pattern as @/components/molecules/Modal.
 */

"use client"

import { X } from "lucide-react"
import type { CSSProperties } from "react"
import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import EventSearchContainer from "@/components/organisms/event-search/EventSearchContainer"
import { useModalPanelDrag } from "@/hooks/useModalPanelDrag"
import {
  getModalResizableContainerStyles,
  MODAL_MAX_WIDTHS,
  MODAL_PORTAL_Z_INDEX,
} from "@/lib/modal-styles"

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
  const backdropRef = useRef<HTMLDivElement>(null)
  const { offset: dragOffset, isDragging, headerPointerDown } = useModalPanelDrag(isOpen, modalRef)

  // Reset overlay scroll so the panel is not partially scrolled out of view (fixes clipped top on open)
  useEffect(() => {
    if (!isOpen) return
    const el = backdropRef.current
    if (!el) return
    el.scrollTop = 0
    requestAnimationFrame(() => {
      el.scrollTop = 0
    })
  }, [isOpen])

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

  // Portal to document.body so fixed + z-index stack above shell chrome (TopStatusBar z-40, nav z-10)
  // without being trapped under a parent stacking context.
  if (typeof document === "undefined") return null

  const panelStyles: CSSProperties = {
    ...getModalResizableContainerStyles(MODAL_MAX_WIDTHS["4xl"]),
    resize: "both",
    overflow: "hidden",
    minHeight: "12rem",
    maxHeight: "min(92dvh, calc(100dvh - 7rem))",
    transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
  }

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 flex min-h-full items-start justify-center overflow-y-auto overscroll-contain bg-black/75 px-4 pb-10 pt-10 sm:px-6 sm:pb-12 sm:pt-12"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-search-modal-title"
      style={{ minWidth: 0, zIndex: MODAL_PORTAL_Z_INDEX }}
    >
      <div
        ref={modalRef}
        className="min-h-0 shrink-0 bg-[var(--token-surface-raised)] rounded-lg shadow-2xl flex flex-col border border-[var(--token-border-accent-soft)]"
        style={panelStyles}
      >
        {/* Header — drag handle (close button excluded via hook) */}
        <div
          className={`flex shrink-0 select-none items-center justify-between px-4 py-4 border-b border-[var(--token-border-accent-soft)] ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{ minWidth: 0, width: "100%", boxSizing: "border-box", touchAction: "none" }}
          onPointerDown={headerPointerDown}
        >
          <h2
            id="event-search-modal-title"
            className="text-lg font-semibold text-[var(--token-text-primary)]"
            style={{ minWidth: 0, flex: "1 1 auto" }}
          >
            Event Search
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 flex items-center justify-center text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md flex-shrink-0"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Body: flex column so form stays fixed, only results scroll */}
        <div
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
          style={{
            minWidth: "20rem",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div
            className="flex-1 min-h-0 flex flex-col p-6"
            style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
          >
            <EventSearchContainer onSelectForDashboard={handleSelectForDashboard} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
