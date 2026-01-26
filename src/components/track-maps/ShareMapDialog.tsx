/**
 * @fileoverview Share Map Dialog component
 * 
 * @created 2026-01-24
 * @creator Auto-generated
 * @lastModified 2026-01-24
 * 
 * @description Dialog for sharing track maps via shareable links
 * 
 * @purpose Allows users to generate and copy shareable links for their track maps
 */

"use client"

import { useState } from "react"

interface ShareMapDialogProps {
  isOpen: boolean
  onClose: () => void
  mapId: string
  mapName: string
}

export default function ShareMapDialog({
  isOpen,
  onClose,
  mapId,
  mapName,
}: ShareMapDialogProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generateShareLink() {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/track-maps/${mapId}/share`, {
        method: "POST",
      })
      if (!response.ok) {
        throw new Error("Failed to generate share link")
      }
      const data = await response.json()
      if (data.success) {
        setShareUrl(data.data.shareUrl)
      } else {
        throw new Error(data.message || "Failed to generate share link")
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate share link")
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      alert("Failed to copy link")
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--token-surface-elevated)] rounded-lg border border-[var(--token-border-default)] w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-[var(--token-border-default)]">
          <h2 className="text-xl font-semibold text-[var(--token-text-primary)]">
            Share Track Map
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)]"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm text-[var(--token-text-secondary)] mb-2">
              Share &quot;{mapName}&quot; with others via a shareable link.
            </p>
          </div>

          {!shareUrl ? (
            <button
              onClick={generateShareLink}
              disabled={loading}
              className="w-full px-4 py-2 bg-[var(--token-accent)] text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Generating..." : "Generate Share Link"}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border border-[var(--token-border-default)] rounded bg-[var(--token-surface)] text-[var(--token-text-primary)] text-sm"
                />
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 border border-[var(--token-border-default)] rounded hover:bg-[var(--token-surface-raised)] transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-[var(--token-text-secondary)]">
                Anyone with this link can view your track map.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
