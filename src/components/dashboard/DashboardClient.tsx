"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { useDashboardContext } from "@/components/dashboard/context/DashboardContext"
import { formatDateLong, formatLapTime } from "@/lib/date-utils"
import type { EventAnalysisSummary, ImportedEventSummary } from "@/types/dashboard"

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
  const {
    selectedEvent,
    eventSummary,
    topDrivers,
    mostConsistentDrivers,
    bestAvgLapDrivers,
    userBestLap,
    userBestConsistency,
    userBestAvgLap,
    isEventLoading,
    eventError,
    recentEvents,
  } = useDashboardContext()

  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState<string | null>(null)

  const kpis = useMemo(() => generateKpiData(eventSummary), [eventSummary])
  const telemetry = useMemo(() => generateTelemetrySnapshot(eventSummary), [eventSummary])
  const alerts = useMemo<AlertItem[]>(() => generateAlerts(selectedEvent), [selectedEvent])
  const activity = useMemo<ActivityItem[]>(() => generateActivityStream(recentEvents), [recentEvents])
  const schedule = useMemo(() => generateSessionSchedule(selectedEvent), [selectedEvent])
  const heatmap = useMemo(() => generateDataQualityMatrix(), [])

  // Fetch weather data when event is selected
  useEffect(() => {
    if (!selectedEvent?.id) {
      setWeather(null)
      setWeatherError(null)
      return
    }

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
        userBestLap={userBestLap}
        userBestConsistency={userBestConsistency}
        userBestAvgLap={userBestAvgLap}
        weather={weather}
        weatherLoading={weatherLoading}
        weatherError={weatherError}
      />

      <section className="grid grid-cols-12 gap-4 lg:gap-6">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} {...kpi} className="col-span-12 sm:col-span-6 xl:col-span-3" />
        ))}
      </section>

      <section className="grid grid-cols-12 gap-4 lg:gap-6">
        <TelemetrySnapshot className="col-span-12 xl:col-span-8" data={telemetry} />
        <div className="col-span-12 rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] xl:col-span-4">
          <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">Recent focus</p>
          <div className="mt-4 space-y-3">
            {recentEvents.slice(0, 3).map((recent) => (
              <div key={recent.id} className="rounded-2xl border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-4 py-3">
                <p className="text-sm font-semibold text-[var(--token-text-primary)]">{recent.eventName}</p>
                <p className="text-xs text-[var(--token-text-muted)]">{recent.track.trackName}</p>
              </div>
            ))}
            {recentEvents.length === 0 && (
              <p className="text-sm text-[var(--token-text-muted)]">Import events to see them here for fast switching.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-12 gap-4 lg:gap-6">
        <AlertStack className="col-span-12 lg:col-span-4" alerts={alerts} />
        <ActivityTimeline className="col-span-12 lg:col-span-8" activity={activity} />
      </section>

      <section className="grid grid-cols-12 gap-4 lg:gap-6">
        <DataQualityHeatmap className="col-span-12 xl:col-span-6" matrix={heatmap} />
        <SessionSchedule className="col-span-12 xl:col-span-6" sessions={schedule} />
      </section>
    </div>
  )
}

function DashboardLoadingState() {
  return (
    <div className="grid animate-pulse grid-cols-12 gap-4 lg:gap-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="col-span-12 rounded-2xl border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/60 p-6 sm:col-span-6 xl:col-span-4" />
      ))}
    </div>
  )
}

function DashboardEmptyState({ recentEvents, message }: { recentEvents: ImportedEventSummary[]; message?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 p-10 text-center">
      <p className="text-sm uppercase tracking-[0.5em] text-[var(--token-text-muted)]">No event selected</p>
      <h2 className="mt-4 text-2xl font-semibold text-[var(--token-text-primary)]">
        {message ?? "Choose a race to unlock telemetry"}
      </h2>
      <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
        Use the event selector above to load telemetry, KPIs, and weather for your mission control view.
      </p>
      {recentEvents.length > 0 && (
        <div className="mt-8 space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--token-text-muted)]">Recent circuits</p>
          <div className="flex flex-wrap justify-center gap-3">
            {recentEvents.slice(0, 4).map((event) => (
              <div key={event.id} className="rounded-full border border-[var(--token-border-default)] px-4 py-2 text-xs font-semibold text-[var(--token-text-secondary)]">
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
  userBestLap,
  userBestConsistency,
  userBestAvgLap,
  weather,
  weatherLoading,
  weatherError
}: { 
  event: EventAnalysisSummary["event"]
  summary: EventAnalysisSummary["summary"] | null
  topDrivers?: EventAnalysisSummary["topDrivers"]
  mostConsistentDrivers?: EventAnalysisSummary["mostConsistentDrivers"]
  bestAvgLapDrivers?: EventAnalysisSummary["bestAvgLapDrivers"]
  userBestLap?: EventAnalysisSummary["userBestLap"]
  userBestConsistency?: EventAnalysisSummary["userBestConsistency"]
  userBestAvgLap?: EventAnalysisSummary["userBestAvgLap"]
  weather: WeatherData | null
  weatherLoading: boolean
  weatherError: string | null
}) {
  const eventDate = event?.eventDate ? new Date(event.eventDate) : null
  const [currentSection, setCurrentSection] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)
  const sectionRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isUserInteractingRef = useRef(false)
  const currentSectionRef = useRef(0)
  const isProgrammaticScrollRef = useRef(false)

  const sections = [
    { title: "Fastest Laps", data: topDrivers, type: "fastest" as const },
    { title: "Most Consistent Drivers", data: mostConsistentDrivers, type: "consistency" as const },
    { title: "Best Overall Average Lap", data: bestAvgLapDrivers, type: "avgLap" as const },
  ]

  const hasData = topDrivers?.length || mostConsistentDrivers?.length || bestAvgLapDrivers?.length

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
        behavior: "smooth"
      })
      setCurrentSection(index)
      currentSectionRef.current = index
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
        setTimeout(() => {
          isUserInteractingRef.current = false
        }, 10000) // Resume auto-scroll 10 seconds after user interaction
        return
      }

      const carousel = carouselRef.current
      if (!carousel) return

      const nextSection = (currentSectionRef.current + 1) % sections.length
      const targetRef = sectionRefs[nextSection]
      
      if (targetRef.current) {
        isProgrammaticScrollRef.current = true
        const sectionWidth = carousel.clientWidth
        carousel.scrollTo({
          left: nextSection * sectionWidth,
          behavior: "smooth"
        })
        setCurrentSection(nextSection)
        currentSectionRef.current = nextSection
        // Reset flag after scroll animation completes
        setTimeout(() => {
          isProgrammaticScrollRef.current = false
        }, 600)
      }
    }

    // Auto-scroll every 5 seconds (adjust as needed)
    autoScrollIntervalRef.current = setInterval(autoScroll, 5000)

    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current)
      }
    }
  }, [hasData, sections.length])

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
        setCurrentSection(newSection)
        currentSectionRef.current = newSection
        // If scroll happened without using buttons, treat as user interaction
        isUserInteractingRef.current = true
        setTimeout(() => {
          isUserInteractingRef.current = false
        }, 10000)
      }
    }

    carousel.addEventListener("scroll", handleScroll, { passive: true })
    return () => carousel.removeEventListener("scroll", handleScroll)
  }, [currentSection, sections.length])

  return (
    <section className="grid grid-cols-12 gap-4 lg:gap-6">
      <div className="col-span-12 rounded-3xl border border-[var(--token-border-default)] bg-gradient-to-br from-[#0f172a] via-[#0b1120] to-[#020617] p-[var(--dashboard-card-padding)] lg:col-span-8">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.5em] text-[var(--token-text-muted)]">Event</p>
          <h1 className="text-3xl font-bold text-white">{event.eventName}</h1>
          <p className="text-sm text-[var(--token-text-secondary)]">{event.trackName} • {eventDate ? formatDateLong(event.eventDate) : "Date TBD"}</p>
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
                      ? "border-white/10 text-white/20 cursor-not-allowed"
                      : "border-white/20 text-white/70 hover:border-white/40 hover:text-white cursor-pointer"
                  }`}
                  aria-label="Previous section"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <p className="text-[11px] uppercase tracking-[0.4em] text-white/70 flex-1">
                  {sections[currentSection]?.title}
                </p>
                <button
                  onClick={handleNext}
                  disabled={currentSection === sections.length - 1}
                  className={`flex items-center justify-center w-8 h-8 rounded-full border transition ${
                    currentSection === sections.length - 1
                      ? "border-white/10 text-white/20 cursor-not-allowed"
                      : "border-white/20 text-white/70 hover:border-white/40 hover:text-white cursor-pointer"
                  }`}
                  aria-label="Next section"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
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
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          {section.data.map((driver, driverIndex) => (
                            <DriverCard
                              key={driver.driverId}
                              driver={driver}
                              index={driverIndex}
                              type={section.type}
                              sectionData={section.data}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-center">
                          <p className="text-sm text-white/60">No data available for {section.title.toLowerCase()}</p>
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
                  <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--token-accent)] mb-2">{userMetric.label}</p>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-2xl font-bold text-white">{userMetric.value}</p>
                      <p className="text-xs text-white/70 mt-1">Position #{userMetric.position}</p>
                    </div>
                    {((currentSection === 0 && userBestLap?.gapToFastest && userBestLap.gapToFastest > 0) ||
                      (currentSection === 1 && userBestConsistency?.gapToBest && userBestConsistency.gapToBest > 0) ||
                      (currentSection === 2 && userBestAvgLap?.gapToBest && userBestAvgLap.gapToBest > 0)) && (
                      <div className="text-right">
                        <p className="text-sm text-white/60">{userMetric.gapLabel}</p>
                        <p className="text-lg font-semibold text-white">{userMetric.gapValue}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </>
        ) : (
          <div className="mb-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-center">
            <p className="text-sm text-white/60">No lap time data available for this event</p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <PrimaryButton label="Import Telemetry" icon="download" />
          <PrimaryButton label="Compare Laps" icon="compare" variant="secondary" />
          <PrimaryButton label="Share Snapshot" icon="share" variant="secondary" />
        </div>
      </div>

      {weather ? (
        <WeatherPanel className="col-span-12 lg:col-span-4" weather={weather} eventDate={event?.eventDate} trackName={event?.trackName} eventName={event?.eventName} />
      ) : weatherLoading ? (
        <WeatherLoadingState className="col-span-12 lg:col-span-4" />
      ) : weatherError ? (
        <WeatherErrorState className="col-span-12 lg:col-span-4" error={weatherError} />
      ) : (
        <div className="col-span-12 rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] lg:col-span-4" />
      )}
    </section>
  )
}

type DriverCardData = 
  | NonNullable<EventAnalysisSummary["topDrivers"]>[number]
  | NonNullable<EventAnalysisSummary["mostConsistentDrivers"]>[number]
  | NonNullable<EventAnalysisSummary["bestAvgLapDrivers"]>[number]

function DriverCard({
  driver,
  index,
  type,
  sectionData,
}: {
  driver: DriverCardData
  index: number
  type: "fastest" | "consistency" | "avgLap"
  sectionData: EventAnalysisSummary["topDrivers"] | EventAnalysisSummary["mostConsistentDrivers"] | EventAnalysisSummary["bestAvgLapDrivers"]
}) {
  let valueDisplay: string
  let gapDisplay: React.ReactNode = null

  if (type === "fastest" && "fastestLapTime" in driver) {
    valueDisplay = formatLapTime(driver.fastestLapTime)
    if (sectionData && Array.isArray(sectionData) && sectionData.length > 0 && "fastestLapTime" in sectionData[0]) {
      const fastestLapTime = (sectionData[0] as { fastestLapTime: number }).fastestLapTime
      const sameClass = driver.className === sectionData[0].className
      const gapToFastest = index > 0 && sameClass ? driver.fastestLapTime - fastestLapTime : 0
      if (gapToFastest > 0) {
        gapDisplay = <span className="text-[10px] text-white/50">+{formatLapTime(gapToFastest)}</span>
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
    <div className="rounded-2xl border border-white/20 bg-white/5 px-4 py-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-white/60">#{index + 1}</span>
        {gapDisplay}
      </div>
      <p className="text-base font-semibold text-white mb-1">{driver.driverName}</p>
      <p className="text-2xl font-bold text-white mb-2">{valueDisplay}</p>
      <p className="text-[10px] text-white/60">{driver.raceLabel}</p>
      <p className="text-[10px] text-white/50">{driver.className}</p>
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

function PrimaryButton({ label, icon, variant = "primary" }: { label: string; icon: "download" | "compare" | "share"; variant?: "primary" | "secondary" }) {
  const base = variant === "primary" ? "bg-white text-black" : "bg-white/10 text-white"
  const border = variant === "primary" ? "border-white" : "border-white/20"
  return (
    <button type="button" className={`flex items-center gap-2 rounded-full border ${border} px-4 py-2 text-sm font-semibold transition hover:opacity-90 ${base}`}>
      <HeroIcon type={icon} />
      {label}
    </button>
  )
}

function HeroIcon({ type }: { type: "download" | "compare" | "share" }) {
  switch (type) {
    case "download":
      return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><path d="M12 5v10m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" /><path d="M5 19h14" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" /></svg>
    case "compare":
      return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><path d="M7 4h3v16H7zm7 0h3v16h-3z" stroke="currentColor" strokeWidth={1.5} /></svg>
    case "share":
    default:
      return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"><path d="M8 12a4 4 0 1 1-4-4 4 4 0 0 1 4 4zm12-6a4 4 0 1 1-4-4 4 4 0 0 1 4 4zm0 16a4 4 0 1 1-4-4 4 4 0 0 1 4 4z" stroke="currentColor" strokeWidth={1.5} /><path d="M15 4.5 9 9m0 6 6 4.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" /></svg>
  }
}

function KpiCard({ label, value, helper, trendLabel, trendDelta, trendValueDisplay, sparkline, className = "" }: KpiDatum & { className?: string }) {
  const tone = trendDelta >= 0 ? "text-[var(--token-status-success-text)]" : "text-[var(--token-status-warning-text)]"
  return (
    <article className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">{label}</p>
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
  const max = Math.max(...data)
  const min = Math.min(...data)
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = ((value - min) / (max - min || 1)) * 60
    return `${x},${60 - y}`
  })
  return (
    <svg viewBox="0 0 100 60" className="mt-4 h-16 w-full text-[var(--token-accent)]" fill="none">
      <polyline points={points.join(" ")} stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" />
    </svg>
  )
}

function TelemetrySnapshot({ className, data }: { className?: string; data: ReturnType<typeof generateTelemetrySnapshot> }) {
  return (
    <article className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">Telemetry</p>
          <h3 className="text-lg font-semibold">Speed trace snapshot</h3>
        </div>
        <span className="rounded-full bg-[var(--token-status-info-bg)] px-3 py-1 text-[11px] font-semibold text-[var(--token-status-info-text)]">
          {data.reference}
        </span>
      </header>
      <svg viewBox="0 0 400 160" className="w-full">
        <TelemetryPath points={data.speed} color="var(--token-telemetry-speed)" height={160} />
        <TelemetryPath points={data.throttle} color="var(--token-telemetry-throttle)" height={160} />
        <TelemetryPath points={data.brake} color="var(--token-telemetry-brake)" height={160} />
        {data.sectors.map((sector, index) => (
          <line
            key={sector}
            x1={(sector / 100) * 400}
            x2={(sector / 100) * 400}
            y1={0}
            y2={160}
            stroke={["var(--token-sector-s1)", "var(--token-sector-s2)", "var(--token-sector-s3)"][index % 3]}
            strokeDasharray="4 4"
            strokeWidth={1}
          />
        ))}
      </svg>
      <p className="mt-4 text-xs text-[var(--token-text-muted)]">Compare toggle overlays teammate baselines on the trace.</p>
    </article>
  )
}

function TelemetryPath({ points, color, height }: { points: number[]; color: string; height: number }) {
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

function WeatherPanel({ className, weather, eventDate, trackName, eventName }: { className?: string; weather: WeatherData; eventDate?: string; trackName?: string; eventName?: string }) {
  return (
    <article className={`rounded-3xl border border-[var(--token-border-default)] bg-gradient-to-br from-[#111f2c] to-[#0b141c] p-[var(--dashboard-card-padding)] text-white ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">Track state</p>
        {weather.isCached && weather.cachedAt && (
          <p className="text-[9px] uppercase tracking-[0.3em] text-white/40">Cached</p>
        )}
      </div>
      {eventName && trackName && eventDate && (
        <p className="text-sm text-white/70 mt-2">{eventName} • {trackName} • {formatDateLong(eventDate)}</p>
      )}
      <h3 className="mt-2 text-xl font-semibold">{weather.condition}</h3>
      <p className="text-sm text-white/70">Wind {weather.wind} • Humidity {weather.humidity}%</p>
      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <WeatherStat label="Air" value={`${Math.round(weather.air)}°C`} />
        <WeatherStat label="Track" value={`${Math.round(weather.track)}°C`} />
        <WeatherStat label="Chance" value={`${weather.precip}%`} />
      </div>
      <div className="mt-6 space-y-2 text-xs text-white/70">
        {weather.forecast.map((entry) => (
          <div key={entry.label} className="flex items-center justify-between rounded-2xl border border-white/10 px-3 py-2">
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
    <div className="rounded-2xl border border-white/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function AlertStack({ className, alerts }: { className?: string; alerts: AlertItem[] }) {
  return (
    <article className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">Alert stack</p>
          <h3 className="text-lg font-semibold">Live flags</h3>
        </div>
        <span className="text-xs text-[var(--token-text-muted)]">Auto-refresh</span>
      </header>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-start justify-between rounded-2xl border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-3 py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                  alert.severity === "green"
                    ? "bg-[var(--token-status-success-bg)] text-[var(--token-status-success-text)]"
                    : alert.severity === "amber"
                      ? "bg-[var(--token-status-warning-bg)] text-[var(--token-status-warning-text)]"
                      : "bg-[var(--token-status-error-bg)] text-[var(--token-status-error-text)]"
                }`}>
                  {alert.severity}
                </span>
                <p className="text-sm font-semibold text-[var(--token-text-primary)]">{alert.label}</p>
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

function ActivityTimeline({ className, activity }: { className?: string; activity: ActivityItem[] }) {
  return (
    <article className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">Activity</p>
      <h3 className="mt-2 text-lg font-semibold">Race engineer feed</h3>
      <div className="mt-4 space-y-4">
        {activity.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <span className={`mt-1 h-2 w-2 rounded-full ${item.type === "engineer" ? "bg-[var(--token-accent)]" : "bg-[var(--token-status-warning-text)]"}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--token-text-primary)]">{item.title}</p>
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

function DataQualityHeatmap({ className, matrix }: { className?: string; matrix: { lap: string; completeness: number[] }[] }) {
  const channels = ["Speed", "Throttle", "Brake", "Gear", "GPS", "Temp"]
  return (
    <article className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">Data quality</p>
      <h3 className="mt-2 text-lg font-semibold">Channel completeness</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="py-2 text-left text-xs uppercase tracking-[0.4em] text-[var(--token-text-muted)]">Lap</th>
              {channels.map((channel) => (
                <th key={channel} className="px-2 py-2 text-xs uppercase tracking-[0.3em] text-[var(--token-text-muted)]">
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

function SessionSchedule({ className, sessions }: { className?: string; sessions: { id: string; label: string; detail: string; status: string }[] }) {
  return (
    <article className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">Program</p>
      <h3 className="mt-2 text-lg font-semibold">Sessions timeline</h3>
      <div className="mt-4 space-y-3">
        {sessions.map((session) => (
          <div key={session.id} className="flex items-center justify-between rounded-2xl border border-[var(--token-border-muted)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--token-text-primary)]">{session.label}</p>
              <p className="text-xs text-[var(--token-text-muted)]">{session.detail}</p>
            </div>
            <span className="text-xs uppercase tracking-[0.4em] text-[var(--token-text-secondary)]">{session.status}</span>
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
  const points = Array.from({ length: 30 }, (_, index) => baseSpeed - Math.sin(index / 2) * 40 - index)
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
    <article className={`rounded-3xl border border-[var(--token-border-default)] bg-gradient-to-br from-[#111f2c] to-[#0b141c] p-[var(--dashboard-card-padding)] text-white ${className}`}>
      <div className="animate-pulse">
        <div className="h-4 w-24 bg-white/20 rounded mb-4" />
        <div className="h-6 w-48 bg-white/20 rounded mb-2" />
        <div className="h-4 w-32 bg-white/20 rounded mb-6" />
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/10 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-white/10 rounded-2xl" />
          ))}
        </div>
      </div>
    </article>
  )
}

function WeatherErrorState({ className, error }: { className?: string; error: string }) {
  return (
    <article className={`rounded-3xl border border-[var(--token-border-default)] bg-gradient-to-br from-[#111f2c] to-[#0b141c] p-[var(--dashboard-card-padding)] text-white ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">Track state</p>
      <p className="mt-4 text-sm text-white/70">{error}</p>
    </article>
  )
}

function generateAlerts(event?: EventAnalysisSummary["event"] | null): AlertItem[] {
  const eventName = event?.eventName ?? "Session"
  return [
    { id: "alert-1", label: `${eventName} • Yellow S2`, severity: "amber", timestamp: "1m", detail: "Slow car clearing T9 apex" },
    { id: "alert-2", label: "Track limits", severity: "red", timestamp: "8m", detail: "Lap 14 invalidated at T4" },
    { id: "alert-3", label: "Grip window", severity: "green", timestamp: "14m", detail: "Medium compound optimum" },
  ]
}

function generateActivityStream(events: ImportedEventSummary[]): ActivityItem[] {
  const base: ActivityItem[] = [
    { id: "activity-1", title: "Engineer", detail: "Adjust brake bias +0.2% for next push lap", timestamp: "Just now", type: "engineer" },
    { id: "activity-2", title: "System", detail: "Sector 1 purple delta -0.032s", timestamp: "2m", type: "system" },
    { id: "activity-3", title: "Engineer", detail: "Plan Box + 2 for short run on scrubbed mediums", timestamp: "8m", type: "engineer" },
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
    { id: "fp1", label: "Practice", detail: new Date(baseDate).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" }), status: "Live" },
    { id: "fp2", label: "Qualifying", detail: new Date(baseDate.getTime() + 2 * 60 * 60 * 1000).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" }), status: "Next" },
    { id: "race", label: "Race", detail: new Date(baseDate.getTime() + 4 * 60 * 60 * 1000).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" }), status: "T-4h" },
  ]
}

function generateDataQualityMatrix() {
  return Array.from({ length: 5 }).map((_, index) => ({
    lap: `Lap ${index + 10}`,
    completeness: Array.from({ length: 6 }).map(() => 50 + Math.random() * 50),
  }))
}

