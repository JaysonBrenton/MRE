/**
 * @fileoverview Users table component for admin console
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-29
 *
 * @description Displays users in a table with management actions, search, and filters
 */

"use client"

import { useEffect, useState, useCallback } from "react"
import EditUserModal from "./EditUserModal"
import DeleteConfirmationDialog from "./DeleteConfirmationDialog"
import Modal from "@/components/ui/Modal"
import ListPagination from "../event-analysis/ListPagination"
import ChartContainer from "../event-analysis/ChartContainer"

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
  const [total, setTotal] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [searchQuery, setSearchQuery] = useState("")
  const [isAdminFilter, setIsAdminFilter] = useState<string>("all")
  const [teamNameFilter, setTeamNameFilter] = useState("")
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [toggleAdminUser, setToggleAdminUser] = useState<User | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: itemsPerPage.toString(),
      })

      if (searchQuery.trim()) {
        // Search by email (API supports partial matching)
        params.append("email", searchQuery.trim())
      }

      if (isAdminFilter !== "all") {
        params.append("isAdmin", isAdminFilter === "true" ? "true" : "false")
      }

      const response = await fetch(`/api/v1/admin/users?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Failed to fetch users")
      }
      const data = await response.json()
      if (data.success) {
        setUsers(data.data.users)
        setTotalPages(data.data.totalPages)
        setTotal(data.data.total || 0)
      } else {
        throw new Error(data.error?.message || "Failed to fetch users")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [page, itemsPerPage, searchQuery, isAdminFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleEdit = (user: User) => {
    setEditUser(user)
  }

  const handleDelete = (user: User) => {
    setDeleteUser(user)
  }

  const handleToggleAdmin = (user: User) => {
    setToggleAdminUser(user)
  }

  const handleSaveUser = (updatedUser: User) => {
    setUsers(users.map((u) => (u.id === updatedUser.id ? updatedUser : u)))
    setEditUser(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteUser) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/v1/admin/users/${deleteUser.id}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (data.success) {
        setUsers(users.filter((u) => u.id !== deleteUser.id))
        setDeleteUser(null)
        fetchUsers() // Refresh to update pagination
      } else {
        setError(data.error?.message || "Failed to delete user")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmToggleAdmin = async () => {
    if (!toggleAdminUser) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/v1/admin/users/${toggleAdminUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isAdmin: !toggleAdminUser.isAdmin,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setUsers(users.map((u) => (u.id === toggleAdminUser.id ? data.data : u)))
        setToggleAdminUser(null)
      } else {
        setError(data.error?.message || "Failed to update admin status")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setActionLoading(false)
    }
  }

  // Get unique team names for filter
  const uniqueTeamNames = Array.from(
    new Set(users.map((u) => u.teamName).filter((t): t is string => t !== null))
  ).sort()

  if (loading && users.length === 0) {
    return (
      <ChartContainer
        title="Users"
        aria-label="Users table - loading"
      >
        <div className="flex items-center justify-center h-64 text-[var(--token-text-secondary)]">
          Loading users...
        </div>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer
      title="Users"
      aria-label="Users table with search, filtering, and management actions"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-[var(--token-border-error)] bg-[var(--token-surface-elevated)] p-3">
            <p className="text-sm text-[var(--token-text-error)]">{error}</p>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex-1">
          <label htmlFor="user-search" className="sr-only">
            Search users
          </label>
          <input
            id="user-search"
            type="search"
            placeholder="Search by email or driver name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="admin-filter" className="text-sm text-[var(--token-text-secondary)]">
            Admin:
          </label>
          <select
            id="admin-filter"
            value={isAdminFilter}
            onChange={(e) => {
              setIsAdminFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            <option value="all">All</option>
            <option value="true">Admins only</option>
            <option value="false">Regular users</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--token-border-default)]">
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Email
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Driver Name
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Team
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Admin
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Created
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-[var(--token-surface)]">
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-[var(--token-text-secondary)]"
                >
                  {searchQuery ? "No users match your search." : "No users found."}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)]"
                >
                  <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)]">
                    {user.email}
                  </td>
                  <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)]">
                    {user.driverName}
                  </td>
                  <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-secondary)]">
                    {user.teamName || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm font-normal">
                    {user.isAdmin ? (
                      <span className="text-[var(--token-text-success)]">Yes</span>
                    ) : (
                      <span className="text-[var(--token-text-secondary)]">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-secondary)]">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-normal">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md px-2 py-1"
                        aria-label={`Edit ${user.email}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleAdmin(user)}
                        className="text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md px-2 py-1"
                        aria-label={user.isAdmin ? "Remove admin" : "Make admin"}
                      >
                        {user.isAdmin ? "Demote" : "Promote"}
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="text-[var(--token-text-error)] hover:text-[var(--token-text-error)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md px-2 py-1"
                        aria-label={`Delete ${user.email}`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <ListPagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        itemsPerPage={itemsPerPage}
        totalItems={total}
        itemLabel="users"
        rowsPerPageOptions={[5, 10, 25, 50, 100]}
        onRowsPerPageChange={(newRowsPerPage) => {
          setItemsPerPage(newRowsPerPage)
          setPage(1)
        }}
      />

      {/* Modals */}
      <EditUserModal
        isOpen={editUser !== null}
        onClose={() => setEditUser(null)}
        user={editUser}
        onSave={handleSaveUser}
      />

      <DeleteConfirmationDialog
        isOpen={deleteUser !== null}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleConfirmDelete}
        title="Delete User"
        message="Are you sure you want to delete this user? This will permanently remove the user account and all associated data."
        itemName={deleteUser ? `${deleteUser.email} (${deleteUser.driverName})` : undefined}
        loading={actionLoading}
      />

      <Modal
        isOpen={toggleAdminUser !== null}
        onClose={() => setToggleAdminUser(null)}
        title={toggleAdminUser?.isAdmin ? "Remove Administrator" : "Promote to Administrator"}
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setToggleAdminUser(null)}
              disabled={actionLoading}
              className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-elevated)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmToggleAdmin}
              disabled={actionLoading}
              className="rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading
                ? "Updating..."
                : toggleAdminUser?.isAdmin
                  ? "Remove Admin"
                  : "Promote to Admin"}
            </button>
          </div>
        }
      >
        <div className="px-4 py-4">
          <p className="text-sm text-[var(--token-text-primary)]">
            {toggleAdminUser?.isAdmin
              ? `Are you sure you want to remove administrator privileges from ${toggleAdminUser.email}?`
              : `Are you sure you want to promote ${toggleAdminUser?.email} to administrator?`}
          </p>
          {toggleAdminUser && (
            <p className="mt-2 text-sm font-medium text-[var(--token-text-primary)]">
              {toggleAdminUser.driverName}
            </p>
          )}
        </div>
      </Modal>
      </div>
    </ChartContainer>
  )
}
