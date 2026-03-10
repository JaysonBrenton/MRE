/**
 * @fileoverview Admin table for venue correction request moderation
 *
 * @description Lists pending venue correction requests; admins can approve or reject.
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import ChartContainer from "@/components/organisms/event-analysis/ChartContainer"
import Modal from "@/components/molecules/Modal"
import Button from "@/components/atoms/Button"

interface VenueCorrectionRequest {
  id: string
  eventId: string
  venueTrackId: string | null
  venueTrackName: string | null
  status: string
  adminNotes: string | null
  createdAt: string
  event: { eventName: string; track: { trackName: string } }
  submittedBy: { id: string; driverName: string | null; email: string }
}

export default function VenueCorrectionRequestsTable() {
  const [requests, setRequests] = useState<VenueCorrectionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"pending" | "all">("pending")
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<{
    request: VenueCorrectionRequest
    adminNotes: string
  } | null>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter === "pending") params.set("status", "pending")
      const res = await fetch(`/api/v1/admin/venue-correction-requests?${params.toString()}`, {
        credentials: "include",
      })
      const json = await res.json()
      if (json.success && json.data?.requests) {
        setRequests(json.data.requests)
      }
    } catch (e) {
      setError("Failed to load venue correction requests")
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleApprove = async (request: VenueCorrectionRequest) => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/admin/venue-correction-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "approve" }),
      })
      const json = await res.json()
      if (json.success) {
        fetchRequests()
      } else {
        setError(json.error?.message ?? "Failed to approve")
      }
    } catch (e) {
      setError("Failed to approve")
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectModal) return
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/admin/venue-correction-requests/${rejectModal.request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "reject",
          adminNotes: rejectModal.adminNotes.trim() || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setRejectModal(null)
        fetchRequests()
      } else {
        setError(json.error?.message ?? "Failed to reject")
      }
    } catch (e) {
      setError("Failed to reject")
    } finally {
      setActionLoading(false)
    }
  }

  const pendingRequests = requests.filter((r) => r.status === "pending")
  const displayRequests = statusFilter === "pending" ? pendingRequests : requests

  if (loading && requests.length === 0) {
    return (
      <ChartContainer
        title="Venue Correction Requests"
        aria-label="Venue correction requests - loading"
      >
        <div className="flex items-center justify-center h-64 text-[var(--token-text-secondary)]">
          Loading...
        </div>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer
      title="Venue Correction Requests"
      aria-label="Venue correction requests moderation table"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-[var(--token-border-error)] bg-[var(--token-surface-elevated)] p-3">
            <p className="text-sm text-[var(--token-text-error)]">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <label className="text-sm text-[var(--token-text-secondary)]">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "pending" | "all")}
            className="rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)]"
          >
            <option value="pending">Pending</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--token-border-default)]">
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                  Event
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                  Current venue
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                  Requested venue
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                  Submitter
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                  Date
                </th>
                {statusFilter === "pending" && (
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                    Actions
                  </th>
                )}
                {statusFilter === "all" && (
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                    Status
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayRequests.length === 0 ? (
                <tr>
                  <td
                    colSpan={statusFilter === "pending" ? 6 : 6}
                    className="px-4 py-8 text-center text-[var(--token-text-secondary)]"
                  >
                    {statusFilter === "pending"
                      ? "No pending venue correction requests."
                      : "No venue correction requests."}
                  </td>
                </tr>
              ) : (
                displayRequests.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)]"
                  >
                    <td className="px-4 py-3 text-sm text-[var(--token-text-primary)]">
                      {r.event.eventName}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--token-text-secondary)]">
                      {r.event.track.trackName}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--token-text-secondary)]">
                      {r.venueTrackId ? (r.venueTrackName ?? "Unknown") : "Revert to original"}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--token-text-secondary)]">
                      {r.submittedBy.driverName ?? r.submittedBy.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--token-text-secondary)]">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    {statusFilter === "pending" && (
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(r)}
                            disabled={actionLoading}
                            className="text-[var(--token-status-success-text)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] rounded px-2 py-1"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectModal({ request: r, adminNotes: "" })}
                            disabled={actionLoading}
                            className="text-[var(--token-status-error-text)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] rounded px-2 py-1"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    )}
                    {statusFilter === "all" && (
                      <td className="px-4 py-3 text-sm text-[var(--token-text-secondary)]">
                        {r.status}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {rejectModal && (
        <Modal
          isOpen={!!rejectModal}
          onClose={() => setRejectModal(null)}
          title="Reject venue correction"
          subtitle="Optionally add a note for the user (e.g. why it was rejected)."
          maxWidth="md"
          footer={
            <div className="flex gap-2">
              <Button variant="default" onClick={() => setRejectModal(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleReject}
                disabled={actionLoading}
                aria-label="Confirm reject"
              >
                Reject
              </Button>
            </div>
          }
        >
          <div className="space-y-3 px-4 py-4">
            <label
              htmlFor="admin-notes"
              className="block text-sm text-[var(--token-text-secondary)]"
            >
              Admin notes (optional)
            </label>
            <textarea
              id="admin-notes"
              value={rejectModal.adminNotes}
              onChange={(e) =>
                setRejectModal((prev) => (prev ? { ...prev, adminNotes: e.target.value } : null))
              }
              rows={3}
              className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)]"
              placeholder="e.g. The requested track does not exist in the region."
            />
          </div>
        </Modal>
      )}
    </ChartContainer>
  )
}
