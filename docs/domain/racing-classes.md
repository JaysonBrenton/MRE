---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-29
description: Domain model for RC racing classes, vehicle types, and skill groupings
purpose: Defines the taxonomy of racing classes that MRE ingests, including race classes (what LiveRC defines),
         vehicle types (inferred car classes), modification rules (Modified/Stock), and skill groupings (Junior/Pro/Expert).
         This document serves as the authoritative reference for understanding what racing classes mean in the MRE
         domain and how they are extracted from LiveRC data.
relatedFiles:
  - docs/database/schema.md
  - docs/architecture/liverc-ingestion/04-data-model.md
  - docs/architecture/liverc-ingestion/26-html-parsing-architecture.md
  - ingestion/connectors/liverc/parsers/entry_list_parser.py
  - src/core/events/infer-vehicle-type.ts
---

# Racing Classes Domain Model

**Last Updated:** 2025-01-29  
**Status:** Complete

This document defines the domain model for racing classes in the My Race Engineer (MRE) application. It provides the authoritative taxonomy of race classes (what LiveRC defines), vehicle types (inferred car classes), modification rules, and skill groupings that are ingested from LiveRC and stored in the MRE database.

---

## Overview

Racing classes in RC racing represent different categories of competition. In MRE, we distinguish between:

1. **Race Classes** - What LiveRC defines (e.g., "40+ Electric Buggy", "Pro Electric Buggy") - primary identifier
2. **Vehicle Types** - Inferred car classes with scale (e.g., "1/8 Electric Buggy", "1/10 Electric Truck") - derived field
3. **Modification Rules** - Rules governing vehicle modifications (Modified vs Stock)
4. **Skill Groupings** - Driver skill/experience levels (Junior, Pro, Expert)

The `EventEntry.className` field stores the race class name as extracted from LiveRC entry list pages. The `EventRaceClass.vehicleType` field stores the inferred vehicle type, which is derived from the race class name using heuristics.

---

## Car Classes (Vehicle Types)

Car classes define the **type of RC vehicle** being raced. These are the primary categories that MRE ingests:

### 1/8 Scale Classes

#### 1/8 Nitro Buggy
- **Scale:** 1/8 scale
- **Power:** Nitro (internal combustion) engine
- **Drive:** 4WD (four-wheel drive)
- **Vehicle Type:** Buggy (off-road racing buggy)
- **Engine:** Typically up to .21 cubic inches
- **Example LiveRC Labels:** `"1/8 Nitro Buggy"`, `"1/8 Nitro Buggy A-Main"`

#### 1/8 Nitro Truggy
- **Scale:** 1/8 scale
- **Power:** Nitro (internal combustion) engine
- **Drive:** 4WD (four-wheel drive)
- **Vehicle Type:** Truggy (truck-style chassis)
- **Engine:** Typically up to .28 cubic inches
- **Example LiveRC Labels:** `"1/8 Nitro Truggy"`, `"1/8 Nitro Truggy A-Main"`

#### 1/8 Electric Buggy
- **Scale:** 1/8 scale
- **Power:** Electric brushless motor
- **Drive:** 4WD (four-wheel drive)
- **Vehicle Type:** Buggy (off-road racing buggy)
- **Example LiveRC Labels:** `"1/8 Electric Buggy"`, `"1/8 Electric Buggy A-Main"`

#### 1/8 Electric Truggy
- **Scale:** 1/8 scale
- **Power:** Electric brushless motor
- **Drive:** 4WD (four-wheel drive)
- **Vehicle Type:** Truggy (truck-style chassis)
- **Example LiveRC Labels:** `"1/8 Electric Truggy"`, `"1/8 Electric Truggy A-Main"`

### 1/10 Scale Classes

#### 1/10 2WD Buggy
- **Scale:** 1/10 scale
- **Power:** Electric (typically)
- **Drive:** 2WD (two-wheel drive, rear-wheel drive)
- **Vehicle Type:** Buggy (off-road racing buggy)
- **Modification Rules:** May include Modified or Stock variants (see below)
- **Example LiveRC Labels:** `"1/10 2WD Buggy"`, `"1/10 2WD Buggy Modified"`, `"1/10 2WD Buggy Stock"`

#### 1/10 4WD Buggy
- **Scale:** 1/10 scale
- **Power:** Electric (typically)
- **Drive:** 4WD (four-wheel drive)
- **Vehicle Type:** Buggy (off-road racing buggy)
- **Modification Rules:** May include Modified or Stock variants (see below)
- **Example LiveRC Labels:** `"1/10 4WD Buggy"`, `"1/10 4WD Buggy Modified"`, `"1/10 4WD Buggy Stock"`

---

## Modification Rules (1/10 Scale Only)

Modification rules apply specifically to **1/10 scale buggies** (both 2WD and 4WD). These rules govern what modifications are allowed to the vehicle.

### Stock Class

**Applies to:** 1/10 2WD Buggy and 1/10 4WD Buggy

**Rules:**
- **Motor:** Limited motor turns
  - 2WD: 17.5-turn (17.5T) brushless motor
  - 4WD: 13.5-turn (13.5T) brushless motor
- **ESC:** Must operate in "blinky" mode (advanced timing features disabled)
- **Battery:** Typically restricted to 2-cell (2S) LiPo batteries, maximum 8.4V
- **Chassis/Components:** Limited modifications to maintain uniformity
- **Purpose:** Emphasizes driver skill and vehicle setup within standardized parameters

**Example LiveRC Labels:** `"1/10 2WD Buggy Stock"`, `"1/10 4WD Buggy Stock"`

### Modified Class

**Applies to:** 1/10 2WD Buggy and 1/10 4WD Buggy

**Rules:**
- **Motor:** No turn limit; racers can use motors of any specification
- **ESC:** Open ESC settings permitted (advanced timing and boost features allowed)
- **Battery:** Typically 2S LiPo, with some classes permitting higher voltage options
- **Chassis/Components:** Modifications generally unrestricted, allowing extensive customization
- **Purpose:** Offers greater flexibility for performance enhancements and optimization

**Example LiveRC Labels:** `"1/10 2WD Buggy Modified"`, `"1/10 4WD Buggy Modified"`

**Note:** Modified and Stock are **not car classes themselves**—they are modification rules that apply to 1/10 scale buggy classes.

---

## Skill Groupings (Not Car Classes)

Skill groupings such as **Junior**, **Pro**, and **Expert** are **not car classes**. They are ways to group similarly skilled drivers together for competitive balance.

### Junior
- **Purpose:** Beginner or youth drivers
- **Not a car class:** This is a skill/experience level grouping
- **Example LiveRC Labels:** `"Junior"`, `"Junior A-Main"`

### Pro
- **Purpose:** Professional or advanced drivers
- **Not a car class:** This is a skill/experience level grouping
- **Example LiveRC Labels:** `"Pro"`, `"Pro A-Main"`

### Expert
- **Purpose:** Expert-level drivers
- **Not a car class:** This is a skill/experience level grouping
- **Example LiveRC Labels:** `"Expert"`, `"Expert A-Main"`

**Important:** When these appear in LiveRC race labels, they are extracted as `class_name` values, but they represent skill groupings, not vehicle types.

---

## Class Name Extraction from LiveRC

The `Race.className` field stores the class name as extracted from LiveRC race labels. The extraction process is documented in the [Race List Parser](architecture/liverc-ingestion/26-html-parsing-architecture.md).

### Extraction Pattern

LiveRC race labels typically follow this format:
```
Race {number}: {class_name} ({race_label})
```

**Examples:**
- `"Race 14: 1/8 Nitro Buggy (1/8 Nitro Buggy A-Main)"`
  - `class_name` = `"1/8 Nitro Buggy"`
  - `race_label` = `"1/8 Nitro Buggy A-Main"`

- `"Race 9: Junior (Junior A-Main)"`
  - `class_name` = `"Junior"`
  - `race_label` = `"Junior A-Main"`

- `"Race 5: 1/10 2WD Buggy Modified (1/10 2WD Buggy Modified A-Main)"`
  - `class_name` = `"1/10 2WD Buggy Modified"`
  - `race_label` = `"1/10 2WD Buggy Modified A-Main"`

### Current Normalization

Currently, class names are:
- Extracted as-is from LiveRC labels
- Normalized only for whitespace (trimmed)
- Stored as free-form text strings
- **Not validated** against a predefined taxonomy
- **Not normalized** to canonical forms

### Variations and Edge Cases

LiveRC class names may vary in:
- **Spacing:** `"1/8 Nitro Buggy"` vs `"1/8Nitro Buggy"`
- **Capitalization:** `"1/8 Nitro Buggy"` vs `"1/8 NITRO BUGGY"`
- **Formatting:** `"1/10 2WD Buggy Modified"` vs `"1/10 2WD Buggy-Modified"`
- **Abbreviations:** Various abbreviations may be used
- **Combinations:** Skill groupings may be combined with car classes

**Current Behavior:** All variations are stored as-is. No normalization or validation is performed.

---

## Database Storage

### EventEntry.className Field

The `className` field in the `EventEntry` model stores the race class name from the entry list:

```prisma
model EventEntry {
  className String @map("class_name")
  eventRaceClassId String? @map("event_race_class_id")
  eventRaceClass EventRaceClass? @relation(...)
  // ... other fields
}
```

**Current Implementation:**
- Type: `String` (text)
- Required: Yes
- Normalization: Minimal (whitespace trimming only)
- Validation: None (all race classes accepted)

**Storage Examples:**
- `"40+ Electric Buggy"`
- `"Pro Electric Buggy"`
- `"Spt. Nitro Truck"`
- `"Int. 2WD Buggy"`

### EventRaceClass Model

The `EventRaceClass` model stores vehicle type information for each unique race class in an event:

```prisma
model EventRaceClass {
  eventId String
  className String
  vehicleType String? @map("vehicle_type")
  vehicleTypeNeedsReview Boolean @default(true) @map("vehicle_type_needs_review")
  vehicleTypeReviewedAt DateTime? @map("vehicle_type_reviewed_at")
  vehicleTypeReviewedBy String? @map("vehicle_type_reviewed_by")
  // ... other fields
}
```

**Storage Examples:**
- `className: "40+ Electric Buggy"`, `vehicleType: "1/8 Electric Buggy"`, `vehicleTypeNeedsReview: true`
- `className: "Pro Nitro Buggy"`, `vehicleType: "1/8 Nitro Buggy"`, `vehicleTypeNeedsReview: false`

---

## Future Considerations

### Class Name Normalization

Future versions of MRE may implement:

1. **Canonical Class Names**
   - Normalize variations to canonical forms
   - Example: `"1/8Nitro Buggy"` → `"1/8 Nitro Buggy"`

2. **Class Name Validation**
   - Validate against known car classes
   - Flag unknown or malformed class names
   - Support for new classes as they appear

3. **Structured Class Representation**
   - Separate fields for:
     - Vehicle type (1/8 buggy, 1/10 2WD, etc.)
     - Power type (Nitro, Electric)
     - Modification rule (Modified, Stock)
     - Skill grouping (Junior, Pro, Expert)

4. **Class Name Parsing**
   - Parse compound class names
   - Extract vehicle type, modification rule, and skill grouping separately
   - Support filtering and searching by individual components

### Filtering and Searching

Future features may include:
- Filter races by car class
- Filter by modification rule (Modified vs Stock)
- Filter by skill grouping
- Search across normalized class names
- Analytics grouped by class

---

## Related Documentation

- [Database Schema Documentation](../database/schema.md) - Schema definition for `Race.className`
- [LiveRC Ingestion Data Model](../architecture/liverc-ingestion/04-data-model.md) - Data model specification
- [HTML Parsing Architecture](../architecture/liverc-ingestion/26-html-parsing-architecture.md) - Class name extraction logic
- [Race List Parser](../../ingestion/connectors/liverc/parsers/race_list_parser.py) - Implementation of class name extraction

---

## Race Class Usage

### Class Extraction

Race classes are extracted from the LiveRC entry list page using `getValidClasses()` in `src/core/events/class-validator.ts`. This function:

- Uses `EventEntry.className` as the source (race classes from entry list)
- Returns all unique race class names (no validation filtering)
- Sorts alphabetically for display

### Vehicle Type Review

Users can review and edit inferred vehicle types through the ClassDetailsModal component:

- **Location**: Available from class dropdowns and entry list
- **Functionality**: 
  - View inferred vehicle type
  - Accept inference (marks as reviewed)
  - Edit vehicle type (select from dropdown of related options)
- **Storage**: Updates are saved to `EventRaceClass` record

### Implementation

Race class extraction is used in:
- **ChartControls**: Groups drivers by race class
- **OverviewTab**: Filters races by race class
- **SessionsTab**: Filters available classes in session analysis
- **DriverList**: Filters classes when displaying driver class information
- **EntryList**: Displays race classes with vehicle type information

## Summary

- **Race Classes** are what LiveRC defines (e.g., "40+ Electric Buggy", "Pro Electric Buggy") - primary identifier
- **Vehicle Types** are inferred car classes with scale (e.g., "1/8 Electric Buggy", "1/10 Electric Truck") - derived field
- **All race classes** from the entry list are accepted and displayed (no validation filtering)
- **Vehicle type inference** extracts vehicle type from race class names using heuristics
- **Vehicle types** are stored in `EventRaceClass` with a "needs review" flag requiring user confirmation
- **Users can review/edit** vehicle types through the ClassDetailsModal component
- **Modified/Stock** are modification rules for 1/10 scale buggies, not race classes
- **Junior/Pro/Expert** are skill groupings that appear in race class names
- **Age groupings** (e.g., "40+", "50+") appear in race class names
- **Race class names** are stored as free-form text extracted from LiveRC entry list
- **Future normalization** may provide structured class representation and validation
- **Future vehicle types** beyond Buggy/Truggy will be supported in later versions

This document is the **authoritative reference** for understanding racing classes in the MRE domain.

---

**End of Racing Classes Domain Model**
