/**
 * @fileoverview Pointer drag to reposition a centered modal panel (translate from layout position).
 */

"use client"

import type { PointerEvent as ReactPointerEvent, RefObject } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

const PAD = 48

function clampOffset(
  nx: number,
  ny: number,
  modalEl: HTMLElement | null
): { x: number; y: number } {
  if (!modalEl) return { x: nx, y: ny }
  const prev = modalEl.style.transform
  modalEl.style.transform = `translate(${nx}px, ${ny}px)`
  const r = modalEl.getBoundingClientRect()
  let x = nx
  let y = ny
  if (r.left < PAD) x += PAD - r.left
  if (r.right > window.innerWidth - PAD) x -= r.right - (window.innerWidth - PAD)
  if (r.top < PAD) y += PAD - r.top
  if (r.bottom > window.innerHeight - PAD) y -= r.bottom - (window.innerHeight - PAD)
  modalEl.style.transform = prev
  return { x, y }
}

export interface UseModalPanelDragResult {
  offset: { x: number; y: number }
  isDragging: boolean
  /** Attach to the draggable header row (pointer events). */
  headerPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
}

/**
 * Drag the modal panel by the header. Resets offset when `isOpen` becomes true.
 * @param modalRef - Ref on the panel root (same element that receives `transform`).
 */
export function useModalPanelDrag(
  isOpen: boolean,
  modalRef: RefObject<HTMLElement | null>
): UseModalPanelDragResult {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const offsetRef = useRef(offset)

  useEffect(() => {
    offsetRef.current = offset
  }, [offset])

  useEffect(() => {
    if (!isOpen) return
    queueMicrotask(() => setOffset({ x: 0, y: 0 }))
  }, [isOpen])

  const headerPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      const el = e.target as HTMLElement
      if (el.closest("button, a, input, select, textarea")) return

      e.preventDefault()
      const startX = e.clientX
      const startY = e.clientY
      const origin = offsetRef.current
      setIsDragging(true)

      const onMove = (ev: PointerEvent) => {
        const rawX = origin.x + (ev.clientX - startX)
        const rawY = origin.y + (ev.clientY - startY)
        const next = clampOffset(rawX, rawY, modalRef.current)
        setOffset(next)
      }

      const onUp = () => {
        setIsDragging(false)
        document.removeEventListener("pointermove", onMove)
        document.removeEventListener("pointerup", onUp)
        document.removeEventListener("pointercancel", onUp)
      }

      document.addEventListener("pointermove", onMove)
      document.addEventListener("pointerup", onUp)
      document.addEventListener("pointercancel", onUp)
    },
    [modalRef]
  )

  return { offset, isDragging, headerPointerDown }
}
