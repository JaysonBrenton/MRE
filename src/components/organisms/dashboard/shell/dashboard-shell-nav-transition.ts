/**
 * Shared motion for nav rail width and any layout keyed off --nav-width
 * (scroll padding, fixed chrome `left`). Keeps perceived sync and a11y timing.
 */
export const DASHBOARD_NAV_SHELL_MOTION_TIMING =
  "duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0"

export const DASHBOARD_NAV_RAIL_TRANSITION_CLASS = `transition-[width,transform] ${DASHBOARD_NAV_SHELL_MOTION_TIMING}`

export const DASHBOARD_NAV_SCROLL_PADDING_TRANSITION_CLASS = `transition-[padding-left] ${DASHBOARD_NAV_SHELL_MOTION_TIMING}`

export const DASHBOARD_NAV_FIXED_LEFT_TRANSITION_CLASS = `transition-[left] ${DASHBOARD_NAV_SHELL_MOTION_TIMING}`
