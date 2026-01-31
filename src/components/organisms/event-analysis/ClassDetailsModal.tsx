/**
 * @fileoverview Class details modal for reviewing and editing vehicle type
 *
 * @created 2025-01-29
 * @creator Auto-generated
 * @lastModified 2025-01-29
 *
 * @description Modal component for viewing race class details and editing vehicle type
 *
 * @purpose Provides UI for users to review inferred vehicle type and accept or edit it
 */

"use client"

import { useState, useEffect } from "react"
import Modal from "@/components/molecules/Modal"
import { getVehicleTypeOptions } from "@/core/events/vehicle-type-options"

export interface ClassDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  className: string
  vehicleType: string | null
  vehicleTypeNeedsReview: boolean
  onSave: (vehicleType: string | null, acceptInference: boolean) => Promise<void>
}

export default function ClassDetailsModal({
  isOpen,
  onClose,
  eventId,
  className,
  vehicleType: initialVehicleType,
  vehicleTypeNeedsReview,
  onSave,
}: ClassDetailsModalProps) {
  const [vehicleType, setVehicleType] = useState<string>(initialVehicleType || "Unknown")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Update local state when props change
  useEffect(() => {
    setVehicleType(initialVehicleType || "Unknown")
    setError(null)
  }, [initialVehicleType, isOpen])

  const options = getVehicleTypeOptions(initialVehicleType)

  const handleAccept = async () => {
    if (!initialVehicleType || initialVehicleType === "Unknown") {
      setError("No inferred vehicle type to accept")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave(initialVehicleType, true)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const valueToSave = vehicleType === "Unknown" ? null : vehicleType
      await onSave(valueToSave, false)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    // Prevent closing during save
    if (isSaving) {
      return
    }
    setVehicleType(initialVehicleType || "Unknown")
    setError(null)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? () => {} : handleCancel}
      title="Race Class Details"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          {error && <span className="text-sm text-red-500 mr-auto">{error}</span>}
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
            disabled={isSaving}
          >
            Cancel
          </button>
          {initialVehicleType && initialVehicleType !== "Unknown" && vehicleTypeNeedsReview && (
            <button
              type="button"
              onClick={handleAccept}
              className="px-4 py-2 text-sm font-medium bg-[var(--token-interactive-primary)] text-white rounded-md hover:bg-[var(--token-interactive-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaving}
            >
              Accept Inference
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-[var(--token-interactive-primary)] text-white rounded-md hover:bg-[var(--token-interactive-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      }
    >
      <div className="px-4 py-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1">
            Race Class
          </label>
          <div className="text-base text-[var(--token-text-primary)]">{className}</div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1">
            Inferred Vehicle Type
            {vehicleTypeNeedsReview && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded">
                Needs Review
              </span>
            )}
          </label>
          <div className="text-base text-[var(--token-text-primary)]">
            {initialVehicleType || "Not determined"}
          </div>
          {vehicleTypeNeedsReview && (
            <p className="mt-1 text-sm text-[var(--token-text-secondary)]">
              Please review and confirm or edit the inferred vehicle type.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="vehicle-type-select"
            className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1"
          >
            Vehicle Type
          </label>
          <select
            id="vehicle-type-select"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-[var(--token-text-secondary)]">
            Select the vehicle type for this race class.
          </p>
        </div>
      </div>
    </Modal>
  )
}
