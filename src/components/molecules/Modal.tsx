/**
 * @fileoverview Reusable modal component with proper flexbox constraints
 *
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 *
 * @description Reusable modal component that enforces proper width constraints
 *              to prevent horizontal compression issues in flex layouts.
 *
 * @purpose Provides a consistent modal pattern that prevents flexbox shrink issues.
 *          All modals should use this component instead of custom implementations.
 *
 * @critical Backdrop dismiss uses onPointerDown (not click) so resize drags that end over the
 *           dimmed area do not close the dialog. Renders via createPortal(document.body) so fixed
 *           positioning is not clipped by ancestor overflow/transform. If you must create a custom
 *           modal (NOT RECOMMENDED),
 *           you MUST apply the same inline styles used in this component to prevent horizontal
 *           compression. See getModalContainerStyles() in @/lib/modal-styles.ts
 *           for the required styles pattern.
 *
 * @relatedFiles
 * - src/lib/modal-styles.ts (shared styles utility for custom modals)
 * - docs/development/FLEXBOX_LAYOUT_CHECKLIST.md (prevention checklist)
 * - docs/architecture/mobile-safe-architecture-guidelines.md (requirements)
 * - src/components/atoms/ListRow.tsx (list row component for modal content)
 */

"use client"

import type { CSSProperties } from "react"
import { ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import {
  getModalContainerStyles,
  getModalResizableContainerStyles,
  MODAL_MAX_WIDTHS,
  MODAL_PORTAL_Z_INDEX,
} from "@/lib/modal-styles"
import { useModalPanelDrag } from "@/hooks/useModalPanelDrag"

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  /** Renders directly below the title, above the header border */
  subtitle?: ReactNode
  children: ReactNode
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl"
  footer?: ReactNode
  ariaLabel?: string
  /**
   * When true (default), the dialog can be resized horizontally and vertically by dragging the
   * bottom-right corner (native browser handle; best supported on desktop).
   */
  resizable?: boolean
  /**
   * When `resizable` is true, optional starting width/height (CSS lengths, e.g. `"42rem"` or `"720px"`).
   * Overrides the default width from `maxWidth`; sets an initial height (otherwise content-driven).
   */
  resizableDefaultSize?: { width: string; height: string }
  /**
   * When true, double-clicking the header (not the close button) toggles the panel between normal
   * layout and filling the viewport. Opt-in so most modals keep the default behavior.
   */
  doubleClickHeaderFullscreen?: boolean
}

// Use shared modal styles utility to ensure consistency
// This prevents horizontal compression issues in flex containers
const maxWidthInRem = MODAL_MAX_WIDTHS

function getDocumentBody(): HTMLElement | null {
  return typeof document !== "undefined" ? document.body : null
}

/**
 * Modal component with enforced flexbox constraints
 *
 * This component ensures proper width constraints throughout the modal structure:
 * - Backdrop container has min-w-0
 * - Modal container has explicit width constraints and flex-shrink-0
 * - All sections (header, body, footer) have proper width constraints; body uses px-4 py-4 to align with header/footer
 * - Prevents horizontal compression issues
 *
 * Usage:
 * ```tsx
 * <Modal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Modal Title"
 *   maxWidth="2xl"
 * >
 *   <div>Modal content</div>
 * </Modal>
 * ```
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "2xl",
  footer,
  ariaLabel,
  resizable = true,
  doubleClickHeaderFullscreen = false,
  resizableDefaultSize,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const portalTarget = useSyncExternalStore(
    () => () => {},
    getDocumentBody,
    () => null
  )
  const fullscreenToggle = doubleClickHeaderFullscreen ? isFullscreen : undefined
  const {
    offset: dragOffset,
    isDragging,
    headerPointerDown,
  } = useModalPanelDrag(isOpen, modalRef, fullscreenToggle)

  // Prevent background scroll; modal is portaled to body so layout scroll does not clip it
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) return
    queueMicrotask(() => setIsFullscreen(false))
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

  if (!isOpen || !portalTarget) return null

  const fullscreenPanel =
    doubleClickHeaderFullscreen && isFullscreen
      ? ({
          width: "100%",
          height: "100%",
          maxWidth: "none",
          minWidth: "20rem",
          maxHeight: "none",
          minHeight: 0,
          boxSizing: "border-box",
          flexShrink: 0,
          overflow: "hidden",
          resize: "none",
        } satisfies CSSProperties)
      : null

  const panelStyles: CSSProperties = {
    ...(fullscreenPanel
      ? fullscreenPanel
      : resizable
        ? {
            ...(resizableDefaultSize
              ? {
                  width: resizableDefaultSize.width,
                  height: resizableDefaultSize.height,
                  maxWidth: "min(96vw, 100vw - 2rem)",
                  minWidth: "20rem",
                  boxSizing: "border-box" as const,
                  flexShrink: 0,
                  flexGrow: 0,
                }
              : getModalResizableContainerStyles(maxWidthInRem[maxWidth])),
            resize: "both",
            overflow: "hidden",
            minHeight: "12rem",
            maxHeight: "calc(100vh - 2rem)",
          }
        : getModalContainerStyles(maxWidthInRem[maxWidth])),
    transform:
      doubleClickHeaderFullscreen && isFullscreen
        ? undefined
        : `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
  }

  const backdropFullscreen = doubleClickHeaderFullscreen && isFullscreen

  return createPortal(
    <div
      className={`fixed inset-0 bg-black/70 backdrop-blur-[2px] ${
        backdropFullscreen
          ? "overflow-hidden p-0"
          : "flex items-start justify-center overflow-y-auto p-4"
      }`}
      onPointerDown={(e) => {
        // Use pointerdown (not click) so closing the overlay does not fire when a resize drag
        // ends with the pointer over the dimmed area (click would target the backdrop).
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabel || "modal-title"}
      style={{ minWidth: 0, zIndex: MODAL_PORTAL_Z_INDEX }}
    >
      <div
        ref={modalRef}
        className={`bg-[var(--token-surface-raised)] shadow-2xl flex flex-col border border-[var(--token-border-accent-soft)] ${
          backdropFullscreen
            ? "h-full w-full min-h-0 rounded-none"
            : `my-4 rounded-lg ${resizable ? "min-h-0" : "max-h-[calc(100vh-2rem)]"}`
        }`}
        style={panelStyles}
      >
        {/* Header — drag handle (excludes close button via hook) */}
        <div
          className={`flex shrink-0 select-none justify-between gap-4 px-4 py-4 border-b border-[var(--token-border-accent-soft)] ${subtitle ? "items-center" : "items-start"} ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{ minWidth: 0, width: "100%", boxSizing: "border-box", touchAction: "none" }}
          onPointerDown={headerPointerDown}
          onDoubleClick={(e) => {
            if (!doubleClickHeaderFullscreen) return
            const el = e.target as HTMLElement
            if (el.closest("button, a, input, select, textarea")) return
            e.preventDefault()
            setIsFullscreen((v) => !v)
          }}
          title={doubleClickHeaderFullscreen ? "Double-click to toggle full screen" : undefined}
        >
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <h2
              id={ariaLabel || "modal-title"}
              className="text-lg font-semibold text-[var(--token-text-primary)]"
            >
              {title}
            </h2>
            {subtitle && (
              <div className="mt-0.5 text-base font-semibold text-[var(--token-accent)] truncate">
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 flex items-center justify-center text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md flex-shrink-0"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4"
          style={{
            minWidth: 0,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="shrink-0 px-4 py-4 border-t border-[var(--token-border-accent-soft)]"
            style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    portalTarget
  )
}
