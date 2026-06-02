---
created: 2026-01-27
creator: Jayson Brenton
lastModified: 2026-05-31
description:
  Account lifecycle, persona panel, logout, roadmap for password resets
purpose:
  Documents actual registration payloads, immersive profile modal behaviours,
  and honest gaps versus aspirational backlog items.
relatedFiles:
  - src/app/register/page.tsx
  - src/app/login/page.tsx
---

# Account management

Authenticated users manage essentials through:

1. The **credential forms** (`/login`, `/register`).
2. The **profile modal** opened from top-right persona chip (“Open profile …”).

## Registration (`/register`)

![Registration fields](./images/register-page.png)

| Field       | Rule                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------- |
| Email       | Stored lowercased; uniqueness enforced API-side. UI label **Email address**.              |
| Password    | Minimum **8 chars** enforced client + server.                                             |
| Driver Name | Mandatory text for persona seeding/fuzzy ingestion. Placeholder cues “Your display name”. |
| Team Name   | Optional string or blank.                                                                 |

Post-success path mirrored with login redirects (`/admin` vs `/eventAnalysis`).

## Signing in (`/login`)

![Sign in](./images/login-page.png)

- Email + password only (there is **no alternate username slug** surfaced in
  Alpha UI even if backlog stories mention hybrids).
- Error surfaces inline after server action denies credentials.
- `?registered=true` query indicates prior successful registration handshake.

Logout currently routes through modal **Sign out** control (see profile capture
below).

![Profile drawer with preferences & Sign out](./images/profile-menu.png)

### Profile modal breakdown

Authenticated modal sections (ordering top → bottom):

1. **Banner** showing display name / email / ADMIN pill when elevated.
2. **Basic Information** — Driver persona string + assigned persona taxonomy
   label.
3. **Activity Statistics** — Events/Races tally placeholders (Zeros until
   analytics pipeline wires personal counters).
4. **UI Preferences** — `Density (Compact • Comfort • Spacious)` + theme toggles
   (**Dark • Light**) hitting client preference reducers immediately.
5. **Account Settings** — Email replay + immutable **Account Created** timestamp
   sourced from persistence.
6. **Sign out** — terminates NextAuth session, returns to `/login`.

> Roadmap backlog still tracks self-service password reset & email-change
> flows—they are **absent** in Alpha v0.1.0 besides contacting operators.

### Admin-specific affordances

Admins additionally see **`MRE Administration`** rail shortcut + console metrics
but share the identical profile modal base—only textual persona tags differ
(“Administrator” badges).

### Security housekeeping

| Practice                              | Rationale                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Use unique passphrase per ecosystem   | ingestion console still shell-level privileged                                                      |
| Sign out from shared workstations     | Redux persist caches event UUID choices                                                             |
| Report suspected duplicate fuzzy rows | ingestion integrity issues differ from credential theft but still escalate via same support channel |

## Related guides

- [Getting Started](getting-started.md)
- [Navigation](navigation.md)
- [Driver Features](driver-features.md)
- [Troubleshooting credential issues](troubleshooting.md)
