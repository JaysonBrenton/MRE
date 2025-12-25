---
created: 2025-01-27
creator: Jayson Brenton
lastModified: 2025-01-27
description: Enterprise-grade security hardening for ingestion subsystem
purpose: Defines security posture, controls, and mandatory safeguards for the ingestion
         subsystem to prevent it from becoming an attack surface. Ensures data integrity,
         connector isolation, and protection from malformed, malicious, or unexpected
         upstream inputs.
relatedFiles:
  - docs/architecture/liverc-ingestion/01-overview.md
  - docs/architecture/liverc-ingestion/05-api-contracts.md
  - docs/architecture/liverc-ingestion/11-ingestion-error-handling.md
  - docs/architecture/liverc-ingestion/17-ingestion-security.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# 24. Ingestion Security Hardening (Enterprise Grade)

This document defines the security posture, controls, and mandatory safeguards for the ingestion subsystem in My Race Engineer (MRE). The goal is to prevent ingestion from becoming an attack surface, preserve data integrity, isolate connectors, and protect the system from malformed, malicious, or unexpected upstream inputs.

This file applies globally to:
- The ingestion engine
- All connectors (LiveRC and future)
- Ingestion runners
- Browser subsystems
- Fetch and parsing layers
- Replay tools and fixtures
- Local and production environments

Security hardening is mandatory, versioned, and non-optional.

---

## 1. Security Objectives

The ingestion subsystem must ensure:
- No untrusted code execution
- No unintended network access
- No leakage of internal information
- No opportunity for SSRF or misrouted requests
- No possibility for connector escalation
- No ingestion-to-frontend privilege escalation
- Ingestion failure does not compromise availability
- All data persisted is validated, sanitised, and safe for downstream use
- Observability logs never include sensitive or internal details

The ingestion system must treat all upstream data as hostile.

---

## 2. Threat Model Overview

The ingestion subsystem must defend against:
- Malformed or adversarial HTML and JavaScript
- Script injection inside embedded JSON blobs (common on LiveRC)
- Broken or changing DOM trees
- Upstream outages returning unexpected or partial markup
- Slow responses causing resource exhaustion
- Connector bugs that expose internal stack traces
- Rogue future connectors requesting unauthorized URLs
- Compromised browser automation contexts
- Replay fixtures that have been tampered with
- Supply-chain issues from Python, Node, or browser updates

Ingestion must operate under a zero-trust assumption for all upstream inputs.

---

## 3. Network Hardening

Ingestion must enforce strict allow-listing:

- Only URLs returned by connector URL-resolver functions may be fetched.
- No arbitrary URLs.
- No dynamic redirections without explicit validation.
- All URLs must be validated and canonicalised before fetch.
- HTTPS is mandatory.
- Timeouts must be short, with exponential backoff.
- HTTP redirect chains must be capped.

SSRF protections require:
- No internal RFC1918 or link-local IPs accepted.
- No localhost or 127.0.0.0/8.
- No file:// or custom schemes.

If a connector requests an invalid URL, the ingestion engine rejects it before making a network request.

---

## 4. Browser Runner Isolation

When Playwright is required:
- Run browser automation in a fully isolated sandbox.
- Disable file system access.
- Deny navigation except to allow-listed domains.
- Disable JavaScript dialogs.
- Disable downloads.
- Disable popups and new windows.
- Disable WebRTC, WebSockets, and all persistent connections.
- Enforce a strict CSP on the runtime context.
- Collect only the minimum DOM or JS state needed.
- Kill browser contexts after every run.
- Impose a global memory and time budget per run.

Browser traces must never include sensitive data and must be stored only in secure debug folders.

---

## 5. Connector Isolation Boundaries

Each connector must be sandboxed logically and in code:

- No connector may access another connector’s resources.
- No connector may trigger arbitrary ingestion for other sources.
- Connector code may not import ingestion engine internals.
- The ingestion engine must reject connectors with elevated permissions unless explicitly configured.

Connector execution must be deterministic and non-privileged.

---

## 6. Validation and Sanitisation Controls

All fetched data must be validated before parsing:

- HTML must pass structure checks.
- Embedded JSON must be extracted with strict parsing, not string eval.
- No execution of inline JS from upstream.
- All numeric fields must be validated for type, range, and units.
- All dates must be validated and normalised to UTC.
- Race and lap counts must comply with expected ranges.
- Missing or malformed fields must be rejected or defaulted based on schema rules.
- Event, race, and driver IDs must be validated for format.
- All URLs must be re-validated after being extracted from upstream HTML.

Any violation triggers a ValidationError that prevents persistence.

---

## 7. Data Integrity and Normalisation Security

Before persistence:
- All records must be normalised via the canonical schema.
- Derived fields (elapsed time, average time) must be computed deterministically.
- No user-controlled or upstream-controlled strings may be used as identifiers.
- Casing, whitespace, and formatting must be normalised.
- No untrusted HTML may be stored in the DB.
- No embedded scripts or markup may survive.

Integrity checks:
- Track IDs must map to real track records.
- Event and race must match foreign key constraints.
- Lap numbers must be strictly sequential.
- No negative or zero lap times.
- Total time must equal the sum of laps or fall within an acceptable tolerance.

If any invariant fails, ingestion halts.

---

## 8. Role-Based Access and Privilege Separation

Ingestion endpoints must require:
- Admin privileges for all ingestion triggers.
- No ingestion from public or user-level endpoints.
- Strict request validation.

Ingestion runners (CLI or admin console):
- Must operate under a dedicated system user.
- Must not share permissions with the web frontend.
- Must run in a reduced-privilege sandbox.

Database:
- Ingestion process must use a restricted DB role.
- Only specific tables are writable.
- No schema migrations may be performed by ingestion.
- Frontend service must not have write access to ingestion tables.

---

## 9. Logging and Redaction Rules

Ingestion logs must include:
- connector name and version
- fetch and parsing timings
- URL identifiers (sanitised)
- error category and stage

Logs must not include:
- raw HTML
- full DOM snapshots
- credentials
- stack traces containing file paths
- internal URLs
- private system information

Debug logs may store raw HTML only in secure debug folders with restricted access and must expire automatically.

---

## 10. Supply-Chain and Dependency Security

Mandatory controls:
- Pin connector dependencies to specific versions.
- Lock HTTPX, Playwright, and parser libraries to known-good versions.
- Audit dependencies automatically (pip audit, npm audit).
- Forbid dynamic imports.
- Forbid use of eval, exec, or unsafe regex patterns.
- Maintain a known-good hash list for fixture files.
- Validate fixture file integrity before replay.

Browser sandbox configuration must be version-pinned and updated only after testing.

---

## 11. Replay and Fixture Security

Replays must be deterministic and safe:

- All fixture files must be immutable and write-protected.
- Fixtures must include integrity hashes.
- Fixture changes require code review.
- Replay tools must not accept external URLs or inputs.
- Replay must not automatically persist results without explicit approval.

Fixtures containing DOM or HTML must be stripped of scripts.

Replay must never mix data from different connectors.

---

## 12. Ingestion Engine Hardening

The ingestion engine itself must enforce:

- Dead-letter queues for failed ingestion runs.
- Hard ceilings on CPU, memory, and runtime.
- Rate limiting on ingestion triggers (per event and global).
- Idempotent writes with upsert-only behaviour.
- No concurrency overlap for the same event.
- Protection against partial ingestion overwriting good data.
- Strict transaction boundaries during persistence.

Engine crashes must never leave partially ingested data.

---

## 13. Cross-Connector Security Policies

All connectors must conform to:

- Same error model
- Same normalisation guarantees
- Same fetch restrictions
- Same logging rules
- Same validation rules
- Same browser sandbox posture
- Same network allow-list logic

Future connectors must undergo a security review:
- Data source trust level classification
- Required browser access
- Attack surface assessment
- Schema robustness evaluation
- Ingestion risk scoring

No connector may bypass or weaken mandatory ingestion security controls.

---

## 14. Incident Response and Recovery

If ingestion produces suspicious output:
- Mark the event’s ingest_depth as unsafe.
- Require manual review before reactivation.
- Allow replay using locked fixtures.
- Provide automated diff tooling between ingestion runs.
- Disable browser ingestion paths until validated.
- Allow connector rollback to a previous version.

If malicious upstream data is detected:
- Quarantine persisted data.
- Capture minimal debugging metadata.
- Block ingestion for that source.

All incidents must be logged with connector version and timestamps.

---

## 15. Summary

This document establishes the enterprise-grade security requirements for ingestion. By enforcing strict network rules, browser sandboxing, connector isolation, validation, data integrity, supply-chain protections, secure logging, and incident response workflows, MRE ensures that ingestion remains reliable, safe, and resilient against hostile or malformed upstream data.

This file is mandatory for all ingestion implementations. No connector or ingestion component may bypass or weaken these requirements.

