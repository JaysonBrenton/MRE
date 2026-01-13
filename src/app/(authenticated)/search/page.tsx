/**
 * @fileoverview Unified Search page
 * 
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 * 
 * @description Unified search page for events and sessions
 */

"use client"

import Breadcrumbs from "@/components/Breadcrumbs"
import SearchForm from "@/components/search/SearchForm"
import SearchResultsTable from "@/components/search/SearchResultsTable"
import ListPagination from "@/components/event-analysis/ListPagination"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { setPage, setItemsPerPage, performSearch } from "@/store/slices/searchSlice"

export default function SearchPage() {
  const dispatch = useAppDispatch()
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    totalEvents,
    totalSessions,
    hasSearched,
  } = useAppSelector((state) => state.search)

  const handlePageChange = (page: number) => {
    dispatch(setPage(page))
    if (hasSearched) {
      dispatch(performSearch())
    }
  }

  const handleRowsPerPageChange = (newItemsPerPage: number) => {
    dispatch(setItemsPerPage(newItemsPerPage))
    dispatch(setPage(1))
    if (hasSearched) {
      dispatch(performSearch())
    }
  }

  const totalItems = totalEvents + totalSessions

  return (
    <section className="content-wrapper mx-auto w-full min-w-0 max-w-6xl flex-shrink-0">
      <Breadcrumbs items={[{ label: "Home", href: "/dashboard" }, { label: "Search" }]} />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">Search</h1>
        <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
          Search for events and sessions (races, practice, qualifying)
        </p>
      </div>

      <div className="mb-8">
        <SearchForm />
      </div>

      <div className="mb-8">
        <SearchResultsTable />
      </div>

      {/* Pagination */}
      {hasSearched && totalItems > 0 && (
        <ListPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          itemsPerPage={itemsPerPage}
          totalItems={totalItems}
          itemLabel="results"
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      )}
    </section>
  )
}
