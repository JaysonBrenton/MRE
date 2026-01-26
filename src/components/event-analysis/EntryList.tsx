/**
 * @fileoverview Entry list component with table layout and pagination
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-29
 * 
 * @description Entry list component showing the actual event entry list with pagination
 * 
 * @purpose Displays event entries with driver name, class, transponder number, and car number.
 *          Desktop-optimized table layout with paginated results.
 * 
 * @relatedFiles
 * - src/components/event-analysis/EntryListTab.tsx (uses this)
 * - src/components/event-analysis/ListPagination.tsx (pagination component)
 */

"use client"

import { useState, useMemo, useEffect } from "react"
import ListPagination from "./ListPagination"
import ClassFilter from "./ClassFilter"
import ChartContainer from "./ChartContainer"
import ClassDetailsModal from "./ClassDetailsModal"

export interface Entry {
  id: string
  driverId: string
  driverName: string
  className: string
  transponderNumber: string | null
  carNumber: string | null
}

export interface EntryListProps {
  entries: Entry[]
  raceClasses?: Map<string, { vehicleType: string | null; vehicleTypeNeedsReview: boolean }>
  eventId?: string
}

type SortField = "driverName" | "className" | "transponderNumber" | "carNumber"
type SortDirection = "asc" | "desc"

interface SortIconProps {
  field: SortField
  activeField: SortField
  direction: SortDirection
}

function SortIcon({ field, activeField, direction }: SortIconProps) {
  if (activeField !== field) {
    return null
  }
  return <span aria-hidden="true">{direction === "asc" ? "↑" : "↓"}</span>
}

export default function EntryList({ entries, raceClasses, eventId }: EntryListProps) {
  const [sortField, setSortField] = useState<SortField>("driverName")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalClassName, setModalClassName] = useState<string | null>(null)

  // Extract unique classes from entries
  const availableClasses = useMemo(() => {
    const classes = new Set<string>()
    entries.forEach((entry) => {
      if (entry.className) {
        classes.add(entry.className)
      }
    })
    return Array.from(classes).sort()
  }, [entries])

  // Filter entries by class
  const filteredEntries = useMemo(() => {
    if (!selectedClass) {
      return entries
    }
    return entries.filter((entry) => entry.className === selectedClass)
  }, [entries, selectedClass])

  const sortedEntries = useMemo(() => {
    const sorted = [...filteredEntries].sort((a, b) => {
      let aValue: number | string | null
      let bValue: number | string | null

      switch (sortField) {
        case "driverName":
          aValue = a.driverName.toLowerCase()
          bValue = b.driverName.toLowerCase()
          break
        case "className":
          aValue = a.className.toLowerCase()
          bValue = b.className.toLowerCase()
          break
        case "transponderNumber":
          aValue = a.transponderNumber ?? ""
          bValue = b.transponderNumber ?? ""
          break
        case "carNumber":
          aValue = a.carNumber ?? ""
          bValue = b.carNumber ?? ""
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })

    return sorted
  }, [filteredEntries, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setItemsPerPage(newRowsPerPage)
    setCurrentPage(1)
  }

  // Pagination calculations
  const totalPages = Math.ceil(sortedEntries.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedEntries = sortedEntries.slice(startIndex, endIndex)

  // Reset to page 1 when sort, filter, or itemsPerPage changes
  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    setTimeout(() => {
      setCurrentPage(1)
    }, 0)
  }, [sortField, sortDirection, selectedClass, itemsPerPage])

  return (
    <ChartContainer
      title="Entry List"
      description="Complete list of drivers entered in this event"
      aria-label="Entry list with driver names, classes, transponders, and car numbers"
    >
      <div className="space-y-4">
        {/* Class Filter */}
        <div className="flex justify-end">
          <ClassFilter
            classes={availableClasses}
            selectedClass={selectedClass}
            onClassChange={setSelectedClass}
          />
        </div>

      {/* Table layout */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {/* Table header */}
          <thead>
            <tr className="border-b border-[var(--token-border-default)]">
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                <button
                  type="button"
                  onClick={() => handleSort("driverName")}
                  className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                >
                  Driver Name
                  <SortIcon
                    field="driverName"
                    activeField={sortField}
                    direction={sortDirection}
                  />
                </button>
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                <button
                  type="button"
                  onClick={() => handleSort("className")}
                  className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                >
                  Class
                  <SortIcon
                    field="className"
                    activeField={sortField}
                    direction={sortDirection}
                  />
                </button>
              </th>
              {raceClasses && (
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                  Vehicle Type
                </th>
              )}
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                <button
                  type="button"
                  onClick={() => handleSort("transponderNumber")}
                  className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                >
                  Transponder
                  <SortIcon
                    field="transponderNumber"
                    activeField={sortField}
                    direction={sortDirection}
                  />
                </button>
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                <button
                  type="button"
                  onClick={() => handleSort("carNumber")}
                  className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                >
                  Car Number
                  <SortIcon
                    field="carNumber"
                    activeField={sortField}
                    direction={sortDirection}
                  />
                </button>
              </th>
            </tr>
          </thead>
          {/* Table body */}
          <tbody>
            {paginatedEntries.map((entry) => {
              const raceClassInfo = raceClasses?.get(entry.className)
              const vehicleType = raceClassInfo?.vehicleType
              
              return (
                <tr
                  key={entry.id}
                  className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)] transition-colors"
                >
                  <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-primary)]">
                    {entry.driverName}
                  </td>
                  <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                    <div className="flex items-center gap-2">
                      <span>{entry.className}</span>
                      {eventId && (
                        <button
                          type="button"
                          onClick={() => {
                            setModalClassName(entry.className)
                            setModalOpen(true)
                          }}
                          className="p-1 text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded"
                          aria-label={`View details for ${entry.className}`}
                          title="View class details"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                  {raceClasses && (
                    <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                      {vehicleType || "Not determined"}
                    </td>
                  )}
                  <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                    {entry.transponderNumber || "N/A"}
                  </td>
                  <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                    {entry.carNumber || "N/A"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <ListPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        totalItems={sortedEntries.length}
        itemLabel="entries"
        rowsPerPageOptions={[5, 10, 25, 50, 100]}
        onRowsPerPageChange={handleRowsPerPageChange}
      />
      </div>
      
      {/* Class Details Modal */}
      {eventId && modalClassName && raceClasses && (
        <ClassDetailsModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false)
            setModalClassName(null)
          }}
          eventId={eventId}
          className={modalClassName}
          vehicleType={raceClasses.get(modalClassName)?.vehicleType ?? null}
          vehicleTypeNeedsReview={raceClasses.get(modalClassName)?.vehicleTypeNeedsReview ?? true}
          onSave={async (vehicleType, acceptInference) => {
            const url = `/api/v1/events/${eventId}/race-classes/${encodeURIComponent(modalClassName)}/vehicle-type`
            console.log("[EntryList] Saving vehicle type:", {
              eventId,
              className: modalClassName,
              vehicleType,
              acceptInference,
              url,
            })

            const response = await fetch(url, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vehicleType, acceptInference }),
              credentials: "include",
              cache: "no-store",
            })

            if (!response.ok) {
              // Parse error response to get actual error message
              let errorMessage = "Failed to save vehicle type"
              try {
                const errorData = await response.json()
                console.error("[EntryList] Save failed:", errorData)
                if (errorData.error?.message) {
                  errorMessage = errorData.error.message
                } else if (errorData.error?.code) {
                  errorMessage = `${errorData.error.code}: ${errorMessage}`
                }
              } catch {
                // If response is not JSON, use status text
                errorMessage = response.statusText || errorMessage
              }
              throw new Error(errorMessage)
            }

            // Verify response body indicates success
            const result = await response.json()
            console.log("[EntryList] Save response:", result)
            if (!result.success) {
              const errorMessage = result.error?.message || "Save operation failed"
              console.error("[EntryList] Save returned success:false:", result)
              throw new Error(errorMessage)
            }

            console.log("[EntryList] Save successful, reloading page...")
            // Refresh the page to show updated data
            window.location.reload()
          }}
        />
      )}
    </ChartContainer>
  )
}

