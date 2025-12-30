"use client"
import { useEffect, useState } from "react"

interface Track {
  id: string
  trackName: string
  source: string
  isFollowed: boolean
  isActive: boolean
  eventCount: number
}

export default function TracksTable() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch("/api/v1/admin/tracks?pageSize=50")
      .then((r) => r.json())
      .then((d) => d.success && setTracks(d.data.tracks))
      .finally(() => setLoading(false))
  }, [])
  if (loading) return <div className="py-8 text-center w-full min-w-0">Loading...</div>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-3 text-left">Track</th>
            <th className="px-4 py-3 text-left">Source</th>
            <th className="px-4 py-3 text-left">Events</th>
            <th className="px-4 py-3 text-left">Followed</th>
            <th className="px-4 py-3 text-left">Active</th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((t) => (
            <tr key={t.id} className="border-b">
              <td className="px-4 py-3">{t.trackName}</td>
              <td className="px-4 py-3">{t.source}</td>
              <td className="px-4 py-3">{t.eventCount}</td>
              <td className="px-4 py-3">{t.isFollowed ? "Yes" : "No"}</td>
              <td className="px-4 py-3">{t.isActive ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

