/**
 * @fileoverview Tests for venue address display normalisation
 */

import { describe, it, expect } from "vitest"
import {
  applyAustraliaPostcodeTypoFix,
  formatTrackAddress,
  isSegmentAlreadyInAddress,
  normalizeAddressForDisplay,
  normalizePostalCodeField,
} from "@/lib/address-normalization"

describe("address-normalization", () => {
  describe("applyAustraliaPostcodeTypoFix", () => {
    it("strips a spurious leading 0 from a five-digit token when Australia is mentioned", () => {
      const s = "Canberra Off Road Model Car Club, Kyeema Street, Narrabundah 02604, Australia"
      expect(applyAustraliaPostcodeTypoFix(s)).toBe(
        "Canberra Off Road Model Car Club, Kyeema Street, Narrabundah 2604, Australia"
      )
    })

    it("does not change US-style leading-zero zips without an Australia hint", () => {
      const s = "123 Main St, Boston 02108, United States"
      expect(applyAustraliaPostcodeTypoFix(s)).toBe(s)
    })

    it("applies the fix when assumeAustralia is set", () => {
      expect(applyAustraliaPostcodeTypoFix("Narrabundah 02604", { assumeAustralia: true })).toBe(
        "Narrabundah 2604"
      )
    })
  })

  describe("normalizePostalCodeField", () => {
    it("normalises 02604 to 2604 when country is Australia", () => {
      expect(normalizePostalCodeField("02604", "Australia")).toBe("2604")
    })

    it("leaves five-digit 0-prefix codes when country is not Australia", () => {
      expect(normalizePostalCodeField("02108", "United States")).toBe("02108")
    })
  })

  describe("formatTrackAddress", () => {
    it("does not duplicate city and postcode already present in free-text address", () => {
      const out = formatTrackAddress({
        address: "Canberra Off Road Model Car Club, Kyeema Street, Narrabundah 02604, Australia",
        city: "Narrabundah",
        postalCode: "02604",
        country: "Australia",
      })
      expect(out).toBe(
        "Canberra Off Road Model Car Club, Kyeema Street, Narrabundah 2604, Australia"
      )
    })

    it("joins structured fields when address is empty", () => {
      expect(
        formatTrackAddress({
          city: "Brisbane",
          state: "QLD",
          postalCode: "4000",
          country: "Australia",
        })
      ).toBe("Brisbane, QLD, 4000, Australia")
    })
  })

  describe("isSegmentAlreadyInAddress", () => {
    it("detects whole-word presence", () => {
      expect(isSegmentAlreadyInAddress("Club, Narrabundah 2604, Australia", "Narrabundah")).toBe(
        true
      )
      expect(isSegmentAlreadyInAddress("Club, Narrabundah 2604, Australia", "2604")).toBe(true)
    })
  })

  describe("normalizeAddressForDisplay", () => {
    it("removes placeholder segments and emails", () => {
      expect(normalizeAddressForDisplay("Track, n/a, admin@example.com, Sydney")).toBe(
        "Track, Sydney"
      )
    })

    it("dedupes exact comma-separated segments", () => {
      expect(normalizeAddressForDisplay("Venue, Venue, City")).toBe("Venue, City")
    })
  })
})
