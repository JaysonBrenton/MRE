# MRE Telemetry Module v1 (T-Motor F722 V1.1 + M8-class GPS)

Author: Jayson Brenton
Date: 2026-01-25
Purpose: End-to-end design for a first telemetry capture solution using an existing drone flight controller (T-Motor F722 V1.1) and a non-RTK GPS module from your current inventory, including user story, hardware, power, wiring, enclosure and cooling, data extraction, and ingestion into MRE.
License: Internal project document, reuse permitted within MRE.

---

## 1. What we are building

A compact, car-ready **Telemetry Module** that mounts inside a 1/8 buggy or truggy (and can also be used in 1/10 off-road) and streams **GPS-derived telemetry** into MRE.

This v1 solution uses:

* **T-Motor F722 V1.1** flight controller (FC) as the telemetry hub
* One of your existing **u-blox M8-class** drone GPS units (Matek SAM-M8, TBS M8-2, VIFLY GPS Mate v2.3)

The key goal of v1 is not centimetre accuracy, it is to prove:

* power stability in a noisy RC environment
* reliable GPS capture in a chassis
* a repeatable “collect, store, view” pipeline into MRE

This v1 solution creates the foundation for a later v2 RTK GNSS build.

**Where users see it.** Telemetry visualisation (path polyline, speed profile, data quality indicators) is presented as a **submenu of My Telemetry** in the MRE dashboard. My Telemetry is the sidebar nav item at `/dashboard/my-telemetry`, labelled "My Telemetry" (Data sources & traces). All visualisation described in this document lives under that entry.

---

## 2. User story and acceptance criteria

### 2.1 Primary user story

As an RC racer using MRE, I want to install a small telemetry module in my car that collects GPS positions and timestamps during a run, so that MRE can show my path, speed profile, and basic lap or segment analytics.

### 2.2 Secondary user stories

* As an RC racer, I want the module to be easily removable and rechargeable or re-powerable, so I can move it between cars.
* As an RC racer, I want the module to survive heat, vibration, and dust, so it works trackside with minimal fuss.
* As an MRE developer, I want telemetry data to arrive in a consistent schema, with traceable session IDs, so I can store raw points and derive metrics later.

### 2.3 Acceptance criteria

Hardware and capture:

* The module can be powered reliably in 1/8 electric (4S), 1/10 electric (2S), and 1/8 nitro (receiver pack).
* GPS is acquired and outputs valid sentences continuously at a configured rate (for example 5Hz or 10Hz).
* FC does not reboot when steering servo loads spike.

Data pipeline:

* Telemetry is associated with an MRE session ID.
* Telemetry is ingested into MRE as raw points.
* MRE can display the following in the **My Telemetry** visualisation submenu: path polyline, speed over time, and basic data quality indicators.

Enclosure:

* FC temperature remains within safe operating range.
* Enclosure withstands vibration and dust, and offers simple access to USB and or SD card.

---

## 3. System architecture overview

### 3.1 High-level data flow

1. GPS module produces GNSS data over UART into the FC.
2. FC logs or forwards the GPS data.
3. A collector process obtains the data from the FC (live or post-run).
4. Collector transforms data into MRE telemetry events.
5. Collector posts batches to MRE API endpoints.
6. MRE stores raw telemetry and computes derived summaries.

### 3.2 Two operating modes

This v1 design supports two practical modes.

Mode A, post-run log import (lowest risk for first pass):

* FC logs GPS during a run
* You download the log after the run
* Import into MRE

Mode B, live streaming (higher complexity, optional):

* FC feeds GPS to a companion device (for example a phone or small Wi-Fi module)
* Companion streams to MRE during the run

Recommendation for v1:

* Start with **Mode A** to prove capture quality and storage.
* Add **Mode B** once the schema and reliability are solid.

---

## 4. Hardware bill of materials

### 4.1 Mandatory components

* **T-Motor F722 V1.1** flight controller
* **One M8-class GPS module** (Matek SAM-M8, TBS M8-2, or VIFLY GPS Mate)
* **5.0V buck regulator** for powering the FC in RC car environments, sized for your class:

  * Input rating to match your supply:

    * 4S electric: up to 16.8V
    * 2S electric: up to 8.4V
    * Nitro receiver pack: up to 8.4V
  * Output: 5.0V
  * Current: target 2A to 3A minimum for headroom
* **Bulk capacitor** (low ESR electrolytic): 470µF to 1000µF across FC 5V and GND
* **Ceramic decoupling capacitors**: 0.1µF at FC power input, 0.1µF at GPS VCC
* Wiring and connectors appropriate to your mounting plan

### 4.2 Optional, recommended components

* **Ferrite bead or clamp-on ferrite** on the FC power lead
* **MicroSD card** if your FC supports logging to SD
* **Heatsinks** for FC processor/regulator zones
* **Small fan** (only if your enclosure is sealed and thermal testing indicates it is needed)

---

## 5. Power design for all classes

### 5.1 Key principle

Power the FC and GPS from a **stable, clean 5.0V rail** that is not dragged down by steering servo current spikes.

### 5.2 Electric 1/8 (4S) and 1/10 (2S)

Recommended powering:

* Feed battery voltage into a **5.0V buck regulator**
* Use the regulator’s 5.0V output for FC + GPS
* Leave receiver and servo powered by ESC BEC as normal

Why:

* steering servo spikes commonly cause BEC dips
* isolating FC rail improves uptime and GPS continuity

### 5.3 Nitro 1/8 (receiver pack)

Recommended powering:

* Receiver pack continues to power receiver and servo
* Receiver pack also feeds a **5.0V buck regulator** dedicated to FC + GPS

If servo is HV and you are using higher pack voltages:

* consider dual-regulator rails (servo rail separate from FC rail)

---

## 6. Wiring and integration

### 6.1 GPS to FC wiring

Use a UART on the FC.

* GPS TX -> FC RX (UARTx)
* GPS RX -> FC TX (UARTx) (recommended)
* GPS VCC -> FC 5V output rail
* GPS GND -> FC GND

Generic wiring diagram:

```
GPS TX  ------------------>  FC RX (UARTx)
GPS RX  <------------------  FC TX (UARTx)
GPS VCC ------------------>  FC 5V
GPS GND ------------------>  FC GND
```

### 6.2 FC power wiring

* 5.0V regulator OUT -> FC 5V IN
* 5.0V regulator GND -> FC GND
* Bulk capacitor across FC 5V and FC GND at the FC pads

Generic wiring diagram:

```
Power source (pack or VBAT tap) -> 5.0V Buck Regulator -> FC 5V IN
Common GND -------------------------------------------> FC GND
Bulk cap across FC 5V IN and FC GND (close to FC)
```

### 6.3 Notes on pad selection

Drone FCs often have multiple 5V pads. Some are outputs only. Some are input capable.

Implementation rule:

* Use the FC documentation or silkscreen guidance to identify the **5V input-capable** pad.
* If uncertain, treat 5V pads as power distribution but ensure you are not back-feeding a regulator output.

---

## 7. FC configuration for GPS capture

### 7.1 GPS protocol choices

M8 GPS modules typically output:

* **NMEA sentences** by default
* optionally u-blox **UBX** binary

For v1, use NMEA because it is easy to parse and validate.

### 7.2 Update rate

Targets:

* Minimum viable: 5Hz
* Better for RC motion: 10Hz if stable

Higher update rates increase noise and bandwidth, but help with short high-speed segments.

### 7.3 Data quality fields to capture

From NMEA you should capture:

* timestamp (UTC)
* latitude, longitude
* altitude (if available)
* ground speed
* course/heading
* fix type and quality
* satellites used
* HDOP or similar

These fields let MRE show data quality and detect bad segments.

---

## 8. Enclosure and cooling design

### 8.1 Constraints

* 1/8 buggy/truggy chassis: dust, vibration, limited airflow under body
* ambient heat: motor/ESC heat soak (electric), engine heat and radiant exhaust heat (nitro)
* FC heat sources: MCU, onboard regulators, sometimes OSD or SD circuits

### 8.2 Cooling strategy, default

The FC generally does not dissipate huge power in this use case, but it can heat soak inside a small sealed enclosure.

Recommended approach for v1:

1. **Passive cooling first**

   * Use a slightly larger enclosure volume than the bare FC footprint.
   * Add internal air space around the FC.
   * Use ventilation slots that face away from direct dust spray.
   * Add a small heatsink on the MCU area if there is a flat surface.

2. **Thermal conduction to the enclosure**

   * Use a thin thermal pad or thermal tape between FC heatsink and an internal metal plate.
   * If your 3D print allows it, embed a thin aluminium plate as a heat spreader.

3. **Airflow management**

   * Prefer venting that allows convective flow.
   * Use labyrinth-style vents or angled slots to reduce dust ingestion.

### 8.3 When to use a fan

A fan is not the first choice in an RC car because:

* it can ingest dust and fail
* it consumes power
* it adds another failure point

Use a fan only if:

* FC temperature is observed to rise to unstable levels during runtime
* the enclosure must be sealed due to environmental conditions

If you do use a fan:

* choose a small 5V fan
* mount it to blow across the FC heatsink
* protect it with a fine mesh and a dust baffle

### 8.4 Practical enclosure features

* Rubber isolation grommets or foam standoffs for vibration
* Strain relief for GPS cable and power cable
* Access port for USB without full disassembly
* Optional SD card access slot if logging to SD
* Raised internal standoffs to prevent the FC underside from shorting

### 8.5 Placement guidance

* Place the GPS antenna as high as possible under the body, away from ESC and motor leads.
* Place the FC away from the ESC and motor wires to reduce EMI.
* Avoid mounting next to the steering servo lead bundle if possible.

---

## 9. Getting the data out of the FC

This is the critical design choice that determines how painful v1 will be.

### 9.1 Option 1, FC logs GPS and you import after the run

Goal:

* reliable capture without live radio links

Mechanisms:

* If FC supports onboard logging to SD, log GPS stream or derived positions.
* Otherwise, log over USB after the run, if the FC retains data.

Pros:

* simplest first pass
* fewer moving parts

Cons:

* not live, requires import workflow

v1 recommendation:

* Start here.

### 9.2 Option 2, FC forwards GPS to a companion device

Mechanisms:

* FC sends GPS data out a UART to a companion.
* Companion can be:

  * small Wi-Fi microcontroller
  * phone tethered collector

Pros:

* enables live streaming

Cons:

* more wiring
* more code
* more points of failure

### 9.3 Option 3, FC itself runs a telemetry uplink

This is typically not practical unless you add a radio module and write custom firmware.

---

## 10. Data ingestion into MRE

### 10.1 Session creation and lifecycle

MRE needs a session boundary.

Suggested flow:

1. User creates a **Telemetry Session** in MRE before a run.
2. MRE returns a **sessionId** and an optional short token.
3. Telemetry points are uploaded tagged with sessionId.
4. User ends the session in MRE.
5. MRE computes summaries.

If using post-run import:

* session can be created at import time instead.

### 10.2 Telemetry event schema

Keep v1 schema simple, stable, and extensible.

Suggested event type:

* `gps_point`

  * `sessionId`: string
  * `ts`: epoch ms (or ISO8601), but choose one and stick to it
  * `lat`: float
  * `lon`: float
  * `alt_m`: float, optional
  * `speed_mps`: float, optional
  * `course_deg`: float, optional
  * `fix_quality`: int or string (none, 2d, 3d, dgps)
  * `sats`: int
  * `hdop`: float, optional
  * `source`: string, for example `m8_nmea`

Optional metadata:

* `deviceId`: stable identifier for the physical telemetry module
* `firmwareVersion`: to debug changes

### 10.3 API endpoints

A minimal set for v1:

* `POST /api/v1/sessions` creates a session
* `POST /api/v1/telemetry` appends telemetry points
* `GET /api/v1/sessions/:id/telemetry` lists points
* `GET /api/v1/sessions/:id/summary` returns derived stats

Telemetry append endpoint should accept batches:

* `points: gps_point[]`

### 10.4 Storage strategy

Store raw points in a table keyed by sessionId and timestamp.

Derived tables:

* session summaries
* optional downsampled polylines

Retention:

* raw points can be pruned if needed, but for early builds keep them.

### 10.5 Import workflow (Mode A)

1. Download the FC log.
2. Parse NMEA sentences to gps_point events.
3. Map timestamps to epoch.
4. Upload points to MRE.
5. MRE displays run path in the **My Telemetry** visualisation submenu (`/dashboard/my-telemetry`).

### 10.6 Live workflow (Mode B)

1. Start session in MRE.
2. Companion starts streaming.
3. Companion posts points in small batches (for example every 1 to 2 seconds).
4. MRE updates path and speed plot in the **My Telemetry** visualisation submenu (`/dashboard/my-telemetry`).

---

## 11. Collector implementation plan

The collector is the bridge between FC logs and MRE.

### 11.1 v1 collector responsibilities

* Read NMEA from a file or serial stream
* Extract GPS fields
* Validate points
* Convert to MRE schema
* Batch upload to MRE

### 11.2 Validation rules

* Reject points with no fix
* Reject impossible jumps if timestamp delta is tiny
* Record dropouts as quality metrics

### 11.3 Batching

* Batch size: 50 to 200 points per request
* Flush interval: 1 to 2 seconds for live mode

---

## 12. Data quality expectations for M8 GPS in RC cars

This is important to set expectations.

* You should expect **metre-level** accuracy.
* Track line will be noisy.
* Speed estimates may be reasonable once smoothed.

This is still valuable for:

* proving the pipeline
* validating session lifecycle
* comparing relative runs
* validating that later RTK is worth it

---

## 13. Risks and mitigations

### 13.1 Brownouts and resets

Risk:

* steering servo spikes cause rail sag

Mitigations:

* dedicated 5.0V regulator for FC
* bulk capacitor at FC
* separate FC rail from servo rail

### 13.2 EMI affecting GPS

Risk:

* motor/ESC noise reduces fix quality

Mitigations:

* antenna placement away from ESC/motor leads
* ferrites on power and signal
* clean 5V rail

### 13.3 Thermal soak in sealed enclosure

Risk:

* FC runs hot inside sealed print

Mitigations:

* passive vents
* heat spreader plate
* heatsink
* fan only if needed

---

## 14. Implementation checklist

Hardware:

* Select the GPS module from your existing M8 units
* Select a 5.0V buck regulator rated for your class
* Add bulk capacitor at FC
* Wire GPS to FC UART
* Bench test GPS fix and update rate

Enclosure:

* design mounts, strain relief, venting
* include USB access
* include heatsink clearance

Software:

* implement MRE session creation
* implement telemetry append endpoint
* implement collector parser and uploader
* implement basic path and speed UI in the **My Telemetry** visualisation submenu (`/dashboard/my-telemetry`)

---
