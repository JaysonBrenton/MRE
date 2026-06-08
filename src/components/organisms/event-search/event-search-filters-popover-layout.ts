/** Popover width matches Tailwind `w-[20rem]`. */
export const EVENT_SEARCH_FILTERS_POPOVER_WIDTH_PX = 320

const VIEWPORT_PADDING_PX = 8
const TRIGGER_GAP_PX = 8
/** Prefer flipping above the trigger when less than this space remains below. */
const MIN_COMFORTABLE_SPACE_BELOW_PX = 160

export interface EventSearchFiltersPopoverRect {
  top: number
  left: number
  width: number
  maxHeight: number
}

/**
 * Computes fixed positioning for the portaled Filters popover from the trigger button rect.
 * Keeps the panel in the viewport and prefers opening above when space below is tight.
 */
export function computeEventSearchFiltersPopoverRect(
  triggerRect: DOMRect,
  viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1024,
  viewportHeight = typeof window !== "undefined" ? window.innerHeight : 768
): EventSearchFiltersPopoverRect {
  const width = Math.min(EVENT_SEARCH_FILTERS_POPOVER_WIDTH_PX, viewportWidth * 0.9)
  const left = Math.max(
    VIEWPORT_PADDING_PX,
    Math.min(triggerRect.left, viewportWidth - width - VIEWPORT_PADDING_PX)
  )

  const spaceBelow = viewportHeight - triggerRect.bottom - TRIGGER_GAP_PX - VIEWPORT_PADDING_PX
  const spaceAbove = triggerRect.top - TRIGGER_GAP_PX - VIEWPORT_PADDING_PX

  const openBelow = spaceBelow >= MIN_COMFORTABLE_SPACE_BELOW_PX || spaceBelow >= spaceAbove
  if (openBelow) {
    const top = triggerRect.bottom + TRIGGER_GAP_PX
    return {
      top,
      left,
      width,
      maxHeight: Math.max(120, spaceBelow),
    }
  }

  const maxHeight = Math.max(120, spaceAbove)
  const top = Math.max(VIEWPORT_PADDING_PX, triggerRect.top - TRIGGER_GAP_PX - maxHeight)
  return { top, left, width, maxHeight }
}
