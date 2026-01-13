"use client"

import { configureStore, combineReducers } from "@reduxjs/toolkit"
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist"
import storage from "redux-persist/lib/storage"
import dashboardReducer from "./slices/dashboardSlice"
import uiReducer from "./slices/uiSlice"
import searchReducer from "./slices/searchSlice"

// Create a noop storage for SSR (server-side rendering)
const createNoopStorage = () => {
  return {
    getItem(_key: string) {
      return Promise.resolve(null)
    },
    setItem(_key: string, value: string) {
      return Promise.resolve(value)
    },
    removeItem(_key: string) {
      return Promise.resolve()
    },
  }
}

// Create sessionStorage adapter
const createSessionStorage = () => {
  if (typeof window === "undefined") {
    return createNoopStorage()
  }
  return {
    getItem(key: string): Promise<string | null> {
      return Promise.resolve(sessionStorage.getItem(key))
    },
    setItem(key: string, value: string): Promise<void> {
      sessionStorage.setItem(key, value)
      return Promise.resolve()
    },
    removeItem(key: string): Promise<void> {
      sessionStorage.removeItem(key)
      return Promise.resolve()
    },
  }
}

// Use localStorage for client, noop for SSR
const storageAdapter = typeof window !== "undefined" ? storage : createNoopStorage()
const sessionStorageAdapter = createSessionStorage()

// Configure persistence for UI slice (localStorage)
const uiPersistConfig = {
  key: "ui",
  storage: storageAdapter,
  whitelist: ["density", "isNavCollapsed"],
}

// Configure persistence for dashboard slice (sessionStorage)
// Only persist selectedEventId, not the full eventData to avoid quota limits
const dashboardPersistConfig = {
  key: "dashboard",
  storage: sessionStorageAdapter,
  whitelist: ["selectedEventId"],
}

// Create persisted reducers
const persistedUiReducer = persistReducer(uiPersistConfig, uiReducer)
const persistedDashboardReducer = persistReducer(dashboardPersistConfig, dashboardReducer)

// Configure persistence for search slice (sessionStorage)
const searchPersistConfig = {
  key: "search",
  storage: sessionStorageAdapter,
  whitelist: ["query", "driverName", "sessionType", "startDate", "endDate", "currentPage", "itemsPerPage"],
}

// Create persisted reducers
const persistedSearchReducer = persistReducer(searchPersistConfig, searchReducer)

// Combine reducers
const rootReducer = combineReducers({
  ui: persistedUiReducer,
  dashboard: persistedDashboardReducer,
  search: persistedSearchReducer,
})

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
  devTools: process.env.NODE_ENV !== "production",
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
