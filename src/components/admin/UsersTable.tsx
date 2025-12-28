/**
 * @fileoverview Users table component for admin console
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Displays users in a table with management actions
 */

"use client"

import { useEffect, useState } from "react"

interface User {
  id: string
  email: string
  driverName: string
  teamName: string | null
  isAdmin: boolean
  createdAt: string
}

export default function UsersTable() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    async function fetchUsers() {
      try {
        const response = await fetch(`/api/v1/admin/users?page=${page}&pageSize=50`)
        if (!response.ok) {
          throw new Error("Failed to fetch users")
        }
        const data = await response.json()
        if (data.success) {
          setUsers(data.data.users)
          setTotalPages(data.data.totalPages)
        } else {
          throw new Error(data.error?.message || "Failed to fetch users")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [page])

  if (loading) {
    return <div className="text-center py-8 text-[var(--token-text-secondary)]">Loading users...</div>
  }

  if (error) {
    return <div className="text-center py-8 text-[var(--token-text-error)]">Error: {error}</div>
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--token-border-default)]">
              <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--token-text-primary)]">Email</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--token-text-primary)]">Driver Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--token-text-primary)]">Team</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--token-text-primary)]">Admin</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--token-text-primary)]">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-[var(--token-border-muted)]">
                <td className="px-4 py-3 text-sm text-[var(--token-text-primary)]">{user.email}</td>
                <td className="px-4 py-3 text-sm text-[var(--token-text-primary)]">{user.driverName}</td>
                <td className="px-4 py-3 text-sm text-[var(--token-text-secondary)]">{user.teamName || "-"}</td>
                <td className="px-4 py-3 text-sm">
                  {user.isAdmin ? (
                    <span className="text-[var(--token-text-success)]">Yes</span>
                  ) : (
                    <span className="text-[var(--token-text-secondary)]">No</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--token-text-secondary)]">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface)] text-[var(--token-text-primary)] disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-[var(--token-text-secondary)]">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface)] text-[var(--token-text-primary)] disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

