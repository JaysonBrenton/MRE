---
created: 2026-02-16
creator: Jayson Brenton
lastModified: 2026-02-16
description: Design for Event Analysis Overview weather card and app-wide icon library
purpose:
  Define the Event Analysis Overview weather card (placement, styling, data reuse),
  adoption of an icon library, and condition-to-icon mapping. Reuses existing
  weather API, types, and patterns where possible.
relatedFiles:
  - src/components/organisms/event-analysis/EventStats.tsx
  - src/components/organisms/event-analysis/OverviewTab.tsx
  - src/components/organisms/dashboard/DriverCardsAndWeatherGrid.tsx
  - src/components/organisms/dashboard/EventAnalysisSection.tsx
  - src/core/weather/get-weather-for-event.ts
  - src/app/api/v1/events/[eventId]/weather/route.ts
  - docs/design/compact-label-value-card.md
  - docs/architecture/atomic-design-system.md
  - docs/api/api-reference.md
---

# Event Analysis Weather Card and Icon Library — Design

**Status:** Implemented  
**Scope:** Event Analysis Overview tab; app-wide icon usage  
**Applies to:** Frontend implementation (Next.js, React)

This document specifies:

1. **Icon library** — choice, installation, and usage guidelines.
2. **Existing weather implementation** — what to reuse (API, types, condition strings).
3. **Event Analysis weather card** — placement, layout, styling, data fetching, and condition-to-icon mapping.
4. **Implementation plan** — steps and file changes.

---

## 1. Icon library

### 1.1 Choice: Lucide React

- **Package:** `lucide-react`
- **Rationale:** Tree-shakeable, React-friendly, consistent stroke style, no API key, and includes weather-related icons (e.g. `Sun`, `Cloud`, `CloudRain`, `CloudSnow`, `CloudLightning`, `CloudFog`). Widely used and well maintained.
- **Installation:** Add to `package.json` dependencies; install inside Docker with `docker exec -it mre-app npm install lucide-react --legacy-peer-deps` (per project Docker-only rules).
- **Usage:** Import named icons per component (e.g. `import { Sun, Cloud } from "lucide-react"`) to keep bundles small. Prefer a single shared component or small utility for “weather icon from condition” so the mapping lives in one place.

### 1.2 Scope

- **Initial use:** Weather card condition icon (sunny, cloudy, rain, etc.).
- **Future use:** Other UI (e.g. dashboard, navigation, status) may use Lucide as the standard icon set; new icons should be added from this library unless there is a strong reason otherwise.
- **Existing inline SVGs:** No requirement to migrate existing inline SVGs (e.g. `MapPinIcon`, `CalendarIcon` in `EventAnalysisHeader.tsx`) in this change; coexistence is fine.

---

## 2. Existing weather implementation (reuse)

### 2.1 API and data shape

- **Endpoint:** `GET /api/v1/events/[eventId]/weather`  
  - Auth required.  
  - Returns: `condition`, `wind`, `humidity`, `air`, `track`, `precip`, `forecast`, `cachedAt`, `isCached`.  
  - See `docs/api/api-reference.md` (Weather Endpoints) and `src/app/api/v1/events/[eventId]/weather/route.ts`.

- **Core logic:** `getWeatherForEvent(eventId)` in `src/core/weather/get-weather-for-event.ts` returns a `WeatherForEvent` object with the same fields. No API or core changes required for the new card.

### 2.2 Types

- **Dashboard:** `WeatherData` is defined in `src/components/organisms/dashboard/DriverCardsAndWeatherGrid.tsx` (lines 14–24) and matches the API response shape (`condition`, `wind`, `humidity`, `air`, `track`, `precip`, `forecast`, `cachedAt?`, `isCached?`).
- **Core:** `WeatherForEvent` in `src/core/weather/get-weather-for-event.ts` is the server-side contract; the API returns this shape.
- **Reuse:** The Event Analysis weather card should use the same shape. Prefer one of:
  - **Option A:** Import `WeatherData` from `DriverCardsAndWeatherGrid` for the new card (no new type, minimal change).
  - **Option B:** Move a shared type to e.g. `src/types/weather.ts` (or a shared core type) and have both the dashboard and Event Analysis import it. Better if we expect more consumers or want to avoid organism-to-organism type imports.

Recommendation: Start with **Option A** (import from `DriverCardsAndWeatherGrid`); refactor to a shared type later if a second consumer or cleaner layering is needed.

### 2.3 Condition strings (for icon mapping)

Conditions come from Open-Meteo WMO codes, mapped in `src/core/weather/fetch-weather.ts` (`wmoWeatherCodeToCondition`), then formatted for display (e.g. “Clear sky”, “Partly cloudy”). Representative values:

| Condition (lowercase / normalized) | Example display |
|------------------------------------|------------------|
| clear sky                          | Clear sky        |
| mainly clear                       | Mainly clear     |
| partly cloudy                      | Partly cloudy    |
| overcast                           | Overcast         |
| fog                                | Fog              |
| drizzle / freezing drizzle         | Drizzle          |
| rain / freezing rain               | Rain             |
| rain showers                       | Rain showers     |
| snow / snow showers                | Snow             |
| thunderstorm                       | Thunderstorm     |
| unknown                            | Unknown          |

Icon mapping (see §3.4) will use the **condition string** (case-insensitive, substring match) so it works with the current API and any future wording tweaks.

### 2.4 Dashboard usage (reference)

- **Fetch:** `EventAnalysisSection.tsx` fetches when `selectedEventId` is set: `fetch(\`/api/v1/events/${selectedEventId}/weather\`, { cache: "no-store" })`, with `weather`, `weatherLoading`, `weatherError` state.
- **Display:** `DriverCardsAndWeatherGrid` receives `weather`, `weatherLoading`, `weatherError` and renders `WeatherPanel`, `WeatherLoadingState`, or `WeatherErrorState`.
- **Error copy:** `WeatherErrorState` in `DriverCardsAndWeatherGrid` normalizes error messages (network, geocode, 404, etc.) to user-friendly text. The same logic or the same component can be reused for the Event Analysis card (see §3.5).

---

## 3. Event Analysis weather card

### 3.1 Placement and layout

- **Location:** Event Analysis → **Overview** tab, in the existing “Event Statistics” section, **next to** the existing `EventStats` card (same section, same visual row).
- **Current structure:** In `OverviewTab.tsx`, the section is roughly:
  - `<section className="space-y-4">` with a “Event Statistics” heading and a single child `<EventStats ... />`.
- **Change:** Wrap `EventStats` and the new weather card in a horizontal layout so they sit side by side with consistent spacing, and wrap on small screens:
  - Use a flex container: e.g. `flex flex-wrap gap-4` (or `gap-6` to match `space-y-6`), with `EventStats` and the new weather card as direct children.
  - No change to the “Event Statistics” heading; it continues to describe both cards.

### 3.2 Card size and styling (match EventStats)

- **Design system:** The new card must follow `docs/design/compact-label-value-card.md` and match `EventStats` styling so the two cards feel like a pair.
- **Outer container (same as EventStats):**
  - `mb-6 w-fit rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2`
- **Inner layout:** Same grid as EventStats for label/value alignment:
  - `grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm text-[var(--token-text-primary)]`
  - Labels: `text-[var(--token-text-secondary)]`
- **Result:** Same width behaviour (`w-fit`), same padding and border, and similar height when the number of rows is similar. Optional: if designs require identical width, add a shared `min-w-[...]` to both cards later.

### 3.3 Content (compact label–value rows)

Display a small set of fields so the card stays compact and consistent with EventStats. Suggested rows:

1. **Condition** — value is the API `condition` string; **lead with an icon** (see §3.4) to the left of the text (e.g. icon + “Partly cloudy”). The grid can treat this as one value cell containing icon + text.
2. **Air** — `Math.round(weather.air)°C`
3. **Track** — `Math.round(weather.track)°C`
4. **Wind** — `weather.wind`
5. **Humidity** — `weather.humidity%`
6. **Precip** — `weather.precip%` (e.g. label “Chance” or “Precip”)

Optional: show “Cached” / “Cached at …” only if `weather.isCached` is true, in a subtle way (e.g. small secondary text), so the card does not grow unnecessarily.

Forecast list (as on the dashboard) is not required for this compact card; the dashboard panel remains the place for full forecast detail.

### 3.4 Condition-to-icon mapping

Map the API `condition` string (case-insensitive, substring or normalized) to a Lucide icon. Suggested mapping (aligns with WMO-derived strings in `fetch-weather.ts`):

| Condition match (substring / normalized) | Lucide icon      | Notes                    |
|-----------------------------------------|------------------|--------------------------|
| clear, mainly clear                     | `Sun`            | Sunny / clear            |
| partly cloudy, overcast                 | `Cloud`          | Cloudy                   |
| fog                                     | `CloudFog`       | Fog                      |
| drizzle, rain, showers (rain)           | `CloudRain`      | Rain                     |
| snow, showers (snow)                    | `CloudSnow`      | Snow                     |
| thunderstorm                            | `CloudLightning` | Thunderstorms            |
| freezing (rain/drizzle)                 | `CloudRain`      | Reuse rain icon          |
| unknown / default                       | `Cloud`          | Safe fallback            |

- **Implementation:** One small helper or component, e.g. `getWeatherIcon(condition: string)` returning a Lucide component or icon name, used only by the weather card (and optionally by the dashboard later). Matching can be implemented as a series of `condition.toLowerCase().includes(...)` checks in a defined order (e.g. “thunderstorm” before “rain”, “freezing” before “rain”).
- **Accessibility:** Icon should be decorative or paired with visible text (“Condition: Partly cloudy”); use `aria-hidden="true"` on the icon or ensure the condition text is in the accessible name.

### 3.5 Data fetching and loading/error states

- **When to fetch:** When the Overview tab is shown and `data.event.id` is present, fetch weather for that event (same as dashboard using `selectedEventId`).
- **Where to hold state:** In `OverviewTab` (or a small wrapper/hook): `weather`, `weatherLoading`, `weatherError`, and `useEffect` + `fetch(\`/api/v1/events/${data.event.id}/weather\`, { cache: "no-store" })`. Same pattern as `EventAnalysisSection.tsx`.
- **Loading:** Show a compact loading state that matches the card size (e.g. same border/surface/padding, skeleton lines or pulse for the grid rows). Either a minimal local skeleton or a reused component if we extract one from the dashboard (see §4).
- **Error:** Show a compact error state (same card container, message inside). Reuse the **user-friendly error message logic** from `WeatherErrorState` in `DriverCardsAndWeatherGrid` (network, geocode, 404, generic “Weather data unavailable”) so behaviour is consistent. Implementation can be a shared helper (e.g. `getWeatherErrorMessage(error: string): string`) or reuse of the same small component.

### 3.6 Component location and naming

- **New component:** `WeatherCard` (or `EventAnalysisWeatherCard`) in `src/components/organisms/event-analysis/WeatherCard.tsx`.
- **Rationale:** Same feature area as `EventStats` and `OverviewTab`; atomic design allows organisms in `event-analysis` to use other organisms (e.g. no need to put the card in molecules unless we want to reuse it on a different page first).

---

## 4. Implementation plan

### 4.1 Icon library

1. Add `lucide-react` to `package.json` dependencies.
2. Install in container: `docker exec -it mre-app npm install lucide-react --legacy-peer-deps`.
3. (Optional) Add a short note in `docs/architecture/atomic-design-system.md` or a “Icons” subsection: prefer Lucide for new icons; existing inline SVGs remain valid.

### 4.2 Shared weather type (optional)

- If reusing type from dashboard: have `WeatherCard` (or OverviewTab) import `WeatherData` from `DriverCardsAndWeatherGrid`.
- If extracting: add `src/types/weather.ts` (or re-export from core) with the same shape and update dashboard + new card to use it.

### 4.3 Condition-to-icon helper

- Add a small module or inline helper: input `condition: string`, output Lucide icon component (or name). Use the mapping table in §3.4. Unit tests optional but recommended for “thunderstorm”, “rain”, “clear”, “unknown”.

### 4.4 WeatherCard component

- Create `src/components/organisms/event-analysis/WeatherCard.tsx`.
- Props: `weather: WeatherData | null`, `weatherLoading: boolean`, `weatherError: string | null` (same as dashboard).
- Layout: same container and grid classes as EventStats (§3.2), rows as in §3.3, condition row with icon from §3.4.
- Loading: compact skeleton inside same card styles.
- Error: same card styles + user-friendly message (reuse or duplicate logic from `WeatherErrorState`).

### 4.5 OverviewTab integration

- In `OverviewTab.tsx`:
  - Add state: `weather`, `weatherLoading`, `weatherError`.
  - Add `useEffect`: when `data.event.id` is set, fetch `GET /api/v1/events/${data.event.id}/weather`, set state (mirror `EventAnalysisSection`).
  - In the Event Statistics section, wrap `EventStats` and `WeatherCard` in a div with `flex flex-wrap gap-4`.
  - Render `<WeatherCard weather={...} weatherLoading={...} weatherError={...} />`.

### 4.6 Optional follow-ups

- **Extract shared loading/error:** If we want one place for “compact weather loading” and “compact weather error” text, extract from `DriverCardsAndWeatherGrid` into small presentational components or a shared helper and use them in both dashboard and Event Analysis.
- **Width parity:** If design asks for exact same width as EventStats, add a shared `min-w-[...]` or fixed width to both cards.
- **Dashboard icons:** Later, the dashboard `WeatherPanel` can use the same condition-to-icon mapping for consistency.

---

## 5. Required documentation updates

When implementing this design, the following documentation must be updated so that the codebase and docs stay in sync.

| Document | Update required |
|----------|------------------|
| **docs/architecture/atomic-design-system.md** | Add an **Icons** subsection (or bullet under "Adding New Components"): state that `lucide-react` is the preferred icon library for new UI; existing inline SVGs remain valid. Optionally add `WeatherCard` to the Key Component Paths table once implemented. |
| **docs/index/document-index.md** | Ensure the Design section includes an entry for this design doc (Event Analysis Weather Card and Icon Library). *(Already added at design time.)* |
| **docs/design/event-analysis-weather-card-design.md** | Before marking complete: set **Status** from `Proposed` to `Implemented` (or `Authoritative`), and set **lastModified** to the implementation date. |
| **docs/api/api-reference.md** | No change required — weather endpoint and response shape are unchanged; the new card is another consumer of the existing API. |
| **docs/design/compact-label-value-card.md** | Optionally add `WeatherCard.tsx` to **relatedFiles** and §4 Reference Implementation as a second example of the compact card pattern. |

If a shared weather type is introduced (e.g. `src/types/weather.ts`), add a one-line mention in the relevant architecture or types doc so future contributors know where the canonical type lives.

---

## 6. Summary

| Item | Decision |
|------|----------|
| Icon library | `lucide-react`; tree-shaken named imports |
| Weather API | Reuse `GET /api/v1/events/[eventId]/weather` |
| Weather type | Reuse `WeatherData` from `DriverCardsAndWeatherGrid` (or move to shared type later) |
| Placement | Next to EventStats in Overview “Event Statistics” section |
| Layout | Flex row, `flex flex-wrap gap-4`; both cards same compact styling |
| Card styling | Match EventStats per compact-label-value-card spec |
| Condition icon | Map condition string → Lucide (Sun, Cloud, CloudRain, etc.) in one helper |
| Fetch & state | In OverviewTab, same pattern as EventAnalysisSection |
| Loading/error | Compact card-sized states; reuse error message logic from dashboard |

This design reuses the existing weather implementation (API, types, condition strings, and error handling) and adds a single new dependency and one new organism, with a clear path to optional refactors (shared types, shared loading/error UI).

---

**End of Event Analysis Weather Card and Icon Library Design**
