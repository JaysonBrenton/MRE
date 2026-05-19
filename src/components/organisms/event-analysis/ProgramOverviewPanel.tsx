"use client"

/**
 * Program overview — schedule phases (practice through mains) per class using a
 * bracket-style SVG. Edges are **program schedule flow**, not bump-through mains
 * advancement (see Mains Ladder panel).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { Download } from "lucide-react"
import Modal from "@/components/molecules/Modal"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import {
  buildProgramOverviewModel,
  computeProgramOverviewLayout,
  shortenProgramOverviewRaceTitle,
  type ProgramOverviewPhaseAggregate,
  type ProgramOverviewSessionPreview,
} from "@/core/events/program-overview-model"

interface ProgramOverviewPanelProps {
  data: EventAnalysisData
  classOptions: string[]
  resolvedClassName: string | null
  onClassNameChange: (className: string | null) => void
  toolbarTitle?: ReactNode
}

type ThemePalette = {
  canvasBg: string
  lineDim: string
  accentText: string
  nodeBg: string
  nodeBorder: string
  nodeText: string
  nodeSubtle: string
}

const defaultPalette: ThemePalette = {
  canvasBg: "#0f172a",
  lineDim: "#475569",
  accentText: "#60a5fa",
  nodeBg: "#1e293b",
  nodeBorder: "#475569",
  nodeText: "#e2e8f0",
  nodeSubtle: "#94a3b8",
}

const NODE_HEIGHT = 82
/** Match {@link NODE_WIDTH} in program-overview-model layout. */

function formatDateTimeUtc(d: Date | null): string {
  if (!d || !Number.isFinite(d.getTime())) return "—"
  return d.toISOString().replace("T", " ").slice(0, 16) + "Z"
}

export default function ProgramOverviewPanel({
  data,
  classOptions,
  resolvedClassName,
  onClassNameChange,
  toolbarTitle,
}: ProgramOverviewPanelProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [palette, setPalette] = useState<ThemePalette>(defaultPalette)
  const [exporting, setExporting] = useState(false)
  type ModalPayload =
    | { kind: "aggregate"; agg: ProgramOverviewPhaseAggregate }
    | { kind: "main"; session: ProgramOverviewSessionPreview }
    | null
  const [modalPayload, setModalPayload] = useState<ModalPayload>(null)

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement)
    const pick = (key: string, fallback: string): string => {
      const v = styles.getPropertyValue(key).trim()
      return v || fallback
    }
    setPalette({
      canvasBg: pick("--token-surface", defaultPalette.canvasBg),
      lineDim: pick("--token-border-muted", defaultPalette.lineDim),
      accentText: pick("--token-accent", defaultPalette.accentText),
      nodeBg: pick("--token-surface-raised", defaultPalette.nodeBg),
      nodeBorder: pick("--token-border-default", defaultPalette.nodeBorder),
      nodeText: pick("--token-text-primary", defaultPalette.nodeText),
      nodeSubtle: pick("--token-text-secondary", defaultPalette.nodeSubtle),
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

  const model = useMemo(() => buildProgramOverviewModel(data, selectedClass), [data, selectedClass])

  const layout = useMemo(() => computeProgramOverviewLayout(model), [model])

  const formatSlug = useCallback((name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
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
      const decoded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error("Image decode failed"))
      })
      image.src = url
      await decoded

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
      link.download = `${formatSlug(selectedClass)}-program-overview.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      // Avoid throwing from export path
    } finally {
      setExporting(false)
    }
  }, [layout, palette.canvasBg, selectedClass, formatSlug])

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
            No race-class rows exist for program overview for this event.
          </p>
        </div>
      </div>
    )
  }

  const toolbarRows = (
    <div className="scrollbar-none flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto border-b border-[var(--token-border-muted)]/60 pb-2">
      {toolbarTitle ? <div className="shrink-0">{toolbarTitle}</div> : null}
      <label
        className="shrink-0 text-xs text-[var(--token-text-secondary)]"
        htmlFor="program-overview-class-select"
      >
        Class
      </label>
      <select
        id="program-overview-class-select"
        className="w-max max-w-full shrink-0 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-sm text-[var(--token-text-primary)]"
        value={selectedClass ?? ""}
        onChange={(e) => onClassNameChange(e.target.value || null)}
      >
        {classOptions.map((cn) => (
          <option key={cn} value={cn}>
            {cn}
          </option>
        ))}
      </select>
      <span
        className="ml-auto shrink-0 text-[10px] leading-tight text-[var(--token-text-secondary)] opacity-95"
        style={{ maxWidth: "22rem" } as CSSProperties}
      >
        Connectors follow schedule grouping (not mains bump-up progression).
      </span>
    </div>
  )

  if (!selectedClass || !model || !layout) {
    return (
      <div className="w-full min-w-0 space-y-3">
        {toolbarRows}
        <div className="rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface)]/40 p-4">
          <p className="text-sm text-[var(--token-text-secondary)]">
            No phased sessions were found for this class for a program timeline.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="w-full min-w-0 space-y-3">
        {toolbarRows}
        <div className="scrollbar-none relative w-full min-w-0 overflow-x-auto rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface)]/30">
          <div className="mx-auto flex w-max justify-center">
            <svg
              ref={svgRef}
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              role="group"
              aria-label={`Program schedule phases for ${model.className}`}
              xmlns="http://www.w3.org/2000/svg"
              className="block shrink-0"
            >
              {layout.edges.map((edge) => (
                <g key={edge.id}>
                  <path
                    d={edge.d}
                    fill="none"
                    stroke={palette.lineDim}
                    strokeOpacity={0.85}
                    strokeWidth={10}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={edge.d}
                    fill="none"
                    stroke={palette.accentText}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="5 6"
                    opacity={0.85}
                    aria-hidden="true"
                  />
                </g>
              ))}
              {layout.nodes.map((n) => {
                const isAgg = n.kind === "aggregate"
                const agg = isAgg ? model.aggregates.find((a) => a.phaseKey === n.phaseKey) : null
                const mainSession =
                  !isAgg && n.sessionId ? model.mains.find((m) => m.id === n.sessionId) : null
                return (
                  <g key={n.id}>
                    <rect
                      x={n.x}
                      y={n.y}
                      width={n.width}
                      height={NODE_HEIGHT}
                      rx={10}
                      fill={palette.nodeBg}
                      stroke={palette.nodeBorder}
                      strokeWidth={1.5}
                      style={{ cursor: "pointer" }}
                      className="[&:focus-visible]:outline [&:focus-visible]:outline-2 [&:focus-visible]:outline-[var(--token-accent)] [&:focus-visible]:outline-offset-2"
                      tabIndex={0}
                      aria-label={`${n.titleLines.join(" ")}. Activate for sessions.`}
                      onClick={() => {
                        if (agg) setModalPayload({ kind: "aggregate", agg })
                        else if (mainSession)
                          setModalPayload({ kind: "main", session: mainSession })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          if (agg) setModalPayload({ kind: "aggregate", agg })
                          else if (mainSession)
                            setModalPayload({ kind: "main", session: mainSession })
                        }
                      }}
                    />
                    {n.titleLines.map((line, idx) => (
                      <text
                        key={`t-${idx}`}
                        x={n.x + 10}
                        y={n.y + 22 + idx * 14}
                        fill={palette.nodeText}
                        fontSize={13}
                        fontWeight={600}
                        style={{ pointerEvents: "none" }}
                      >
                        {line}
                      </text>
                    ))}
                    {n.subtitleLines.map((line, idx) => (
                      <text
                        key={`s-${idx}`}
                        x={n.x + 10}
                        y={n.y + (n.titleLines.length > 1 ? 56 : 48) + idx * 12}
                        fill={palette.nodeSubtle}
                        fontSize={10}
                        style={{ pointerEvents: "none" }}
                      >
                        {line}
                      </text>
                    ))}
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
            {exporting ? "Exporting…" : "Export PNG"}
          </button>
        </div>
      </div>

      <Modal
        isOpen={modalPayload !== null}
        onClose={() => setModalPayload(null)}
        title={
          modalPayload?.kind === "aggregate"
            ? modalPayload.agg.title
            : modalPayload?.kind === "main"
              ? shortenProgramOverviewRaceTitle(modalPayload.session.raceLabelRaw)
              : ""
        }
        subtitle={
          modalPayload?.kind === "main"
            ? modalPayload.session.raceLabelRaw
            : modalPayload?.kind === "aggregate"
              ? `${modalPayload.agg.sessions.length} session${modalPayload.agg.sessions.length === 1 ? "" : "s"} · ${modalPayload.agg.phaseKey}`
              : undefined
        }
        maxWidth="3xl"
        resizable={false}
      >
        {modalPayload?.kind === "aggregate" ? (
          <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--token-border-default)]">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead className="bg-[var(--token-surface)]/60 text-[var(--token-text-secondary)]">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Session</th>
                  <th className="px-3 py-2 font-medium">Start (derived)</th>
                  <th className="px-3 py-2 font-medium">Results</th>
                </tr>
              </thead>
              <tbody>
                {modalPayload.agg.sessions.map((s, idx) => (
                  <tr key={s.id} className="border-t border-[var(--token-border-muted)]">
                    <td className="px-3 py-2 text-[var(--token-text-secondary)]">
                      {s.raceOrder ?? idx + 1}
                    </td>
                    <td className="px-3 py-2">{s.raceLabelShort}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatDateTimeUtc(s.startTime)}
                    </td>
                    <td className="px-3 py-2">
                      <a
                        href={s.raceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--token-accent)] underline-offset-2 hover:underline"
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {modalPayload?.kind === "main" ? (
          <div className="space-y-2 text-sm">
            <p className="text-[var(--token-text-secondary)]">
              Main final — full label as ingested from LiveRC.
            </p>
            <p className="break-words font-medium text-[var(--token-text-primary)]">
              {modalPayload.session.raceLabelRaw}
            </p>
            <p>
              <a
                href={modalPayload.session.raceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--token-accent)] underline-offset-2 hover:underline"
              >
                View results (opens in new tab)
              </a>
            </p>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
