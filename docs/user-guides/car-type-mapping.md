---
created: 2026-05-13
creator: Jayson Brenton
lastModified: 2026-05-31
description: Account-wide car type mapping for consistent session analysis
purpose:
  Explains how to open the mapping UI from Event Analysis and where deeper
  taxonomy rules are documented for power users.
relatedFiles:
  - docs/architecture/car-taxonomy-user-mapping.md
  - src/app/(authenticated)/guides/car-type-mapping/page.tsx
---

# Car type mapping

LiveRC and club schedules often spell the same real-world class in different
ways (“1/8 Nitro Buggy”, “1/8th Nitro Buggy”, abbreviated labels, and so on).
**Car type mapping** lets you pin event text to MRE’s **canonical vehicle
classes** so filtering, summaries, and practice-day tooling stay aligned across
events.

## Where you use it

1. Open **My Event Analysis** (`/eventAnalysis`) and select an imported event.
2. In the primary tab strip, open **Actions** → **Map car types**.

![Actions menu with Map car types highlighted](./images/event-actions-menu.png)

3. In the modal, confirm **suggestions**, add **manual** mappings, or review
   rules already applied to your account.

Mappings are **per account**: they adjust how **you** see analysis; they do not
rewrite LiveRC or affect other users.

For platform behaviour (matching precedence, taxonomy structure, APIs), see
[Car taxonomy and user car-type mapping](../architecture/car-taxonomy-user-mapping.md).

## Richer walkthrough in the app

The authenticated guide at `/guides/car-type-mapping` mirrors this topic with
long-form sections (“Why this exists”, “What you are mapping”, workflow tips).
Use that page when you are already signed in and want copy that tracks UI
releases closely.

## Related guides

- [My Event Analysis (dashboard)](dashboard.md)
- [Event Analysis tabs and charts](event-analysis.md)
