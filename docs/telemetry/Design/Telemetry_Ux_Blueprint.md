# MRE Telemetry UX Blueprint (Desktop, Capability-Based)

## Purpose

Design a telemetry experience that helps a serious club racer answer real
questions quickly, without needing to understand GNSS, IMU, or file formats.

Primary outcomes:

- Lap time improvement
- Car setup diagnosis

Success bar:

- Within 30 seconds of opening a session, the user can identify the top 1 to 3
  places they lost time vs their best lap, and get a clear suggestion on what
  changed.

## Scope and assumptions

- Desktop-only for first release.
- Device-agnostic. We care about the type and quality of data available, not the
  hardware brand.
- Capability tiers (used throughout UI):
  - **Position only**: GNSS speed and path
  - **Position + 3-axis**: plus accel (jump and impact hints)
  - **Position + 6-axis**: plus gyro (corner stability and braking events)
  - **Position + 9-axis**: plus magnetometer (heading support, but can be
    disabled if interference)

- Users never see internal terms like PVT, EKF, RINEX.
- Track map is based on session position, optionally matched to a known track,
  but the UX must still work if no official track exists.

## Step 1, Prioritised user questions (Jobs to be done)

Ranked by value for the target user.

### Tier A, must answer fast

1. **Where am I losing time vs my best lap?**
2. **What changed in the best lap, what did I do differently?**
3. **Was I consistent, or did one corner ruin it?**
4. **Am I braking too early or too late?** (if supported)

### Tier B, high value

5. **Are jumps costing me time, am I landing unsettled?** (if supported)
6. **Did the car push or oversteer, and where?** (only with enough sensors, with
   confidence)
7. **Did the session degrade over time?** (battery fade, tyres, temperature
   proxies)
8. **Is my line different between laps, where?**

### Tier C, trust and edge cases

9. **Did telemetry quality degrade?** (dropouts, noise)
10. **Did the driver crash or require marshalling?**
11. **Did the driver perform a pit stop?** (nitro only, can be deferred)

Deliverable:

- This list becomes the navigation priority. Overview and Compare must answer
  Tier A immediately.

## Step 2, Core analysis views and navigation

A small set of views that cover most questions.

### Primary navigation model

User enters at **Session Overview**. From there they can pivot into deeper
views.

Left rail navigation (within a session):

1. Session Overview
2. Lap Compare
3. Segments and Corners
4. Events
5. Consistency
6. Quality and Trust

Top bar actions:

- Session picker
- Export snapshot
- Notes (optional later)

## View 1, Session Overview (default landing)

### Primary job

Answer the first 30 second question: where time was lost vs best, and what to do
next.

### Layout

- **Main canvas left**: Track map
- **Main canvas right**: Insights and lap list
- **Footer**: Quick metric toggles and mini timeline (optional)

### Components

1. **Track map panel**
   - Map with selectable overlay mode:
     - Speed heat
     - Delta to best heat (default after selecting a lap)
     - Line overlay (best vs selected)

   - Hover and selection shows a cursor with distance and speed.

2. **30-second insights panel**
   - Insight cards (top 3), each with:
     - Segment name or label (Corner 3, Straight 2, Jump 1)
     - Time lost (for selected lap vs best)
     - Plain-language hint
     - Confidence label (High, Medium, Low)

   - Example hints:
     - “Lower exit speed, likely late throttle or wide line.”
     - “Braked earlier here, entry speed dropped.”
     - “Lost time on landing, car unsettled.”

3. **Lap list table**
   - Columns:
     - Lap #
     - Lap time
     - Gap to best
     - Flags (crash, dropout, low quality)

   - Best lap highlighted.
   - Selecting a lap updates map overlays.

4. **Quality strip**
   - GPS data quality: Good, OK, Poor
   - Motion sensor quality: Good, OK, Poor
   - Coverage: percent of session with valid positioning
   - Click opens Quality and Trust view.

### Key interactions

- Single click lap selection.
- One click action: **Compare to best**.
- Map hover cursor shows where on track and updates inspector.

### Outputs

- A clear call to action: “Compare to best” and “Review top time-loss segments.”

## View 2, Lap Compare

### Primary job

Show where time was lost across lap distance, and make the change obvious.

### Layout

- **Top**: Lap selectors and compare action
- **Left**: Delta chart and metric chart
- **Right**: Map overlay and inspector

### Components

1. **Lap selectors**
   - Left: Reference lap (default Best)
   - Right: Target lap (default Selected)
   - Shortcut button: **Compare to best**

2. **Delta time vs distance chart**
   - X axis: distance along lap
   - Y axis: delta time (target minus reference)
   - Hover and scrub creates a cursor.
   - Highlight top 3 delta zones.

3. **Metric chart (capability-aware)**
   - Toggle metrics based on capability:
     - Always: speed
     - If 3-axis: vertical accel proxy, impact severity
     - If 6-axis: yaw rate, lateral accel, braking events
     - If 9-axis: heading confidence, magnetometer status

4. **Map overlay**
   - Two lines (reference and target)
   - Cursor follows scrub
   - Optional segment highlights

5. **Right inspector**
   - At cursor:
     - Distance, speed, delta
     - Entry speed, min speed, exit speed for nearest segment
     - Hint text
     - Confidence

### Key interactions

- Scrub delta chart, cursor moves on map.
- Click a highlighted delta zone to zoom into that section.
- Toggle metric, charts update without changing the compare selection.

## View 3, Segments and Corners

### Primary job

Turn the lap into actionable chunks, prioritised by time impact.

### Segment model

- Auto detect corners and straights from curvature and speed change.
- Each segment has start and end distance, and a label.

### Components

1. **Segment list (sortable)**
   - Default sort: time lost vs best
   - Columns:
     - Segment label
     - Time lost
     - Entry speed
     - Min speed
     - Exit speed
     - Confidence

2. **Segment detail panel**
   - Mini charts for the segment window:
     - speed
     - optional braking events
     - optional stability score

   - Coaching hint

3. **Map highlight**
   - Selected segment highlighted
   - Optional compare overlay for that segment only

### Key interactions

- Click a segment, everything focuses to it.
- One click jump to Compare view, pre-zoomed to that segment.

## View 4, Events

### Primary job

Make jumps, braking events, impacts, crashes, and dropouts obvious.

### Event types

- Braking events (6-axis preferred)
- Jumps (3-axis minimum)
- Impacts (3-axis minimum)
- Crash or marshal stop (inferred from speed to zero and time stationary)
- GNSS dropout or low quality spans

### Components

1. **Timeline**
   - Event markers with severity
   - Drag selection to zoom time range

2. **Map markers**
   - Markers at event locations
   - Click to jump timeline

3. **Event detail**
   - Type, time, severity, duration
   - Speed before and after
   - Confidence

### Key interactions

- Click event marker, cursor syncs across charts and map.

## View 5, Consistency

### Primary job

Show whether the driver was consistent, and where variance is concentrated.

### Components

1. **Lap time distribution**
   - Scatter or histogram
   - Best, average, median markers

2. **Trend over session**
   - Lap times by lap number
   - Optional moving average

3. **Variance by segment**
   - List sorted by highest variance
   - Heat overlay on map showing inconsistency zones

4. **Lap set filters**
   - All laps
   - Best 5
   - Last 5
   - Custom range

## View 6, Quality and Trust

### Primary job

Make data reliability explicit, so the user trusts the insights.

### Quality concepts shown to users

- “GPS data quality”
- “Motion sensor quality”
- “Coverage”
- “Heading source” as GPS or compass

### Components

1. **Quality summary cards**
   - GPS quality
   - Motion quality
   - Coverage

2. **Quality over time timeline**
   - Shows low quality spans and dropouts

3. **Rules explanations**
   - What was hidden and why
   - What was downgraded and why

## Step 3, Interaction model

Core interactions must feel effortless.

### Global interactions

- Selecting laps and segments is always one click.
- Scrubbing always moves a cursor on the map.
- Zooming map triggers chart downsampling to keep performance.
- Metric switching is a simple control, not a complex tool.
- Always-available action: one click “Compare to best.”
- Export snapshot captures current view state into a shareable artifact.

### Performance behaviour

- Charts and map should remain responsive.
- When zooming, downsample or aggregate automatically.
- Avoid blocking renders on heavy calculations. Use precomputed derived features
  where possible.

## Step 4, Vocabulary and UI copy guide

### Labels

- “GPS data quality”
- “Motion sensor quality”
- “Heading source: GPS or compass”
- “High precision mode available” (only if raw obs exists)
- “Coverage” as a percent

### Tooltips

- Keep tooltips to one short sentence.
- Always explain impact, not implementation.

Examples:

- GPS data quality tooltip: “Lower quality means the map line and deltas may be
  less accurate in those sections.”
- Motion sensor quality tooltip: “If motion quality is low, braking, jump, and
  stability metrics may be hidden.”

### Warnings

- Use plain language with an action.
- Example: “GPS signal dropped out for 3 seconds on Lap 6, that section is
  excluded from line comparison.”

## Step 5, Dummy data specification

We seed representative data to validate UX and edge cases.

### Data pack goals

- UI must still work when data is missing.
- Quality indicators must make sense.
- Charts must be useful and not misleading.

### Core entities

- Track
  - id, name
  - referencePath (polyline)
  - optional segments (if known)

- Session
  - id, startTime, duration
  - capabilityProfile
  - conditions tags (optional)

- Samples (time series)
  - timestampMs
  - position: x,y or lat,lon
  - speed
  - optional heading
  - optional accel ax,ay,az
  - optional gyro gx,gy,gz
  - optional mag mx,my,mz
  - quality fields: sats, hdop, fixType, dropoutFlag

- Derived (precomputed for UI)
  - laps with indices and lap time
  - distanceAlongLap
  - bestLapId
  - segments with metrics and deltas
  - events with confidence

### Required dummy sessions

1. Clean session, 9-axis
2. Clean session, position only
3. Noisy GNSS session, 6-axis
4. GNSS dropouts session, 6-axis
5. Jump-heavy session, 6-axis
6. Inconsistent driving session, position only or 3-axis

### Realism targets

- 8 to 12 laps
- 8 to 12 minutes
- Best lap and near-best lap exist
- 1 to 2 obvious mistakes
- Time loss concentrated in 2 to 4 segments

## Step 6, Quality and trust behaviours (rules)

These rules prevent misleading output.

### Hiding and downgrading

- If GPS quality is Poor or dropout, hide line overlay deltas for that span.
- If only position is present, do not show yaw rate, lateral accel, braking
  events, jump detection.
- If 3-axis only, allow jump and impact hints with Medium confidence, do not
  claim push or oversteer.
- If 6-axis present, allow braking events and stability hints, still require
  confidence.
- If 9-axis present but magnetometer interference detected, disable compass
  heading and label heading source as GPS.

### Confidence labels

- High: strong sensor support and stable quality
- Medium: partial support or mild noise
- Low: limited support, noisy, or short spans

### User explanations

- Always explain what was hidden and why.
- Always explain what was excluded and why.

## Step 7, Design sprint plan

### Sprint 1, Speed improvement vertical slice

Deliver:

- Session Overview
- Lap Compare
- Segments
- Dummy data sessions: clean 9-axis and position-only

Acceptance checks:

- Under 30 seconds to find top time-loss zones.
- One click Compare to best.
- Works with position-only data.

### Sprint 2, Setup diagnosis and trust

Deliver:

- Events
- Consistency
- Quality and Trust
- Dummy data sessions: noisy, dropouts, jumps, inconsistent

Acceptance checks:

- User can answer “is this driver consistency or car behaviour?”
- Warnings increase trust and do not overwhelm.

## Prototype checklist (clickable plan)

Even if first pass is static screens, define clickable states.

- Overview
  - select lap
  - click Compare to best
  - click insight card to jump to segment

- Compare
  - scrub delta chart
  - click highlighted delta zone
  - toggle metric

- Segments
  - sort by time lost
  - click segment
  - jump to Compare zoomed

- Events
  - click event marker
  - jump cursor

- Consistency
  - filter lap range
  - click high variance segment

- Quality
  - click quality span
  - show impact on charts
