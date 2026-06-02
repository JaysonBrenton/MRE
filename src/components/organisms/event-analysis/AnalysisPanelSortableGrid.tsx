/**
 * @fileoverview Drag-and-drop reorder grid for Event / Session Level Analysis panels.
 */

"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

export type AnalysisPanelDragHandle = {
  attributes: Record<string, unknown>
  listeners?: Record<string, unknown>
  disabled: boolean
}

/** Number of grid tracks at the widest breakpoint. Smaller screens always step down. */
export type AnalysisGridColumns = 2 | 3

/**
 * Grid track classes per column count and the matching full-row span used by an
 * expanded panel. Kept together so the expand span can never drift from the
 * grid: a 3-up grid steps 1 → 2 → 3 columns, so an expanded card must span 2
 * (md) then 3 (lg) to stay full width at every breakpoint.
 */
const GRID_COLUMNS_CLASS: Record<AnalysisGridColumns, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
}

const EXPANDED_SPAN_CLASS: Record<AnalysisGridColumns, string> = {
  2: "md:col-span-2",
  3: "md:col-span-2 lg:col-span-3",
}

const AnalysisGridColumnsContext = createContext<AnalysisGridColumns>(2)

export interface AnalysisPanelSortableGridProps {
  panelIds: string[]
  onReorder: (activeId: string, overId: string) => void
  /** Widest-breakpoint track count. Defaults to 2. */
  columns?: AnalysisGridColumns
  children: ReactNode
}

/** DnD context + dense grid shell. Wrap each panel in {@link SortableAnalysisPanel}. */
export default function AnalysisPanelSortableGrid({
  panelIds,
  onReorder,
  columns = 2,
  children,
}: AnalysisPanelSortableGridProps) {
  const [motionEnabled, setMotionEnabled] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setMotionEnabled(!mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onReorder(String(active.id), String(over.id))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={panelIds} strategy={rectSortingStrategy}>
        <AnalysisGridColumnsContext.Provider value={columns}>
          <div
            className={`grid min-h-0 w-full min-w-0 grid-cols-1 gap-4 ${GRID_COLUMNS_CLASS[columns]} [grid-auto-flow:dense] ${
              motionEnabled ? "" : "[&_[data-sortable-panel]]:!transition-none"
            }`}
            role="presentation"
          >
            {children}
          </div>
        </AnalysisGridColumnsContext.Provider>
      </SortableContext>
    </DndContext>
  )
}

export function SortableAnalysisPanel({
  id,
  order,
  disabled,
  expanded = false,
  className = "",
  children,
}: {
  id: string
  order: number
  disabled?: boolean
  /** When true, the panel spans the full grid row (track count from context). */
  expanded?: boolean
  className?: string
  children: (dragHandle: AnalysisPanelDragHandle) => ReactNode
}) {
  const columns = useContext(AnalysisGridColumnsContext)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })

  const style = {
    order,
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const spanClass = expanded ? EXPANDED_SPAN_CLASS[columns] : ""

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`min-h-0 min-w-0 touch-manipulation ${isDragging ? "z-10 opacity-40" : ""} ${spanClass} ${className}`}
      data-sortable-panel={id}
    >
      {children({
        attributes: attributes as unknown as Record<string, unknown>,
        listeners: disabled ? undefined : (listeners as Record<string, unknown>),
        disabled: Boolean(disabled),
      })}
    </div>
  )
}
