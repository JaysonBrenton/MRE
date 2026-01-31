/**
 * @fileoverview Track Map Canvas component
 *
 * @created 2026-01-24
 * @creator Auto-generated
 * @lastModified 2026-01-24
 *
 * @description SVG-based canvas for rendering and editing track map shapes
 *
 * @purpose Provides the interactive canvas where users can draw, select, and edit shapes
 */

"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Group } from "@visx/group"
import type { TrackMapData, TrackMapShape, TrackMapShapeType } from "@/core/track-maps/repo"

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

interface TrackMapCanvasProps {
  mapData: TrackMapData
  selectedShapeId: string | null
  selectedTool: TrackMapShapeType | null
  onShapeAdd: (shape: TrackMapShape) => void
  onShapeSelect: (shapeId: string | null) => void
  onShapeUpdate: (shapeId: string, updates: Partial<TrackMapShape>) => void
  onShapeDelete: (shapeId: string) => void
}

export default function TrackMapCanvas({
  mapData,
  selectedShapeId,
  selectedTool,
  onShapeAdd,
  onShapeSelect,
  onShapeUpdate,
  onShapeDelete,
}: TrackMapCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPoints, setCurrentPoints] = useState<number[][]>([])
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, scale: 1 })

  const canvasWidth = mapData.canvasWidth || 1000
  const canvasHeight = mapData.canvasHeight || 1000

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!selectedTool) {
        // Click to select
        const target = e.target as SVGElement
        const shapeId = target.getAttribute("data-shape-id")
        onShapeSelect(shapeId || null)
        return
      }

      // Start drawing
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = (e.clientX - rect.left) / viewBox.scale - viewBox.x
      const y = (e.clientY - rect.top) / viewBox.scale - viewBox.y

      setIsDrawing(true)
      setCurrentPoints([[x, y]])

      // For point-based tools, create shape immediately
      if (selectedTool === "marker") {
        const shape: TrackMapShape = {
          id: generateId(),
          type: "marker",
          coordinates: [[x, y]],
          style: {
            strokeColor: "#3b82f6",
            fillColor: "#3b82f6",
            strokeWidth: 2,
            opacity: 1,
          },
        }
        onShapeAdd(shape)
        setIsDrawing(false)
      } else if (selectedTool === "arrow" && currentPoints.length === 0) {
        // Start arrow drawing
        setCurrentPoints([[x, y]])
      } else if (selectedTool === "sector" && currentPoints.length === 0) {
        // Start sector drawing
        setCurrentPoints([[x, y]])
      } else if (selectedTool === "curve" && currentPoints.length === 0) {
        // Start curve drawing
        setCurrentPoints([[x, y]])
      } else if (selectedTool === "chicane" && currentPoints.length === 0) {
        // Start chicane drawing
        setCurrentPoints([[x, y]])
      }
    },
    [selectedTool, viewBox, onShapeAdd, onShapeSelect, currentPoints.length]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isDrawing || !selectedTool) return

      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = (e.clientX - rect.left) / viewBox.scale - viewBox.x
      const y = (e.clientY - rect.top) / viewBox.scale - viewBox.y

      if (selectedTool === "straight" && currentPoints.length === 1) {
        setCurrentPoints([currentPoints[0], [x, y]])
      } else if (selectedTool === "arrow" && currentPoints.length === 1) {
        setCurrentPoints([currentPoints[0], [x, y]])
      } else if (selectedTool === "sector" && currentPoints.length === 1) {
        setCurrentPoints([currentPoints[0], [x, y]])
      } else if (selectedTool === "curve" && currentPoints.length < 3) {
        setCurrentPoints([...currentPoints, [x, y]])
      } else if (selectedTool === "chicane" && currentPoints.length < 4) {
        setCurrentPoints([...currentPoints, [x, y]])
      } else if (selectedTool === "custom") {
        setCurrentPoints([...currentPoints, [x, y]])
      }
    },
    [isDrawing, selectedTool, currentPoints, viewBox]
  )

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !selectedTool) return

    if (selectedTool === "straight" && currentPoints.length === 2) {
      const shape: TrackMapShape = {
        id: generateId(),
        type: "straight",
        coordinates: currentPoints,
        style: {
          strokeColor: "#3b82f6",
          strokeWidth: 2,
          opacity: 1,
        },
      }
      onShapeAdd(shape)
    } else if (selectedTool === "arrow" && currentPoints.length === 2) {
      const shape: TrackMapShape = {
        id: generateId(),
        type: "arrow",
        coordinates: currentPoints,
        style: {
          strokeColor: "#3b82f6",
          strokeWidth: 2,
          opacity: 1,
        },
      }
      onShapeAdd(shape)
    } else if (selectedTool === "sector" && currentPoints.length === 2) {
      const shape: TrackMapShape = {
        id: generateId(),
        type: "sector",
        coordinates: currentPoints,
        style: {
          strokeColor: "#3b82f6",
          fillColor: "#3b82f6",
          strokeWidth: 2,
          opacity: 0.3,
        },
      }
      onShapeAdd(shape)
    } else if (selectedTool === "curve" && currentPoints.length >= 3) {
      const shape: TrackMapShape = {
        id: generateId(),
        type: "curve",
        coordinates: currentPoints,
        style: {
          strokeColor: "#3b82f6",
          strokeWidth: 2,
          opacity: 1,
        },
      }
      onShapeAdd(shape)
    } else if (selectedTool === "chicane" && currentPoints.length >= 4) {
      const shape: TrackMapShape = {
        id: generateId(),
        type: "chicane",
        coordinates: currentPoints,
        style: {
          strokeColor: "#3b82f6",
          strokeWidth: 2,
          opacity: 1,
        },
      }
      onShapeAdd(shape)
    } else if (selectedTool === "custom" && currentPoints.length > 1) {
      const shape: TrackMapShape = {
        id: generateId(),
        type: "custom",
        coordinates: currentPoints,
        style: {
          strokeColor: "#3b82f6",
          strokeWidth: 2,
          opacity: 1,
        },
      }
      onShapeAdd(shape)
    }

    setIsDrawing(false)
    setCurrentPoints([])
  }, [isDrawing, selectedTool, currentPoints, onShapeAdd])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Delete" && selectedShapeId) {
        onShapeDelete(selectedShapeId)
      }
    },
    [selectedShapeId, onShapeDelete]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const renderShape = (shape: TrackMapShape) => {
    const isSelected = shape.id === selectedShapeId
    const style = shape.style

    switch (shape.type) {
      case "straight":
        if (shape.coordinates.length >= 2) {
          return (
            <g key={shape.id} data-shape-id={shape.id}>
              <line
                x1={shape.coordinates[0][0]}
                y1={shape.coordinates[0][1]}
                x2={shape.coordinates[1][0]}
                y2={shape.coordinates[1][1]}
                stroke={isSelected ? "#f59e0b" : style.strokeColor}
                strokeWidth={isSelected ? style.strokeWidth + 2 : style.strokeWidth}
                opacity={style.opacity || 1}
                style={{ cursor: "pointer" }}
                onClick={() => onShapeSelect(shape.id)}
              />
              {shape.label && (
                <text
                  x={(shape.coordinates[0][0] + shape.coordinates[1][0]) / 2}
                  y={(shape.coordinates[0][1] + shape.coordinates[1][1]) / 2 - 5}
                  fill={style.strokeColor}
                  fontSize="12"
                  textAnchor="middle"
                  style={{ pointerEvents: "none" }}
                >
                  {shape.label}
                </text>
              )}
              {shape.measurement && (
                <text
                  x={(shape.coordinates[0][0] + shape.coordinates[1][0]) / 2}
                  y={(shape.coordinates[0][1] + shape.coordinates[1][1]) / 2 + 15}
                  fill={style.strokeColor}
                  fontSize="10"
                  textAnchor="middle"
                  style={{ pointerEvents: "none" }}
                >
                  {shape.measurement.distance} {shape.measurement.unit}
                </text>
              )}
            </g>
          )
        }
        return null

      case "marker":
        if (shape.coordinates.length >= 1) {
          return (
            <g key={shape.id} data-shape-id={shape.id}>
              <circle
                cx={shape.coordinates[0][0]}
                cy={shape.coordinates[0][1]}
                r={isSelected ? 8 : 6}
                fill={isSelected ? "#f59e0b" : style.fillColor || style.strokeColor}
                stroke={isSelected ? "#f59e0b" : style.strokeColor}
                strokeWidth={isSelected ? 3 : style.strokeWidth}
                opacity={style.opacity || 1}
                style={{ cursor: "pointer" }}
                onClick={() => onShapeSelect(shape.id)}
              />
              {shape.label && (
                <text
                  x={shape.coordinates[0][0]}
                  y={shape.coordinates[0][1] - 12}
                  fill={style.strokeColor}
                  fontSize="12"
                  textAnchor="middle"
                  style={{ pointerEvents: "none" }}
                >
                  {shape.label}
                </text>
              )}
              {shape.measurement && (
                <text
                  x={shape.coordinates[0][0]}
                  y={shape.coordinates[0][1] + 20}
                  fill={style.strokeColor}
                  fontSize="10"
                  textAnchor="middle"
                  style={{ pointerEvents: "none" }}
                >
                  {shape.measurement.distance} {shape.measurement.unit}
                </text>
              )}
            </g>
          )
        }
        return null

      case "arrow":
        if (shape.coordinates.length >= 2) {
          const [start, end] = shape.coordinates
          const dx = end[0] - start[0]
          const dy = end[1] - start[1]
          const angle = Math.atan2(dy, dx)
          const arrowLength = 10
          const arrowAngle = Math.PI / 6
          const arrowX = end[0] - arrowLength * Math.cos(angle - arrowAngle)
          const arrowY = end[1] - arrowLength * Math.sin(angle - arrowAngle)
          const arrowX2 = end[0] - arrowLength * Math.cos(angle + arrowAngle)
          const arrowY2 = end[1] - arrowLength * Math.sin(angle + arrowAngle)
          return (
            <g key={shape.id} data-shape-id={shape.id}>
              <line
                x1={start[0]}
                y1={start[1]}
                x2={end[0]}
                y2={end[1]}
                stroke={isSelected ? "#f59e0b" : style.strokeColor}
                strokeWidth={isSelected ? style.strokeWidth + 2 : style.strokeWidth}
                opacity={style.opacity || 1}
                style={{ cursor: "pointer" }}
                onClick={() => onShapeSelect(shape.id)}
              />
              <path
                d={`M ${end[0]} ${end[1]} L ${arrowX} ${arrowY} M ${end[0]} ${end[1]} L ${arrowX2} ${arrowY2}`}
                stroke={isSelected ? "#f59e0b" : style.strokeColor}
                strokeWidth={isSelected ? style.strokeWidth + 2 : style.strokeWidth}
                strokeLinecap="round"
                opacity={style.opacity || 1}
              />
            </g>
          )
        }
        return null

      case "sector":
        if (shape.coordinates.length >= 2) {
          const [start, end] = shape.coordinates
          const width = Math.abs(end[0] - start[0])
          const height = Math.abs(end[1] - start[1])
          const x = Math.min(start[0], end[0])
          const y = Math.min(start[1], end[1])
          return (
            <rect
              key={shape.id}
              data-shape-id={shape.id}
              x={x}
              y={y}
              width={width}
              height={height}
              fill={isSelected ? "#f59e0b" : style.fillColor || style.strokeColor}
              fillOpacity={(style.opacity || 1) * 0.3}
              stroke={isSelected ? "#f59e0b" : style.strokeColor}
              strokeWidth={isSelected ? style.strokeWidth + 2 : style.strokeWidth}
              opacity={style.opacity || 1}
              style={{ cursor: "pointer" }}
              onClick={() => onShapeSelect(shape.id)}
            />
          )
        }
        return null

      case "curve":
        if (shape.coordinates.length >= 3) {
          const pathData = shape.coordinates
            .map((coord, i) => {
              if (i === 0) return `M ${coord[0]} ${coord[1]}`
              if (i === 1) return `Q ${coord[0]} ${coord[1]}`
              return `${coord[0]} ${coord[1]}`
            })
            .join(" ")
          return (
            <path
              key={shape.id}
              data-shape-id={shape.id}
              d={pathData}
              fill="none"
              stroke={isSelected ? "#f59e0b" : style.strokeColor}
              strokeWidth={isSelected ? style.strokeWidth + 2 : style.strokeWidth}
              opacity={style.opacity || 1}
              style={{ cursor: "pointer" }}
              onClick={() => onShapeSelect(shape.id)}
            />
          )
        }
        return null

      case "chicane":
        if (shape.coordinates.length >= 4) {
          const pathData = shape.coordinates
            .map((coord, i) => `${i === 0 ? "M" : "L"} ${coord[0]} ${coord[1]}`)
            .join(" ")
          return (
            <path
              key={shape.id}
              data-shape-id={shape.id}
              d={pathData}
              fill="none"
              stroke={isSelected ? "#f59e0b" : style.strokeColor}
              strokeWidth={isSelected ? style.strokeWidth + 2 : style.strokeWidth}
              opacity={style.opacity || 1}
              style={{ cursor: "pointer" }}
              onClick={() => onShapeSelect(shape.id)}
            />
          )
        }
        return null

      case "custom":
        if (shape.coordinates.length >= 2) {
          const pathData = shape.coordinates
            .map((coord, i) => `${i === 0 ? "M" : "L"} ${coord[0]} ${coord[1]}`)
            .join(" ")
          return (
            <path
              key={shape.id}
              data-shape-id={shape.id}
              d={pathData}
              fill="none"
              stroke={isSelected ? "#f59e0b" : style.strokeColor}
              strokeWidth={isSelected ? style.strokeWidth + 2 : style.strokeWidth}
              opacity={style.opacity || 1}
              style={{ cursor: "pointer" }}
              onClick={() => onShapeSelect(shape.id)}
            />
          )
        }
        return null

      default:
        return null
    }
  }

  const renderCurrentDrawing = () => {
    if (!isDrawing || currentPoints.length === 0) return null

    if (selectedTool === "straight" && currentPoints.length === 2) {
      return (
        <line
          x1={currentPoints[0][0]}
          y1={currentPoints[0][1]}
          x2={currentPoints[1][0]}
          y2={currentPoints[1][1]}
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="5,5"
          opacity={0.5}
        />
      )
    }

    if (selectedTool === "arrow" && currentPoints.length === 2) {
      const [start, end] = currentPoints
      const dx = end[0] - start[0]
      const dy = end[1] - start[1]
      const angle = Math.atan2(dy, dx)
      const arrowLength = 10
      const arrowAngle = Math.PI / 6
      const arrowX = end[0] - arrowLength * Math.cos(angle - arrowAngle)
      const arrowY = end[1] - arrowLength * Math.sin(angle - arrowAngle)
      const arrowX2 = end[0] - arrowLength * Math.cos(angle + arrowAngle)
      const arrowY2 = end[1] - arrowLength * Math.sin(angle + arrowAngle)
      return (
        <g>
          <line
            x1={start[0]}
            y1={start[1]}
            x2={end[0]}
            y2={end[1]}
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="5,5"
            opacity={0.5}
          />
          <path
            d={`M ${end[0]} ${end[1]} L ${arrowX} ${arrowY} M ${end[0]} ${end[1]} L ${arrowX2} ${arrowY2}`}
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="5,5"
            opacity={0.5}
            strokeLinecap="round"
          />
        </g>
      )
    }

    if (selectedTool === "sector" && currentPoints.length === 2) {
      const [start, end] = currentPoints
      const width = Math.abs(end[0] - start[0])
      const height = Math.abs(end[1] - start[1])
      const x = Math.min(start[0], end[0])
      const y = Math.min(start[1], end[1])
      return (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="#3b82f6"
          fillOpacity={0.1}
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="5,5"
          opacity={0.5}
        />
      )
    }

    if (selectedTool === "custom" && currentPoints.length > 1) {
      const pathData = currentPoints
        .map((coord, i) => `${i === 0 ? "M" : "L"} ${coord[0]} ${coord[1]}`)
        .join(" ")
      return (
        <path
          d={pathData}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="5,5"
          opacity={0.5}
        />
      )
    }

    return null
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-8">
      <svg
        ref={svgRef}
        width={canvasWidth}
        height={canvasHeight}
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        className="border border-[var(--token-border-default)] bg-white dark:bg-gray-900"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: selectedTool ? "crosshair" : "default" }}
      >
        {/* Grid */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="0.5"
              opacity="0.3"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Shapes */}
        <Group>{mapData.shapes.map(renderShape)}</Group>

        {/* Current drawing */}
        {renderCurrentDrawing()}
      </svg>
    </div>
  )
}
