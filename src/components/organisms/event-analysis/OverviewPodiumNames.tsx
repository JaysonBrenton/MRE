"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

const TQ_BADGE_CLASS =
  "inline-flex shrink-0 items-center justify-center rounded border border-[var(--token-accent)]/35 bg-[var(--token-accent-soft-bg)] px-1 py-px text-[0.55rem] font-bold leading-none tracking-wide text-[var(--token-accent)] no-underline"

/** One-line podium name: native `title` + help cursor when CSS truncation hides the full string. */
export function HighlightPodiumName({ name, className }: { name: string; className: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [truncated, setTruncated] = useState(false)
  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    setTruncated(el.scrollWidth > el.clientWidth + 0.5)
  }, [])

  useLayoutEffect(() => {
    measure()
  }, [name, measure])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      measure()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  return (
    <span
      ref={ref}
      className={truncated ? `${className} cursor-help` : className}
      title={truncated ? name : undefined}
    >
      {name}
    </span>
  )
}

/** Driver name with optional compact “TQ” (top qualifier) badge to the right of the truncated name. */
export function PodiumNameWithOptionalTq({
  name,
  nameClassName,
  isTopQualifier,
}: {
  name: string
  nameClassName: string
  isTopQualifier: boolean
}) {
  return (
    <span className="flex min-w-0 max-w-full items-center gap-1">
      <HighlightPodiumName name={name} className={`${nameClassName} min-w-0 flex-1`} />
      {isTopQualifier ? (
        <abbr title="Top qualifier" className={TQ_BADGE_CLASS} aria-label="Top qualifier">
          TQ
        </abbr>
      ) : null}
    </span>
  )
}

/** 2nd/3rd slots: driver name or em dash when standings have no row (keeps podium height consistent). */
export function PodiumSlotName({
  name,
  filledClassName,
  emptyHint,
  isTopQualifier = false,
}: {
  name: string | null
  filledClassName: string
  emptyHint: string
  /** When true and `name` is set, show the top-qualifier badge next to the name. */
  isTopQualifier?: boolean
}) {
  if (name) {
    return (
      <PodiumNameWithOptionalTq
        name={name}
        nameClassName={filledClassName}
        isTopQualifier={isTopQualifier}
      />
    )
  }
  return (
    <span
      className="min-w-0 text-xs font-medium leading-tight text-[var(--token-text-tertiary)] sm:text-sm"
      title={emptyHint}
      aria-label={emptyHint}
    >
      —
    </span>
  )
}
