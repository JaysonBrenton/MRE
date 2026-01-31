/**
 * @fileoverview Search Redux slice
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 *
 * @description Redux state management for unified search feature
 */

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit"
import type { SessionType } from "@/core/search/types"
import type {
  EventSearchResult,
  SessionSearchResult,
  UnifiedSearchResult,
} from "@/core/search/types"

// API response type matches UnifiedSearchResult (all dates are already strings)
type UnifiedSearchResultApiResponse = UnifiedSearchResult

interface SearchState {
  // Search parameters
  query: string
  driverName: string
  sessionType: SessionType | null
  startDate: string | null
  endDate: string | null

  // Results (dates as strings for Redux serialization)
  events: EventSearchResult[]
  sessions: SessionSearchResult[]
  totalEvents: number
  totalSessions: number

  // Pagination
  currentPage: number
  itemsPerPage: number
  totalPages: number

  // UI state
  isLoading: boolean
  error: string | null
  hasSearched: boolean
}

const initialState: SearchState = {
  query: "",
  driverName: "",
  sessionType: null,
  startDate: null,
  endDate: null,
  events: [],
  sessions: [],
  totalEvents: 0,
  totalSessions: 0,
  currentPage: 1,
  itemsPerPage: 10,
  totalPages: 0,
  isLoading: false,
  error: null,
  hasSearched: false,
}

// Async thunk for performing search
export const performSearch = createAsyncThunk<
  UnifiedSearchResult,
  void,
  { rejectValue: { message: string; code?: string } }
>("search/performSearch", async (_, { getState, rejectWithValue, signal }) => {
  const state = getState() as { search: SearchState }
  const searchState = state.search

  // Build query parameters
  const params = new URLSearchParams()
  if (searchState.query) {
    params.append("q", searchState.query)
  }
  if (searchState.driverName) {
    params.append("driver_name", searchState.driverName)
  }
  if (searchState.sessionType) {
    params.append("session_type", searchState.sessionType)
  }
  if (searchState.startDate) {
    params.append("start_date", searchState.startDate)
  }
  if (searchState.endDate) {
    params.append("end_date", searchState.endDate)
  }
  params.append("page", String(searchState.currentPage))
  params.append("items_per_page", String(searchState.itemsPerPage))

  try {
    const response = await fetch(`/api/v1/search?${params.toString()}`, {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return rejectWithValue({
        message: errorData.error?.message || "Failed to perform search",
        code: errorData.error?.code,
      })
    }

    const result = await response.json()

    if (result.success && result.data) {
      // API response already has dates as strings, use directly
      const data = result.data as UnifiedSearchResultApiResponse
      return {
        events: data.events,
        sessions: data.sessions,
        totalEvents: data.totalEvents,
        totalSessions: data.totalSessions,
        currentPage: data.currentPage,
        totalPages: data.totalPages,
        itemsPerPage: data.itemsPerPage,
      }
    }

    return rejectWithValue({
      message: "Invalid response from server",
    })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    console.error("Error performing search", error)
    return rejectWithValue({
      message: error instanceof Error ? error.message : "Failed to perform search",
    })
  }
})

const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    setQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload
      state.currentPage = 1 // Reset to first page on query change
    },
    setDriverName: (state, action: PayloadAction<string>) => {
      state.driverName = action.payload
      state.currentPage = 1
    },
    setSessionType: (state, action: PayloadAction<SessionType | null>) => {
      state.sessionType = action.payload
      state.currentPage = 1
    },
    setDateRange: (
      state,
      action: PayloadAction<{ startDate: string | null; endDate: string | null }>
    ) => {
      state.startDate = action.payload.startDate
      state.endDate = action.payload.endDate
      state.currentPage = 1
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload
    },
    setItemsPerPage: (state, action: PayloadAction<number>) => {
      state.itemsPerPage = action.payload
      state.currentPage = 1
    },
    clearSearch: (state) => {
      state.query = ""
      state.driverName = ""
      state.sessionType = null
      state.startDate = null
      state.endDate = null
      state.events = []
      state.sessions = []
      state.totalEvents = 0
      state.totalSessions = 0
      state.currentPage = 1
      state.totalPages = 0
      state.error = null
      state.hasSearched = false
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(performSearch.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(performSearch.fulfilled, (state, action) => {
        state.isLoading = false
        state.events = action.payload.events
        state.sessions = action.payload.sessions
        state.totalEvents = action.payload.totalEvents
        state.totalSessions = action.payload.totalSessions
        state.currentPage = action.payload.currentPage
        state.totalPages = action.payload.totalPages
        state.itemsPerPage = action.payload.itemsPerPage
        state.error = null
        state.hasSearched = true
      })
      .addCase(performSearch.rejected, (state, action) => {
        if (action.error.name === "AbortError") {
          state.isLoading = false
          return
        }
        state.isLoading = false
        state.error = action.payload?.message || action.error.message || "Failed to perform search"
      })
  },
})

export const {
  setQuery,
  setDriverName,
  setSessionType,
  setDateRange,
  setPage,
  setItemsPerPage,
  clearSearch,
} = searchSlice.actions

export default searchSlice.reducer
