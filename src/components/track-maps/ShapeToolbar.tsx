/**
 * @fileoverview Shape Toolbar component
 * 
 * @created 2026-01-24
 * @creator Auto-generated
 * @lastModified 2026-01-24
 * 
 * @description Toolbar for selecting shape tools
 * 
 * @purpose Provides buttons for selecting different shape types to draw
 */

"use client"

import type { TrackMapShapeType } from "@/core/track-maps/repo"

interface ShapeToolbarProps {
  selectedTool: TrackMapShapeType | null
  onToolSelect: (tool: TrackMapShapeType | null) => void
}

const TOOLS: Array<{
  type: TrackMapShapeType
  label: string
  icon: (active: boolean) => React.ReactNode
}> = [
  {
    type: "straight",
    label: "Straight Line",
    icon: (active) => (
      <svg
        className={`w-6 h-6 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <line
          x1="4"
          y1="12"
          x2="20"
          y2="12"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    type: "curve",
    label: "Curve",
    icon: (active) => (
      <svg
        className={`w-6 h-6 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M4 12 Q12 4 20 12"
          stroke="currentColor"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    type: "chicane",
    label: "Chicane",
    icon: (active) => (
      <svg
        className={`w-6 h-6 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M4 8 L8 12 L4 16 M20 8 L16 12 L20 16"
          stroke="currentColor"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    type: "sector",
    label: "Sector",
    icon: (active) => (
      <svg
        className={`w-6 h-6 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <rect
          x="4"
          y="6"
          width="16"
          height="12"
          stroke="currentColor"
          strokeWidth={2}
          fill="none"
        />
      </svg>
    ),
  },
  {
    type: "arrow",
    label: "Arrow",
    icon: (active) => (
      <svg
        className={`w-6 h-6 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <line
          x1="4"
          y1="12"
          x2="16"
          y2="12"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <path
          d="M14 8 L18 12 L14 16"
          stroke="currentColor"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    type: "marker",
    label: "Marker",
    icon: (active) => (
      <svg
        className={`w-6 h-6 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="4"
          stroke="currentColor"
          strokeWidth={2}
          fill="currentColor"
          opacity="0.3"
        />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    type: "custom",
    label: "Custom Line",
    icon: (active) => (
      <svg
        className={`w-6 h-6 ${active ? "text-[var(--token-accent)]" : "text-[var(--token-text-secondary)]"}`}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M4 8 Q8 4 12 8 T20 8"
          stroke="currentColor"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
]

export default function ShapeToolbar({ selectedTool, onToolSelect }: ShapeToolbarProps) {
  return (
    <div className="flex flex-col items-center py-4 gap-2">
      {TOOLS.map((tool) => {
        const isActive = selectedTool === tool.type
        return (
          <button
            key={tool.type}
            onClick={() => onToolSelect(isActive ? null : tool.type)}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
              isActive
                ? "bg-[var(--token-accent)]/20 border-2 border-[var(--token-accent)]"
                : "hover:bg-[var(--token-surface-raised)] border-2 border-transparent"
            }`}
            title={tool.label}
          >
            {tool.icon(isActive)}
          </button>
        )
      })}
    </div>
  )
}
