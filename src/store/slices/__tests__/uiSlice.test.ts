import { describe, expect, it } from "vitest"
import reducer, {
  closeCommandPalette,
  closeMobileNav,
  openCommandPalette,
  openMobileNav,
  setDensity,
  setNavCollapsed,
  toggleMobileNav,
  toggleNavCollapsed,
} from "@/store/slices/uiSlice"

const createState = () => reducer(undefined, { type: "@@INIT" })

describe("uiSlice reducers", () => {
  it("updates density preference", () => {
    const next = reducer(createState(), setDensity("compact"))
    expect(next.density).toBe("compact")
  })

  it("toggles nav collapsed state", () => {
    const collapsed = reducer(createState(), toggleNavCollapsed())
    expect(collapsed.isNavCollapsed).toBe(true)

    const expanded = reducer(collapsed, setNavCollapsed(false))
    expect(expanded.isNavCollapsed).toBe(false)
  })

  it("controls command palette visibility", () => {
    const openState = reducer(createState(), openCommandPalette())
    expect(openState.isCommandPaletteOpen).toBe(true)

    const closedState = reducer(openState, closeCommandPalette())
    expect(closedState.isCommandPaletteOpen).toBe(false)
  })

  it("controls mobile navigation drawer visibility", () => {
    const openState = reducer(createState(), openMobileNav())
    expect(openState.isMobileNavOpen).toBe(true)

    const closedState = reducer(openState, closeMobileNav())
    expect(closedState.isMobileNavOpen).toBe(false)

    const toggled = reducer(closedState, toggleMobileNav())
    expect(toggled.isMobileNavOpen).toBe(true)
  })
})
