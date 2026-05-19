/**
 * Interactive mains bracket ladder canvas with per-node summaries and **drivers who advanced to the
 * next main** (observed: same driver appears in this session and the next hop on the ladder graph).
 *
 * Shipped primarily under Event Level Analysis (“Mains Ladder”, `#event-level-analysis-col-1-heading`).
 *
 * @see docs/architecture/event-analysis-mains-ladder.md — routing, domain modules (`main-bracket-ladder-*`), Bump-Up complements.
 */

"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { Download } from "lucide-react"
import Modal from "@/components/molecules/Modal"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import {
  type BracketNodeDriver,
  type MainBracketLadderNode,
  buildMainBracketLadderModel,
  driversAdvancedToNextRoundSorted,
} from "@/core/events/main-bracket-ladder-model"
import { assignCenterYBySessionId } from "@/core/events/main-bracket-ladder-layout"

interface MainBracketLadderPanelProps {
  data: EventAnalysisData
  classOptions: string[]
  resolvedClassName: string | null
  onClassNameChange: (className: string | null) => void
  /** Renders at the start of the class toolbar row (e.g. section title). */
  toolbarTitle?: ReactNode
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
/** Suppress default focus outline/ring on the class picker (still operable via keyboard). */
const MAIN_BRACKET_CLASS_SELECT_CLASS =
  "w-max max-w-full shrink-0 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-sm text-[var(--token-text-primary)] focus:outline-none focus-visible:outline-none"
const LINK_GUTTER = 56
const MIN_TIER_GAP = NODE_WIDTH + LINK_GUTTER
const CANVAS_PAD_X = 40
const CANVAS_PAD_Y = 36
const CANVAS_MIN_HEIGHT = 320
const NODE_VIEW_PADDING = 12
/** Fixed vertical centers — height is derived from content, not the container (avoids ResizeObserver loops). */
const ODD_ROW_CENTER_Y = 92
const EVEN_ROW_CENTER_Y = 248
const CENTER_ROW_CENTER_Y = 170
/** Minimum gap between stacked node centers when a tier has 3+ sessions (lettered mains). */
const STACK_LANE_GAP = 14

type BracketLayout = {
  width: number
  height: number
  tierGap: number
  nodes: { node: MainBracketLadderNode; x: number; y: number }[]
  edges: {
    id: string
    path: string
    kind: "direct" | "via_lcq"
    driverCount: number | null
    labelX: number
    labelY: number
  }[]
}

function driverCountLabel(node: MainBracketLadderNode): string {
  const count = node.drivers.length
  if (count === 1) return "1 driver"
  return `${count} drivers`
}

/** Fits inside NODE_WIDTH minus horizontal padding at ~10px font in the SVG export. */
const CARD_PROGRESSED_NAME_MAX_CHARS = 23
const CARD_PROGRESSED_MAX_LINES = 3
const CARD_PROGRESSED_LINE_HEIGHT = 13

/** Lines shown under the round label for drivers who advanced to the next main. */
function advancedDriverNameLines(drivers: BracketNodeDriver[]): string[] {
  if (drivers.length === 0) return []

  const names = drivers.map((d) => d.driverName)
  const lines: string[] = []
  let i = 0

  while (i < names.length && lines.length < CARD_PROGRESSED_MAX_LINES) {
    const linesLeft = CARD_PROGRESSED_MAX_LINES - lines.length
    const namesLeft = names.length - i

    if (linesLeft === 1 && namesLeft > 1) {
      const first = names[i]!
      const more = namesLeft - 1
      const suffix = ` +${more} more`
      const budget = CARD_PROGRESSED_NAME_MAX_CHARS - suffix.length
      let head = first
      if (head.length > budget) {
        head = head.slice(0, Math.max(1, budget - 1)) + "…"
      }
      lines.push(head + suffix)
      break
    }

    let chunk = names[i]!
    if (chunk.length > CARD_PROGRESSED_NAME_MAX_CHARS) {
      lines.push(chunk.slice(0, CARD_PROGRESSED_NAME_MAX_CHARS - 1) + "…")
      i++
      continue
    }
    i++
    while (i < names.length && `${chunk}, ${names[i]!}`.length <= CARD_PROGRESSED_NAME_MAX_CHARS) {
      chunk += ", " + names[i]!
      i++
    }
    lines.push(chunk)
  }

  return lines
}

function buildEdgePath(
  from: { node: MainBracketLadderNode; x: number; y: number },
  to: { node: MainBracketLadderNode; x: number; y: number },
  avoidLcqLane: boolean
): string {
  const startX = from.x + NODE_WIDTH
  const startY = from.y + NODE_HEIGHT / 2
  const endX = to.x
  const endY = to.y + NODE_HEIGHT / 2
  if (avoidLcqLane && to.node.tierIndex - from.node.tierIndex > 1) {
    // Keep direct edges horizontally separated from LCQ feeders and delay the
    // only vertical turn until close to the destination final node.
    const elbowX = Math.max(startX + 56, endX - 40)
    return `M ${startX} ${startY} H ${elbowX} V ${endY} H ${endX}`
  }
  const gutterMidX = startX + Math.max(LINK_GUTTER / 2, (endX - startX) / 2)
  return `M ${startX} ${startY} H ${gutterMidX} V ${endY} H ${endX}`
}

function edgeLabelPosition(
  from: { node: MainBracketLadderNode; x: number; y: number },
  to: { node: MainBracketLadderNode; x: number; y: number },
  avoidLcqLane: boolean,
  kind: "direct" | "via_lcq"
): { x: number; y: number } {
  const startX = from.x + NODE_WIDTH
  const startY = from.y + NODE_HEIGHT / 2
  const endX = to.x
  const endY = to.y + NODE_HEIGHT / 2
  const fromIsLcq = /\blcq\b|last\s*chance/i.test(from.node.raceLabel)
  const toIsLcq = /\blcq\b|last\s*chance/i.test(to.node.raceLabel)

  // For LCQ-mediated edges, anchor count badges at LCQ ingress/egress so users
  // immediately see "into LCQ" vs "out of LCQ" path volumes.
  if (kind === "via_lcq") {
    if (toIsLcq) {
      return { x: to.x - 26, y: endY }
    }
    if (fromIsLcq) {
      return { x: from.x + NODE_WIDTH + 26, y: startY }
    }
  }
  if (avoidLcqLane && to.node.tierIndex - from.node.tierIndex > 1) {
    return {
      // Anchor to destination side so comparable direct-path badges share the same x.
      x: endX - 24,
      y: (startY + endY) / 2 - 8,
    }
  }
  return {
    x: startX + Math.max(LINK_GUTTER / 2, (endX - startX) / 2),
    y: endY - 8,
  }
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function inflateRect(
  r: { x: number; y: number; width: number; height: number },
  pad: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: r.x - pad,
    y: r.y - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  }
}

function labelRect(x: number, y: number): { x: number; y: number; width: number; height: number } {
  return { x: x - 11, y: y - 8, width: 22, height: 16 }
}

function bracketOverflows(container: HTMLElement): boolean {
  return (
    container.scrollWidth > container.clientWidth + 1 ||
    container.scrollHeight > container.clientHeight + 1
  )
}

function getSvgContentOffset(container: HTMLElement): { left: number; top: number } {
  const svg = container.querySelector("svg")
  if (!svg) return { left: 0, top: 0 }
  const containerRect = container.getBoundingClientRect()
  const svgRect = svg.getBoundingClientRect()
  return {
    left: svgRect.left - containerRect.left + container.scrollLeft,
    top: svgRect.top - containerRect.top + container.scrollTop,
  }
}

function isNodeInView(container: HTMLElement, x: number, y: number): boolean {
  const { left: offsetLeft, top: offsetTop } = getSvgContentOffset(container)
  const { scrollLeft, scrollTop, clientWidth, clientHeight } = container
  const pad = NODE_VIEW_PADDING
  const viewLeft = scrollLeft + pad
  const viewTop = scrollTop + pad
  const viewRight = scrollLeft + clientWidth - pad
  const viewBottom = scrollTop + clientHeight - pad
  const nodeLeft = offsetLeft + x
  const nodeTop = offsetTop + y
  return (
    nodeLeft >= viewLeft &&
    nodeTop >= viewTop &&
    nodeLeft + NODE_WIDTH <= viewRight &&
    nodeTop + NODE_HEIGHT <= viewBottom
  )
}

function scrollToNode(container: HTMLElement, x: number, y: number): void {
  const { left: offsetLeft, top: offsetTop } = getSvgContentOffset(container)
  const targetLeft = offsetLeft + x + NODE_WIDTH / 2 - container.clientWidth / 2
  const targetTop = offsetTop + y + NODE_HEIGHT / 2 - container.clientHeight / 2
  const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth)
  const maxTop = Math.max(0, container.scrollHeight - container.clientHeight)
  container.scrollTo({
    left: Math.min(maxLeft, Math.max(0, targetLeft)),
    top: Math.min(maxTop, Math.max(0, targetTop)),
    behavior: "smooth",
  })
}

function computeBracketLayout(
  model: NonNullable<ReturnType<typeof buildMainBracketLadderModel>>
): BracketLayout {
  const maxTier = Math.max(...model.nodes.map((n) => n.tierIndex))
  const tierGap = MIN_TIER_GAP
  const width = CANVAS_PAD_X * 2 + NODE_WIDTH + maxTier * tierGap
  const centerYBySessionId = assignCenterYBySessionId(model.nodes, {
    nodeHeight: NODE_HEIGHT,
    stackLaneGap: STACK_LANE_GAP,
    oddRowCenterY: ODD_ROW_CENTER_Y,
    evenRowCenterY: EVEN_ROW_CENTER_Y,
    centerRowCenterY: CENTER_ROW_CENTER_Y,
  })
  const nodes = model.nodes.map((node) => ({
    node,
    x: CANVAS_PAD_X + node.tierIndex * tierGap,
    y: (centerYBySessionId.get(node.sessionId) ?? CENTER_ROW_CENTER_Y) - NODE_HEIGHT / 2,
  }))
  const height = Math.max(
    CANVAS_MIN_HEIGHT,
    Math.ceil(Math.max(...nodes.map((n) => n.y + NODE_HEIGHT)) + CANVAS_PAD_Y)
  )
  const coords = new Map(nodes.map((n) => [n.node.sessionId, { x: n.x, y: n.y }]))
  const nodesById = new Map(nodes.map((n) => [n.node.sessionId, n]))
  const rawEdges = model.edges
    .map((edge) => {
      const from = coords.get(edge.fromSessionId)
      const to = coords.get(edge.toSessionId)
      const fromNode = nodesById.get(edge.fromSessionId)
      const toNode = nodesById.get(edge.toSessionId)
      if (!from || !to || !fromNode || !toNode) return null
      const avoidLcqLane =
        edge.kind === "direct" && toNode.node.tierIndex - fromNode.node.tierIndex > 1
      const labelPos = edgeLabelPosition(fromNode, toNode, avoidLcqLane, edge.kind)
      const fromIsLcq = /\blcq\b|last\s*chance/i.test(fromNode.node.raceLabel)
      const toIsLcq = /\blcq\b|last\s*chance/i.test(toNode.node.raceLabel)
      const lcqAnchorMode =
        edge.kind === "via_lcq" && toIsLcq
          ? "lcq_in"
          : edge.kind === "via_lcq" && fromIsLcq
            ? "lcq_out"
            : null
      const lcqAnchorSessionId =
        lcqAnchorMode === "lcq_in"
          ? toNode.node.sessionId
          : lcqAnchorMode === "lcq_out"
            ? fromNode.node.sessionId
            : null
      return {
        id: `${edge.fromSessionId}:${edge.toSessionId}`,
        kind: edge.kind,
        fromRaceLabel: fromNode.node.raceLabel,
        toRaceLabel: toNode.node.raceLabel,
        lcqAnchorMode,
        lcqAnchorSessionId,
        driverCount: edge.driverCount,
        labelX: labelPos.x,
        labelY: labelPos.y,
        path: buildEdgePath(fromNode, toNode, avoidLcqLane),
      }
    })
    .filter(
      (
        x
      ): x is {
        id: string
        path: string
        kind: "direct" | "via_lcq"
        fromRaceLabel: string
        toRaceLabel: string
        lcqAnchorMode: "lcq_in" | "lcq_out" | null
        lcqAnchorSessionId: string | null
        driverCount: number | null
        labelX: number
        labelY: number
      } => x !== null
    )

  const nodeRects = nodes.map((n) => ({
    x: n.x,
    y: n.y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  }))
  const placedLabelRects: Array<{ x: number; y: number; width: number; height: number }> = []

  const edges = rawEdges.map((edge) => {
    if (edge.driverCount == null || edge.driverCount <= 0) return edge
    const fromIsLcq = /\blcq\b|last\s*chance/i.test(edge.fromRaceLabel)
    const toIsLcq = /\blcq\b|last\s*chance/i.test(edge.toRaceLabel)
    const xShifts =
      edge.kind === "via_lcq" && toIsLcq ? [0] : edge.kind === "via_lcq" && fromIsLcq ? [0] : [0]
    // Prefer preserving horizontal offset from the line (x=0), and separate badges by y first.
    const yShifts =
      edge.kind === "direct" ? [0, -24, 24, -40, 40, -56, 56] : [0, -26, 26, -44, 44, -62, 62]
    for (const dx of xShifts) {
      for (const dy of yShifts) {
        const candidate = labelRect(edge.labelX + dx, edge.labelY + dy)
        const hitsNode = nodeRects.some((r) => rectsOverlap(candidate, r))
        if (hitsNode) continue
        const expandedCandidate = inflateRect(candidate, 5)
        const hitsPlaced = placedLabelRects.some((r) => rectsOverlap(expandedCandidate, r))
        if (hitsPlaced) continue
        placedLabelRects.push(candidate)
        return { ...edge, labelX: edge.labelX + dx, labelY: edge.labelY + dy }
      }
    }
    // Fallback: keep original position if no collision-free position found.
    placedLabelRects.push(labelRect(edge.labelX, edge.labelY))
    return edge
  })

  // Deterministic LCQ label stacking: fixed side (inbound left / outbound right)
  // with minimum vertical separation so +N badges read clearly.
  const MIN_LCQ_LABEL_GAP = 24
  const edgesByLcqAnchor = new Map<string, number[]>()
  edges.forEach((edge, idx) => {
    if (
      !edge.lcqAnchorMode ||
      !edge.lcqAnchorSessionId ||
      edge.driverCount == null ||
      edge.driverCount <= 0
    ) {
      return
    }
    const key = `${edge.lcqAnchorMode}:${edge.lcqAnchorSessionId}`
    const list = edgesByLcqAnchor.get(key) ?? []
    list.push(idx)
    edgesByLcqAnchor.set(key, list)
  })
  for (const [, idxs] of edgesByLcqAnchor) {
    const sorted = [...idxs].sort((a, b) => edges[a]!.labelY - edges[b]!.labelY)
    for (let i = 1; i < sorted.length; i++) {
      const prev = edges[sorted[i - 1]!]!
      const curr = edges[sorted[i]!]!
      if (curr.labelY - prev.labelY < MIN_LCQ_LABEL_GAP) {
        curr.labelY = prev.labelY + MIN_LCQ_LABEL_GAP
      }
    }
  }

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

function formatFinishCell(position: number | null): string {
  if (position === null) return "—"
  return `P${position}`
}

function AdvancedDriversTableHTML({
  drivers,
  nextRoundLabel,
  captionClassName,
}: {
  drivers: BracketNodeDriver[]
  nextRoundLabel: string
  captionClassName: string
}) {
  return (
    <table className="w-full border-collapse text-left text-[var(--token-text-primary)]">
      <caption className={captionClassName}>Drivers who advanced to {nextRoundLabel}</caption>
      <thead>
        <tr className="border-b border-[var(--token-border-muted)] text-[var(--token-text-secondary)]">
          <th scope="col" className="max-w-[9rem] pb-1 pr-3 align-bottom text-xs font-medium">
            Driver
          </th>
          <th scope="col" className="pb-1 align-bottom text-xs font-medium">
            Finish
          </th>
        </tr>
      </thead>
      <tbody className="text-xs">
        {drivers.map((d) => (
          <tr key={d.driverId} className="border-t border-[var(--token-border-muted)]/70">
            <td className="break-words py-1 pr-3 align-top font-normal">{d.driverName}</td>
            <td className="break-words py-1 align-top font-normal">
              {formatFinishCell(d.position)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

type ProgressFloaterState = {
  anchor: SVGRectElement
  drivers: BracketNodeDriver[]
  nextRoundLabel: string
}

function AdvancedDriversTooltipFloater({
  state,
  onDismiss,
}: {
  state: ProgressFloaterState
  onDismiss: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({
    visibility: "hidden",
    top: 0,
    left: 0,
  })

  useLayoutEffect(() => {
    const update = () => {
      const el = panelRef.current
      if (!el) return
      const anchorRect = state.anchor.getBoundingClientRect()
      const tooltipRect = el.getBoundingClientRect()
      const gap = 8
      const vw = window.innerWidth
      const vh = window.innerHeight

      let top = anchorRect.top - tooltipRect.height - gap
      if (top < 8) {
        top = anchorRect.bottom + gap
      }
      let left = anchorRect.left + anchorRect.width / 2
      const half = Math.max(tooltipRect.width / 2, 100)
      left = Math.max(8 + half, Math.min(vw - 8 - half, left))
      const maxTop = vh - tooltipRect.height - 8
      if (maxTop >= 8) {
        top = Math.max(8, Math.min(maxTop, top))
      } else {
        top = 8
      }

      setStyle({
        visibility: "visible",
        position: "fixed",
        top,
        left,
        transform: "translateX(-50%)",
        zIndex: 10000,
        maxWidth: `${Math.min(420, vw - 16)}px`,
      })
    }

    update()
    const raf = requestAnimationFrame(update)
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [state])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onDismiss])

  return (
    <div
      ref={panelRef}
      role="presentation"
      aria-hidden="true"
      className="pointer-events-none overflow-visible rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] px-3 py-2 shadow-lg"
      style={style}
    >
      <AdvancedDriversTableHTML
        drivers={state.drivers}
        nextRoundLabel={state.nextRoundLabel}
        captionClassName="mb-2 text-left text-xs font-semibold text-[var(--token-text-primary)]"
      />
    </div>
  )
}

export default function MainBracketLadderPanel({
  data,
  classOptions,
  resolvedClassName,
  onClassNameChange,
  toolbarTitle,
}: MainBracketLadderPanelProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [exporting, setExporting] = useState(false)
  const [palette, setPalette] = useState<ThemePalette>(defaultPalette)
  const [activeNode, setActiveNode] = useState<MainBracketLadderNode | null>(null)

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

  const activeNodeAdvancement = useMemo(() => {
    if (!activeNode || !model) {
      return {
        target: null as MainBracketLadderNode | null,
        drivers: [] as BracketNodeDriver[],
      }
    }
    return driversAdvancedToNextRoundSorted(activeNode, model)
  }, [activeNode, model])

  const advancedToNextIds = useMemo(
    () => new Set(activeNodeAdvancement.drivers.map((d) => d.driverId)),
    [activeNodeAdvancement.drivers]
  )

  const layout = useMemo(() => {
    if (!model || model.nodes.length === 0) return null
    return computeBracketLayout(model)
  }, [model])

  const bracketHasLcqEdges = useMemo(
    () => layout?.edges.some((e) => e.kind === "via_lcq") ?? false,
    [layout]
  )

  const [progressTooltip, setProgressTooltip] = useState<ProgressFloaterState | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const centerViewport = () => {
      const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth)
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight)
      el.scrollTo({ left: maxLeft / 2, top: maxTop / 2 })
    }
    const frame = requestAnimationFrame(centerViewport)
    return () => cancelAnimationFrame(frame)
  }, [selectedClass, layout?.width, layout?.height])

  const handleNodeClick = useCallback((node: MainBracketLadderNode, x: number, y: number) => {
    const container = containerRef.current
    if (!container) {
      setActiveNode(node)
      return
    }
    if (bracketOverflows(container) && !isNodeInView(container, x, y)) {
      scrollToNode(container, x, y)
      return
    }
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
      <div className="w-full min-w-0 space-y-3">
        {toolbarTitle ? (
          <div className="min-w-0 border-b border-[var(--token-border-muted)]/60 pb-2">
            {toolbarTitle}
          </div>
        ) : null}
        <div className="rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 p-4">
          <p className="text-sm text-[var(--token-text-secondary)]">
            No classes with multiple mains ladder rounds are available for this event.
          </p>
        </div>
      </div>
    )
  }

  if (!selectedClass || !model || !layout) {
    return (
      <div className="w-full min-w-0 space-y-3">
        <div className="scrollbar-none flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto border-b border-[var(--token-border-muted)]/60 pb-2">
          {toolbarTitle ? <div className="shrink-0">{toolbarTitle}</div> : null}
          <label
            className="shrink-0 text-xs text-[var(--token-text-secondary)]"
            htmlFor="main-bracket-class-select"
          >
            Class
          </label>
          <select
            id="main-bracket-class-select"
            className={MAIN_BRACKET_CLASS_SELECT_CLASS}
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
        <div className="rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 p-4">
          <p className="text-sm text-[var(--token-text-secondary)]">
            Not enough ladder rounds exist to build a progression bracket for this class.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {layout.nodes.map(({ node }) => {
        const { target, drivers: advancedList } = driversAdvancedToNextRoundSorted(node, model)
        if (advancedList.length === 0 || !target) return null
        const descId = `mains-bracket-adv-${node.sessionId}`
        return (
          <div key={`adv-desc-${node.sessionId}`} id={descId} className="sr-only">
            <AdvancedDriversTableHTML
              drivers={advancedList}
              nextRoundLabel={target.roundLabel}
              captionClassName=""
            />
          </div>
        )
      })}
      <div className="w-full min-w-0 space-y-3">
        <div className="scrollbar-none flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto border-b border-[var(--token-border-muted)]/60 pb-2">
          {toolbarTitle ? <div className="shrink-0">{toolbarTitle}</div> : null}
          <label
            className="shrink-0 text-xs text-[var(--token-text-secondary)]"
            htmlFor="main-bracket-class-select"
          >
            Class
          </label>
          <select
            id="main-bracket-class-select"
            className={MAIN_BRACKET_CLASS_SELECT_CLASS}
            value={selectedClass}
            onChange={(e) => onClassNameChange(e.target.value || null)}
          >
            {classOptions.map((cn) => (
              <option key={cn} value={cn}>
                {cn}
              </option>
            ))}
          </select>
          {bracketHasLcqEdges ? (
            <div className="ml-auto flex shrink-0 items-center gap-3 text-xs text-[var(--token-text-secondary)]">
              <span className="inline-flex shrink-0 items-center gap-1">
                <svg width="20" height="8" aria-hidden="true">
                  <line
                    x1="1"
                    y1="4"
                    x2="19"
                    y2="4"
                    stroke={palette.advancedText}
                    strokeWidth="2.5"
                  />
                </svg>
                Direct advance
              </span>
              <span className="inline-flex shrink-0 items-center gap-1">
                <svg width="20" height="8" aria-hidden="true">
                  <line
                    x1="1"
                    y1="4"
                    x2="19"
                    y2="4"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                  />
                </svg>
                Via LCQ
              </span>
            </div>
          ) : null}
        </div>

        <div
          ref={containerRef}
          className="scrollbar-none relative w-full min-w-0 overflow-x-auto rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface)]/30"
        >
          <div className="mx-auto flex w-max justify-center">
            <svg
              ref={svgRef}
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              role="group"
              aria-label={`Mains ladder bracket for ${selectedClass}`}
              xmlns="http://www.w3.org/2000/svg"
              className="block shrink-0"
            >
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
                    stroke={edge.kind === "via_lcq" ? "#f59e0b" : palette.advancedText}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={edge.kind === "via_lcq" ? "6 4" : undefined}
                  />
                </g>
              ))}

              {layout.nodes.map(({ node, x, y }) => {
                const { target, drivers: advancedList } = driversAdvancedToNextRoundSorted(
                  node,
                  model
                )
                const showAdvancedTooltip = advancedList.length > 0 && Boolean(target)
                const descId = `mains-bracket-adv-${node.sessionId}`
                const progressedLines = advancedDriverNameLines(advancedList)
                return (
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
                      className={
                        showAdvancedTooltip
                          ? "[&:focus-visible]:outline [&:focus-visible]:outline-2 [&:focus-visible]:outline-[var(--token-accent)] [&:focus-visible]:outline-offset-2"
                          : undefined
                      }
                      tabIndex={showAdvancedTooltip ? 0 : undefined}
                      aria-describedby={showAdvancedTooltip ? descId : undefined}
                      aria-label={`${node.roundLabel}. Activate for round details.`}
                      onMouseEnter={(e) => {
                        if (!showAdvancedTooltip || !target) return
                        setProgressTooltip({
                          anchor: e.currentTarget,
                          drivers: advancedList,
                          nextRoundLabel: target.roundLabel,
                        })
                      }}
                      onMouseLeave={() => {
                        if (!showAdvancedTooltip) return
                        setProgressTooltip(null)
                      }}
                      onFocus={(e) => {
                        if (!showAdvancedTooltip || !target) return
                        setProgressTooltip({
                          anchor: e.currentTarget,
                          drivers: advancedList,
                          nextRoundLabel: target.roundLabel,
                        })
                      }}
                      onBlur={() => {
                        if (!showAdvancedTooltip) return
                        setProgressTooltip(null)
                      }}
                      onKeyDown={(e) => {
                        if (!showAdvancedTooltip) return
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleNodeClick(node, x, y)
                        }
                      }}
                      onClick={() => handleNodeClick(node, x, y)}
                    />
                    <text
                      x={x + 10}
                      y={y + 22}
                      fill={palette.nodeText}
                      fontSize={14}
                      fontWeight={600}
                      style={{ pointerEvents: "none" }}
                    >
                      {node.roundLabel}
                    </text>
                    {progressedLines.length > 0 ? (
                      <text
                        x={x + 10}
                        y={y + 38}
                        fill={palette.advancedText}
                        fontSize={10}
                        fontWeight={600}
                        style={{ pointerEvents: "none" }}
                      >
                        {progressedLines.map((line, idx) => (
                          <tspan
                            key={idx}
                            x={x + 10}
                            dy={idx === 0 ? 0 : CARD_PROGRESSED_LINE_HEIGHT}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </svg>
          </div>
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
                {driverCountLabel(activeNode)}
                {activeNodeAdvancement.target ? (
                  <>
                    {" "}
                    · {activeNodeAdvancement.drivers.length} advanced to{" "}
                    {activeNodeAdvancement.target.roundLabel}
                  </>
                ) : (
                  <> · Final or no following main in ladder</>
                )}
                {activeNode.advancedDriverCount > 0 ? (
                  <> · {activeNode.advancedDriverCount} started this main after an earlier main</>
                ) : null}
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
                          backgroundColor: advancedToNextIds.has(driver.driverId)
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
        {progressTooltip != null &&
          typeof document !== "undefined" &&
          createPortal(
            <AdvancedDriversTooltipFloater
              state={progressTooltip}
              onDismiss={() => setProgressTooltip(null)}
            />,
            document.body
          )}
      </div>
    </>
  )
}
