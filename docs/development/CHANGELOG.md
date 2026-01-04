# Changelog

All notable changes to the My Race Engineer (MRE) project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- [2025-12-16] Refine Next.js configuration by optimizing server performance and security. Updated serverExternalPackages to include additional dependencies and improved webpack settings. Adjusted body size limits for server actions to bolster protection against DoS attacks. (a91d7a9)
- [2025-12-11] Enhance Next.js configuration to exclude argon2 from Edge Runtime and client-side bundling. Added serverExternalPackages for argon2 and implemented webpack adjustments for client-side fallback. Introduced body size limits for server actions to mitigate DoS attacks. (16dcb68)
- [2025-12-01] Initial commit from Create Next App (7708471)

### Changed

- [2025-12-28] misc (6838631)
- [2025-12-25] misc (d97e4ed)
- [2025-12-23] misc updates (add4697)
- [2025-12-23] Sync driver selection state across analysis tabs (e3b546d)
- [2025-12-23] hardening (59e1e6f)
- [2025-12-23] UI/UX consistency (24c1884)
- [2025-12-23] Review docs. UI/UX (9fdc0d5)
- [2025-12-23] Instrumented ingestion with Prometheus metrics and lightweight spans (488f409)
- [2025-12-23] hydration problem (8af6e12)
- [2025-12-23] logging updates (a3cc748)
- [2025-12-23] charting errors (26552c9)
- [2025-12-16] Optimize Next.js configuration by refining server performance and security settings. Updated serverExternalPackages to include new dependencies and adjusted webpack configurations for improved handling. Increased body size limits for server actions to strengthen protection against DoS attacks. (ccb6843)
- [2025-12-12] Update Next.js configuration to refine server performance and security. Adjusted serverExternalPackages to include new dependencies and further optimized webpack settings. Increased body size limits for server actions to enhance protection against DoS attacks. (d0cb17a)
- [2025-12-11] Refactor Next.js configuration to improve server performance and security. Updated serverExternalPackages to include additional dependencies and optimized webpack settings for better client-side handling. Enhanced body size limits for server actions to further protect against potential DoS attacks. (266e955)

### Fixed

- [2025-12-16] Fix LiveRC event discovery and improve search UX

  - Add Playwright fallback for LiveRC events pages with dynamic content (8ddf619)

---

## [0.1.1] - 2025-12-28

### Changed

- [2026-01-01] misc updates (5f2fcf4)
- [2025-12-30] 0.1.1 updates (8e478e7)

---

## Types of Changes

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes

---

**End of Changelog**
