---
created: 2025-01-27
creator: Documentation Update
lastModified: 2025-01-27
description: Telemetry visualization specification for MRE version 0.1.1
purpose:
  Defines telemetry visualization types, data sources, real-time and historical
  patterns, and implementation guidelines
relatedFiles:
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# Telemetry Visualization Specification

**Document Status:** Version 0.1.1 Feature Specification  
**Authoritative Scope:** Applies to all telemetry visualizations in version
0.1.1  
**Purpose:** Defines telemetry visualization types, data source requirements,
real-time and historical patterns, and implementation guidelines.

**Implementation Status:** Fully in-scope and required for version 0.1.1

---

## Table of Contents

1. [Overview](#overview)
2. [Visualization Types](#visualization-types)
3. [Data Sources](#data-sources)
4. [Real-Time vs Historical Patterns](#real-time-vs-historical-patterns)
5. [Chart/Graph Library Recommendations](#chartgraph-library-recommendations)
6. [Performance Considerations](#performance-considerations)
7. [Integration with Existing Data](#integration-with-existing-data)
8. [Future Sensor Data Integration](#future-sensor-data-integration)
9. [Future: Mobile App](#future-mobile-app)

---

## Overview

Version 0.1.1 includes telemetry visualization capabilities for displaying lap
data and future sensor data. All visualization types are fully in-scope and
required. Visualizations support both real-time (live race data) and historical
(past race data) modes.

**Key Principles:**

- Interactive and responsive visualizations (desktop viewport 1280px+)
- Performance-optimized for large datasets
- Accessible chart interactions
- Consistent visualization patterns

**Platform scope:** Telemetry visualizations are desktop-only for version 0.1.1.
A separate native mobile app is planned for a future release. Do not implement
mobile-specific layouts or touch optimizations in the web app.

**Note:** Telemetry visualization is fully in-scope for version 0.1.1. All
visualization types listed in Section 2 are required features. Telemetry data
ingestion is also in scope (see `docs/telemetry/`). Visualization components
use lap data from LiveRC ingestion and will support telemetry data when
available.

---

## Visualization Types

All visualization types listed below are fully in-scope and required for version
0.1.1. Visualization components must be implemented even if data sources are not
yet available.

### Lap Time Charts (Required)

**Purpose:** Display lap times over the course of a race or multiple races.

**Chart Types:**

- Line chart (lap times over race)
- Bar chart (lap time distribution)
- Comparison chart (multiple drivers)

**Features:**

- Interactive tooltips showing lap details
- Zoom and pan for detailed views
- Highlight fastest/slowest laps
- Compare multiple drivers
- Sector breakdown (if available)

**Data Requirements:**

- Lap number
- Lap time (seconds)
- Driver identification
- Race identification

**Use Cases:**

- Analyze lap time consistency
- Compare driver performance
- Identify fastest/slowest laps
- Track performance trends

---

### Speed Graphs (Required)

**Purpose:** Visualize speed data over time or by track sector.

**Chart Types:**

- Line chart (speed over time)
- Area chart (speed by sector)
- Heatmap (speed by sector and lap)

**Features:**

- Speed scale (km/h or mph)
- Sector markers
- Average speed indicators
- Peak speed highlights
- Speed comparison between drivers

**Data Requirements:**

- Speed measurements
- Time or lap number
- Sector information (if available)
- Driver identification

**Use Cases:**

- Analyze speed consistency
- Identify speed variations
- Compare sector speeds
- Track speed trends

**Note:** Speed data may not be available from LiveRC ingestion. This
visualization type is fully in-scope for version 0.1.1 - visualization
components must be implemented and ready for when speed data becomes available.

---

### GPS Track Visualization (Required)

**Purpose:** Display GPS tracks on track layout maps.

**Visualization Types:**

- Track layout map
- GPS track overlay
- Heatmap of track usage
- Optimal racing line visualization

**Features:**

- Interactive map with zoom/pan
- Multiple driver tracks overlay
- Sector markers
- Start/finish line
- Track boundaries

**Data Requirements:**

- GPS coordinates (latitude, longitude)
- Track layout data
- Driver identification
- Timestamp data

**Use Cases:**

- Visualize racing lines
- Compare driver lines
- Identify optimal racing line
- Track position analysis

**Note:** GPS data may not be available from LiveRC ingestion. This
visualization type is fully in-scope for version 0.1.1 - visualization
components must be implemented and ready for when GPS data becomes available.

---

### Sensor Data Visualization (Required)

**Purpose:** Display sensor data such as throttle, brake, and steering inputs.

**Chart Types:**

- Line chart (sensor values over time)
- Stacked area chart (multiple sensors)
- Gauge charts (current values)

**Sensor Types:**

- Throttle position (0-100%)
- Brake pressure (0-100%)
- Steering angle (-180° to +180°)
- RPM (revolutions per minute)
- Temperature sensors

**Features:**

- Real-time sensor value display
- Historical sensor data playback
- Multiple sensor overlay
- Sensor correlation analysis
- Alert thresholds

**Data Requirements:**

- Sensor type
- Sensor value
- Timestamp
- Driver/vehicle identification

**Use Cases:**

- Analyze driving inputs
- Compare driver techniques
- Identify input patterns
- Optimize driving style

**Note:** Sensor data is not available from LiveRC ingestion. This visualization
type is fully in-scope for version 0.1.1 - visualization components must be
implemented and ready for when sensor data becomes available.

---

### Sector Analysis (Required)

**Purpose:** Analyze performance by track sectors.

**Visualization Types:**

- Heatmap (sector times by lap)
- Bar chart (sector time comparison)
- Radar chart (sector performance)

**Features:**

- Sector time breakdown
- Sector comparison between drivers
- Sector consistency analysis
- Optimal sector identification
- Sector improvement tracking

**Data Requirements:**

- Sector times
- Sector identification
- Lap number
- Driver identification

**Use Cases:**

- Identify slow sectors
- Compare sector performance
- Track sector improvements
- Optimize sector times

**Note:** Sector data may be available from LiveRC ingestion if lap segments are
parsed. This visualization type is fully in-scope for version 0.1.1 -
visualization components must be implemented regardless of current data
availability.

---

## Data Sources

### Existing Lap Data (LiveRC Ingestion)

**Current Data Available:**

- Lap times (from LiveRC race results)
- Lap numbers
- Position on lap
- Elapsed race time
- Pace strings

**Data Structure:**

- Stored in `Lap` table
- Linked to `RaceResult` and `Race`
- Available via `/api/v1/races/[raceId]/laps`
- Available via `/api/v1/race-results/[raceResultId]/laps`

**Visualization Support:**

- ✅ Lap time charts (fully supported)
- ✅ Sector analysis (if sector data parsed)
- ⚠️ Speed graphs (not available from LiveRC)
- ⚠️ GPS tracks (not available from LiveRC)
- ⚠️ Sensor data (not available from LiveRC)

### Future Sensor Data

**Planned Data Sources:**

- Telemetry devices (GPS, IMU, sensors)
- Data collection systems
- Real-time data streams
- Historical data storage

**Integration Points:**

- Data ingestion API endpoints
- Real-time data streaming
- Data storage schema
- Data processing pipeline

**Visualization Support:**

- ✅ All visualization types (when data available)
- ✅ Real-time visualization
- ✅ Historical playback
- ✅ Multi-sensor correlation

---

## Real-Time vs Historical Patterns

### Real-Time Visualization

**Purpose:** Display live race data as it happens.

**Patterns:**

- WebSocket or Server-Sent Events for data streaming
- Incremental chart updates
- Real-time data buffering
- Performance optimization for frequent updates

**Implementation:**

- Connect to real-time data stream
- Update charts incrementally
- Buffer data for smooth rendering
- Handle connection interruptions

**Use Cases:**

- Live race monitoring
- Real-time performance tracking
- Live coaching/analysis
- Race commentary support

**Status:** Documented for future implementation when real-time data sources are
available.

### Historical Visualization

**Purpose:** Display past race data for analysis.

**Patterns:**

- Load complete dataset
- Render full chart
- Interactive playback controls
- Time-based navigation

**Implementation:**

- Fetch historical data via API
- Render complete visualization
- Support zoom/pan for details
- Playback controls for time-based data

**Use Cases:**

- Post-race analysis
- Performance comparison
- Historical trend analysis
- Driver improvement tracking

**Status:** Supported with existing lap data from LiveRC ingestion.

---

## Chart/Graph Library Recommendations

### Recommended Libraries

**Primary Recommendation:**

- **Visx** (formerly vx) - Low-level visualization primitives
- **Recharts** - React chart library built on D3
- **Chart.js with react-chartjs-2** - Popular chart library

**Considerations:**

- React compatibility
- Desktop performance (1280px+ viewport)
- Accessibility support
- Customization flexibility
- Bundle size

### Library Selection Criteria

**Requirements:**

- React/Next.js compatible
- Desktop rendering (1280px+ viewport)
- Accessible (ARIA support)
- Customizable styling
- Performance-optimized
- Active maintenance

**Current Codebase:**

- Visx is already in dependencies (see `package.json`)
- Consider using Visx for consistency
- Evaluate other libraries for specific needs

---

## Performance Considerations

### Large Dataset Handling

**Strategies:**

- Data aggregation for overview charts
- Downsampling for detailed views
- Virtual scrolling for long lists
- Lazy loading of chart data
- Progressive rendering

### Rendering Optimization

**Strategies:**

- Canvas rendering for large datasets
- SVG rendering for interactive charts
- Memoization of chart components
- Debounce user interactions
- Optimize re-renders

---

## Integration with Existing Data

### Lap Data Integration

**Current Implementation:**

- Lap data available from LiveRC ingestion
- Stored in `Lap` table
- Accessible via API endpoints
- Ready for visualization

**Visualization Implementation:**

- Fetch lap data via `/api/v1/races/[raceId]/laps`
- Transform data for chart library
- Render lap time charts
- Support filtering and comparison

**Example:**

```typescript
// Fetch lap data
const laps = await getRaceLaps(raceId);

// Transform for chart
const chartData = laps.map(lap => ({
  x: lap.lapNumber,
  y: lap.lapTimeSeconds,
  driver: lap.raceDriver.displayName
}));

// Render chart
<LineChart data={chartData} />
```

---

## Future Sensor Data Integration

### Integration Points

**API Endpoints:**

- `/api/v1/telemetry/stream` (real-time)
- `/api/v1/telemetry/[sessionId]` (historical)
- `/api/v1/telemetry/sensors` (sensor metadata)

**Data Storage:**

- Telemetry data tables (to be designed)
- Time-series database (optional)
- Sensor metadata storage

**Processing Pipeline:**

- Data ingestion service
- Data normalization
- Real-time processing
- Historical storage

### Visualization Support

**When Sensor Data Available:**

- All visualization types supported
- Real-time visualization enabled
- Multi-sensor correlation
- Advanced analysis features

**Migration Path:**

- Visualization components ready for sensor data
- Data transformation layer abstracts data source
- Gradual migration as sensor data becomes available

---

## Future: Mobile App

**Status:** Out of scope for version 0.1.1.

A separate native mobile app is planned for a future release. The web application
is desktop-only. When the mobile app is developed, it will consume the same
`/api/v1/telemetry/*` endpoints and may reuse visualization concepts documented
here, but implementation will be tailored to mobile viewports, touch
interactions, and native performance characteristics.

Do not implement mobile-specific layouts, responsive breakpoints for small
screens, or touch-optimized interactions in the web app for telemetry features.

---

## Accessibility Requirements

### Chart Accessibility

**Requirements:**

- ARIA labels for charts
- Screen reader descriptions
- Keyboard navigation
- High contrast mode support
- Text alternatives for charts

### Interactive Elements

**Requirements:**

- Keyboard-accessible tooltips
- Keyboard navigation for chart interactions
- Focus indicators
- Screen reader announcements

---

## Related Documentation

- [Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md) -
  Architecture rules (desktop-only; mobile strategy in Section 1)
- [Version 0.1.1 Feature Scope](../specs/mre-v0.1-feature-scope.md) - Feature
  specifications
- [Dashboard Architecture](../architecture/dashboard-architecture.md) -
  Dashboard widget system
- [Telemetry Documentation Index](../telemetry/README.md) - Telemetry ingestion,
  processing, and UX design
- [Telemetry API Contract](../telemetry/Design/API_Contract_Telemetry.md) -
  Endpoints, query patterns, and response shapes for telemetry sessions, laps,
  timeseries, and map data

---

## License

Internal use only. This document defines telemetry visualization specifications
for version 0.1.1 of MRE.
