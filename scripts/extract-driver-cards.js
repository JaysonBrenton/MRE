const fs = require("fs")
const src = fs.readFileSync("src/components/organisms/dashboard/DashboardClient.tsx", "utf8")
const lines = src.split("\n")

const weatherData = lines.slice(20, 31).join("\n")
const grid = lines.slice(293, 1553).join("\n")
const driverCard = lines.slice(1553, 1630).join("\n")
const weatherStat = lines.slice(1874, 1884).join("\n")
const weatherPanel = lines.slice(1786, 1874).join("\n")
const weatherLoadingState = lines.slice(2125, 2149).join("\n")
const weatherErrorState = lines.slice(2149, 2190).join("\n")

const header = `"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import {
  formatDateLong,
  formatLapTime,
  formatPositionImprovement,
  formatLapTimeImprovement,
} from "@/lib/date-utils"
import type { EventAnalysisSummary } from "@root-types/dashboard"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import ImprovementDriverCard from "./ImprovementDriverCard"

`

fs.writeFileSync(
  "src/components/organisms/dashboard/DriverCardsAndWeatherGrid.tsx",
  header +
    weatherData +
    "\n\n" +
    grid +
    "\n\n" +
    driverCard +
    "\n\n" +
    weatherStat +
    "\n\n" +
    weatherPanel +
    "\n\n" +
    weatherLoadingState +
    "\n\n" +
    weatherErrorState
)
console.log("Wrote DriverCardsAndWeatherGrid.tsx")
