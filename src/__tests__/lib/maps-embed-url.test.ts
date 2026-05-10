import { describe, it, expect } from "vitest"
import {
  buildGoogleMapsClassicVenueEmbedSrc,
  buildGoogleMapsPlaceEmbedSrc,
} from "@/lib/maps-embed-url"

describe("maps-embed-url", () => {
  describe("buildGoogleMapsClassicVenueEmbedSrc", () => {
    it("builds public output=embed URL with encoded query", () => {
      const url = buildGoogleMapsClassicVenueEmbedSrc("3011 Maingate Lane, Kissimmee, FL")
      expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\?/)
      const u = new URL(url)
      expect(u.pathname).toBe("/maps")
      expect(u.searchParams.get("q")).toBe("3011 Maingate Lane, Kissimmee, FL")
      expect(u.searchParams.get("output")).toBe("embed")
      expect(u.searchParams.get("z")).toBe("15")
    })

    it("clamps z to 1–22", () => {
      const low = buildGoogleMapsClassicVenueEmbedSrc("X", 0)
      expect(new URL(low).searchParams.get("z")).toBe("1")
      const high = buildGoogleMapsClassicVenueEmbedSrc("Y", 999)
      expect(new URL(high).searchParams.get("z")).toBe("22")
    })

    it("throws on empty query", () => {
      expect(() => buildGoogleMapsClassicVenueEmbedSrc("  ")).toThrow()
    })
  })

  describe("buildGoogleMapsPlaceEmbedSrc (Embed API v1)", () => {
    it("builds Embed v1 place URL with encoded query", () => {
      const url = buildGoogleMapsPlaceEmbedSrc({
        apiKey: "test-key",
        query: "3011 Maingate Lane, Kissimmee, FL",
      })
      expect(url).toContain("https://www.google.com/maps/embed/v1/place")
      expect(url).toContain("key=test-key")
      expect(url).toContain("zoom=15")
      const u = new URL(url)
      expect(u.searchParams.get("q")).toBe("3011 Maingate Lane, Kissimmee, FL")
    })

    it("clamps zoom to 0–22", () => {
      const low = buildGoogleMapsPlaceEmbedSrc({ apiKey: "k", query: "X", zoom: -5 })
      expect(low).toContain("zoom=0")
      const high = buildGoogleMapsPlaceEmbedSrc({ apiKey: "k", query: "Y", zoom: 999 })
      expect(high).toContain("zoom=22")
    })

    it("throws on empty inputs", () => {
      expect(() => buildGoogleMapsPlaceEmbedSrc({ apiKey: "", query: "A" })).toThrow()
      expect(() => buildGoogleMapsPlaceEmbedSrc({ apiKey: "k", query: "  " })).toThrow()
    })
  })
})
