import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import type { DensityPreference } from "@root-types/dashboard"

interface UiState {
  density: DensityPreference
  isNavCollapsed: boolean
  isCommandPaletteOpen: boolean
}

const initialState: UiState = {
  density: "comfortable",
  isNavCollapsed: false,
  isCommandPaletteOpen: false,
}

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setDensity: (state, action: PayloadAction<DensityPreference>) => {
      state.density = action.payload
    },
    setNavCollapsed: (state, action: PayloadAction<boolean>) => {
      state.isNavCollapsed = action.payload
    },
    toggleNavCollapsed: (state) => {
      state.isNavCollapsed = !state.isNavCollapsed
    },
    openCommandPalette: (state) => {
      state.isCommandPaletteOpen = true
    },
    closeCommandPalette: (state) => {
      state.isCommandPaletteOpen = false
    },
  },
})

export const {
  setDensity,
  setNavCollapsed,
  toggleNavCollapsed,
  openCommandPalette,
  closeCommandPalette,
} = uiSlice.actions
export default uiSlice.reducer
