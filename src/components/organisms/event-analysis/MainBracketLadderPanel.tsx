"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Download } from "lucide-react"
import Modal from "@/components/molecules/Modal"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import {
  type MainBracketLadderNode,
  buildMainBracketLadderModel,
} from "@/core/events/main-bracket-ladder-model"

interface MainBracketLadderPanelProps {
  data: EventAnalysisData
  classOptions: string[]
  resolvedClassName: string | null
  onClassNameChange: (className: string | null) => void
}

type ThemePalette = {
  canvasBg: string
  panelBg: string
  panelBorder: string
  line: string
  lineDim: string
  nodeBg: string
  nodeBorder: string
  nodeText: string
  nodeSubtle: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
  advancedBg: string
  advancedText: string
}

const defaultPalette: ThemePalette = {
  canvasBg: "#0f172a",
  panelBg: "#111827",
  panelBorder: "#334155",
  line: "#64748b",
  lineDim: "#475569",
  nodeBg: "#1e293b",
  nodeBorder: "#475569",
  nodeText: "#e2e8f0",
  nodeSubtle: "#94a3b8",
  tooltipBg: "#0f172a",
  tooltipBorder: "#334155",
  tooltipText: "#e2e8f0",
  advancedBg: "#1d4ed8",
  advancedText: "#dbeafe",
}

const NODE_WIDTH = 188
const NODE_HEIGHT = 82
const LINK_GUTTER = 56
const MIN_TIER_GAP = NODE_WIDTH + LINK_GUTTER
const CANVAS_PAD_X = 40
const CANVAS_PAD_Y = 36
const CANVAS_MIN_HEIGHT = 320
const CANVAS_MIN_WIDTH = 720
/** Fixed vertical centers — height is derived from content, not the container (avoids ResizeObserver loops). */
const ODD_ROW_CENTER_Y = 92
const EVEN_ROW_CENTER_Y = 248
const CENTER_ROW_CENTER_Y = 170

type BracketLayout = {
  width: number
  height: number
  tierGap: number
  nodes: { node: MainBracketLadderNode; x: number; y: number }[]
  edges: { id: string; path: string }[]
}

function driverCountLabel(node: MainBracketLadderNode): string {
  const count = node.drivers.length
  if (count === 1) return "1 driver"
  return `${count} drivers`
}

function nodeCenterY(node: MainBracketLadderNode): number {
  if (node.branch === "odd") return ODD_ROW_CENTER_Y
  if (node.branch === "even") return EVEN_ROW_CENTER_Y
  if (node.branch === "center") return CENTER_ROW_CENTER_Y
  const offset = 42 + Math.floor(node.rowIndex / 2) * 34
  return node.rowIndex % 2 === 0 ? CENTER_ROW_CENTER_Y - offset : CENTER_ROW_CENTER_Y + offset
}

function nodeY(node: MainBracketLadderNode): number {
  return nodeCenterY(node) - NODE_HEIGHT / 2
}

function buildEdgePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const startX = from.x + NODE_WIDTH
  const startY = from.y + NODE_HEIGHT / 2
  const endX = to.x
  const endY = to.y + NODE_HEIGHT / 2
  const gutterMidX = startX + Math.max(LINK_GUTTER / 2, (endX - startX) / 2)
  return `M ${startX} ${startY} H ${gutterMidX} V ${endY} H ${endX}`
}

function computeBracketLayout(
  model: NonNullable<ReturnType<typeof buildMainBracketLadderModel>>,
  containerWidth: number
): BracketLayout {
  const maxTier = Math.max(...model.nodes.map((n) => n.tierIndex))
  const tierGap =
    maxTier === 0
      ? MIN_TIER_GAP
      : Math.max(
          MIN_TIER_GAP,
          Math.floor((containerWidth - CANVAS_PAD_X * 2 - NODE_WIDTH) / maxTier)
        )
  const width = Math.max(containerWidth, CANVAS_PAD_X * 2 + NODE_WIDTH + maxTier * tierGap)
  const nodes = model.nodes.map((node) => ({
    node,
    x: CANVAS_PAD_X + node.tierIndex * tierGap,
    y: nodeY(node),
  }))
  const height = Math.max(
    CANVAS_MIN_HEIGHT,
    Math.ceil(Math.max(...nodes.map((n) => n.y + NODE_HEIGHT)) + CANVAS_PAD_Y)
  )
  const coords = new Map(nodes.map((n) => [n.node.sessionId, { x: n.x, y: n.y }]))
  const edges = model.edges
    .map((edge) => {
      const from = coords.get(edge.fromSessionId)
      const to = coords.get(edge.toSessionId)
      if (!from || !to) return null
      return {
        id: `${edge.fromSessionId}:${edge.toSessionId}`,
        path: buildEdgePath(from, to),
      }
    })
    .filter((x): x is { id: string; path: string } => x !== null)
  return { width, height, tierGap, nodes, edges }
}

function formatClassSlug(className: string): string {
  return className
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function safePosition(value: number | null): string {
  if (value === null) return "-"
  return String(value)
}

function formatLapsTime(lapsCompleted: number, totalTimeSeconds: number | null): string {
  if (totalTimeSeconds == null || !Number.isFinite(totalTimeSeconds)) {
    return `${lapsCompleted} laps`
  }
  const total = Math.max(0, Math.floor(totalTimeSeconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const time =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`
  return `${lapsCompleted} laps / ${time}`
}

export default function MainBracketLadderPanel({
  data,
  classOptions,
  resolvedClassName,
  onClassNameChange,
}: MainBracketLadderPanelProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [exporting, setExporting] = useState(false)
  const [palette, setPalette] = useState<ThemePalette>(defaultPalette)
  const [activeNode, setActiveNode] = useState<MainBracketLadderNode | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement)
    const pick = (key: string, fallback: string): string => {
      const v = styles.getPropertyValue(key).trim()
      return v || fallback
    }
    setPalette({
      canvasBg: pick("--token-surface", defaultPalette.canvasBg),
      panelBg: pick("--glass-bg", defaultPalette.panelBg),
      panelBorder: pick("--glass-border", defaultPalette.panelBorder),
      line: pick("--token-border-default", defaultPalette.line),
      lineDim: pick("--token-border-muted", defaultPalette.lineDim),
      nodeBg: pick("--token-surface-raised", defaultPalette.nodeBg),
      nodeBorder: pick("--token-border-default", defaultPalette.nodeBorder),
      nodeText: pick("--token-text-primary", defaultPalette.nodeText),
      nodeSubtle: pick("--token-text-secondary", defaultPalette.nodeSubtle),
      tooltipBg: pick("--token-surface-raised", defaultPalette.tooltipBg),
      tooltipBorder: pick("--token-border-default", defaultPalette.tooltipBorder),
      tooltipText: pick("--token-text-primary", defaultPalette.tooltipText),
      advancedBg: pick("--token-accent-soft-bg", defaultPalette.advancedBg),
      advancedText: pick("--token-accent", defaultPalette.advancedText),
    })
  }, [])

  const selectedClass = useMemo(() => {
    if (resolvedClassName && classOptions.includes(resolvedClassName)) return resolvedClassName
    return classOptions[0] ?? null
  }, [classOptions, resolvedClassName])

  useEffect(() => {
    if (selectedClass !== resolvedClassName) {
      onClassNameChange(selectedClass)
    }
  }, [onClassNameChange, resolvedClassName, selectedClass])

  const model = useMemo(
    () => buildMainBracketLadderModel(data, selectedClass),
    [data, selectedClass]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      const width = Math.max(CANVAS_MIN_WIDTH, Math.floor(el.clientWidth))
      setContainerWidth((prev) => (prev === width ? prev : width))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [model])

  const layout = useMemo(() => {
    if (!model || model.nodes.length === 0) return null
    const width =
      containerWidth > 0
        ? containerWidth
        : CANVAS_PAD_X * 2 +
          NODE_WIDTH +
          Math.max(...model.nodes.map((n) => n.tierIndex)) * MIN_TIER_GAP
    return computeBracketLayout(model, width)
  }, [containerWidth, model])

  const onNodeSelect = useCallback((node: MainBracketLadderNode) => {
    setActiveNode(node)
  }, [])

  const exportPng = useCallback(async () => {
    const svg = svgRef.current
    if (!svg || !selectedClass || !layout) return
    try {
      setExporting(true)
      const serializer = new XMLSerializer()
      const source = serializer.serializeToString(svg)
      const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" })
      const url = URL.createObjectURL(blob)

      const image = new Image()
      const decode = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error("Image decode failed"))
      })
      image.src = url
      await decode

      const scale = Math.max(2, Math.min(3, window.devicePixelRatio || 2))
      const canvas = document.createElement("canvas")
      canvas.width = Math.floor(layout.width * scale)
      canvas.height = Math.floor(layout.height * scale)
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas context not available")
      ctx.scale(scale, scale)
      ctx.fillStyle = palette.canvasBg
      ctx.fillRect(0, 0, layout.width, layout.height)
      ctx.drawImage(image, 0, 0, layout.width, layout.height)
      URL.revokeObjectURL(url)

      const png = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.href = png
      link.download = `${formatClassSlug(selectedClass)}-mains-ladder.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      // Silent fallback to avoid disrupting analysis workflow.
    } finally {
      setExporting(false)
    }
  }, [layout, palette.canvasBg, selectedClass])

  if (classOptions.length === 0) {
    return (
      <div className="w-full min-w-0 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 p-4">
        <p className="text-sm text-[var(--token-text-secondary)]">
          No classes with multiple mains ladder rounds are available for this event.
        </p>
      </div>
    )
  }

  if (!selectedClass || !model || !layout) {
    return (
      <div className="w-full min-w-0 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label
            className="text-xs text-[var(--token-text-secondary)]"
            htmlFor="main-bracket-class-select"
          >
            Class
          </label>
          <select
            id="main-bracket-class-select"
            className="min-w-[15rem] rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-sm text-[var(--token-text-primary)]"
            value={selectedClass ?? ""}
            onChange={(e) => onClassNameChange(e.target.value || null)}
          >
            {classOptions.map((cn) => (
              <option key={cn} value={cn}>
                {cn}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-3 text-sm text-[var(--token-text-secondary)]">
          Not enough ladder rounds exist to build a progression bracket for this class.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 space-y-3">
      <p className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-xs text-[var(--token-text-secondary)]">
        Mains ladder from published results. Select a round for full details. Advancements inferred
        from published results, not official rules.
      </p>

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--token-border-muted)]/60 pb-2">
        <label
          className="text-xs text-[var(--token-text-secondary)]"
          htmlFor="main-bracket-class-select"
        >
          Class
        </label>
        <select
          id="main-bracket-class-select"
          className="min-w-[16rem] rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-sm text-[var(--token-text-primary)]"
          value={selectedClass}
          onChange={(e) => onClassNameChange(e.target.value || null)}
        >
          {classOptions.map((cn) => (
            <option key={cn} value={cn}>
              {cn}
            </option>
          ))}
        </select>
      </div>

      <div
        ref={containerRef}
        className="relative flex w-full min-w-0 items-center justify-center overflow-x-auto overflow-y-visible rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface)]/30"
        style={{ minHeight: "min(28rem, 55vh)" }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Mains ladder bracket for ${selectedClass}`}
          xmlns="http://www.w3.org/2000/svg"
          className="block max-w-full"
        >
          <rect x={0} y={0} width={layout.width} height={layout.height} fill={palette.panelBg} />

          {layout.edges.map((edge) => (
            <g key={edge.id}>
              <path
                d={edge.path}
                fill="none"
                stroke={palette.lineDim}
                strokeWidth={8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={edge.path}
                fill="none"
                stroke={palette.advancedText}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}

          {layout.nodes.map(({ node, x, y }) => (
            <g key={node.sessionId}>
              <rect
                x={x}
                y={y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={10}
                fill={palette.nodeBg}
                stroke={palette.nodeBorder}
                strokeWidth={1.5}
                style={{ cursor: "pointer" }}
                onClick={() => onNodeSelect(node)}
              />
              <text
                x={x + 10}
                y={y + 24}
                fill={palette.nodeText}
                fontSize={14}
                fontWeight={600}
                style={{ pointerEvents: "none" }}
              >
                {node.roundLabel}
              </text>
              <text
                x={x + 10}
                y={y + 42}
                fill={palette.nodeSubtle}
                fontSize={12}
                style={{ pointerEvents: "none" }}
              >
                {driverCountLabel(node)}
              </text>
              <text
                x={x + 10}
                y={y + 60}
                fill={node.advancedDriverCount > 0 ? palette.advancedText : palette.nodeSubtle}
                fontSize={11}
                fontWeight={node.advancedDriverCount > 0 ? 600 : 400}
                style={{ pointerEvents: "none" }}
              >
                {node.advancedDriverCount > 0
                  ? `${node.advancedDriverCount} progressed`
                  : "No prior progress"}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={exportPng}
          disabled={exporting}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          {exporting ? "Exporting..." : "Export PNG"}
        </button>
      </div>

      <Modal
        isOpen={activeNode !== null}
        onClose={() => setActiveNode(null)}
        title={activeNode?.roundLabel ?? "Round Details"}
        subtitle={activeNode?.raceLabel}
        maxWidth="3xl"
        resizable={false}
      >
        {activeNode && (
          <div className="w-full min-w-0 space-y-3">
            <p className="text-sm text-[var(--token-text-secondary)]">
              {driverCountLabel(activeNode)} · {activeNode.advancedDriverCount} progressed from
              earlier rounds
            </p>
            <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--token-border-default)]">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <thead className="bg-[var(--token-surface)]/60 text-[var(--token-text-secondary)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Pos</th>
                    <th className="px-3 py-2 font-medium">Driver</th>
                    <th className="px-3 py-2 font-medium">Qual</th>
                    <th className="px-3 py-2 font-medium">Laps / Time</th>
                    <th className="px-3 py-2 font-medium">From Round</th>
                  </tr>
                </thead>
                <tbody>
                  {activeNode.drivers.map((driver) => (
                    <tr
                      key={driver.driverId}
                      className="border-t border-[var(--token-border-muted)]"
                      style={{
                        backgroundColor: driver.advancedFromPriorRound
                          ? "var(--token-accent-soft-bg)"
                          : "transparent",
                      }}
                    >
                      <td className="px-3 py-2">P{safePosition(driver.position)}</td>
                      <td className="px-3 py-2">{driver.driverName}</td>
                      <td className="px-3 py-2">Q{safePosition(driver.qualifyingPosition)}</td>
                      <td className="px-3 py-2">
                        {formatLapsTime(driver.lapsCompleted, driver.totalTimeSeconds)}
                      </td>
                      <td className="px-3 py-2">{driver.progressedFromRoundLabel ?? "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
