/**
 * @fileoverview Edit user modal component
 * 
 * @created 2025-01-29
 * @creator System
 * @lastModified 2025-01-29
 * 
 * @description Modal form for editing user details
 * 
 * @purpose Allows admins to edit user email, driver name, team name, and admin status
 * 
 * @relatedFiles
 * - src/components/ui/Modal.tsx (modal component)
 * - src/components/admin/UsersTable.tsx (parent component)
 */

"use client"

import { useState, useEffect } from "react"
import Modal from "@/components/ui/Modal"

interface User {
  id: string
  email: string
  driverName: string
  teamName: string | null
  isAdmin: boolean
}

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
  onSave: (user: User) => void
}

export default function EditUserModal({
  isOpen,
  onClose,
  user,
  onSave,
}: EditUserModalProps) {
  const [email, setEmail] = useState("")
  const [driverName, setDriverName] = useState("")
  const [teamName, setTeamName] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setEmail(user.email)
      setDriverName(user.driverName)
      setTeamName(user.teamName || "")
      setIsAdmin(user.isAdmin)
      setError(null)
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email !== user.email ? email : undefined,
          driverName: driverName !== user.driverName ? driverName : undefined,
          teamName: teamName !== user.teamName ? (teamName || null) : undefined,
          isAdmin: isAdmin !== user.isAdmin ? isAdmin : undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        onSave(data.data)
        onClose()
      } else {
        setError(data.error?.message || "Failed to update user")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit User"
      maxWidth="md"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-elevated)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-user-form"
            disabled={loading}
            className="rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      }
    >
      <form id="edit-user-form" onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        {error && (
          <div className="rounded-md border border-[var(--token-border-error)] bg-[var(--token-surface-elevated)] p-3">
            <p className="text-sm text-[var(--token-text-error)]">{error}</p>
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          />
        </div>

        <div>
          <label
            htmlFor="driverName"
            className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
          >
            Driver Name
          </label>
          <input
            id="driverName"
            type="text"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            required
            className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          />
        </div>

        <div>
          <label
            htmlFor="teamName"
            className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
          >
            Team Name (optional)
          </label>
          <input
            id="teamName"
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          />
        </div>

        <div className="flex items-center">
          <input
            id="isAdmin"
            type="checkbox"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--token-form-border)] text-[var(--token-accent)] focus:ring-[var(--token-interactive-focus-ring)]"
          />
          <label
            htmlFor="isAdmin"
            className="ml-2 text-sm font-medium text-[var(--token-text-primary)]"
          >
            Administrator
          </label>
        </div>
      </form>
    </Modal>
  )
}

