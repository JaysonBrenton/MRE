/**
 * @fileoverview Chart color picker component - preset colors and custom color picker
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Color picker component for chart color customization with preset palette and custom color option
 *
 * @purpose Provides UI for users to select chart colors from preset palette or custom color picker.
 *          Designed to work with dark theme.
 *
 * @relatedFiles
 * - src/hooks/useChartColors.ts (color state management)
 * - src/components/event-analysis/ChartContainer.tsx (chart container)
 */

"use client"

import { useState, useRef, useEffect, useLayoutEffect } from "react"
import { createPortal } from "react-dom"

/**
 * Preset color palette optimized for dark theme
 * Includes the default accent color and other colors from the chart design standards
 */
export const PRESET_COLORS = [
  "#3a8eff", // Default accent (var(--token-accent))
  "#5aa2ff", // Average lap color
  "#4ecdc4", // Teal
  "#ff6b6b", // Red
  "#ffe66d", // Yellow
  "#a8e6cf", // Mint green
  "#ff8b94", // Pink
  "#9b59b6", // Purple
  "#f39c12", // Orange
  "#1abc9c", // Turquoise
  "#e74c3c", // Dark red
  "#3498db", // Light blue
] as const

export interface ChartColorPickerProps {
  currentColor: string
  onColorChange: (color: string) => void
  onClose: () => void
  position?: { top: number; left: number }
  label?: string
}

/**
 * Chart color picker with preset colors and custom color input
 */
export default function ChartColorPicker({
  currentColor,
  onColorChange,
  onClose,
  position,
  label,
}: ChartColorPickerProps) {
  const [customColorValue, setCustomColorValue] = useState(currentColor)
  const [adjustedPosition, setAdjustedPosition] = useState<{ top: number; left: number } | null>(
    position || null
  )
  const popoverRef = useRef<HTMLDivElement>(null)

  // Adjust position to stay within viewport bounds
  useLayoutEffect(() => {
    if (!position || !popoverRef.current) {
      // Use requestAnimationFrame to avoid synchronous setState
      requestAnimationFrame(() => {
        setAdjustedPosition(position || null)
      })
      return
    }

    const popover = popoverRef.current
    const rect = popover.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const padding = 8 // Minimum padding from viewport edges

    let adjustedTop = position.top
    let adjustedLeft = position.left

    // Check if popover overflows right edge
    if (rect.right > viewportWidth - padding) {
      adjustedLeft = viewportWidth - rect.width - padding
    }

    // Check if popover overflows left edge
    if (rect.left < padding) {
      adjustedLeft = padding
    }

    // Check if popover overflows bottom edge
    if (rect.bottom > viewportHeight - padding) {
      // Try to position above the trigger instead
      adjustedTop = position.top - rect.height - 8
      // If that would overflow top, position at bottom with padding
      if (adjustedTop < padding) {
        adjustedTop = viewportHeight - rect.height - padding
      }
    }

    // Check if popover overflows top edge
    if (rect.top < padding) {
      adjustedTop = padding
    }

    // Use requestAnimationFrame to avoid synchronous setState
    requestAnimationFrame(() => {
      setAdjustedPosition({ top: adjustedTop, left: adjustedLeft })
    })
  }, [position])

  // Handle clicks outside the popover to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [onClose])

  // Handle Escape key to close
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose])

  const handlePresetColorClick = (color: string) => {
    onColorChange(color)
    onClose()
  }

  const handleCustomColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const color = event.target.value
    setCustomColorValue(color)
    onColorChange(color)
  }

  // Convert CSS variable to hex if needed (for default accent color)
  const getDisplayColor = (color: string): string => {
    if (color.startsWith("var(--token-accent)")) {
      return "#3a8eff" // Default accent color hex value
    }
    if (color.startsWith("var(")) {
      // If it's a CSS variable, we can't easily get the computed value here
      // Just return the first preset color as fallback
      return PRESET_COLORS[0]
    }
    return color
  }

  const displayColor = getDisplayColor(currentColor)

  const popoverStyle: React.CSSProperties = adjustedPosition
    ? {
        position: "fixed",
        top: `${adjustedPosition.top}px`,
        left: `${adjustedPosition.left}px`,
        zIndex: 9999,
      }
    : position
      ? {
          position: "fixed",
          top: `${position.top}px`,
          left: `${position.left}px`,
          zIndex: 9999,
        }
      : {
          position: "absolute",
          top: "100%",
          left: 0,
          marginTop: "8px",
          zIndex: 9999,
        }

  const popoverContent = (
    <div
      ref={popoverRef}
      className="bg-[var(--token-surface-elevated)] border border-[var(--token-border-default)] rounded-lg shadow-lg p-4 min-w-[280px]"
      style={popoverStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {label && (
        <div className="text-sm font-semibold text-[var(--token-text-primary)] mb-3">{label}</div>
      )}

      {/* Preset Colors */}
      <div className="mb-4">
        <div className="text-xs font-medium text-[var(--token-text-secondary)] mb-2">
          Preset Colors
        </div>
        <div className="grid grid-cols-6 gap-2">
          {PRESET_COLORS.map((color) => {
            const isSelected = displayColor.toLowerCase() === color.toLowerCase()
            return (
              <button
                key={color}
                type="button"
                onClick={() => handlePresetColorClick(color)}
                className={`w-8 h-8 rounded border-2 transition-all hover:scale-110 ${
                  isSelected
                    ? "border-[var(--token-accent)] ring-2 ring-[var(--token-accent)] ring-offset-1 ring-offset-[var(--token-surface-elevated)]"
                    : "border-[var(--token-border-default)] hover:border-[var(--token-border-default)]"
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Select color ${color}`}
                title={color}
              />
            )
          })}
        </div>
      </div>

      {/* Custom Color Picker */}
      <div className="border-t border-[var(--token-border-default)] pt-4">
        <div className="text-xs font-medium text-[var(--token-text-secondary)] mb-2">
          Custom Color
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <input
              type="color"
              value={displayColor}
              onChange={handleCustomColorChange}
              className="w-full h-10 rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] cursor-pointer"
              aria-label="Custom color picker"
            />
          </div>
          <input
            type="text"
            value={displayColor}
            onChange={(e) => {
              const value = e.target.value
              setCustomColorValue(value)
              // Validate and apply hex color on blur or Enter
              if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)) {
                onColorChange(value)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur()
              }
            }}
            className="w-20 px-2 py-1 text-sm rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-accent)]"
            placeholder="#000000"
            aria-label="Hex color code"
          />
        </div>
      </div>
    </div>
  )

  // Render using portal to avoid stacking context issues
  // This ensures the popover appears above all other content
  if (typeof window !== "undefined" && document.body) {
    return createPortal(popoverContent, document.body)
  }

  // Fallback for SSR (shouldn't happen in practice since this is a client component)
  return popoverContent
}
