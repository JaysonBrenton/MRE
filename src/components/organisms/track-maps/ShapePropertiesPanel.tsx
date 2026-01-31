/**
 * @fileoverview Shape Properties Panel component
 *
 * @created 2026-01-24
 * @creator Auto-generated
 * @lastModified 2026-01-24
 *
 * @description Panel for editing selected shape properties
 *
 * @purpose Allows users to modify shape properties like color, stroke width, labels, etc.
 */

"use client"

import { useState } from "react"
import type { TrackMapShape } from "@/core/track-maps/repo"

interface ShapePropertiesPanelProps {
  shape: TrackMapShape
  onUpdate: (updates: Partial<TrackMapShape>) => void
  onDelete: () => void
}

const COLOR_PALETTE = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
  "#6366f1", // indigo
]

export default function ShapePropertiesPanel({
  shape,
  onUpdate,
  onDelete,
}: ShapePropertiesPanelProps) {
  const [label, setLabel] = useState(shape.label || "")
  const [strokeColor, setStrokeColor] = useState(shape.style.strokeColor)
  const [fillColor, setFillColor] = useState(shape.style.fillColor || "")
  const [strokeWidth, setStrokeWidth] = useState(shape.style.strokeWidth)
  const [opacity, setOpacity] = useState(shape.style.opacity ?? 1)

  const handleLabelChange = (newLabel: string) => {
    setLabel(newLabel)
    onUpdate({ label: newLabel || undefined })
  }

  const handleColorChange = (color: string) => {
    setStrokeColor(color)
    onUpdate({
      style: {
        ...shape.style,
        strokeColor: color,
      },
    })
  }

  const handleFillColorChange = (color: string) => {
    setFillColor(color)
    onUpdate({
      style: {
        ...shape.style,
        fillColor: color || undefined,
      },
    })
  }

  const handleStrokeWidthChange = (width: number) => {
    setStrokeWidth(width)
    onUpdate({
      style: {
        ...shape.style,
        strokeWidth: width,
      },
    })
  }

  const handleOpacityChange = (op: number) => {
    setOpacity(op)
    onUpdate({
      style: {
        ...shape.style,
        opacity: op,
      },
    })
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--token-text-primary)]">Shape Properties</h3>
        <button
          onClick={onDelete}
          className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
        >
          Delete
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1">
          Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--token-border-default)] rounded bg-[var(--token-surface)] text-[var(--token-text-primary)]"
          placeholder="Enter label..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--token-text-secondary)] mb-2">
          Stroke Color
        </label>
        <div className="grid grid-cols-5 gap-2 mb-2">
          {COLOR_PALETTE.map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              className={`w-8 h-8 rounded border-2 ${
                strokeColor === color
                  ? "border-[var(--token-accent)]"
                  : "border-[var(--token-border-default)]"
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        <input
          type="color"
          value={strokeColor}
          onChange={(e) => handleColorChange(e.target.value)}
          className="w-full h-10 border border-[var(--token-border-default)] rounded"
        />
      </div>

      {shape.type === "marker" || shape.type === "sector" ? (
        <div>
          <label className="block text-sm font-medium text-[var(--token-text-secondary)] mb-2">
            Fill Color
          </label>
          <div className="grid grid-cols-5 gap-2 mb-2">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => handleFillColorChange(color)}
                className={`w-8 h-8 rounded border-2 ${
                  fillColor === color
                    ? "border-[var(--token-accent)]"
                    : "border-[var(--token-border-default)]"
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          <input
            type="color"
            value={fillColor || "#000000"}
            onChange={(e) => handleFillColorChange(e.target.value)}
            className="w-full h-10 border border-[var(--token-border-default)] rounded"
          />
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1">
          Stroke Width: {strokeWidth}
        </label>
        <input
          type="range"
          min="1"
          max="10"
          value={strokeWidth}
          onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1">
          Opacity: {Math.round(opacity * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={opacity}
          onChange={(e) => handleOpacityChange(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {shape.coordinates.length >= 2 && (
        <div>
          <label className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1">
            Measurement
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={shape.measurement?.distance || ""}
              onChange={(e) => {
                const distance = Number(e.target.value)
                if (!isNaN(distance) && distance > 0) {
                  onUpdate({
                    measurement: {
                      distance,
                      unit: shape.measurement?.unit || "m",
                    },
                  })
                } else {
                  onUpdate({ measurement: undefined })
                }
              }}
              className="flex-1 px-3 py-2 border border-[var(--token-border-default)] rounded bg-[var(--token-surface)] text-[var(--token-text-primary)]"
              placeholder="Distance"
            />
            <select
              value={shape.measurement?.unit || "m"}
              onChange={(e) => {
                if (shape.measurement) {
                  onUpdate({
                    measurement: {
                      ...shape.measurement,
                      unit: e.target.value as "m" | "ft",
                    },
                  })
                }
              }}
              className="px-3 py-2 border border-[var(--token-border-default)] rounded bg-[var(--token-surface)] text-[var(--token-text-primary)]"
            >
              <option value="m">m</option>
              <option value="ft">ft</option>
            </select>
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-[var(--token-border-default)]">
        <p className="text-xs text-[var(--token-text-secondary)]">Type: {shape.type}</p>
        <p className="text-xs text-[var(--token-text-secondary)]">
          Points: {shape.coordinates.length}
        </p>
        {shape.measurement && (
          <p className="text-xs text-[var(--token-text-secondary)]">
            Distance: {shape.measurement.distance} {shape.measurement.unit}
          </p>
        )}
      </div>
    </div>
  )
}
