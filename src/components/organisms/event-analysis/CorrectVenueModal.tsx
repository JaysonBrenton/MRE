/**
 * @fileoverview Modal for correcting event venue
 *
 * @description Allows event-linked users to select the actual track where the event was held.
 * Admin moderation required - submission goes to moderation queue.
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import Modal from "@/components/molecules/Modal"
import Button from "@/components/atoms/Button"
import TrackSelectionModal from "@/components/organisms/event-search/TrackSelectionModal"
import type { Track } from "@/components/organisms/event-search/TrackRow"
import { clientLogger } from "@/lib/client-logger"
import { NESTED_MODAL_OVERLAY_Z_INDEX } from "@/lib/modal-styles"

export interface CorrectVenueModalProps {
  eventId: string
  currentTrackName: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const FAVOURITES_STORAGE_KEY = "mre_favourite_tracks"

export default function CorrectVenueModal({
  eventId,
  currentTrackName,
  isOpen,
  onClose,
  onSuccess,
}: CorrectVenueModalProps) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [tracksLoading, setTracksLoading] = useState(false)
  const [favourites, setFavourites] = useState<string[]>([])
  const [showTrackPicker, setShowTrackPicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTracks = useCallback(async () => {
    setTracksLoading(true)
    try {
      const res = await fetch("/api/v1/tracks?followed=false&active=true", {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to load tracks")
      const json = await res.json()
      if (json.success && json.data?.tracks) {
        setTracks(
          json.data.tracks.map(
            (t: { id: string; trackName: string; sourceTrackSlug?: string; country?: string }) => ({
              id: t.id,
              trackName: t.trackName,
              sourceTrackSlug: t.sourceTrackSlug,
              country: t.country,
            })
          )
        )
      }
    } catch (e) {
      clientLogger.error("Failed to load tracks for venue correction", { error: e })
      setError("Failed to load tracks")
    } finally {
      setTracksLoading(false)
    }
  }, [])

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(FAVOURITES_STORAGE_KEY) : null
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[]
        if (Array.isArray(parsed)) setFavourites(parsed)
      } catch {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadTracks()
      setError(null)
      setShowTrackPicker(false)
    }
  }, [isOpen, loadTracks])

  const handleToggleFavourite = useCallback((trackId: string) => {
    setFavourites((prev) => {
      const next = prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
      if (typeof window !== "undefined") {
        localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(next))
      }
      return next
    })
  }, [])

  const handleSelectTrack = useCallback(
    async (track: Track) => {
      setShowTrackPicker(false)
      setSubmitting(true)
      setError(null)
      try {
        const res = await fetch(`/api/v1/events/${eventId}/venue-correction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ venueTrackId: track.id }),
        })
        const json = await res.json()
        if (!json.success) {
          throw new Error(json.error?.message ?? "Failed to submit")
        }
        onSuccess()
        onClose()
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to submit venue correction"
        setError(msg)
      } finally {
        setSubmitting(false)
      }
    },
    [eventId, onSuccess, onClose]
  )

  const handleRevert = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/events/${eventId}/venue-correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ venueTrackId: null }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? "Failed to submit")
      onSuccess()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to submit"
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }, [eventId, onSuccess, onClose])

  return (
    <>
      <Modal
        isOpen={isOpen && !showTrackPicker}
        onClose={onClose}
        title="Correct venue"
        subtitle="Submit the actual track where this event was held. An administrator will review your request."
        maxWidth="md"
        footer={
          <div className="flex flex-wrap gap-2">
            <Button variant="default" onClick={onClose} disabled={submitting} aria-label="Cancel">
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleRevert}
              disabled={submitting || tracksLoading}
              aria-label="Revert to original venue"
            >
              Revert to original ({currentTrackName})
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowTrackPicker(true)}
              disabled={submitting || tracksLoading}
              aria-label="Select track"
            >
              {tracksLoading ? "Loading tracks…" : "Select track"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--token-text-secondary)]">
            The venue shown may not match where this event was held. Select the correct track or
            revert to the original.
          </p>
          {error && (
            <p className="text-sm text-[var(--token-status-error-text)]" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>

      <TrackSelectionModal
        tracks={tracks}
        favourites={favourites}
        isOpen={showTrackPicker}
        onClose={() => setShowTrackPicker(false)}
        onSelect={handleSelectTrack}
        onToggleFavourite={handleToggleFavourite}
        overlayZIndex={NESTED_MODAL_OVERLAY_Z_INDEX}
      />
    </>
  )
}
