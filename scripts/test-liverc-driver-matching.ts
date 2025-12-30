/**
 * @fileoverview Test script for LiveRC driver matching
 * 
 * Tests the fuzzy matching logic used for LiveRC event filtering
 */

import { normalizeDriverName } from "../src/core/users/name-normalizer"
import { fuzzyMatchUserToDriver, SUGGEST_MIN } from "../src/core/users/driver-matcher"

// Test cases based on "Jayson Brenton"
const testCases = [
  {
    user: "Jayson Brenton",
    driver: "Jayson Brenton",
    shouldMatch: true,
    expectedType: "exact" as const,
  },
  {
    user: "Jayson Brenton",
    driver: "jayson brenton",
    shouldMatch: true,
    expectedType: "exact" as const,
  },
  {
    user: "Jayson Brenton",
    driver: "JAYSON BRENTON",
    shouldMatch: true,
    expectedType: "exact" as const,
  },
  {
    user: "Jayson Brenton",
    driver: "Jayson  Brenton", // Extra space
    shouldMatch: true,
    expectedType: "exact" as const,
  },
  {
    user: "Jayson Brenton",
    driver: "Jay Brenton",
    shouldMatch: true,
    expectedType: "fuzzy" as const,
  },
  {
    user: "Jayson Brenton",
    driver: "Jayson B.",
    shouldMatch: false, // Too different
  },
  {
    user: "Jayson Brenton",
    driver: "Jason Brenton", // Common misspelling
    shouldMatch: true,
    expectedType: "fuzzy" as const,
  },
  {
    user: "Jayson Brenton",
    driver: "Jayson Brenton Jr.",
    shouldMatch: true,
    expectedType: "fuzzy" as const,
  },
]

console.log("Testing LiveRC driver matching logic (name-based only, no transponder)\n")
console.log("=" .repeat(80))

let passed = 0
let failed = 0

for (const testCase of testCases) {
  const userNormalized = normalizeDriverName(testCase.user)
  const driverNormalized = normalizeDriverName(testCase.driver)
  
  const match = fuzzyMatchUserToDriver(
    {
      id: "test-user-id",
      driverName: testCase.user,
      normalizedName: userNormalized,
      transponderNumber: null,
    },
    {
      id: "test-driver-id",
      displayName: testCase.driver,
      normalizedName: driverNormalized,
      transponderNumber: null,
    },
    true // Skip transponder matching (LiveRC mode)
  )

  const matched = match !== null && (
    match.matchType === "exact" ||
    (match.matchType === "fuzzy" && match.similarityScore >= SUGGEST_MIN)
  )

  const testPassed = matched === testCase.shouldMatch && 
    (!testCase.shouldMatch || match?.matchType === testCase.expectedType)

  if (testPassed) {
    passed++
    console.log(`✓ PASS: "${testCase.user}" vs "${testCase.driver}"`)
    if (match) {
      console.log(`  Match: ${match.matchType} (similarity: ${match.similarityScore.toFixed(3)})`)
      console.log(`  Normalized: "${userNormalized}" vs "${driverNormalized}"`)
    } else {
      console.log(`  No match (as expected)`)
    }
  } else {
    failed++
    console.log(`✗ FAIL: "${testCase.user}" vs "${testCase.driver}"`)
    console.log(`  Expected: ${testCase.shouldMatch ? `match (${testCase.expectedType})` : "no match"}`)
    console.log(`  Got: ${match ? `${match.matchType} (similarity: ${match.similarityScore.toFixed(3)})` : "no match"}`)
    console.log(`  Normalized: "${userNormalized}" vs "${driverNormalized}"`)
  }
  console.log()
}

console.log("=" .repeat(80))
console.log(`Results: ${passed} passed, ${failed} failed`)

if (failed > 0) {
  console.error("\nSome tests failed!")
  process.exit(1)
} else {
  console.log("\nAll tests passed!")
  process.exit(0)
}

