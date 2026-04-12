# Address normalisation (venue / track display)

## Scope

Normalisation applies to **track/venue addresses** shown in the app (for example
the event overview map link) and in API payloads that expose `event.address`. It
**does not** validate addresses against a postal authority and **does not**
geocode.

Implementation: `src/lib/address-normalization.ts`.

## Behaviour

1. **Structured + free-text merge** — `formatTrackAddress` takes optional
   `address` (free text from ingestion) plus `city`, `state`, `postalCode`, and
   `country`. Segments that are **already present** in the free-text line
   (whole-word, case-insensitive) are **not** appended again, which avoids
   strings like `… Narrabundah 02604, Australia, Narrabundah, 02604`.

2. **Australia postcode typo** — When the country or free-text address indicates
   **Australia**, a five-digit token matching `0` + four digits (e.g. `02604`)
   is treated as a mistaken leading zero and normalised to four digits (`2604`).
   The free-text line is normalised early in this way when Australia is
   indicated so that duplicate checks against structured `postalCode` stay
   consistent. The structured `postalCode` field uses the same rule when country
   (or the free-text line) indicates Australia. Without an Australia hint, other
   countries’ formats (e.g. US ZIP `02108`) are left unchanged. The public
   helper `applyAustraliaPostcodeTypoFix` can also take
   `{ assumeAustralia: true }` when callers already know the row is Australian.

3. **Display cleanup** — `normalizeAddressForDisplay` removes placeholder tokens
   (`n/a`, `none`, …), lines that look like **email addresses**, fake
   placeholder postcodes (`00000`, …), **exact duplicate** comma-separated
   segments, and **shorter** segments that are already covered by a **longer**
   segment (e.g. drops standalone `Narrabundah` when `Narrabundah 2604` is
   present).

## Consumers

- `src/core/events/get-event-analysis-data.ts` — sets `event.address` from
  `formatTrackAddress` for the **LiveRC-linked** `event.track` (venue correction
  overrides are **deprecated** and must not apply once removed; see
  [`venue-correction-deprecation.md`](./venue-correction-deprecation.md)).
  Per-user **host track** display should reuse the same formatting for
  consistency.

## Tests

- `src/__tests__/lib/address-normalization.test.ts`

## Related

- Ingestion uses separate **country** normalisation in Python
  (`ingestion/common/country_lookup.py`); that pipeline is unchanged by this
  module.
