# Powering a Drone Flight Controller (T-Motor F722 V1.1) in RC Cars

Author: Jayson Brenton
Date: 2026-01-25
Purpose: Describe power requirements, hardware options, and wiring diagrams for powering a drone flight controller (FC) and GPS in RC car platforms, across the common classes discussed.
License: Internal project document, reuse permitted within MRE.

---

## 1. Scope and assumptions

This document covers powering a **T-Motor F722 V1.1** flight controller (FC) used as a telemetry hub, plus a **GPS module powered from the FC**, across:

* **1/8 scale electric** buggy/truggy using a **4S** main pack
* **1/8 scale nitro** using a **dedicated receiver pack** for electronics
* **1/10 scale off-road electric** using a **2S** main pack

The goal is stable power for:

* FC (telemetry hub)
* GPS module (powered from FC)
* Optional: receiver (RX) powered from the same rail or separate rail

Assumptions:

* GPS connects to an FC UART.
* FC is not used for flight, it is used for serial data capture, logging, and forwarding.
* You will confirm the exact pad labels and voltage limits from the FC manual for your specific board revision.

---

## 2. Non-negotiable rules

### 2.1 Do not power anything from RX/TX signal pins

* RX and TX pins are **data lines only**.
* Some FC connectors bundle **5V + GND + RX + TX** and it can look like “power on RX/TX”, but power is still from **5V and GND** pins.

### 2.2 Power the FC using a power input rail

Depending on the FC design, you power it via either:

* **5V + GND** pads (regulated 5.0V input), or
* **VBAT/BAT/B+ + GND** pads (wide input battery voltage), **only if supported by your FC**.

### 2.3 RC cars are electrically noisy

Steering servos and ESCs create dips and spikes. GPS is sensitive to brownouts.

Minimum recommended filtering at the FC input:

* **470µF to 1000µF** low ESR electrolytic across FC 5V and GND, mounted close to the FC
* **0.1µF** ceramic across FC 5V and GND, close to the FC power pins

Minimum recommended filtering at the GPS power pins:

* **0.1µF** ceramic across GPS VCC and GND
* Optional: **47µF to 220µF** low ESR electrolytic across GPS VCC and GND

### 2.4 Grounding matters

* Always share a **common ground** between FC, receiver, ESC, and regulators.
* Keep FC power and ground runs short, twist the pair if practical.

---

## 3. Power requirements overview

### 3.1 Flight controller power (typical)

Most drone FCs run internal electronics at 3.3V but accept either:

* **5V regulated** input on 5V pads, or
* **VBAT** input on BAT/VBAT pads if the board includes onboard regulators.

Important:

* A pad labelled **5V** almost always expects a **regulated 5.0V**, not 6.0V/6.6V/7.4V, unless the FC manual explicitly says it is allowed.

### 3.2 GPS module power (typical)

Most drone GPS modules:

* Accept **5V** on VCC and regulate internally to 3.3V
* Use **3.3V UART logic** on TX/RX

Plan:

* Power GPS from FC, usually from **FC 5V OUT**.

---

## 4. Hardware building blocks

### 4.1 Power sources

* **ESC BEC** (common in electric cars)
* **Receiver pack** (common in nitro)
* **Standalone regulator/BEC** (recommended when voltage is above 5V or noise is severe)

### 4.2 Regulator types

* **Switching buck regulator to 5.0V**: best efficiency, best for 6V to 16.8V inputs
* **Linear LDO to 5.0V**: simple but wastes heat at higher input voltages

### 4.3 Filtering components

* Bulk capacitor: **470µF to 1000µF** low ESR electrolytic at FC input
* Ceramic decoupler: **0.1µF** at FC input
* Optional: ferrite bead in series with FC 5V input if noise remains problematic

---

## 5. Solutions by class

### 5.1 1/8 Electric (4S main pack)

#### Typical platform power

* Main pack: **4S LiPo** (nominal 14.8V, full 16.8V)
* ESC provides **BEC** to power RX and servo, often **5V to 7.4V** depending on ESC settings

#### Solution A, power FC from ESC BEC 5V rail

Use this only if the ESC BEC output is a true **regulated 5.0V** rail.

Pros:

* Simple
* No extra regulators

Cons:

* Servo load can cause dips and noise
* Some BEC rails are 6.0V or 7.4V and are not safe for 5V-only FC inputs

Wiring diagram:

```
[4S LiPo] -> [ESC]
               |
               +-- BEC 5V -----> [Receiver VCC]
               |                  [Receiver GND]
               |
               +-- BEC 5V -----> [FC 5V IN]
                                  [FC GND]

Servo power comes from receiver rail
```

Add:

* 470µF to 1000µF across FC 5V IN and GND

#### Solution B, dedicated 5V regulator fed by the main pack

Add a buck regulator rated for 4S input and required current, then power FC and GPS from it.

Pros:

* Cleaner, more stable rail
* Isolates FC and GPS from steering servo spikes

Cons:

* Extra hardware

Wiring diagram:

```
[4S LiPo] -----> [Buck Regulator 5.0V] -----> [FC 5V IN]
     |                   |                        |
     |                   +------------------------+-- GND
     |
     +-----> [ESC] -> motor
     |
     +-----> [ESC BEC] -> Receiver + Servo
```

#### Solution C, power FC via VBAT/BAT pads from main pack

Use only if your FC manual confirms VBAT input supports 4S and the board is designed for it.

Pros:

* Minimal external regulators

Cons:

* Must confirm VBAT range and that the board’s regulators stay stable under load

Wiring diagram:

```
[4S LiPo] -----> [FC VBAT/BAT IN]
     |
     +-----> [ESC] -> motor

[FC 5V OUT] -----> GPS VCC
[FC GND] ---------> GPS GND
```

---

### 5.2 1/10 Off-Road Electric (2S main pack)

#### Typical platform power

* Main pack: **2S LiPo** (nominal 7.4V, full 8.4V)
* ESC provides **BEC** output, often 5V to 6V

The same solutions apply as 1/8 electric, just with lower battery voltage.

#### Solution A, power FC from ESC BEC 5V rail

Use only if BEC output is **regulated 5.0V**.

Wiring diagram:

```
[2S LiPo] -> [ESC]
               |
               +-- BEC 5V -----> [Receiver VCC]
               |                  [Receiver GND]
               |
               +-- BEC 5V -----> [FC 5V IN]
                                  [FC GND]
```

#### Solution B, dedicated 5V regulator fed by the main pack

Pros and cons same as 4S, but regulator spec is easier.

Wiring diagram:

```
[2S LiPo] -----> [Buck Regulator 5.0V] -----> [FC 5V IN]
     |                   |                        |
     |                   +------------------------+-- GND
     |
     +-----> [ESC] -> motor
     |
     +-----> [ESC BEC] -> Receiver + Servo
```

#### Solution C, power FC via VBAT/BAT pads from main pack

Use only if the FC supports 2S VBAT input and produces stable regulated rails.

Wiring diagram:

```
[2S LiPo] -----> [FC VBAT/BAT IN]

[FC 5V OUT] -----> GPS VCC
```

---

### 5.3 1/8 Nitro (dedicated receiver pack)

#### Typical platform power

Nitro cars commonly run a receiver pack such as:

* **5-cell NiMH** receiver pack, nominal **6.0V**
* **2S LiFe** receiver pack, nominal **6.6V**
* Sometimes **2S LiPo** receiver pack, nominal **7.4V** (often requires regulation, and receiver/servo voltage ratings must be checked)

For powering an FC that expects 5V input, assume you need regulation unless your FC has a confirmed wide-input VBAT pad.

#### Solution A, receiver pack -> 5V regulator -> FC 5V input

Recommended default for nitro.

Pros:

* Clean stable 5V rail
* Reduces brownouts during heavy steering loads

Cons:

* Extra regulator

Wiring diagram:

```
[Receiver Pack 6.0V / 6.6V / 7.4V]
          |
          +-----> [Receiver + Servo] (direct if voltage compatible)
          |
          +-----> [Buck Regulator 5.0V] -----> [FC 5V IN]
                         |                        |
                         +------------------------+-- GND
```

#### Solution B, receiver pack -> FC VBAT/BAT input

Only if FC supports the input voltage range and the onboard regulation is stable.

Pros:

* Minimal extra hardware

Cons:

* Must confirm VBAT range and behaviour under servo load

Wiring diagram:

```
[Receiver Pack]
     |
     +-----> [Receiver + Servo]
     |
     +-----> [FC VBAT/BAT IN]
```

#### Solution C, dual-regulator approach for maximum reliability

Separate rails:

* One rail for receiver and steering servo (6.0V or 7.4V if supported)
* One rail for FC and GPS (5.0V)

Pros:

* Best stability under steering load
* Best protection for FC and GPS

Cons:

* More wiring and hardware

Wiring diagram:

```
[Receiver Pack]
     |
     +-----> [Regulator A 6.0V or 7.4V] -----> [Receiver + Servo]
     |
     +-----> [Regulator B 5.0V] -----------> [FC 5V IN]
                                               |
                                               +--> [GPS VCC]
```

---

## 6. GPS wiring to the FC

### 6.1 UART wiring

* GPS TX -> FC RX on chosen UART
* GPS RX -> FC TX on chosen UART (recommended for configuration)
* GPS VCC -> FC 5V OUT (or FC 3.3V OUT if GPS is truly 3.3V-only and the rail supports the current)
* GPS GND -> FC GND

Diagram:

```
[FC UART]
  TX  ------------------>  GPS RX
  RX  <------------------  GPS TX
  5V  ------------------>  GPS VCC
 GND  ------------------>  GPS GND
```

### 6.2 UART voltage compatibility

* GPS UART TX/RX is typically **3.3V logic**, which matches the FC.
* If you add an external “reader” board later, ensure its TX does not drive 5V into GPS RX.

---

## 7. Recommended defaults for MRE prototyping

If you want one approach that works across all classes with minimal surprises:

1. Use a **dedicated clean 5.0V buck regulator** to power **FC + GPS**.
2. Keep **steering servo** on the existing receiver rail, unless brownouts occur.
3. Add a bulk capacitor at FC input, at least **470µF**, preferably **1000µF** low ESR.
4. Use a short twisted pair for FC power and ground.
5. Mount GPS away from ESC and motor leads.

---

## 8. Troubleshooting checklist

Common symptoms and causes:

* FC reboots when steering: servo current spike causing voltage sag, separate FC rail, add bulk capacitance
* GPS fix drops or gets erratic: power noise, poor antenna placement, EMI from ESC, add filtering and relocate
* No GPS data: UART TX/RX swapped, wrong UART configured, wrong baud rate, missing common ground

Debug tools:

* Multimeter to confirm voltage at FC pads under steering load
* Optional inline voltage logger to detect dips
* FC LED behaviour to confirm resets

---

## 9. Next step, board-specific pad mapping

To finalise exact wiring for the **T-Motor F722 V1.1**, map these from the board manual or photo:

* Which pads are **5V input**, **5V output**, **GND**
* Whether there is **VBAT/BAT input**, and its supported voltage range
* Which **UART pads** to use for GPS

Once you have a pinout image or manual, create a board-accurate wiring plan for:

* 1/8 electric 4S
* 1/8 nitro receiver pack
* 1/10 electric 2S

Include exact pad names, exact UART selection, and recommended regulator placement.

10. Hardware required

This section lists the practical hardware you will need to power the FC reliably across all classes, and to connect GPS for telemetry.

10.1 Core electronics

Flight Controller (FC): T-Motor F722 V1.1

Mounted in the chassis, used as the telemetry hub.

Must be powered from either regulated 5.0V pads, or VBAT pads if supported.

GPS module (UART GNSS)

Drone-style GNSS module with UART output (NMEA and/or UBX).

Ideally supports 5V VCC input and 3.3V UART logic.

RC receiver (RX)

Standard car receiver providing the control signal path.

Its power rail also typically powers the steering servo.

Steering servo

Main source of transient current spikes on the electronics rail.

ESC

Electric classes: provides motor drive and often includes a BEC for electronics.

Receiver pack (nitro only)

One of:

5-cell NiMH 6.0V

2S LiFe 6.6V

2S LiPo 7.4V

10.2 Power conversion and conditioning

You do not always need every item below, but these are the building blocks for stable FC power.

Buck regulator, 5.0V output

Recommended default for powering FC and GPS in all classes.

Must be rated for the input voltage of the class:

1/8 electric 4S: input up to 16.8V

1/10 electric 2S: input up to 8.4V

1/8 nitro: input depends on receiver pack, typically up to 8.4V

Choose a current rating with headroom, typical target 2A to 3A minimum for FC plus GPS margin.

Optional second regulator rail for nitro and high-power servos

Used when you want to isolate FC and GPS from servo spikes.

Either:

Regulator A set to a servo-safe voltage for receiver plus servo, commonly 6.0V, or 7.4V if the servo supports HV

Regulator B fixed 5.0V for FC plus GPS

Bulk capacitor, low ESR electrolytic

470µF to 1000µF across FC 5V and GND, mounted close to the FC.

Mitigates dips from servo spikes.

Ceramic decoupling capacitors

0.1µF across FC power input.

0.1µF across GPS VCC and GND.

Optional ferrite bead or clamp-on ferrite

Used on the FC power lead if you see persistent noise issues.

Optional TVS diode (transient suppression)

For harsh environments, can protect the 5V rail from spikes.

10.3 Wiring, connectors, and mounting

Wire (silicone insulated preferred)

Power: 22AWG to 20AWG depending on length and current.

Signal: 26AWG to 30AWG is fine for UART.

Connectors and terminals

JST-SH or JST-GH style (common in drone ecosystems) for GPS harnesses.

Servo plugs for tapping receiver rails.

Heatshrink, solder, and strain relief.

Ground plane for GPS antenna (if using a patch antenna)

Small conductive plate under the antenna improves performance and reduces multipath.

Mounting hardware

Vibration-isolated mount for FC where possible.

Secure GPS antenna placement with clear sky view.

10.4 Optional logging and data extraction hardware

These are not required if you can extract data from the FC directly, but are useful for development.

USB cable and computer for configuration

Used to configure the FC ports and verify GPS input on the bench.

USB to UART adapter (bench bring-up)

Helpful for testing a GPS module directly without the FC.

MicroSD card (if your FC supports onboard logging)

Useful for recording telemetry when you are not streaming live.

10.5 Minimum recommended kit by class

1/8 electric 4S

Minimum: FC, GPS, ESC with 5V BEC or 5V buck regulator, bulk capacitor, wiring.

Recommended: dedicated 5V buck regulator for FC plus GPS, leave servo on ESC BEC.

1/10 electric 2S

Minimum: FC, GPS, ESC with 5V BEC or 5V buck regulator, bulk capacitor, wiring.

Recommended: dedicated 5V buck regulator for FC plus GPS if the servo causes dips.

1/8 nitro

Minimum: FC, GPS, receiver pack, 5V buck regulator for FC plus GPS, bulk capacitor, wiring.

Recommended: dual-regulator rails if running a high-torque servo and you see resets.