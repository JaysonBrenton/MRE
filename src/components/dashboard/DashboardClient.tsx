"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { fetchEventData, fetchRecentEvents } from "@/store/slices/dashboardSlice"
import { formatDateLong, formatLapTime } from "@/lib/date-utils"
import type { EventAnalysisSummary, ImportedEventSummary } from "@root-types/dashboard"
import ImprovementDriverCard from "./ImprovementDriverCard"
// EventAnalysisClient removed - dashboard now uses summary endpoint only
// Full analysis data is only loaded on /events/analyse/[eventId] page
// import EventAnalysisClient from "@/app/(authenticated)/events/analyse/[eventId]/EventAnalysisClient"
// import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

interface WeatherData {
  condition: string
  wind: string
  humidity: number
  air: number
  track: number
  precip: number
  forecast: Array<{ label: string; detail: string }>
  cachedAt?: string
  isCached?: boolean
}

interface KpiDatum {
  id: string
  label: string
  value: string
  helper: string
  trendLabel: string
  trendDelta: number
  trendValueDisplay: string
  sparkline: number[]
}

interface AlertItem {
  id: string
  label: string
  severity: "green" | "amber" | "red"
  timestamp: string
  detail: string
}

interface ActivityItem {
  id: string
  title: string
  detail: string
  timestamp: string
  type: "engineer" | "system"
}

export default function DashboardClient() {
  const dispatch = useAppDispatch()
  const selectedEventId = useAppSelector((state) => state.dashboard.selectedEventId)
  const eventData = useAppSelector((state) => state.dashboard.eventData)
  const isEventLoading = useAppSelector((state) => state.dashboard.isEventLoading)
  const eventError = useAppSelector((state) => state.dashboard.eventError)
  const recentEvents = useAppSelector((state) => state.dashboard.recentEvents)

  // Extract event data fields
  const selectedEvent = eventData?.event ?? null
  const eventSummary = eventData?.summary ?? null
  const topDrivers = eventData?.topDrivers
  const mostConsistentDrivers = eventData?.mostConsistentDrivers
  const bestAvgLapDrivers = eventData?.bestAvgLapDrivers
  const mostImprovedDrivers = eventData?.mostImprovedDrivers
  const userBestLap = eventData?.userBestLap
  const userBestConsistency = eventData?.userBestConsistency
  const userBestAvgLap = eventData?.userBestAvgLap

  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  // analysisData removed - dashboard now uses summary data from Redux store only
  // Full analysis data is only loaded on /events/analyse/[eventId] page

  // Fetch recent events on mount
  useEffect(() => {
    dispatch(fetchRecentEvents("all"))
  }, [dispatch])

  // Fetch event data when selectedEventId changes
  useEffect(() => {
    if (!selectedEventId) {
      return
    }

    const promise = dispatch(fetchEventData(selectedEventId))

    return () => {
      promise.abort()
    }
  }, [dispatch, selectedEventId])

  // Reset weather state when event is deselected
  useEffect(() => {
    if (!selectedEvent?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWeather(null)

      setWeatherError(null)
    }
  }, [selectedEvent?.id])

  // Fetch weather data when event is selected
  useEffect(() => {
    if (!selectedEvent?.id) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWeatherLoading(true)

    setWeatherError(null)

    fetch(`/api/v1/events/${selectedEvent.id}/weather`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 404) {
            setWeatherError("Event not found")
            return
          }
          const errorData = await response.json().catch(() => ({}))
          setWeatherError(errorData.error?.message || "Failed to load weather data")
          return
        }

        const result = await response.json()
        if (result.success && result.data) {
          setWeather(result.data)
        } else {
          setWeatherError("Invalid response from server")
        }
      })
      .catch((error) => {
        console.error("Error fetching weather data", error)
        setWeatherError("Failed to fetch weather data")
      })
      .finally(() => {
        setWeatherLoading(false)
      })
  }, [selectedEvent?.id])

  // Full analysis data fetching removed - dashboard now uses summary endpoint only
  // Summary data is provided by Redux store (fetches from /api/v1/events/[eventId]/summary)
  // Full analysis data is only loaded on /events/analyse/[eventId] page

  if (isEventLoading) {
    return <DashboardLoadingState />
  }

  if (eventError && !selectedEvent) {
    return <DashboardEmptyState recentEvents={recentEvents} message={eventError} />
  }

  if (!selectedEvent) {
    return <DashboardEmptyState recentEvents={recentEvents} />
  }

  return (
    <div className="flex flex-col gap-[var(--dashboard-gap)]">
      <DashboardHero
        event={selectedEvent}
        summary={eventSummary}
        topDrivers={topDrivers}
        mostConsistentDrivers={mostConsistentDrivers}
        bestAvgLapDrivers={bestAvgLapDrivers}
        mostImprovedDrivers={mostImprovedDrivers}
        userBestLap={userBestLap}
        userBestConsistency={userBestConsistency}
        userBestAvgLap={userBestAvgLap}
        weather={weather}
        weatherLoading={weatherLoading}
        weatherError={weatherError}
      />

      {/* Event Analysis Features removed from dashboard
          Full analysis is only available on /events/analyse/[eventId] page
          Dashboard uses summary data from Redux store for performance */}
    </div>
  )
}

function DashboardLoadingState() {
  return (
    <div className="grid animate-pulse grid-cols-12 gap-4 lg:gap-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="col-span-12 rounded-2xl border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/60 p-6 sm:col-span-6 xl:col-span-4"
        />
      ))}
    </div>
  )
}

function DashboardEmptyState({
  recentEvents,
  message,
}: {
  recentEvents: ImportedEventSummary[]
  message?: string
}) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 p-10 text-center">
      <p className="text-sm uppercase tracking-[0.5em] text-[var(--token-text-muted)]">
        No event selected
      </p>
      <h2 className="mt-4 text-2xl font-semibold text-[var(--token-text-primary)]">
        {message ?? "Choose a race to unlock telemetry"}
      </h2>
      <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
        Use the event selector above to load telemetry, KPIs, and weather for your mission control
        view.
      </p>
      {recentEvents.length > 0 && (
        <div className="mt-8 space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
            Recent circuits
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {recentEvents.slice(0, 4).map((event) => (
              <div
                key={event.id}
                className="rounded-full border border-[var(--token-border-default)] px-4 py-2 text-xs font-semibold text-[var(--token-text-secondary)]"
              >
                {event.track.trackName}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DashboardHero({
  event,
  summary,
  topDrivers,
  mostConsistentDrivers,
  bestAvgLapDrivers,
  mostImprovedDrivers,
  userBestLap,
  userBestConsistency,
  userBestAvgLap,
  weather,
  weatherLoading,
  weatherError,
}: {
  event: EventAnalysisSummary["event"]
  summary: EventAnalysisSummary["summary"] | null
  topDrivers?: EventAnalysisSummary["topDrivers"]
  mostConsistentDrivers?: EventAnalysisSummary["mostConsistentDrivers"]
  bestAvgLapDrivers?: EventAnalysisSummary["bestAvgLapDrivers"]
  mostImprovedDrivers?: EventAnalysisSummary["mostImprovedDrivers"]
  userBestLap?: EventAnalysisSummary["userBestLap"]
  userBestConsistency?: EventAnalysisSummary["userBestConsistency"]
  userBestAvgLap?: EventAnalysisSummary["userBestAvgLap"]
  weather: WeatherData | null
  weatherLoading: boolean
  weatherError: string | null
}) {
  const eventDate = event?.eventDate ? new Date(event.eventDate) : null
  const [currentSection, setCurrentSection] = useState(0)
  const [currentClassIndex, setCurrentClassIndex] = useState<number>(0)
  const carouselRef = useRef<HTMLDivElement>(null)
  const sectionRef0 = useRef<HTMLDivElement>(null)
  const sectionRef1 = useRef<HTMLDivElement>(null)
  const sectionRef2 = useRef<HTMLDivElement>(null)
  const sectionRef3 = useRef<HTMLDivElement>(null)

  const sectionRefs = useMemo(() => [sectionRef0, sectionRef1, sectionRef2, sectionRef3], [])
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isUserInteractingRef = useRef(false)
  const currentSectionRef = useRef(0)
  const previousSectionRef = useRef<number>(0)
  const isProgrammaticScrollRef = useRef(false)
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const programmaticScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const sections = [
    { title: "Fastest Laps", data: topDrivers, type: "fastest" as const },
    { title: "Most Consistent Drivers", data: mostConsistentDrivers, type: "consistency" as const },
    { title: "Best Overall Average Lap", data: bestAvgLapDrivers, type: "avgLap" as const },
    { title: "Most Improved", data: mostImprovedDrivers, type: "improvement" as const },
  ]

  const hasData =
    topDrivers?.length ||
    mostConsistentDrivers?.length ||
    bestAvgLapDrivers?.length ||
    mostImprovedDrivers?.length

  // Get intersection of classes from all sections (only classes that appear in all four)
  const getAllClasses = (): string[] => {
    const fastestClasses = new Set(topDrivers?.map((d) => d.className) || [])
    const consistentClasses = new Set(mostConsistentDrivers?.map((d) => d.className) || [])
    const avgLapClasses = new Set(bestAvgLapDrivers?.map((d) => d.className) || [])
    const improvedClasses = new Set(mostImprovedDrivers?.map((d) => d.className) || [])

    // Intersection: classes that appear in all four
    return Array.from(fastestClasses)
      .filter((c) => consistentClasses.has(c) && avgLapClasses.has(c) && improvedClasses.has(c))
      .sort()
  }

  const allClasses = getAllClasses()

  // Group drivers by className for each section
  const groupDriversByClass = (
    drivers:
      | EventAnalysisSummary["topDrivers"]
      | EventAnalysisSummary["mostConsistentDrivers"]
      | EventAnalysisSummary["bestAvgLapDrivers"]
      | EventAnalysisSummary["mostImprovedDrivers"],
    type: "fastest" | "consistency" | "avgLap" | "improvement"
  ) => {
    if (!drivers || drivers.length === 0) return {}

    type DriverUnion =
      | NonNullable<EventAnalysisSummary["topDrivers"]>[number]
      | NonNullable<EventAnalysisSummary["mostConsistentDrivers"]>[number]
      | NonNullable<EventAnalysisSummary["bestAvgLapDrivers"]>[number]
      | NonNullable<EventAnalysisSummary["mostImprovedDrivers"]>[number]

    const grouped = drivers.reduce(
      (acc, driver) => {
        const className = driver.className
        if (!acc[className]) {
          acc[className] = []
        }
        acc[className].push(driver as DriverUnion)
        return acc
      },
      {} as Record<string, DriverUnion[]>
    )

    // Sort drivers within each class by their metric
    Object.keys(grouped).forEach((className) => {
      grouped[className].sort((a, b) => {
        if (type === "fastest" && "fastestLapTime" in a && "fastestLapTime" in b) {
          return (
            (a as { fastestLapTime: number }).fastestLapTime -
            (b as { fastestLapTime: number }).fastestLapTime
          )
        } else if (type === "consistency" && "consistency" in a && "consistency" in b) {
          return (
            (b as { consistency: number }).consistency - (a as { consistency: number }).consistency
          ) // Higher is better
        } else if (type === "avgLap" && "avgLapTime" in a && "avgLapTime" in b) {
          return (a as { avgLapTime: number }).avgLapTime - (b as { avgLapTime: number }).avgLapTime
        } else if (type === "improvement" && "improvementScore" in a && "improvementScore" in b) {
          return (
            (b as { improvementScore: number }).improvementScore -
            (a as { improvementScore: number }).improvementScore
          ) // Higher is better
        }
        return 0
      })
    })

    return grouped
  }

  // Get current class drivers for a section (using global class index)
  const getCurrentClassDrivers = (section: (typeof sections)[number]): DriverCardData[] => {
    if (!section.data || section.data.length === 0) return []

    // If no classes in intersection, show all drivers (top 3)
    if (allClasses.length === 0) {
      return section.data.slice(0, 3) as DriverCardData[]
    }

    // Ensure currentClassIndex is within bounds
    const safeClassIndex = currentClassIndex % allClasses.length
    const currentClass = allClasses[safeClassIndex]

    if (!currentClass) return []

    const grouped = groupDriversByClass(section.data, section.type)
    if (!grouped[currentClass]) return []

    // Return top 3 drivers from current class
    return grouped[currentClass].slice(0, 3) as DriverCardData[]
  }

  const scrollToSection = (index: number, isUserAction = false) => {
    if (isUserAction) {
      isUserInteractingRef.current = true
    } else {
      isProgrammaticScrollRef.current = true
      // Reset flag after scroll animation completes
      setTimeout(() => {
        isProgrammaticScrollRef.current = false
      }, 600)
    }
    const targetRef = sectionRefs[index]
    const carousel = carouselRef.current
    if (targetRef.current && carousel) {
      const sectionWidth = carousel.clientWidth
      carousel.scrollTo({
        left: index * sectionWidth,
        behavior: "smooth",
      })
      // Track previous section to detect cycle completion
      previousSectionRef.current = currentSection
      setCurrentSection(index)
      currentSectionRef.current = index
      // Class index stays the same when manually navigating
    }
  }

  const handlePrev = () => {
    if (currentSection > 0) {
      scrollToSection(currentSection - 1, true)
    }
  }

  const handleNext = () => {
    if (currentSection < sections.length - 1) {
      scrollToSection(currentSection + 1, true)
    }
  }

  // Auto-scroll functionality
  useEffect(() => {
    if (!hasData || sections.length === 0) return

    // Initialize the ref with current section
    currentSectionRef.current = currentSection

    const autoScroll = () => {
      if (isUserInteractingRef.current) {
        // Reset the flag after a delay so auto-scroll resumes
        if (userInteractionTimeoutRef.current) {
          clearTimeout(userInteractionTimeoutRef.current)
        }
        userInteractionTimeoutRef.current = setTimeout(() => {
          isUserInteractingRef.current = false
          userInteractionTimeoutRef.current = null
        }, 10000) // Resume auto-scroll 10 seconds after user interaction
        return
      }

      const carousel = carouselRef.current
      if (!carousel) return

      const currentSectionIndex = currentSectionRef.current
      const nextSection = (currentSectionIndex + 1) % sections.length
      const targetRef = sectionRefs[nextSection]

      if (targetRef.current) {
        isProgrammaticScrollRef.current = true
        const sectionWidth = carousel.clientWidth
        carousel.scrollTo({
          left: nextSection * sectionWidth,
          behavior: "smooth",
        })

        // Detect cycle completion: when going from last section (2) to first (0)
        const isCycleComplete = currentSectionIndex === sections.length - 1 && nextSection === 0

        if (isCycleComplete && allClasses.length > 0) {
          // Advance to next class when cycle completes
          setCurrentClassIndex((prev) => {
            const nextIndex = (prev + 1) % allClasses.length
            return nextIndex
          })
        }

        previousSectionRef.current = currentSectionIndex
        setCurrentSection(nextSection)
        currentSectionRef.current = nextSection

        // Reset flag after scroll animation completes
        if (programmaticScrollTimeoutRef.current) {
          clearTimeout(programmaticScrollTimeoutRef.current)
        }
        programmaticScrollTimeoutRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false
          programmaticScrollTimeoutRef.current = null
        }, 600)
      }
    }

    // Auto-scroll every 5 seconds (adjust as needed)
    autoScrollIntervalRef.current = setInterval(autoScroll, 5000)

    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current)
        autoScrollIntervalRef.current = null
      }
      if (userInteractionTimeoutRef.current) {
        clearTimeout(userInteractionTimeoutRef.current)
        userInteractionTimeoutRef.current = null
      }
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current)
        programmaticScrollTimeoutRef.current = null
      }
    }
  }, [hasData, sections.length, currentSection, allClasses.length])

  // Update current section based on scroll position
  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    const handleScroll = () => {
      // Ignore scroll events from programmatic scrolling
      if (isProgrammaticScrollRef.current) return

      const scrollLeft = carousel.scrollLeft
      const sectionWidth = carousel.clientWidth
      const newSection = Math.round(scrollLeft / sectionWidth)
      if (newSection !== currentSection && newSection >= 0 && newSection < sections.length) {
        previousSectionRef.current = currentSection
        setCurrentSection(newSection)
        currentSectionRef.current = newSection
        // If scroll happened without using buttons, treat as user interaction
        isUserInteractingRef.current = true
        if (userInteractionTimeoutRef.current) {
          clearTimeout(userInteractionTimeoutRef.current)
        }
        userInteractionTimeoutRef.current = setTimeout(() => {
          isUserInteractingRef.current = false
          userInteractionTimeoutRef.current = null
        }, 10000)
      }
    }

    carousel.addEventListener("scroll", handleScroll, { passive: true })
    return () => carousel.removeEventListener("scroll", handleScroll)
  }, [currentSection, sections.length])

  return (
    <>
      <div className="border-b border-[var(--token-border-default)] pb-4">
        <h2 className="text-xl font-semibold text-[var(--token-text-primary)]">Event Highlights</h2>
      </div>
      <section className="grid grid-cols-12 gap-4 lg:gap-6">
        <div className="col-span-12 rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] p-[var(--dashboard-card-padding)] lg:col-span-8">
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.5em] text-[var(--token-text-muted)]">
              Event
            </p>
            <h1 className="text-3xl font-bold text-[var(--token-text-primary)]">
              {event.eventName}
            </h1>
            <p className="text-sm text-[var(--token-text-secondary)]">
              {event.trackName} • {eventDate ? formatDateLong(event.eventDate) : "Date TBD"}
            </p>
          </div>

          {hasData ? (
            <>
              <div className="mb-6">
                {/* Navigation header with chevrons */}
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={handlePrev}
                    disabled={currentSection === 0}
                    className={`flex items-center justify-center w-8 h-8 rounded-full border transition ${
                      currentSection === 0
                        ? "border-[var(--token-border-muted)] text-[var(--token-text-muted)] cursor-not-allowed"
                        : "border-[var(--token-border-default)] text-[var(--token-text-secondary)] hover:border-[var(--token-border-default)] hover:text-[var(--token-text-primary)] cursor-pointer"
                    }`}
                    aria-label="Previous section"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <div className="flex-1">
                    <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--token-text-secondary)]">
                      {sections[currentSection]?.title}
                    </p>
                    {allClasses.length > 0 ? (
                      <p className="text-xs text-[var(--token-text-primary)] mt-1 font-medium">
                        {allClasses[currentClassIndex % allClasses.length]}
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--token-text-muted)] mt-1 italic">
                        No classes in common across all sections
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleNext}
                    disabled={currentSection === sections.length - 1}
                    className={`flex items-center justify-center w-8 h-8 rounded-full border transition ${
                      currentSection === sections.length - 1
                        ? "border-[var(--token-border-muted)] text-[var(--token-text-muted)] cursor-not-allowed"
                        : "border-[var(--token-border-default)] text-[var(--token-text-secondary)] hover:border-[var(--token-border-default)] hover:text-[var(--token-text-primary)] cursor-pointer"
                    }`}
                    aria-label="Next section"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                {/* Carousel container */}
                <div
                  ref={carouselRef}
                  className="overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
                  style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                >
                  <div className="flex">
                    {sections.map((section, sectionIndex) => (
                      <div
                        key={sectionIndex}
                        ref={sectionRefs[sectionIndex]}
                        className="w-full flex-shrink-0 snap-start"
                      >
                        {section.data && section.data.length > 0 ? (
                          (() => {
                            const currentClassDrivers = getCurrentClassDrivers(section)
                            if (currentClassDrivers.length === 0) {
                              return (
                                <div className="rounded-2xl border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-4 py-6 text-center">
                                  <p className="text-sm text-[var(--token-text-muted)]">
                                    No drivers available for this class
                                  </p>
                                </div>
                              )
                            }
                            // Get the original index for proper ranking display
                            let allClassDrivers: DriverCardData[]
                            if (allClasses.length === 0) {
                              // No intersection - use all drivers from section (already sorted by metric)
                              allClassDrivers = section.data.slice(0, 3) as DriverCardData[]
                            } else {
                              // Use drivers from the current class
                              const grouped = groupDriversByClass(section.data, section.type)
                              const safeClassIndex = currentClassIndex % allClasses.length
                              const currentClass = allClasses[safeClassIndex]
                              allClassDrivers = (
                                currentClass ? grouped[currentClass] || [] : []
                              ) as DriverCardData[]
                            }

                            return (
                              <div className="flex gap-6 justify-start md:justify-start">
                                {currentClassDrivers.map((driver, driverIndex) => {
                                  // Find the original index in the group for proper ranking
                                  const originalIndex = allClassDrivers.findIndex(
                                    (d) => d.driverId === driver.driverId
                                  )
                                  return (
                                    <div
                                      key={driver.driverId}
                                      className="flex-shrink-0 w-full md:w-auto md:flex-1 max-w-[220px]"
                                    >
                                      {section.type === "improvement" &&
                                      "improvementScore" in driver ? (
                                        <ImprovementDriverCard
                                          driver={
                                            driver as NonNullable<
                                              EventAnalysisSummary["mostImprovedDrivers"]
                                            >[number]
                                          }
                                          index={originalIndex >= 0 ? originalIndex : driverIndex}
                                        />
                                      ) : (
                                        <DriverCard
                                          driver={driver}
                                          index={originalIndex >= 0 ? originalIndex : driverIndex}
                                          type={section.type}
                                          sectionData={allClassDrivers as typeof section.data}
                                        />
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })()
                        ) : (
                          <div className="rounded-2xl border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-4 py-6 text-center">
                            <p className="text-sm text-[var(--token-text-muted)]">
                              No data available for {section.title.toLowerCase()}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {(() => {
                // Determine which user metric to display based on current section
                let userMetric: {
                  label: string
                  value: string
                  position: number
                  gapLabel: string
                  gapValue: string
                } | null = null

                if (currentSection === 0 && userBestLap) {
                  // Top Performers section - show fastest lap
                  userMetric = {
                    label: "Your Best Lap",
                    value: formatLapTime(userBestLap.lapTime),
                    position: userBestLap.position,
                    gapLabel: "Gap to fastest",
                    gapValue: `+${formatLapTime(userBestLap.gapToFastest)}`,
                  }
                } else if (currentSection === 1 && userBestConsistency) {
                  // Most Consistent Drivers section - show consistency
                  userMetric = {
                    label: "Your Consistency",
                    value: `${userBestConsistency.consistency.toFixed(1)}%`,
                    position: userBestConsistency.position,
                    gapLabel: "Gap to best",
                    gapValue: `-${userBestConsistency.gapToBest.toFixed(1)}%`,
                  }
                } else if (currentSection === 2 && userBestAvgLap) {
                  // Best Overall Average Lap section - show average lap
                  userMetric = {
                    label: "Your Average Lap",
                    value: formatLapTime(userBestAvgLap.avgLapTime),
                    position: userBestAvgLap.position,
                    gapLabel: "Gap to best",
                    gapValue: `+${formatLapTime(userBestAvgLap.gapToBest)}`,
                  }
                }

                if (!userMetric) return null

                return (
                  <div className="mb-6 rounded-2xl border border-[var(--token-accent)]/30 bg-[var(--token-accent)]/10 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--token-accent)] mb-2">
                      {userMetric.label}
                    </p>
                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="text-2xl font-bold text-[var(--token-text-primary)]">
                          {userMetric.value}
                        </p>
                        <p className="text-xs text-[var(--token-text-secondary)] mt-1">
                          Position #{userMetric.position}
                        </p>
                      </div>
                      {((currentSection === 0 &&
                        userBestLap?.gapToFastest &&
                        userBestLap.gapToFastest > 0) ||
                        (currentSection === 1 &&
                          userBestConsistency?.gapToBest &&
                          userBestConsistency.gapToBest > 0) ||
                        (currentSection === 2 &&
                          userBestAvgLap?.gapToBest &&
                          userBestAvgLap.gapToBest > 0)) && (
                        <div className="text-right">
                          <p className="text-sm text-[var(--token-text-muted)]">
                            {userMetric.gapLabel}
                          </p>
                          <p className="text-lg font-semibold text-[var(--token-text-primary)]">
                            {userMetric.gapValue}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </>
          ) : (
            <div className="mb-6 rounded-2xl border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-4 py-6 text-center">
              <p className="text-sm text-[var(--token-text-muted)]">
                No lap time data available for this event
              </p>
            </div>
          )}
        </div>

        {weather ? (
          <WeatherPanel
            className="col-span-12 lg:col-span-4"
            weather={weather}
            eventDate={event?.eventDate}
            trackName={event?.trackName}
            eventName={event?.eventName}
          />
        ) : weatherLoading ? (
          <WeatherLoadingState className="col-span-12 lg:col-span-4" />
        ) : weatherError ? (
          <WeatherErrorState className="col-span-12 lg:col-span-4" error={weatherError} />
        ) : (
          <div className="col-span-12 rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] lg:col-span-4" />
        )}
      </section>
    </>
  )
}

type DriverCardData =
  | NonNullable<EventAnalysisSummary["topDrivers"]>[number]
  | NonNullable<EventAnalysisSummary["mostConsistentDrivers"]>[number]
  | NonNullable<EventAnalysisSummary["bestAvgLapDrivers"]>[number]
  | NonNullable<EventAnalysisSummary["mostImprovedDrivers"]>[number]

function DriverCard({
  driver,
  index,
  type,
  sectionData,
}: {
  driver: DriverCardData
  index: number
  type: "fastest" | "consistency" | "avgLap" | "improvement"
  sectionData:
    | EventAnalysisSummary["topDrivers"]
    | EventAnalysisSummary["mostConsistentDrivers"]
    | EventAnalysisSummary["bestAvgLapDrivers"]
    | EventAnalysisSummary["mostImprovedDrivers"]
}) {
  let valueDisplay: string
  let gapDisplay: React.ReactNode = null

  if (type === "fastest" && "fastestLapTime" in driver) {
    valueDisplay = formatLapTime(driver.fastestLapTime)
    if (
      sectionData &&
      Array.isArray(sectionData) &&
      sectionData.length > 0 &&
      "fastestLapTime" in sectionData[0]
    ) {
      const fastestLapTime = (sectionData[0] as { fastestLapTime: number }).fastestLapTime
      const sameClass = driver.className === sectionData[0].className
      const gapToFastest = index > 0 && sameClass ? driver.fastestLapTime - fastestLapTime : 0
      if (gapToFastest > 0) {
        gapDisplay = (
          <span className="text-[10px] text-[var(--token-text-muted)]">
            +{formatLapTime(gapToFastest)}
          </span>
        )
      }
    }
  } else if (type === "consistency" && "consistency" in driver) {
    valueDisplay = `${driver.consistency.toFixed(1)}%`
  } else if (type === "avgLap" && "avgLapTime" in driver) {
    valueDisplay = formatLapTime(driver.avgLapTime)
  } else {
    valueDisplay = "N/A"
  }

  return (
    <div className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 py-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[var(--token-text-muted)]">#{index + 1}</span>
        {gapDisplay}
      </div>
      <p className="text-base font-semibold text-[var(--token-text-primary)] mb-1">
        {driver.driverName}
      </p>
      <p className="text-2xl font-bold text-[var(--token-text-primary)] mb-2">{valueDisplay}</p>
      <p className="text-[10px] text-[var(--token-text-muted)]">{driver.raceLabel}</p>
      <p className="text-[10px] text-[var(--token-text-muted)]">{driver.className}</p>
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-[var(--token-text-primary)]">{value}</p>
    </div>
  )
}

function KpiCard({
  label,
  value,
  helper,
  trendLabel,
  trendDelta,
  trendValueDisplay,
  sparkline,
  className = "",
}: KpiDatum & { className?: string }) {
  const tone =
    trendDelta >= 0
      ? "text-[var(--token-status-success-text)]"
      : "text-[var(--token-status-warning-text)]"
  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-[var(--token-text-primary)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--token-text-secondary)]">{helper}</p>
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className={tone}>{trendLabel}</span>
        <span className={tone}>{trendValueDisplay}</span>
      </div>
      <Sparkline data={sparkline} />
    </article>
  )
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) {
    return (
      <svg viewBox="0 0 100 60" className="mt-4 h-16 w-full text-[var(--token-accent)]" fill="none">
        <polyline
          points=""
          stroke="currentColor"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  const max = Math.max(...data)
  const min = Math.min(...data)
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = ((value - min) / (max - min || 1)) * 60
    return `${x},${60 - y}`
  })
  return (
    <svg viewBox="0 0 100 60" className="mt-4 h-16 w-full text-[var(--token-accent)]" fill="none">
      <polyline
        points={points.join(" ")}
        stroke="currentColor"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TelemetrySnapshot({
  className,
  data,
}: {
  className?: string
  data: ReturnType<typeof generateTelemetrySnapshot>
}) {
  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
            Telemetry
          </p>
          <h3 className="text-lg font-semibold">Speed trace snapshot</h3>
        </div>
        <span className="rounded-full bg-[var(--token-status-info-bg)] px-3 py-1 text-[11px] font-semibold text-[var(--token-status-info-text)]">
          {data.reference}
        </span>
      </header>
      <svg viewBox="0 0 400 160" className="w-full">
        <TelemetryPath points={data.speed} color="var(--token-telemetry-speed)" height={160} />
        <TelemetryPath
          points={data.throttle}
          color="var(--token-telemetry-throttle)"
          height={160}
        />
        <TelemetryPath points={data.brake} color="var(--token-telemetry-brake)" height={160} />
        {data.sectors.map((sector, index) => (
          <line
            key={sector}
            x1={(sector / 100) * 400}
            x2={(sector / 100) * 400}
            y1={0}
            y2={160}
            stroke={
              ["var(--token-sector-s1)", "var(--token-sector-s2)", "var(--token-sector-s3)"][
                index % 3
              ]
            }
            strokeDasharray="4 4"
            strokeWidth={1}
          />
        ))}
      </svg>
      <p className="mt-4 text-xs text-[var(--token-text-muted)]">
        Compare toggle overlays teammate baselines on the trace.
      </p>
    </article>
  )
}

function TelemetryPath({
  points,
  color,
  height,
}: {
  points: number[]
  color: string
  height: number
}) {
  if (points.length === 0) {
    return <path d="" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
  }
  const max = Math.max(...points)
  const min = Math.min(...points)
  const d = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 400
      const y = height - ((value - min) / (max - min || 1)) * height
      return `${index === 0 ? "M" : "L"}${x},${y}`
    })
    .join(" ")
  return <path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
}

function WeatherPanel({
  className,
  weather,
  eventDate,
  trackName,
  eventName,
}: {
  className?: string
  weather: WeatherData
  eventDate?: string
  trackName?: string
  eventName?: string
}) {
  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
          Track state
        </p>
        {weather.isCached && weather.cachedAt && (
          <p className="text-[9px] uppercase tracking-[0.3em] text-[var(--token-text-muted)]">
            Cached
          </p>
        )}
      </div>
      {eventName && trackName && eventDate && (
        <p className="text-sm text-[var(--token-text-secondary)] mt-2">
          {eventName} • {trackName} • {formatDateLong(eventDate)}
        </p>
      )}
      <h3 className="mt-2 text-xl font-semibold text-[var(--token-text-primary)]">
        {weather.condition}
      </h3>
      <p className="text-sm text-[var(--token-text-secondary)]">
        Wind {weather.wind} • Humidity {weather.humidity}%
      </p>
      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <WeatherStat label="Air" value={`${Math.round(weather.air)}°C`} />
        <WeatherStat label="Track" value={`${Math.round(weather.track)}°C`} />
        <WeatherStat label="Chance" value={`${weather.precip}%`} />
      </div>
      <div className="mt-6 space-y-2 text-xs text-[var(--token-text-secondary)]">
        {weather.forecast.map((entry) => (
          <div
            key={entry.label}
            className="flex items-center justify-between rounded-2xl border border-[var(--token-border-muted)] px-3 py-2"
          >
            <span>{entry.label}</span>
            <span>{entry.detail}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

function WeatherStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--token-border-default)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-[var(--token-text-primary)]">{value}</p>
    </div>
  )
}

function AlertStack({ className, alerts }: { className?: string; alerts: AlertItem[] }) {
  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
            Alert stack
          </p>
          <h3 className="text-lg font-semibold">Live flags</h3>
        </div>
        <span className="text-xs text-[var(--token-text-muted)]">Auto-refresh</span>
      </header>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start justify-between rounded-2xl border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-3 py-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                    alert.severity === "green"
                      ? "bg-[var(--token-status-success-bg)] text-[var(--token-status-success-text)]"
                      : alert.severity === "amber"
                        ? "bg-[var(--token-status-warning-bg)] text-[var(--token-status-warning-text)]"
                        : "bg-[var(--token-status-error-bg)] text-[var(--token-status-error-text)]"
                  }`}
                >
                  {alert.severity}
                </span>
                <p className="text-sm font-semibold text-[var(--token-text-primary)]">
                  {alert.label}
                </p>
              </div>
              <p className="mt-1 text-xs text-[var(--token-text-secondary)]">{alert.detail}</p>
            </div>
            <span className="text-xs text-[var(--token-text-muted)]">{alert.timestamp}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

function ActivityTimeline({
  className,
  activity,
}: {
  className?: string
  activity: ActivityItem[]
}) {
  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
        Activity
      </p>
      <h3 className="mt-2 text-lg font-semibold">Race engineer feed</h3>
      <div className="mt-4 space-y-4">
        {activity.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <span
              className={`mt-1 h-2 w-2 rounded-full ${item.type === "engineer" ? "bg-[var(--token-accent)]" : "bg-[var(--token-status-warning-text)]"}`}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--token-text-primary)]">
                  {item.title}
                </p>
                <span className="text-xs text-[var(--token-text-muted)]">{item.timestamp}</span>
              </div>
              <p className="text-sm text-[var(--token-text-secondary)]">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

function DataQualityHeatmap({
  className,
  matrix,
}: {
  className?: string
  matrix: { lap: string; completeness: number[] }[]
}) {
  const channels = ["Speed", "Throttle", "Brake", "Gear", "GPS", "Temp"]
  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
        Data quality
      </p>
      <h3 className="mt-2 text-lg font-semibold">Channel completeness</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="py-2 text-left text-xs uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
                Lap
              </th>
              {channels.map((channel) => (
                <th
                  key={channel}
                  className="px-2 py-2 text-xs uppercase tracking-[0.3em] text-[var(--token-text-muted)]"
                >
                  {channel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.lap}>
                <td className="py-2 text-xs text-[var(--token-text-secondary)]">{row.lap}</td>
                {row.completeness.map((score, index) => (
                  <td key={`${row.lap}-${index}`} className="px-2 py-1">
                    <div className="h-6 w-full rounded-full bg-[var(--token-border-muted)]">
                      <div
                        className={`h-full rounded-full ${score > 80 ? "bg-[var(--token-status-success-text)]" : score > 60 ? "bg-[var(--token-status-warning-text)]" : "bg-[var(--token-status-error-text)]"}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

function SessionSchedule({
  className,
  sessions,
}: {
  className?: string
  sessions: { id: string; label: string; detail: string; status: string }[]
}) {
  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
        Program
      </p>
      <h3 className="mt-2 text-lg font-semibold">Sessions timeline</h3>
      <div className="mt-4 space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between rounded-2xl border border-[var(--token-border-muted)] px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-[var(--token-text-primary)]">
                {session.label}
              </p>
              <p className="text-xs text-[var(--token-text-muted)]">{session.detail}</p>
            </div>
            <span className="text-xs uppercase tracking-[0.4em] text-[var(--token-text-secondary)]">
              {session.status}
            </span>
          </div>
        ))}
      </div>
    </article>
  )
}

function generateKpiData(summary: EventAnalysisSummary["summary"] | null): KpiDatum[] {
  const baseLaps = summary?.totalLaps ?? 58
  return [
    {
      id: "lap-delta",
      label: "Lap Delta",
      value: "-0.182s",
      helper: "vs target",
      trendLabel: "Improving",
      trendDelta: 0.12,
      trendValueDisplay: "-0.12s",
      sparkline: [0.32, 0.28, 0.2, 0.15, 0.12, 0.08, 0.1],
    },
    {
      id: "sector",
      label: "Sector Gains",
      value: "S1 +0.08s",
      helper: "S2 -0.03s / S3 -0.01s",
      trendLabel: "S1 purple",
      trendDelta: 0.03,
      trendValueDisplay: "+0.03s",
      sparkline: [0.12, 0.1, 0.08, 0.05, 0.02, -0.01, 0.01],
    },
    {
      id: "tire",
      label: "Tire Life",
      value: `${Math.min(baseLaps / 2, 18).toFixed(0)} laps`,
      helper: "Medium compound",
      trendLabel: "+1 lap",
      trendDelta: 1,
      trendValueDisplay: "+1 lap",
      sparkline: [12, 12.5, 13, 13.4, 14, 14.5, 15],
    },
    {
      id: "consistency",
      label: "Consistency",
      value: `${Math.min(98, 75 + baseLaps * 0.2).toFixed(1)}%`,
      helper: "Fastest 5 laps",
      trendLabel: "Stable",
      trendDelta: 0,
      trendValueDisplay: "±0",
      sparkline: [90, 91, 92, 94, 95, 94, 93],
    },
  ]
}

function generateTelemetrySnapshot(summary: EventAnalysisSummary["summary"] | null) {
  const laps = summary?.totalLaps ?? 50
  const baseSpeed = 280 + (laps % 5)
  const points = Array.from(
    { length: 30 },
    (_, index) => baseSpeed - Math.sin(index / 2) * 40 - index
  )
  const throttle = points.map((value, index) => 50 + Math.sin(index) * 40)
  const brake = points.map((value, index) => Math.max(0, 30 - Math.cos(index) * 30))
  return {
    reference: "vs. baseline",
    speed: points,
    throttle,
    brake,
    sectors: [33, 66, 99],
  }
}

function WeatherLoadingState({ className }: { className?: string }) {
  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <div className="animate-pulse">
        <div className="h-4 w-24 bg-[var(--token-surface)] rounded mb-4" />
        <div className="h-6 w-48 bg-[var(--token-surface)] rounded mb-2" />
        <div className="h-4 w-32 bg-[var(--token-surface)] rounded mb-6" />
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[var(--token-surface)] rounded-2xl" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-[var(--token-surface)] rounded-2xl" />
          ))}
        </div>
      </div>
    </article>
  )
}

function WeatherErrorState({ className, error }: { className?: string; error: string }) {
  // Parse error message to show user-friendly version
  const getUserFriendlyError = (errorMsg: string): string => {
    if (errorMsg.includes("geocode") || errorMsg.includes("Geocoding")) {
      return "Weather data unavailable for this location"
    }
    if (errorMsg.includes("404") || errorMsg.includes("not found")) {
      return "Weather data not available"
    }
    if (errorMsg.includes("Failed to fetch") || errorMsg.includes("network")) {
      return "Unable to load weather data"
    }
    // Default fallback - show first sentence or truncate long technical errors
    const firstSentence = errorMsg.split(".")[0]
    if (firstSentence.length > 100) {
      return "Weather data unavailable"
    }
    return firstSentence
  }

  const friendlyError = getUserFriendlyError(error)

  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
        Track state
      </p>
      <p className="mt-4 text-sm text-[var(--token-text-secondary)]">{friendlyError}</p>
    </article>
  )
}

function generateAlerts(event?: EventAnalysisSummary["event"] | null): AlertItem[] {
  const eventName = event?.eventName ?? "Session"
  return [
    {
      id: "alert-1",
      label: `${eventName} • Yellow S2`,
      severity: "amber",
      timestamp: "1m",
      detail: "Slow car clearing T9 apex",
    },
    {
      id: "alert-2",
      label: "Track limits",
      severity: "red",
      timestamp: "8m",
      detail: "Lap 14 invalidated at T4",
    },
    {
      id: "alert-3",
      label: "Grip window",
      severity: "green",
      timestamp: "14m",
      detail: "Medium compound optimum",
    },
  ]
}

function generateActivityStream(events: ImportedEventSummary[]): ActivityItem[] {
  const base: ActivityItem[] = [
    {
      id: "activity-1",
      title: "Engineer",
      detail: "Adjust brake bias +0.2% for next push lap",
      timestamp: "Just now",
      type: "engineer",
    },
    {
      id: "activity-2",
      title: "System",
      detail: "Sector 1 purple delta -0.032s",
      timestamp: "2m",
      type: "system",
    },
    {
      id: "activity-3",
      title: "Engineer",
      detail: "Plan Box + 2 for short run on scrubbed mediums",
      timestamp: "8m",
      type: "engineer",
    },
  ]
  return base.concat(
    events.slice(0, 2).map((event, index) => ({
      id: `activity-r-${event.id}`,
      title: "Recent Event",
      detail: `${event.eventName} ready for review`,
      timestamp: `${15 + index * 4}m`,
      type: "system" as const,
    }))
  )
}

function generateSessionSchedule(event?: EventAnalysisSummary["event"] | null) {
  const baseDate = event?.eventDate ? new Date(event.eventDate) : new Date()
  return [
    {
      id: "fp1",
      label: "Practice",
      detail: new Date(baseDate).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" }),
      status: "Live",
    },
    {
      id: "fp2",
      label: "Qualifying",
      detail: new Date(baseDate.getTime() + 2 * 60 * 60 * 1000).toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "Next",
    },
    {
      id: "race",
      label: "Race",
      detail: new Date(baseDate.getTime() + 4 * 60 * 60 * 1000).toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "T-4h",
    },
  ]
}

function generateDataQualityMatrix() {
  return Array.from({ length: 5 }).map((_, index) => ({
    lap: `Lap ${index + 10}`,
    completeness: Array.from({ length: 6 }).map(() => 50 + Math.random() * 50),
  }))
}
