import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit"
import type { EventAnalysisSummary, ImportedEventSummary } from "@root-types/dashboard"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

// API response type with ISO string dates (as returned from API)
type EventAnalysisDataApiResponse = Omit<EventAnalysisData, "event" | "races" | "summary" | "raceClasses"> & {
  event: {
    id: string
    eventName: string
    eventDate: string // ISO string
    trackName: string
  }
  races: Array<{
    id: string
    raceId: string
    className: string
    raceLabel: string
    raceOrder: number | null
    startTime: string | null // ISO string
    durationSeconds: number | null
    results: Array<{
      raceResultId: string
      raceDriverId: string
      driverId: string
      driverName: string
      positionFinal: number
      lapsCompleted: number
      totalTimeSeconds: number | null
      fastLapTime: number | null
      avgLapTime: number | null
      consistency: number | null
      // laps array removed - not used by any components
    }>
  }>
  raceClasses: Record<string, { vehicleType: string | null; vehicleTypeNeedsReview: boolean }>
  summary: {
    totalRaces: number
    totalDrivers: number
    totalLaps: number
    dateRange: {
      earliest: string | null // ISO string
      latest: string | null // ISO string
    }
  }
}

interface DashboardState {
  selectedEventId: string | null
  eventData: EventAnalysisSummary | null
  isEventLoading: boolean
  eventError: string | null
  recentEvents: ImportedEventSummary[]
  isRecentLoading: boolean
  analysisData: EventAnalysisDataApiResponse | null
  isAnalysisLoading: boolean
  analysisError: string | null
  currentFetchRequestId: string | null // Track current fetch to ignore stale responses
}

interface FetchEventError {
  message: string
  code?: "NOT_FOUND" | "UNKNOWN"
}

const initialState: DashboardState = {
  selectedEventId: null,
  eventData: null,
  isEventLoading: false,
  eventError: null,
  recentEvents: [],
  isRecentLoading: false,
  analysisData: null,
  isAnalysisLoading: false,
  analysisError: null,
  currentFetchRequestId: null,
}

// Async thunk for fetching event data
export const fetchEventData = createAsyncThunk<
  EventAnalysisSummary,
  string,
  { rejectValue: FetchEventError }
>("dashboard/fetchEventData", async (eventId: string, { rejectWithValue, signal }) => {
  try {
    const response = await fetch(`/api/v1/events/${eventId}/summary`, {
      cache: "no-store",
      signal,
    })

    // Check if request was aborted before processing
    if (signal?.aborted) {
      throw new Error("Request aborted")
    }

    if (!response.ok) {
      if (response.status === 404) {
        return rejectWithValue({ message: "Event not found", code: "NOT_FOUND" })
      }
      return rejectWithValue({ message: "Failed to load event data", code: "UNKNOWN" })
    }

    const result = await response.json()

    // Check again if request was aborted before processing result
    if (signal?.aborted) {
      throw new Error("Request aborted")
    }

    if (result.success && result.data) {
      return result.data
    }

    return rejectWithValue({ message: "Invalid response from server", code: "UNKNOWN" })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      // Request was aborted, don't set error
      throw error
    }
    console.error("Error fetching event summary", error)
    return rejectWithValue({ message: "Failed to fetch event data", code: "UNKNOWN" })
  }
})

// Async thunk for fetching recent events
export const fetchRecentEvents = createAsyncThunk<
  ImportedEventSummary[],
  "all" | "my" | undefined,
  { rejectValue: string }
>("dashboard/fetchRecentEvents", async (eventScope = "all", { rejectWithValue, signal }) => {
  try {
    const params = new URLSearchParams({ limit: "8" })
    if (eventScope === "my") {
      params.append("filter", "my")
    }

    const response = await fetch(`/api/v1/events?${params.toString()}`, {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = "Failed to load recent events"
      try {
        const errorData = await response.json()
        if (errorData.error?.message) {
          errorMessage = errorData.error.message
        }
      } catch {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage
      }
      return rejectWithValue(errorMessage)
    }

    const json = await response.json()
    if (json.success && Array.isArray(json.data?.events)) {
      return json.data.events
    } else {
      return rejectWithValue("Invalid response from server")
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error
    }
    console.error("Error fetching recent events", error)
    return rejectWithValue("Failed to fetch recent events")
  }
})

// Async thunk for fetching full event analysis data
export const fetchEventAnalysisData = createAsyncThunk<
  EventAnalysisDataApiResponse,
  string,
  { rejectValue: FetchEventError }
>("dashboard/fetchEventAnalysisData", async (eventId: string, { rejectWithValue, signal }) => {
  try {
    const response = await fetch(`/api/v1/events/${eventId}/analysis`, {
      cache: "no-store",
      signal,
    })

    if (!response.ok) {
      if (response.status === 404) {
        return rejectWithValue({ message: "Event not found", code: "NOT_FOUND" })
      }
      // Try to get error message from response
      let errorMessage = "Failed to load event analysis data"
      try {
        const errorData = await response.json()
        if (errorData.error?.message) {
          errorMessage = errorData.error.message
        }
      } catch {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage
      }
      return rejectWithValue({ message: errorMessage, code: "UNKNOWN" })
    }

    const result = await response.json()

    if (result.success && result.data) {
      return result.data as EventAnalysisDataApiResponse
    }

    return rejectWithValue({ message: "Invalid response from server", code: "UNKNOWN" })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      // Request was aborted, don't set error
      throw error
    }
    console.error("Error fetching event analysis data", error)
    return rejectWithValue({ message: "Failed to fetch event analysis data", code: "UNKNOWN" })
  }
})

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    selectEvent: (state, action: PayloadAction<string | null>) => {
      const prevSelected = state.selectedEventId
      const nextSelected = action.payload

      state.selectedEventId = nextSelected

      if (nextSelected !== prevSelected) {
        state.eventData = null
        state.eventError = null
        state.analysisData = null
        state.analysisError = null
      }

      if (!nextSelected) {
        // Clear all event-related state when deselecting
        state.eventData = null
        state.eventError = null
        state.analysisData = null
        state.analysisError = null
        state.isEventLoading = false
        state.isAnalysisLoading = false
        state.currentFetchRequestId = null
      } else if (nextSelected !== prevSelected) {
        // Only set isEventLoading - isAnalysisLoading will be set when fetchEventAnalysisData actually starts
        state.isEventLoading = true
        state.currentFetchRequestId = null
      }
    },
    clearEvent: (state) => {
      state.selectedEventId = null
      state.eventData = null
      state.eventError = null
      state.isEventLoading = false
      state.analysisData = null
      state.analysisError = null
      state.isAnalysisLoading = false
      state.currentFetchRequestId = null
    },
  },
  extraReducers: (builder) => {
    // Fetch event data
    builder
      .addCase(fetchEventData.pending, (state, action) => {
        state.isEventLoading = true
        state.eventError = null
        // Track the requestId to ignore stale responses
        state.currentFetchRequestId = action.meta.requestId
      })
      .addCase(fetchEventData.fulfilled, (state, action) => {
        // Only update state if this is the most recent request
        if (state.currentFetchRequestId === action.meta.requestId) {
          state.isEventLoading = false
          state.eventData = action.payload
          state.eventError = null
          state.currentFetchRequestId = null
        }
      })
      .addCase(fetchEventData.rejected, (state, action) => {
        // Don't set error if request was aborted (normal behavior on navigation/reload)
        if (action.error.name === "AbortError") {
          // Only clear loading if this was the current request
          if (state.currentFetchRequestId === action.meta.requestId) {
            state.isEventLoading = false
            state.currentFetchRequestId = null
          }
          return
        }
        
        // Only update state if this is the most recent request
        if (state.currentFetchRequestId === action.meta.requestId) {
          state.isEventLoading = false
          state.eventError =
            action.payload?.message || action.error.message || "Failed to fetch event data"
          state.currentFetchRequestId = null

          if (action.payload?.code === "NOT_FOUND") {
            state.selectedEventId = null
            state.eventData = null
          }
        }
      })

    // Fetch recent events
    builder
      .addCase(fetchRecentEvents.pending, (state) => {
        state.isRecentLoading = true
      })
      .addCase(fetchRecentEvents.fulfilled, (state, action) => {
        state.isRecentLoading = false
        state.recentEvents = action.payload
      })
      .addCase(fetchRecentEvents.rejected, (state, action) => {
        state.isRecentLoading = false
        // Keep existing recentEvents on error
        console.error("Failed to fetch recent events:", action.payload)
      })

    // Fetch event analysis data
    builder
      .addCase(fetchEventAnalysisData.pending, (state) => {
        state.isAnalysisLoading = true
        state.analysisError = null
      })
      .addCase(fetchEventAnalysisData.fulfilled, (state, action) => {
        state.isAnalysisLoading = false
        state.analysisData = action.payload
        state.analysisError = null
      })
      .addCase(fetchEventAnalysisData.rejected, (state, action) => {
        // Don't set error if request was aborted (normal behavior on navigation/reload)
        if (action.error.name === "AbortError") {
          state.isAnalysisLoading = false
          return
        }
        
        state.isAnalysisLoading = false
        state.analysisError =
          action.payload?.message || action.error.message || "Failed to fetch event analysis data"

        if (action.payload?.code === "NOT_FOUND") {
          state.selectedEventId = null
          state.analysisData = null
        }
      })
  },
})

export const { selectEvent, clearEvent } = dashboardSlice.actions
export default dashboardSlice.reducer
