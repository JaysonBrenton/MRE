/**
 * @fileoverview Shared modal container styles to prevent horizontal compression
 * 
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 * 
 * @description Provides consistent inline styles for modal containers to prevent
 *              flexbox horizontal compression issues. These styles must be applied
 *              to any modal container that is a direct child of a flex container
 *              with items-center or justify-center alignment.
 * 
 * @purpose Prevents modal containers from being compressed below their minimum
 *          width. This is a critical fix for flex containers that use
 *          items-center/justify-center with children that have w-full max-w-*.
 * 
 * @usage
 * ```tsx
 * import { getModalContainerStyles } from "@/lib/modal-styles"
 * 
 * <div style={getModalContainerStyles('28rem')}>
 *   {modal content}
 * </div>
 * ```
 * 
 * @relatedFiles
 * - src/components/ui/Modal.tsx (uses this pattern)
 * - docs/development/FLEXBOX_LAYOUT_CHECKLIST.md (reference)
 * - docs/architecture/mobile-safe-architecture-guidelines.md (requirements)
 */

import type { CSSProperties } from 'react'

/**
 * Gets the required inline styles for a modal container to prevent horizontal compression.
 * 
 * These styles must be applied to modal containers that are direct children of flex
 * containers with items-center or justify-center. Without these styles, modals can
 * be compressed to extremely narrow widths (e.g., 34px) due to flexbox behavior.
 * 
 * @param maxWidth - Maximum width in rem units (e.g., '28rem', '36rem', '42rem')
 * @returns Object with required inline styles
 * 
 * @example
 * ```tsx
 * // For a medium modal (max-w-md equivalent)
 * <div style={getModalContainerStyles('28rem')}>
 * 
 * // For a large modal (max-w-xl equivalent)
 * <div style={getModalContainerStyles('36rem')}>
 * ```
 */
export function getModalContainerStyles(maxWidth: string): CSSProperties {
  return {
    width: '100%',
    maxWidth: maxWidth,
    minWidth: '20rem', // 320px - prevents compression below this width
    boxSizing: 'border-box',
    flexShrink: 0, // Critical: prevents flex container from compressing the modal
    flexGrow: 0, // Prevents flex container from expanding beyond maxWidth
  }
}

/**
 * Common modal max-width values in rem units
 * These match Tailwind's max-width classes:
 * - sm: 24rem (384px) - max-w-sm
 * - md: 28rem (448px) - max-w-md
 * - lg: 32rem (512px) - max-w-lg
 * - xl: 36rem (576px) - max-w-xl
 * - 2xl: 42rem (672px) - max-w-2xl
 * - 3xl: 48rem (768px) - max-w-3xl
 * - 4xl: 56rem (896px) - max-w-4xl
 */
export const MODAL_MAX_WIDTHS = {
  sm: '24rem',
  md: '28rem',
  lg: '32rem',
  xl: '36rem',
  '2xl': '42rem',
  '3xl': '48rem',
  '4xl': '56rem',
} as const

