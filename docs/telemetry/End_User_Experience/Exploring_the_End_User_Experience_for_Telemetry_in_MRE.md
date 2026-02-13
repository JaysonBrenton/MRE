# Exploring the End User Experience for Telemetry in MRE

## Goal

Design a telemetry experience that helps an end user answer real questions
quickly, without needing to understand GNSS, IMU, or file formats.

## Approach

We will explore UX by moving from user intent to concrete screens and
interactions, using real looking (dummy) data to validate the flow.

## Step 1: Start from the user’s questions (Jobs to be done)

We should capture the top questions a driver actually asks after a run.
Examples:

- How did my best lap happen, what changed?
- Where am I losing time vs my best lap?
- Was I consistent, or did one corner ruin the lap?
- Am I braking too early or too late?
- Are jumps costing me time, am I landing unsettled?
- Did the car push or oversteer, and where?
- Did the session degrade over time (battery fade, tyres, temperature)?
- Is my line different between laps, where?
- Did the telemetry quality degrade (GNSS dropouts, sensor noise)?
- Did the driver crash or require marshalling?
- Did the driver perform a pit stop? (Nitro only, not electric)

Deliverable from this step:

- A prioritised list of user questions, ranked by value.

## Step 2: Define the core analysis views

We will define a small set of views that cover most questions.

Recommended baseline views:

1. Session Overview

- Map of the run
- Lap list with best lap highlighted
- Simple quality indicator (GNSS quality, IMU mode)

2. Lap Compare

- Choose two laps (best vs current, or best vs average)
- Delta time plot across lap distance
- Overlay lines on track map

3. Segment and Corner Detail

- Auto detected corners and straights
- Metrics per segment: entry speed, min speed, exit speed, time lost

4. Events View

- Braking events, jumps, impacts
- Timeline and map markers

5. Consistency View

- Lap time distribution
- Variance by segment
- Heatmap style overlay for where the user is inconsistent

Deliverable from this step:

- A wireframe level outline of these views and how a user navigates between
  them.

## Step 3: Define the interaction model

We should decide how users explore data without pain.

Core interactions to validate:

- Selecting laps and segments
- Scrubbing a timeline and seeing a cursor on the map
- Zooming a map and automatically downsampling charts
- Switching between metrics with a simple control, not a complex tool
- One click "Compare to best lap"
- Sharing or exporting a session snapshot

Deliverable from this step:

- A clickable prototype plan (even if first pass is static screens).

## Step 4: Choose a consistent vocabulary and UI language

Users should not see internal terms like PVT, EKF, RINEX.

Instead:

- "GPS data quality"
- "Motion sensor quality"
- "Heading source: GPS or compass"
- "High precision mode available" if raw observations exist

Deliverable from this step:

- A short UX copy guide for labels, tooltips, and error messages.

## Step 5: Use dummy data to test realism early

We will seed the app with representative data that includes:

- Clean data session
- Noisy GNSS session
- 3 axis only session
- 6 axis session
- 9 axis with magnetometer interference session
- A session with GNSS dropouts
- A session with jumps and impacts
- A session with inconsistent driving

This lets us validate:

- The UI still works when data is missing
- The quality indicators make sense
- The charts are useful and not misleading

Deliverable from this step:

- A dummy data pack and a repeatable seeding workflow.

## Step 6: Define “quality and trust” behaviours

Telemetry UX fails if users do not trust it.

We should define:

- When MRE shows warnings
- When MRE hides a metric because it is not valid
- Confidence bands or simple confidence labels
- How we explain missing sensors or degraded quality

Deliverable from this step:

- A rules list for trust and quality.

## Step 7: Run short design sprints

Each sprint produces:

- One end to end flow
- Realistic dummy data for that flow
- A working UI slice or prototype

Suggested sprint order:

1. Session Overview plus Lap list
2. Best lap compare with delta time
3. Segment and corner breakdown
4. Events and jump detection
5. Consistency heatmaps and trend over session

## What this document is

This is not a user story. It is a UX discovery and design plan.

- A user story is a single requirement written from the user’s perspective with
  acceptance criteria.
- This document describes how we will discover, prioritise, and design the end
  user experience, including the deliverables at each step.

## Questions to answer now (to steer the UX direction)

1. Who is the first target user: casual club racer, serious competitor, or race
   director?
2. What devices will they most commonly use in the first release: RaceBox style
   logs, hobby GPS modules, or pro GNSS raw obs?
3. What is the single most valuable insight MRE must deliver in the first 30
   seconds after upload?
4. Do users care more about lap time improvement or car setup diagnosis, or
   both?
5. Will users typically analyse on a phone trackside, or on a desktop later?

## Answers (Decided)

These answers steer the UX direction. See `Telemetry_Ux_Blueprint.md` for the
concrete UX plan that implements them.

1. **Target user:** Serious club racer. Someone who already races regularly and
   wants to improve lap times and diagnose car behaviour.
2. **Devices:** Device-agnostic. We care about capability (GNSS PVT, 3/6/9 axis
   IMU), not hardware brand. RaceBox-style logs and hobby GPS modules are
   expected; pro GNSS raw obs may come later.
3. **30-second insight:** Where time was lost vs best lap, and the top 1–3
   places to focus. The Session Overview and Lap Compare views must answer this
   within 30 seconds of opening a processed session.
4. **Lap time vs setup:** Both. Lap time improvement is the primary outcome;
   car setup diagnosis (push, oversteer, braking, jumps) is high value when
   sensor capability supports it.
5. **Phone vs desktop:** Desktop. Analysis happens on desktop later, not
   trackside on a phone. A separate native mobile app is planned for a future
   release.

**Note on "30 seconds":** The clock starts when the user opens a *processed*
session (status = ready). Processing time (upload → parse → canonicalise →
derive) is excluded. The Session Overview must load and surface top insights in
under 30 seconds of page load.
