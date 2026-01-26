# MRE Telemetry Module v2 (RTK GNSS + Corrections)

Author: Jayson Brenton
Date: 2026-01-25
Purpose: End-to-end design for an RTK-capable telemetry module for RC cars that targets 10 cm class positioning (and often better) without you operating your own base station, including correction options, hardware, wiring, enclosure and cooling, and the full data ingestion pipeline into MRE.
License: Internal project document, reuse permitted within MRE.

---

## 1. What we are building

A compact, car-ready telemetry module that provides **high-precision GNSS** (centimetre to decimetre class in open sky) and streams telemetry into MRE.

This v2 solution upgrades v1 by replacing the M8 GPS with an **RTK-capable multi-band GNSS receiver** and adding a **correction path** so you can reach approximately **10 cm** (or better) without deploying your own base station.

The module is designed to mount inside:

* **1/8 electric buggy/truggy** (4S)
* **1/10 off-road electric** (2S)
* **1/8 nitro buggy/truggy**, including **1/8 nitro truggy** (receiver pack powering electronics)

You intend to 3D print a custom enclosure, so this document includes enclosure, heat, and airflow considerations.

**Where users see it.** Telemetry visualisation (racing line, speed profile, RTK state, quality overlays) is presented as a **submenu of My Telemetry** in the MRE dashboard. My Telemetry is the sidebar nav item at `/dashboard/my-telemetry`, labelled "My Telemetry" (Data sources & traces). All visualisation described in this document lives under that entry.

---

## 2. User story and acceptance criteria

### 2.1 Primary user story

As an RC racer using MRE, I want a small, robust telemetry module that captures high-precision GNSS positions while I drive, so that MRE can show an accurate racing line, speeds, and lap-to-lap comparisons with meaningful line deltas.

### 2.2 Secondary user stories

* As an RC racer, I want the module to work at tracks without me setting up a base station.
* As an RC racer, I want to choose between free, low-cost, and professional correction options.
* As an MRE developer, I want to store raw points plus GNSS quality indicators so I can detect bad data, filter it, and score confidence.

### 2.3 Acceptance criteria

Accuracy and stability:

* In open sky, the module can reach at least **10 cm class** horizontal accuracy when corrections are available and RTK is fixed for a meaningful portion of the run.
* The module remains stable under steering servo spikes, chassis vibration, and typical track dust.
* RTK state, correction age, and accuracy estimates are captured and visible in MRE via the **My Telemetry** submenu (`/dashboard/my-telemetry`, Data sources & traces).

Pipeline:

* Telemetry is associated with an MRE session.
* Telemetry is ingested in batches and stored as raw points.
* MRE can render the following in the **My Telemetry** visualisation submenu:

  * racing line polyline
  * speed profile
  * RTK status over time (fixed/float/single)
  * data quality overlays (dropouts, correction age, horizontal accuracy)

Operational:

* The enclosure keeps electronics within safe temperature ranges without relying on fragile airflow that ingests dust.

---

## 3. Architecture overview

### 3.1 High-level data flow

1. RTK GNSS receiver outputs high-rate position and quality data (UBX and or NMEA) to the FC (and or directly to a logger).
2. Corrections are delivered to the RTK GNSS receiver via one of:

   * NRTK via NTRIP over the internet
   * PPP-RTK correction service over the internet
   * PPP-RTK corrections via L-band satellite (where available for your region and hardware)
3. A collector reads the logged stream or live stream.
4. Collector converts points into MRE telemetry events.
5. Collector uploads batches to MRE.
6. MRE stores raw points and generates summaries.

### 3.2 Recommended split of responsibilities

* **RTK GNSS receiver** does positioning, resolves ambiguities, applies corrections, outputs the computed solution.
* **Corrections client** acquires RTCM or SSR corrections and feeds them into the receiver.
* **FC (T-Motor F722 V1.1)** acts as a robust serial hub and logger, and optionally forwards data.

This separation matters because the F722 is not an RTK engine, the GNSS receiver is.

---

## 4. Correction solutions, what they are, what they cost

This section focuses on solutions that avoid you running your own base station.

Important note on pricing:

* The figures below are **indicative ranges** seen in the market and should be validated for your region, provider, and requirements before purchase.

### 4.1 Network RTK (NRTK) via NTRIP

What it is:

* You connect your rover (your car) to a correction network over the internet.
* The network provides RTCM corrections derived from multiple fixed reference stations.
* Your rover receiver applies corrections and attempts RTK fixed.

What you need in the car:

* RTK GNSS receiver (for example u-blox ZED-F9P class)
* Internet connection (phone hotspot, or a small LTE modem)
* NTRIP client that can send RTCM to the GNSS receiver

Pros:

* Often the fastest time to RTK fixed and the most consistent centimetre performance in covered areas.
* Mature, widely supported RTCM workflows.

Cons:

* Needs cellular data coverage.
* Subscriptions vary by network and can be expensive.

Cost tiers, indicative:

* Entry self-service plans can be in the tens of dollars per month.
* Agriculture-oriented plans can be a few hundred dollars per year per device.
* Survey-grade offerings can range from hundreds to several thousand dollars per year depending on coverage and support.

Free and near-free options:

* Community casters such as **RTK2go**, quality varies widely.
* Limited free access via eligibility pathways (for example certain positioning programs).
* Free trials are common.

Practical take:

* NRTK is usually the best path to true centimetre tracking when you have coverage, but it introduces recurring cost and dependency on mobile data.

### 4.2 PPP-RTK correction services (subscription style)

PPP-RTK is a hybrid approach:

* Uses precise point positioning concepts plus RTK-style corrections.
* Often offers wide-area coverage.
* Usually delivered over IP, sometimes also via L-band satellite.

You can treat these services as:

* simpler to deploy than classic NTRIP networks in some areas
* a subscription per device or per fleet

#### 4.2.1 u-blox PointPerfect (PPP-RTK)

What it is:

* A PPP-RTK correction service designed to provide fast convergence and high precision where coverage exists.

Cost patterns, indicative:

* Often sold as monthly subscriptions.
* Some packaging models also offer usage-based or pooled plans, which can suit weekend racing.

Operational notes:

* Delivery methods and supported hardware can change over time.
* If you plan to rely on satellite delivery, confirm what is currently supported for your exact receiver and region.

Free options:

* Trials are common.

#### 4.2.2 Swift Navigation Skylark (NRTK and PPP-RTK)

What it is:

* Cloud-based high-precision service offered in different modes depending on region and integration.

Cost patterns, indicative:

* Commonly positioned as per-device monthly and or annual pricing.

Free options:

* Free trial.

#### 4.2.3 Trimble RTX (PPP-style corrections)

What it is:

* A family of correction services deliverable via internet or satellite.

Cost patterns, indicative:

* Often sold in tiers via channels.
* Higher-accuracy tiers can be priced in the high hundreds to low thousands per year per device.

Free options:

* Trials exist in some segments.

Practical take:

* PPP-RTK services can be excellent when you want wide-area coverage and simpler logistics, but convergence behaviour and regional performance can differ from classic NRTK.

### 4.3 SBAS augmentation (WAAS/EGNOS style)

What it is:

* Satellite-based augmentation that improves basic GNSS accuracy.

What it delivers:

* Typically improves metre-level positioning and stability.
* It generally does not reliably deliver 10 cm class accuracy for RC racing lines.

Why it still matters:

* It is effectively free once you have compatible hardware.
* It can be a fallback mode when corrections are unavailable.

---

## 5. Recommended approach for MRE v2

For RC racing, you want:

* fast convergence
* repeatable results
* minimal user pain

Recommended priority order:

1. **NRTK via NTRIP** when the track has reliable mobile coverage.
2. **PPP-RTK subscription** if you want simpler setup and broader coverage, and you accept different convergence behaviour.
3. **SBAS fallback** when no corrections are available.

MRE should record and display the mode and quality over time so users understand confidence; that visualisation appears in the **My Telemetry** submenu (Data sources & traces).

---

## 6. Hardware design

### 6.1 Core hardware, RTK capable

* **Flight Controller (aligned to your existing approach): T-Motor F722 V1.1**

  * Used as a serial hub and logger.

* **RTK GNSS receiver**

  * Recommended class: **u-blox ZED-F9P** (or equivalent multi-band RTK receiver).
  * Key requirements:

    * multi-band, L1 and L2 capable
    * RTCM input supported
    * UBX or equivalent binary output supported

* **Dual-band GNSS antenna**

  * Patch or helical antenna designed for L1 and L2.
  * Use a ground plane for patch antennas.

* **Clean 5.0V power rail**

  * 5.0V buck regulator sized with headroom.

### 6.2 Corrections transport hardware

You must get corrections into the GNSS receiver.

Choose one of:

A. Phone hotspot plus microcontroller NTRIP client

* Phone provides Wi-Fi hotspot.
* A small Wi-Fi capable MCU (for example ESP32 class) runs NTRIP client.
* MCU forwards RTCM to the GNSS receiver over UART.

B. Dedicated LTE modem

* Small LTE modem provides always-on internet.
* MCU or embedded host runs NTRIP client.

C. Service-specific delivery module

* Some PPP-RTK services can be integrated through vendor-specific modems or SDKs.

D. L-band receiver (where applicable)

* Adds complexity and cost.
* Useful if you want satellite delivery without mobile data.

### 6.3 Filtering and robustness components

* bulk capacitor 470µF to 1000µF low ESR at the FC input
* 0.1µF ceramic at the FC input
* 0.1µF ceramic at GNSS VCC
* optional ferrites on power leads

---

## 7. Powering the module across classes

The design goal is one repeatable power architecture:

* A dedicated **5.0V buck regulator** powers the RTK GNSS receiver and the FC.
* Receiver and servo can remain on their existing rail.

### 7.1 1/8 electric buggy/truggy (4S)

* Tap main pack voltage and feed a 5.0V buck regulator.
* Power FC and GNSS from that 5.0V.
* Keep ESC BEC powering receiver and servo.

### 7.2 1/10 off-road electric (2S)

* Same pattern, 2S input spec is easier.

### 7.3 1/8 nitro buggy/truggy, including 1/8 nitro truggy

* Receiver pack powers receiver and servo.
* Receiver pack feeds a 5.0V buck regulator dedicated to FC plus GNSS.
* If you run a high-torque servo and see resets, use dual rails.

---

## 8. Wiring diagrams

This section shows the three essential wiring groups:

* power
* GNSS to FC
* corrections into GNSS

### 8.1 Power wiring

```
Power Source (4S/2S/nitro receiver pack) -> 5.0V buck regulator -> FC 5V IN
                                                           |-> RTK GNSS VCC
Common GND ------------------------------------------------> FC GND
                                                           |-> RTK GNSS GND
Bulk capacitor across FC 5V IN and FC GND, close to FC
```

### 8.2 RTK GNSS to FC wiring

Use one FC UART for GNSS output.

```
RTK GNSS TX  ------------------>  FC RX (UART_GNSS)
RTK GNSS RX  <------------------  FC TX (UART_GNSS)   (optional, for config)
RTK GNSS VCC ------------------>  5.0V rail
RTK GNSS GND ------------------>  GND
```

### 8.3 Corrections wiring, NTRIP client to GNSS RTCM input

Use a second UART on the GNSS receiver if available (recommended), or the same UART if you can multiplex.

```
NTRIP client TX (RTCM out) ----> RTK GNSS RX2 (RTCM in)
NTRIP client RX (optional) <---- RTK GNSS TX2
Common GND --------------------> GND
```

If the FC must be in the middle:

```
NTRIP client TX ----> FC RX (UART_RTCM_IN)
FC TX (UART_RTCM_OUT) ----> RTK GNSS RX2
```

The simplest and most reliable is direct NTRIP client to GNSS.

---

## 9. Enclosure and thermal design

### 9.1 What creates heat in v2

Compared to v1, v2 can add heat from:

* RTK GNSS receiver (more processing than an M8)
* Corrections transport hardware (especially LTE modems)

An LTE modem can be the dominant heat source.

### 9.2 Cooling strategy

Use a staged approach:

1. Passive cooling first

   * Use a slightly larger enclosure volume than the PCB footprint.
   * Add vents that face away from dust spray.
   * Avoid fully sealing the enclosure unless necessary.

2. Conduction to a heat spreader

   * Embed a thin aluminium plate in the 3D print as a heat spreader.
   * Use thermal pads to couple the hottest component zones to the plate.

3. Manage LTE modem heat if present

   * Give the modem its own airflow path and internal clearance.
   * Keep it away from the GNSS receiver and antenna feed.

4. Fans, only if required

   * A fan is a last resort in a dusty RC environment.
   * If needed, use a small 5V fan, add mesh and a dust baffle, and ensure it can be cleaned.

### 9.3 RF and antenna placement

* Place the dual-band antenna as high as possible with a clear sky view.
* Keep it away from ESC, motor wires, and LTE antenna and modem.
* Avoid large carbon or metal obstructions above the antenna.
* Use a ground plane for patch antennas.

---

## 10. Data extraction and ingestion into MRE

The ingestion model remains the same as v1, but v2 adds more quality fields.

### 10.1 Session lifecycle

* Create a telemetry session in MRE.
* Capture GNSS points with quality metadata.
* Upload in batches.
* End session and compute summaries.

### 10.2 Telemetry schema, RTK enhanced

Suggested event type `gps_point` with RTK additions.

Core fields:

* `sessionId`
* `ts` (epoch ms)
* `lat`, `lon`, `alt_m`
* `speed_mps` (optional)
* `course_deg` (optional)

Quality fields:

* `fix_type` (none, 2d, 3d)
* `rtk_status` (single, float, fixed)
* `sats`
* `hdop` or `pdop`
* `hacc_m` and `vacc_m` if available
* `corr_age_s` (age of differential corrections)
* `corr_source` (ntrip, ppp_rtk_ip, ppp_rtk_lband, sbas, none)

Device fields:

* `deviceId`
* `firmwareVersion`

### 10.3 MRE endpoints

* `POST /api/v1/sessions`
* `POST /api/v1/telemetry` (batch append)
* `GET /api/v1/sessions/:id/telemetry`
* `GET /api/v1/sessions/:id/summary`

### 10.4 What MRE should visualise for RTK

All of the following visualisation is presented as a **submenu of My Telemetry** (`/dashboard/my-telemetry`, Data sources & traces) in the dashboard sidebar:

* A timeline strip of RTK state (fixed vs float vs single)
* Colour overlays on the path based on `rtk_status` and `hacc_m`
* A warnings panel:

  * time in fixed
  * longest dropout
  * average correction age

---

## 11. Subscription and cost model, detailed

This section is intentionally explicit so you can plan operating cost.

### 11.1 Cost buckets

A. Free or near-free

* Community NTRIP casters like RTK2go
* Eligibility-based access via government positioning programs
* Free trials from commercial services

B. Hobbyist and prosumer

* Monthly plans in the tens of dollars per device
* Annual plans in the low hundreds per device

C. Professional and survey grade

* Annual plans in the high hundreds to several thousand per device
* Often sold via resellers with support, SLAs, and premium network features

### 11.2 NRTK via NTRIP, indicative examples

Examples that appear in the market:

* Entry self-service plans can be around $40 per month in some regions.
* Some regional plans can be a few hundred dollars per year per device.
* Some national plans can be a few hundred dollars per year per device.
* Survey-grade networks can range higher depending on reseller, features, and coverage.

Free NTRIP options:

* RTK2go style community mountpoints, quality and proximity vary.
* Some networks provide limited free access via specific programs, research, education, or partner access.

Operational note:

* These prices typically assume you already have mobile internet coverage and a data plan.

### 11.3 PPP-RTK subscription services, indicative examples

Swift Navigation Skylark:

* Common public references include per-device monthly pricing and per-device annual pricing.

u-blox PointPerfect:

* Common public references include monthly subscriptions, plus some pooled or usage-based options.

Trimble RTX:

* Often sold in tiers through channels.
* Higher-accuracy tiers are often priced in the high hundreds to low thousands per year per device.

Free options:

* Free trials are common.

### 11.4 Hidden costs you should plan for

* Mobile data.
* Extra hardware for corrections transport (LTE modem, SIM, antennas).
* Operational time cost, credentials, configuration, troubleshooting.

---

## 12. Implementation blueprint

### 12.1 Build phases

Phase 1, bench RTK fixed

* Wire RTK GNSS and confirm clean power.
* Feed corrections from a known-good source.
* Confirm RTK fixed state and stable `hacc_m`.

Phase 2, stationary outdoor test

* Put the module outside with antenna on a ground plane.
* Record 10 minutes.
* Validate correction age and RTK state stability.

Phase 3, vehicle installation

* Install in chassis.
* Validate no resets during steering.
* Validate antenna placement.

Phase 4, MRE ingestion and visualisation

* Upload and store points.
* Build RTK state timeline and quality overlays, surfaced in the **My Telemetry** visualisation submenu (`/dashboard/my-telemetry`).

### 12.2 Configuration checklist

* GNSS output protocol chosen, UBX recommended for richer quality fields.
* GNSS output rate set, 5Hz to 10Hz.
* RTCM input enabled and mapped to the correct UART.
* Correction credentials stored securely on the client device.

---

## 13. Risks and mitigations

* Corrections unavailable at a track, mitigate with fallback to SBAS or standalone.
* Mobile coverage poor, mitigate with a different provider or PPP-RTK options.
* Thermal soak if LTE modem used, mitigate with conduction plate and venting.
* EMI affects fix stability, mitigate with antenna placement, ferrites, and wiring discipline.

---

## 14. What this enables in MRE

With RTK fields captured, MRE can support the following; all are accessed via the **My Telemetry** submenu (Data sources & traces) in the dashboard:

* accurate racing line deltas
* turn-in consistency maps
* braking point dispersion
* segment-by-segment comparison
* confidence scoring based on time-in-fixed and horizontal accuracy
