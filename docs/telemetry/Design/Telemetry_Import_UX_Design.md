# Telemetry Import UX Design

**Author:** MRE Team  
**Date:** 2026-02-16  
**Purpose:** Define how end users get telemetry data into MRE—entry points, upload flow, capture hints, processing feedback, and error handling. This document fills the gap between the API contract (technical) and the analysis views (post-import).  
**Audience:** Frontend implementers, UX designers, product  
**License:** Proprietary, internal to MRE

---

## 1. Scope and Relationship to Other Docs

This document defines:

- Entry points and navigation into the import flow
- Step-by-step upload flow (single-file and multi-file)
- Capture hints UX (track, session name, optional metadata)
- Processing feedback (states, progress, polling)
- Error states and remediation

**Related documents:**

| Document | Coverage |
| -------- | -------- |
| [API Contract](API_Contract_Telemetry.md) §6.1 | POST /uploads, GET /uploads/{id}, POST /uploads/{id}/finalise |
| [User Story: Universal Telemetry Import](../User_Story/User_Story_Universal_Telemetry_Import_and_Analysis_(GNSS_+_IMU).md) | AC1: Create telemetry session |
| [Telemetry UX Blueprint](Telemetry_Ux_Blueprint.md) | Session Overview, Lap Compare, session picker (post-import views) |
| [Telemetry Implementation Design](Telemetry_Implementation_Design.md) | Pipeline stages, API endpoint summary |

---

## 2. Entry Points and Navigation

### 2.1 Primary Entry Points

| Entry point | Location | User intent |
| ----------- | -------- | ----------- |
| **Import button** | Top bar (global) or Telemetry dashboard | "I have new telemetry to add" |
| **Session picker** | Session Overview or Telemetry dashboard | "Create new session" or "Add to existing" |
| **Empty state** | Telemetry dashboard when no sessions | "Get started—import your first session" |

**Recommendation:** Primary entry is a visible **Import** or **Add session** action in the Telemetry area (dashboard or top bar). The session picker in [Telemetry UX Blueprint](Telemetry_Ux_Blueprint.md) should include an option to create a new session via import.

### 2.2 Navigation Flow

```
Telemetry Dashboard / Session Overview
    → Click "Import" or "Add session"
    → Import flow (modal or dedicated page)
    → Upload files → Optional capture hints → Confirm
    → Redirect to Session Overview (processing) or session list
```

**Modal vs dedicated page:** Use a **modal** for single-file imports; use a **dedicated page** or **multi-step wizard** for multi-file imports (GNSS + IMU, or batch).

---

## 3. Upload Flow

### 3.1 Single-File Flow

1. **Select files** — User clicks drop zone or file picker. Drag-and-drop supported.
2. **File validation** — Client-side: size, extension, MIME. Show errors before upload.
3. **Optional capture hints** — Track, session name, local start time (see §4).
4. **Upload** — PUT to signed URL. Show progress bar.
5. **Finalise** — POST /uploads/{id}/finalise. API creates session, triggers ingestion.
6. **Redirect** — Navigate to session detail (processing state) or session list.

**Flow diagram:**

```
[Select files] → [Validate] → [Optional hints] → [Upload] → [Finalise] → [Session created]
                    ↓                                   ↓
              [Validation error]              [Upload / Finalise error]
```

### 3.2 Multi-File Flow (GNSS + IMU)

Some devices export separate GNSS and IMU files. MRE treats them as an **artifact set** for one session.

1. **Add files** — User adds first file (e.g. GNSS CSV). Option: "Add another file" for same session.
2. **File list** — Show added files with role hint if detectable (e.g. "GNSS", "IMU", "Unknown").
3. **Capture hints** — Single set of hints for the session (track, name, start time).
4. **Upload all** — Sequential or parallel uploads; each gets a signed URL. Show per-file progress.
5. **Finalise** — Single finalise call after all uploads complete. API creates one session with multiple artifacts.
6. **Redirect** — Same as single-file.

**UX note:** For multi-file, make it clear that files belong to one session. "Import session: file 1 of 2, file 2 of 2" or "Add GNSS file, Add IMU file".

### 3.3 Add to Existing Session (v2)

Allow adding more artifacts to an existing session (e.g. user forgot to upload IMU file).

- Entry: Session detail page → "Add files to this session"
- Flow: Same as multi-file, but session_id is pre-set. No new session created.
- Gating: Only when session status is UPLOADING or when explicitly supported.

---

## 4. Capture Hints UX

### 4.1 What Capture Hints Are

Optional metadata the user can provide to improve session setup:

| Hint | Purpose | Required? |
| ---- | ------- | --------- |
| **Track** | Pre-assign session to a known track; enables track catalogue SFL (v2) | No |
| **Session name** | User-facing label | No |
| **Local start time** | Device local time; helps with timezone and external alignment | No |

Reference: [API Contract](API_Contract_Telemetry.md) §6.1 — `capture_hint.track_id`, `session_name`, `local_start_time`.

### 4.2 When to Show Capture Hints

**Option A (recommended):** Show hints **after** file selection, **before** upload. User sees file(s) and can optionally add track/name/time.

**Option B:** Show hints in a collapsible "Advanced" section. Default: collapsed.

**Option C:** Skip hints on first import; offer "Edit session" after creation for track/name.

**Recommendation:** Option A. Simple form: Track (search/select), Session name (text), Local start time (datetime picker, optional). All optional. Submit with "Import" or "Start import".

### 4.3 Track Selection

- Search/autocomplete from track catalogue.
- "No track" or "Unknown track" is valid—auto SFL detection still runs.
- v2: Pre-assigning track can improve lap detection when catalogue SFL exists.

### 4.4 Session Name

- Free text, max length (e.g. 128 chars).
- Default: empty or derived from filename (e.g. "RaceBox_2026-02-16_10-00").

### 4.5 Local Start Time

- Datetime picker with timezone (or "Use device timezone" if detectable).
- Optional. Helps when aligning with external data (weather, LiveRC event).

---

## 5. Processing Feedback

### 5.1 States After Finalise

After POST /uploads/{id}/finalise, the session is created and ingestion is triggered. Session status:

| Status | Meaning |
| ------ | ------- |
| `UPLOADING` | More files may be added (multi-file, or add-to-session) |
| `PROCESSING` | Pipeline running (parse, canonicalise, downsample, fuse, laps, materialise) |
| `READY` | Session is query-ready; user can view analysis |
| `FAILED` | Pipeline failed; show error and remediation |

### 5.2 What the User Sees During Processing

**Immediate redirect:** After finalise, redirect to session detail (Session Overview) or session list.

**Session Overview (processing state):**
- Replace main content with a processing card:
  - "Processing your session…"
  - Optional: progress indicator (e.g. "Parsing…", "Detecting laps…") if API provides stage
  - "This usually takes 30 seconds to 2 minutes."
- Disable Lap Compare, Segments, etc. until READY.
- Poll GET /sessions/{id} every 3–5 seconds until status is READY or FAILED.

**Session list:**
- Show session row with status badge: "Processing" or spinner.
- Click opens session detail (same processing card as above).

### 5.3 Polling vs WebSocket

**v1:** Polling GET /sessions/{id} every 3–5 seconds. Simple, sufficient for desktop.

**v2:** WebSocket or SSE for real-time status updates. Reduces polling load.

### 5.4 Progress Granularity

If the API returns processing stage (e.g. `processing_stage: "detect_laps"`), show it:
- "Parsing files…"
- "Detecting laps…"
- "Almost ready…"

If not, use a single message: "Processing your session…"

---

## 6. Error States and Remediation

### 6.1 Client-Side Errors (Before Upload)

| Error | Cause | UX |
| ----- | ----- | --- |
| File too large | > max_size_bytes (e.g. 100 MB) | "File is too large. Maximum size is 100 MB." |
| Unsupported type | Extension or MIME not in allowed list | "We don't support this file type. Use CSV, GPX, or NMEA." |
| Too many files | Limit exceeded (e.g. 10 per session) | "Maximum 10 files per session." |
| Duplicate file | Same sha256 already in session | "This file was already added." (Allow or warn) |

### 6.2 Upload Errors

| Error | Cause | UX |
| ----- | ----- | --- |
| Signed URL expired | User took too long | "Upload link expired. Please try again." |
| Network error | PUT failed | "Upload failed. Check your connection and try again." |
| 4xx / 5xx on PUT | Server or storage error | Show API error message; "Upload failed. Try again later." |

### 6.3 Finalise Errors

| Error | Cause | UX |
| ----- | ----- | --- |
| 4xx / 5xx on finalise | API or backend error | Show API error message; "Could not start processing. Try again." |
| Validation failed | File structure invalid (detected server-side) | "We couldn't read this file. Check that it's a valid telemetry export." |

### 6.4 Processing Errors (Session FAILED)

| Error code (example) | UX message |
| -------------------- | ---------- |
| `FORMAT_NOT_RECOGNISED` | "We couldn't recognise this file format. Try exporting as CSV or GPX." |
| `CSV_NO_TIME_COLUMN` | "This file doesn't have a time column. Export with timestamps enabled." |
| `CSV_NO_POSITION_COLUMNS` | "This file doesn't have position data (lat/lon)." |
| `INTEGRITY_HASH_MISMATCH` | "File was corrupted during upload. Please re-upload." |
| `PARSE_ERROR` (generic) | "We couldn't process this file. Check the format and try again." |

**Session detail (FAILED):** Show error card with message, error code (for support), and "Re-import" or "Try again" action.

### 6.5 Remediation Hints

Provide one actionable hint per error when possible:
- "Export as CSV with timestamps and position columns."
- "Use GPX with time tags on track points."
- "Re-upload the file. If it keeps failing, try a different export format from your device."

---

## 7. Accessibility and Responsiveness

- **Keyboard:** Full keyboard navigation for file picker, form fields, and buttons.
- **Screen reader:** Announce upload progress, success, and errors.
- **Focus management:** After redirect to session, focus on the processing card or session title.
- **Desktop-only (v1):** No mobile web support; see [Telemetry UX Blueprint](Telemetry_Ux_Blueprint.md) scope.

---

## 8. Implementation Checklist

- [ ] Import button in Telemetry dashboard / top bar
- [ ] Drop zone + file picker; drag-and-drop
- [ ] Client-side validation (size, type)
- [ ] Capture hints form (track, session name, local start time) — all optional
- [ ] Upload to signed URL with progress bar
- [ ] POST finalise; handle 202 response
- [ ] Redirect to session detail or list
- [ ] Processing state UI (polling GET /sessions/{id})
- [ ] Error states: validation, upload, finalise, processing failed
- [ ] Multi-file flow: add files, upload all, single finalise
- [ ] Session picker: "Create new" → import flow

---

## 9. References

- [API Contract §6.1 Upload intake](API_Contract_Telemetry.md#61-upload-intake)
- [User Story: Universal Telemetry Import](../User_Story/User_Story_Universal_Telemetry_Import_and_Analysis_(GNSS_+_IMU).md)
- [Telemetry UX Blueprint](Telemetry_Ux_Blueprint.md)
- [Telemetry Implementation Design](Telemetry_Implementation_Design.md)
- [Supported Formats and Parser Specification](Supported%20Formats%20and%20Parser%20Specification.md) (error codes)
