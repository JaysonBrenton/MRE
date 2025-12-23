/**
 * @fileoverview Chart icon component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Reusable SVG chart/analytics icon component
 * 
 * @purpose Provides a consistent chart icon for linking to event analysis pages.
 *          Follows MRE dark theme guidelines with appropriate stroke colors.
 * 
 * @relatedFiles
 * - docs/design/mre-dark-theme-guidelines.md (theme guidelines)
 */

export interface ChartIconProps {
  className?: string
  size?: number
}

export default function ChartIcon({ className = "", size = 24 }: ChartIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Chart bars */}
      <rect
        x="3"
        y="18"
        width="4"
        height="3"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <rect
        x="9"
        y="12"
        width="4"
        height="9"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <rect
        x="15"
        y="6"
        width="4"
        height="15"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* Chart line (optional, for analytics feel) */}
      <path
        d="M5 18 L11 12 L17 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

