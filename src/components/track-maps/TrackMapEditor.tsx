/**
 * @fileoverview Track Map Editor component
 * 
 * @created 2026-01-24
 * @creator Auto-generated
 * @lastModified 2026-01-24
 * 
 * @description Main editor component for track maps
 * 
 * @purpose Provides the complete track map editing interface with canvas,
 *          toolbar, and property panels
 */

"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import TrackMapCanvas from "./TrackMapCanvas"
import ShapeToolbar from "./ShapeToolbar"
import ShapePropertiesPanel from "./ShapePropertiesPanel"
import ShareMapDialog from "./ShareMapDialog"
import type { TrackMapWithRelations, TrackMapData, TrackMapShape } from "@/core/track-maps/repo"

interface TrackMapEditorProps {
  mapId: string | null
  initialMap?: TrackMapWithRelations | null
  onSave?: (map: TrackMapWithRelations) => void
}

export default function TrackMapEditor({
  mapId,
  initialMap,
  onSave,
}: TrackMapEditorProps) {
  const [mapData, setMapData] = useState<TrackMapData>({
    canvasWidth: 1000,
    canvasHeight: 1000,
    shapes: [],
  })
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)
  const [selectedTool, setSelectedTool] = useState<TrackMapShape["type"] | null>(null)
  const [mapName, setMapName] = useState(initialMap?.name || "Untitled Map")
  const [mapDescription, setMapDescription] = useState(initialMap?.description || "")
  const [isPublic, setIsPublic] = useState(initialMap?.isPublic || false)
  const [saving, setSaving] = useState(false)
  const [trackId, setTrackId] = useState(initialMap?.trackId || "")
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [tracks, setTracks] = useState<Array<{ id: string; trackName: string }>>([])
  const historyRef = useRef<TrackMapData[]>([])
  const historyIndexRef = useRef(-1)

  useEffect(() => {
    if (!trackId) {
      // Load all active tracks for selection (followed=false so we get full catalogue)
      fetch("/api/v1/tracks?followed=false&active=true")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setTracks(data.data.tracks || [])
          }
        })
        .catch(() => {
          // Ignore errors
        })
    }
  }, [trackId])

  useEffect(() => {
    if (initialMap) {
      setMapData(initialMap.mapData)
      setMapName(initialMap.name)
      setMapDescription(initialMap.description || "")
      setIsPublic(initialMap.isPublic)
      setTrackId(initialMap.trackId)
      // Initialize history
      historyRef.current = [initialMap.mapData]
      historyIndexRef.current = 0
    } else {
      // Initialize with empty map
      const emptyMap: TrackMapData = {
        canvasWidth: 1000,
        canvasHeight: 1000,
        shapes: [],
      }
      historyRef.current = [emptyMap]
      historyIndexRef.current = 0
    }
  }, [initialMap])

  const addToHistory = useCallback((newMapData: TrackMapData) => {
    // Remove any history after current index (when undoing then making new changes)
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    // Add new state
    historyRef.current.push(JSON.parse(JSON.stringify(newMapData)))
    historyIndexRef.current = historyRef.current.length - 1
    // Limit history size to 50
    if (historyRef.current.length > 50) {
      historyRef.current.shift()
      historyIndexRef.current--
    }
  }, [])

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--
      setMapData(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])))
    }
  }, [])

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++
      setMapData(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])))
    }
  }, [])

  const handleShapeAdd = useCallback((shape: TrackMapShape) => {
    setMapData((prev) => {
      const newData = {
        ...prev,
        shapes: [...prev.shapes, shape],
      }
      addToHistory(newData)
      return newData
    })
    setSelectedShapeId(shape.id)
    setSelectedTool(null)
  }, [addToHistory])

  const handleShapeUpdate = useCallback((shapeId: string, updates: Partial<TrackMapShape>) => {
    setMapData((prev) => {
      const newData = {
        ...prev,
        shapes: prev.shapes.map((s) => (s.id === shapeId ? { ...s, ...updates } : s)),
      }
      addToHistory(newData)
      return newData
    })
  }, [addToHistory])

  const handleShapeDelete = useCallback((shapeId: string) => {
    setMapData((prev) => {
      const newData = {
        ...prev,
        shapes: prev.shapes.filter((s) => s.id !== shapeId),
      }
      addToHistory(newData)
      return newData
    })
    if (selectedShapeId === shapeId) {
      setSelectedShapeId(null)
    }
  }, [selectedShapeId, addToHistory])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleUndo, handleRedo])

  const handleSave = useCallback(async () => {
    if (!trackId) {
      alert("Please select a track first")
      return
    }

    try {
      setSaving(true)
      const url = mapId ? `/api/v1/track-maps/${mapId}` : "/api/v1/track-maps"
      const method = mapId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trackId,
          name: mapName,
          description: mapDescription || undefined,
          mapData,
          isPublic,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save track map")
      }

      const data = await response.json()
      if (data.success && onSave) {
        onSave(data.data.map)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save track map")
    } finally {
      setSaving(false)
    }
  }, [mapId, trackId, mapName, mapDescription, mapData, isPublic, onSave])

  const selectedShape = mapData.shapes.find((s) => s.id === selectedShapeId) || null

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--token-border-default)]">
        <div className="flex items-center gap-4 flex-1">
          <input
            type="text"
            value={mapName}
            onChange={(e) => setMapName(e.target.value)}
            className="text-2xl font-semibold bg-transparent border-none outline-none text-[var(--token-text-primary)]"
            placeholder="Untitled Map"
          />
          {!trackId && (
            <div className="flex flex-col gap-1">
              <label htmlFor="track-map-track-select" className="text-xs font-medium text-[var(--token-text-secondary)]">
                Track
              </label>
              <select
                id="track-map-track-select"
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                className="px-3 py-2 border border-[var(--token-border-default)] rounded bg-[var(--token-surface)] text-[var(--token-text-primary)] min-w-[200px]"
                required
                aria-describedby={tracks.length === 0 ? "track-map-no-tracks" : undefined}
              >
                <option value="">Select track…</option>
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.trackName}
                  </option>
                ))}
              </select>
              {tracks.length === 0 && (
                <span id="track-map-no-tracks" className="text-xs text-[var(--token-text-muted)]">
                  No tracks in catalogue. Sync tracks via Admin → Tracks.
                </span>
              )}
            </div>
          )}
          <input
            type="text"
            value={mapDescription}
            onChange={(e) => setMapDescription(e.target.value)}
            className="flex-1 text-sm bg-transparent border border-[var(--token-border-default)] rounded px-2 py-1 text-[var(--token-text-secondary)]"
            placeholder="Description (optional)"
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={historyIndexRef.current <= 0}
              className="px-3 py-2 border border-[var(--token-border-default)] rounded hover:bg-[var(--token-surface-raised)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Undo (Ctrl+Z)"
            >
              ↶
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndexRef.current >= historyRef.current.length - 1}
              className="px-3 py-2 border border-[var(--token-border-default)] rounded hover:bg-[var(--token-surface-raised)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Redo (Ctrl+Y)"
            >
              ↷
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--token-text-secondary)]">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Public
          </label>
          {mapId && (
            <button
              onClick={() => setShareDialogOpen(true)}
              className="px-4 py-2 border border-[var(--token-border-default)] rounded-lg hover:bg-[var(--token-surface-raised)] transition-colors"
            >
              Share
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || (!mapId && !trackId)}
            className="px-4 py-2 bg-[var(--token-accent)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            title={!mapId && !trackId ? "Select a track first" : undefined}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {mapId && (
          <ShareMapDialog
            isOpen={shareDialogOpen}
            onClose={() => setShareDialogOpen(false)}
            mapId={mapId}
            mapName={mapName}
          />
        )}
      </div>

      {/* Main editor area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="w-16 border-r border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]">
          <ShapeToolbar
            selectedTool={selectedTool}
            onToolSelect={setSelectedTool}
          />
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-[var(--token-surface)]">
          <TrackMapCanvas
            mapData={mapData}
            selectedShapeId={selectedShapeId}
            selectedTool={selectedTool}
            onShapeAdd={handleShapeAdd}
            onShapeSelect={setSelectedShapeId}
            onShapeUpdate={handleShapeUpdate}
            onShapeDelete={handleShapeDelete}
          />
        </div>

        {/* Properties panel */}
        {selectedShape && (
          <div className="w-64 border-l border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] overflow-y-auto">
            <ShapePropertiesPanel
              shape={selectedShape}
              onUpdate={(updates) => handleShapeUpdate(selectedShape.id, updates)}
              onDelete={() => handleShapeDelete(selectedShape.id)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
