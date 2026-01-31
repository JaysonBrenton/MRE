/**
 * @fileoverview Shared modal container styles and content block width utilities to prevent horizontal compression
 *
 * @created 2025-01-28
 * @creator System
 * @lastModified 2026-01-26
 *
 * @description Provides consistent inline styles for modal containers and content blocks to prevent
 *              flexbox horizontal compression issues. These styles must be applied to:
 *              1. Modal containers that are direct children of flex containers with items-center/justify-center
 *              2. Content blocks (empty states, messages, etc.) inside scrollable flex containers
 *
 * @purpose Prevents horizontal compression bugs that cause content to collapse to 0 width.
 *          This is the #1 recurring layout bug - always use these utilities when creating
 *          scrollable flex layouts or content blocks in flex containers.
 *
 * @usage
 * ```tsx
 * import { getModalContainerStyles, getContentBlockStyles, getContentBlockStylesWithMax } from "@/lib/modal-styles"
 *
 * // Modal container
 * <div style={getModalContainerStyles('28rem')}>
 *   {modal content}
 * </div>
 *
 * // Content block (empty state, message, etc.)
 * <div style={getContentBlockStyles()}>
 *   <p>Content that won't compress</p>
 * </div>
 *
 * // Content block with max width (centered content)
 * <div style={getContentBlockStylesWithMax('28rem')}>
 *   <p>Centered content with max width</p>
 * </div>
 * ```
 *
 * @relatedFiles
 * - src/components/ui/Modal.tsx (uses this pattern)
 * - docs/development/FLEXBOX_LAYOUT_CHECKLIST.md (reference - see "Content Blocks in Scrollable Flex Containers")
 * - docs/architecture/mobile-safe-architecture-guidelines.md (requirements)
 */

import type { CSSProperties } from "react"

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
    width: "100%",
    maxWidth: maxWidth,
    minWidth: "20rem", // 320px - prevents compression below this width
    boxSizing: "border-box",
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
/**
 * Gets the required inline styles for content blocks inside scrollable flex containers.
 *
 * **CRITICAL:** Use this for ALL content blocks (empty states, loading messages, error messages, etc.)
 * inside scrollable flex containers. Without these styles, content will collapse to 0 width.
 *
 * This is the #1 recurring layout bug. Always use this utility when creating content blocks
 * in flex layouts, especially when using `overflow-y-auto` or `overflow-y-scroll`.
 *
 * @param minWidth - Minimum width in rem units (default: '20rem' / 320px)
 * @returns Object with required inline styles
 *
 * @example
 * ```tsx
 * // Empty state wrapper
 * <div style={getContentBlockStyles()}>
 *   <p>Content that won't compress</p>
 * </div>
 *
 * // With custom minimum width
 * <div style={getContentBlockStyles('24rem')}>
 *   <p>Wider minimum</p>
 * </div>
 * ```
 */
export function getContentBlockStyles(minWidth: string = "20rem"): CSSProperties {
  return {
    minWidth,
    width: "100%",
    boxSizing: "border-box",
  }
}

/**
 * Gets the required inline styles for content blocks with a maximum width (for centered content).
 *
 * Use this for inner content divs that should be centered with a max width (e.g., `max-w-md` equivalent).
 * This prevents compression while also limiting maximum width for readability.
 *
 * @param maxWidth - Maximum width in rem units (e.g., '28rem' for max-w-md)
 * @param minWidth - Minimum width in rem units (default: '20rem' / 320px)
 * @returns Object with required inline styles
 *
 * @example
 * ```tsx
 * // Centered content with max width (max-w-md equivalent)
 * <div style={getContentBlockStylesWithMax('28rem')}>
 *   <p>Centered content that won't compress</p>
 * </div>
 *
 * // With custom min/max
 * <div style={getContentBlockStylesWithMax('36rem', '24rem')}>
 *   <p>Wider content</p>
 * </div>
 * ```
 */
export function getContentBlockStylesWithMax(
  maxWidth: string,
  minWidth: string = "20rem"
): CSSProperties {
  return {
    minWidth,
    maxWidth,
    width: "100%",
    boxSizing: "border-box",
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
  sm: "24rem",
  md: "28rem",
  lg: "32rem",
  xl: "36rem",
  "2xl": "42rem",
  "3xl": "48rem",
  "4xl": "56rem",
} as const
