import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import type { DensityPreference } from "@root-types/dashboard"

interface UiState {
  density: DensityPreference
  isNavCollapsed: boolean
  isCommandPaletteOpen: boolean
  /** Slide-over nav open (viewports below `lg` where the rail is not persistently visible). */
  isMobileNavOpen: boolean
}

const initialState: UiState = {
  density: "comfortable",
  isNavCollapsed: false,
  isCommandPaletteOpen: false,
  isMobileNavOpen: false,
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
    openMobileNav: (state) => {
      state.isMobileNavOpen = true
    },
    closeMobileNav: (state) => {
      state.isMobileNavOpen = false
    },
    toggleMobileNav: (state) => {
      state.isMobileNavOpen = !state.isMobileNavOpen
    },
  },
})

export const {
  setDensity,
  setNavCollapsed,
  toggleNavCollapsed,
  openCommandPalette,
  closeCommandPalette,
  openMobileNav,
  closeMobileNav,
  toggleMobileNav,
} = uiSlice.actions
export default uiSlice.reducer
