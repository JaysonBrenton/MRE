"use client"

import type { KeyboardEvent } from "react"
import { useCallback, useState } from "react"
import Modal from "@/components/molecules/Modal"
import { buildGoogleMapsClassicVenueEmbedSrc } from "@/lib/maps-embed-url"

const PREVIEW_BTN_CLASS = [
  "group relative block w-full min-w-0 cursor-pointer overflow-hidden rounded-xl border border-[var(--glass-border)]",
  "shadow-sm transition-[box-shadow,filter]",
  "hover:brightness-[1.02] hover:shadow-md",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)]",
].join(" ")

const FRAME_CLASS = "absolute inset-0 h-full w-full border-0"

function activateOnKeyActivate(e: KeyboardEvent<HTMLElement>, onActivate: () => void): void {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault()
    onActivate()
  }
}

export type GoogleMapsVenueEmbedProps = {
  /** Full address line(s) matching Google Search / Maps Embed `q=` */
  address: string
}

/**
 * Small Maps iframe (Google `maps?q=&output=embed`; no Embed API key). Click or keyboard opens a modal with the same embed.
 */
export function GoogleMapsVenueEmbed({ address }: GoogleMapsVenueEmbedProps) {
  const trimmed = address.trim()

  const [modalOpen, setModalOpen] = useState(false)
  const open = useCallback(() => setModalOpen(true), [])
  const close = useCallback(() => setModalOpen(false), [])

  if (!trimmed) {
    return null
  }

  let embedSrc: string
  try {
    embedSrc = buildGoogleMapsClassicVenueEmbedSrc(trimmed)
  } catch {
    return null
  }

  const iframeTitle = `Map preview: ${trimmed}`

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={PREVIEW_BTN_CLASS}
        aria-expanded={modalOpen}
        aria-label={`Expand venue map: ${trimmed}`}
        onClick={() => open()}
        onKeyDown={(e) => activateOnKeyActivate(e, open)}
      >
        <div className="relative aspect-[16/10] w-full bg-[var(--token-surface-raised)]">
          <iframe
            title={iframeTitle}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className={`${FRAME_CLASS} pointer-events-none`}
            src={embedSrc}
          />
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1 text-center text-[10px] font-medium text-white opacity-95 sm:text-xs"
            aria-hidden
          >
            Open full map
          </span>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={close} title="Venue location" maxWidth="4xl">
        <div className="min-h-[min(70vh,28rem)] w-full min-w-0 overflow-hidden rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-raised)]">
          <iframe
            title={`${iframeTitle} (full)`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-[min(70vh,28rem)] w-full border-0"
            src={embedSrc}
          />
        </div>
      </Modal>
    </>
  )
}
