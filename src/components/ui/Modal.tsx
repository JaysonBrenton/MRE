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
 * @relatedFiles
 * - docs/design/mre-mobile-ux-guidelines.md (mobile UX requirements)
 * - src/components/ui/ListRow.tsx (list row component for modal content)
 */

"use client"

import { ReactNode, useEffect, useRef } from "react"

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl"
  footer?: ReactNode
  ariaLabel?: string
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
}

/**
 * Modal component with enforced flexbox constraints
 * 
 * This component ensures proper width constraints throughout the modal structure:
 * - Backdrop container has min-w-0
 * - Modal container has explicit width constraints and flex-shrink-0
 * - All sections (header, body, footer) have proper width constraints
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
  children,
  maxWidth = "2xl",
  footer,
  ariaLabel,
}: ModalProps) {
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

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabel || "modal-title"}
      style={{ minWidth: 0 }}
    >
      <div
        ref={modalRef}
        className={`w-full ${maxWidthClasses[maxWidth]} max-h-[90vh] bg-[var(--token-surface)] rounded-lg shadow-lg flex flex-col sm:max-h-[600px]`}
        onClick={(e) => e.stopPropagation()}
        style={{ 
          minWidth: 0,
          width: '100%',
          maxWidth: maxWidth === '2xl' ? '42rem' : undefined,
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-4 border-b border-[var(--token-border-default)]"
          style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}
        >
          <h2 
            id={ariaLabel || "modal-title"}
            className="text-lg font-semibold text-[var(--token-text-primary)]"
            style={{ minWidth: 0, flex: '1 1 auto' }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md flex-shrink-0"
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

        {/* Body */}
        <div 
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ 
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div 
            className="px-4 py-4 border-t border-[var(--token-border-default)]"
            style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

