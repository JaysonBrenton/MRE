/**
 * @fileoverview Reusable tooltip component with instant display and focus persistence
 *
 * @created 2025-01-29
 * @creator System
 * @lastModified 2025-01-29
 *
 * @description Portal-based tooltip component that displays instantly and stays visible
 *              while the target element has focus. Uses fixed positioning to avoid
 *              clipping by parent containers or sidebars.
 *
 * @purpose Provides consistent tooltip behavior across the application with:
 *          - Instant display (no delay)
 *          - Persists while element has focus
 *          - Portal-based rendering to avoid clipping
 *          - Accessible with proper ARIA attributes
 *
 * @usage
 * ```tsx
 * <Tooltip text="Tooltip text">
 *   <button>Hover me</button>
 * </Tooltip>
 * ```
 *
 * @relatedFiles
 * - src/components/event-analysis/ChartControls.tsx (uses this pattern)
 */

"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"

export interface TooltipProps {
  text: string
  children: React.ReactElement
  /** Optional position: 'top' (default), 'bottom', 'left', or 'right' */
  position?: "top" | "bottom" | "left" | "right"
}

/**
 * Tooltip component that uses portal to render above sidebar and other containers
 *
 * Wraps an interactive element and displays a tooltip on hover/focus.
 * The tooltip appears instantly and stays visible while the element has focus.
 */
export default function Tooltip({ text, children, position = "top" }: TooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const elementRef = useRef<HTMLElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [actualPosition, setActualPosition] = useState<"top" | "bottom" | "left" | "right">(
    position
  )

  // Store any ref that might be in the child's props (for forwardRef components)
  // In React 19, we cannot access element.ref directly. For forwardRef components,
  // refs are passed as props, so we can check for them here.
  const originalRefFromProps = React.isValidElement(children)
    ? (children.props as { ref?: React.Ref<HTMLElement> })?.ref
    : undefined

  // Create ref callback that handles both our ref and preserves any original ref
  // In React 19, refs are regular props for forwardRef components, so we can
  // access them from props. For DOM elements, refs are special and cannot be
  // preserved when cloning with a new ref (this is a React 19 limitation).
  const refCallback = useCallback(
    (node: HTMLElement | null) => {
      // Set our internal ref for tooltip positioning
      elementRef.current = node

      // Preserve original ref if it exists (for forwardRef components)
      if (originalRefFromProps) {
        if (typeof originalRefFromProps === "function") {
          originalRefFromProps(node)
        } else if (
          originalRefFromProps &&
          typeof originalRefFromProps === "object" &&
          "current" in originalRefFromProps
        ) {
          // For ref objects, update the current property
          // eslint-disable-next-line react-hooks/immutability
          ;(originalRefFromProps as React.MutableRefObject<HTMLElement | null>).current = node
        }
      }
    },
    [originalRefFromProps]
  )

  // Clone the child element to attach event handlers and ref
  const childProps = children.props as {
    className?: string
    onMouseEnter?: (e: React.MouseEvent) => void
    onMouseLeave?: (e: React.MouseEvent) => void
    onFocus?: (e: React.FocusEvent) => void
    onBlur?: (e: React.FocusEvent) => void
    title?: string
  }
  const existingClassName = childProps.className ?? ""
  const mergedClassName = existingClassName ? `${existingClassName} cursor-help` : "cursor-help"
  const childWithProps = React.cloneElement(children, {
    ref: refCallback,
    className: mergedClassName,
    onMouseEnter: (e: React.MouseEvent) => {
      setShowTooltip(true)
      childProps.onMouseEnter?.(e)
    },
    onMouseLeave: (e: React.MouseEvent) => {
      setShowTooltip(false)
      childProps.onMouseLeave?.(e)
    },
    onFocus: (e: React.FocusEvent) => {
      setShowTooltip(true)
      childProps.onFocus?.(e)
    },
    onBlur: (e: React.FocusEvent) => {
      setShowTooltip(false)
      childProps.onBlur?.(e)
    },
    title: undefined,
  } as Record<string, unknown>)

  useEffect(() => {
    if (!elementRef.current || !showTooltip) return

    const updatePosition = () => {
      if (!elementRef.current || !tooltipRef.current) return

      const elementRect = elementRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      }

      // Estimate tooltip dimensions if not yet rendered
      const tooltipWidth = tooltipRect.width || 200 // Fallback estimate
      const tooltipHeight = tooltipRect.height || 32 // Fallback estimate
      const gap = 8

      // Calculate ideal positions based on position prop
      let preferredTop = 0
      let preferredLeft = 0
      let finalPosition = position

      if (position === "right" || position === "left") {
        // Horizontal positioning (left/right)
        preferredTop = elementRect.top + elementRect.height / 2
        preferredLeft =
          position === "right" ? elementRect.right + gap : elementRect.left - tooltipWidth - gap

        // Auto-flip if needed
        if (position === "right" && preferredLeft + tooltipWidth > viewport.width - 8) {
          finalPosition = "left"
          preferredLeft = elementRect.left - tooltipWidth - gap
        } else if (position === "left" && preferredLeft < 8) {
          finalPosition = "right"
          preferredLeft = elementRect.right + gap
        }

        // Clamp horizontal position
        preferredLeft = Math.max(8, Math.min(viewport.width - tooltipWidth - 8, preferredLeft))

        // Clamp vertical position (centered on element)
        const halfTooltipHeight = tooltipHeight / 2
        preferredTop = Math.max(
          halfTooltipHeight + 8,
          Math.min(viewport.height - halfTooltipHeight - 8, preferredTop)
        )
      } else {
        // Vertical positioning (top/bottom)
        preferredTop =
          position === "top" ? elementRect.top - tooltipHeight - gap : elementRect.bottom + gap

        preferredLeft = elementRect.left + elementRect.width / 2

        // Determine if we should flip position due to viewport constraints
        if (position === "top" && preferredTop < 8) {
          // Not enough space above, flip to bottom
          finalPosition = "bottom"
          preferredTop = elementRect.bottom + gap
        } else if (position === "bottom" && preferredTop + tooltipHeight > viewport.height - 8) {
          // Not enough space below, flip to top
          finalPosition = "top"
          preferredTop = elementRect.top - tooltipHeight - gap
        }

        // Clamp horizontal position to keep within viewport
        const halfTooltipWidth = tooltipWidth / 2
        const minLeft = halfTooltipWidth + 8 // 8px padding from edge
        const maxLeft = viewport.width - halfTooltipWidth - 8

        preferredLeft = Math.max(minLeft, Math.min(maxLeft, preferredLeft))

        // Clamp vertical position to keep within viewport
        preferredTop = Math.max(8, Math.min(viewport.height - tooltipHeight - 8, preferredTop))
      }

      setActualPosition(finalPosition)
      setTooltipPosition({
        top: preferredTop,
        left: preferredLeft,
      })
    }

    // Use a slight delay to allow tooltip to render and get dimensions
    const timeoutId = setTimeout(updatePosition, 0)

    // Use requestAnimationFrame for smoother updates
    let rafId: number
    const handleUpdate = () => {
      rafId = requestAnimationFrame(() => {
        updatePosition()
      })
    }

    window.addEventListener("scroll", handleUpdate, true)
    window.addEventListener("resize", handleUpdate)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener("scroll", handleUpdate, true)
      window.removeEventListener("resize", handleUpdate)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [showTooltip, position])

  if (!showTooltip || !elementRef.current || typeof window === "undefined" || !document.body) {
    return childWithProps
  }

  // Tooltip content: whitespace-normal + break-words keep long text inside the border.
  // Do not use whitespace-nowrap—it causes overflow for descriptive tooltips (e.g. Average Lap).
  const tooltipContent = (
    <div
      ref={tooltipRef}
      className="fixed px-3 py-1.5 text-sm text-[var(--token-text-primary)] bg-[var(--token-surface-raised)] border border-[var(--token-border-default)] rounded-md shadow-lg whitespace-normal break-words pointer-events-none"
      role="tooltip"
      style={{
        top: `${tooltipPosition.top}px`,
        left: `${tooltipPosition.left}px`,
        transform:
          actualPosition === "left" || actualPosition === "right"
            ? "translateY(-50%)"
            : "translateX(-50%)",
        zIndex: 9999,
        maxWidth: `${Math.min(300, window.innerWidth - 16)}px`,
        visibility: tooltipPosition.top === 0 && tooltipPosition.left === 0 ? "hidden" : "visible",
      }}
    >
      {text}
      {/* Tooltip arrow */}
      {actualPosition === "top" && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
          <div className="w-2 h-2 bg-[var(--token-surface-raised)] border-r border-b border-[var(--token-border-default)] rotate-45"></div>
        </div>
      )}
      {actualPosition === "bottom" && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-px">
          <div className="w-2 h-2 bg-[var(--token-surface-raised)] border-l border-t border-[var(--token-border-default)] rotate-45"></div>
        </div>
      )}
      {actualPosition === "right" && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 -ml-px">
          <div className="w-2 h-2 bg-[var(--token-surface-raised)] border-l border-b border-[var(--token-border-default)] rotate-45"></div>
        </div>
      )}
      {actualPosition === "left" && (
        <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-px">
          <div className="w-2 h-2 bg-[var(--token-surface-raised)] border-r border-t border-[var(--token-border-default)] rotate-45"></div>
        </div>
      )}
    </div>
  )

  return (
    <>
      {childWithProps}
      {createPortal(tooltipContent, document.body)}
    </>
  )
}
