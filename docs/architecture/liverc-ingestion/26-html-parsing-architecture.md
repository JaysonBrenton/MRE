# 26. HTML Parsing Architecture

This document defines the enterprise-grade HTML and script parsing subsystem used by
the LiveRC ingestion pipeline in My Race Engineer (MRE). It specifies the parsing
stack, module boundaries, safety rules, normalisation procedures, and integration
points with the ingestion pipeline.

This file is authoritative. Connectors must implement parsing exactly as described.

---

## 1. Purpose and Design Goals

The HTML parsing layer must provide:

- Deterministic extraction of structured data from LiveRC pages
- Stable long-term behaviour despite changes to LiveRC front-end markup
- Strict validation and normalisation of all extracted values
- Fail-fast behavior for malformed or incomplete upstream pages
- Full integration with fixtures, replay, and debugging tools
- Safe, observable, testable behaviour without reliance on browser execution

Parsing must support two categories of input:

1. Traditional HTML markup (race lists, tables, headings, breadcrumbs)
2. Embedded JavaScript data structures (e.g., racerLaps blobs)

The parser must operate as part of the ingestion pipeline’s
extract → transform → validate → store sequence.

---

## 2. Parsing Stack Selection

### 2.1 Primary HTML Parser: selectolax (required)

MRE must use the selectolax HTML parser.

Reasons:

- Extremely fast (10–50x faster than BeautifulSoup)
- Lenient with malformed markup (critical for LiveRC)
- Provides efficient CSS selectors
- Compatible with streaming or preloaded HTML
- Low memory overhead
- Works perfectly in async ingestion workflows

### 2.2 Script and JSON Parsing: Python stdlib only

The parser must use:

- re (for targeted extraction of JS variables)
- json (for real JSON)
- ast.literal_eval (only when upstream JS uses Python-compatible literals)

Under no circumstances may the parser:

- Evaluate raw JavaScript
- Execute JS inside Python
- Use third-party JS interpreters

### 2.3 Prohibited Technologies

- BeautifulSoup4 (too slow for ingestion scale)
- Selenium (browser execution is handled by Playwright fallback)
- html5lib (too slow)
- regex-only scraping of entire pages (allowed only for micro-extractions)

---

## 3. Parser Architecture

Parsing is partitioned into a stable set of domain-specific parsers. Each parser is
pure, synchronous, and side-effect free.

DomainParser implementations:

- TrackListParser
- EventListParser
- EventMetadataParser
- RaceListParser
- RaceMetadataParser
- RaceResultsParser
- RaceLapDataParser (parses racerLaps embedded JS)

All parsers must follow the same interface:

parse(html: str, url: str) → ParsedX

Where ParsedX is a dataclass or typed structure.

### 3.1 No parser may perform network requests

All network access is encapsulated in the HTTPX layer.

### 3.2 No parser may depend on database state

Parsers operate on raw HTML only.

### 3.3 Parsers must be idempotent

Given identical HTML, they must always produce identical outputs.

---

## 4. Extraction Rules

### 4.1 CSS Selector Standards

Parsers must use selectolax CSS selectors in the following style:

- Specific, stable selectors (avoid nth-child selectors)
- Prefer attributes and class names
- Fall back to structural context when needed

If multiple markup variants exist:

- Parsers must accept all known variants
- Parsers must fail with a clear error if no variant matched

### 4.2 Embedded JS Extraction

LiveRC stores rich data in JS variables, such as:

var racerLaps = {...};

Rules:

- Locate script tags containing known identifiers (e.g., "racerLaps")
- Extract exactly the relevant variable assignment using anchored regex
- Clean the JS block (strip trailing semicolons, convert single quotes)
- Transform into JSON or Python-safe structures
- Validate structure against expected schema

Parsers must never:

- Execute JavaScript
- Evaluate arbitrary code
- Accept unbounded script contents

---

## 5. Normalisation Rules

All parsing must normalise upstream values before returning them.

### 5.1 String Normalisation

Rules:

- Strip whitespace
- Collapse multiple spaces into one
- Normalise Unicode
- Replace non-breaking spaces
- Remove trailing punctuation where required

### 5.2 Number Normalisation

Rules:

- Convert lap times like "38.17" into float seconds
- Convert total-time strings like "30:32.160" into integer seconds
- Convert driver ranks into integers
- Convert lap numbers into integers
- Convert pace strings into structured fields

### 5.3 Date Normalisation

Rules:

- Determine event local timezone (LiveRC sometimes embeds this)
- Convert to UTC
- Store as ISO 8601 strings
- Validate parsed timestamps with strict mode

### 5.4 Race Label Normalisation

Examples:

- “A-Main”
- “Heat 3”
- “Round 2 – Heat 5”

Rules:

- Extract components: round, heat, class, main
- Generate canonical machine forms for ordering
- Preserve original for display

### 5.5 Class Name Extraction

Class names are extracted from LiveRC race labels which follow the pattern:

```
Race {number}: {class_name} ({race_label})
```

**Extraction Process:**

1. Parse race label from event page HTML (via `RaceListParser`)
2. Remove "Race X: " prefix if present using regex: `^Race\s+\d+:\s*`
3. Check for parentheses pattern: `^(.+?)\s*\((.+?)\)\s*$`
4. If parentheses found:
   - `class_name` = text before parentheses (trimmed)
   - `race_label` = text within parentheses (trimmed)
5. If no parentheses:
   - `class_name` = entire label (trimmed)
   - `race_label` = entire label (trimmed)

**Examples:**

- Input: `"Race 14: 1/8 Nitro Buggy (1/8 Nitro Buggy A-Main)"`
  - `class_name` = `"1/8 Nitro Buggy"`
  - `race_label` = `"1/8 Nitro Buggy A-Main"`

- Input: `"Race 5: 1/10 2WD Buggy Modified (1/10 2WD Buggy Modified A-Main)"`
  - `class_name` = `"1/10 2WD Buggy Modified"`
  - `race_label` = `"1/10 2WD Buggy Modified A-Main"`

- Input: `"Race 9: Junior (Junior A-Main)"`
  - `class_name` = `"Junior"`
  - `race_label` = `"Junior A-Main"`

**Normalisation Rules:**

- Whitespace: Trim leading/trailing whitespace only
- No case normalization: Preserve original capitalization
- No format normalization: Preserve spacing, punctuation, and formatting as-is
- Variations: All variations are stored as-is (e.g., `"1/8Nitro Buggy"` vs `"1/8 Nitro Buggy"`)

**Current Limitations:**

- No validation against predefined taxonomy
- No normalization to canonical forms
- No parsing of compound class names (e.g., separating vehicle type from modification rule)

**Future Considerations:**

- Normalize variations to canonical forms
- Validate against known car classes
- Parse compound class names into structured components
- Support filtering and searching by class components

See [Racing Classes Domain Model](../../domain/racing-classes.md) for complete taxonomy and definitions.

---

## 6. Validation Requirements

All parser outputs must be validated according to:

- 12-ingestion-validation-rules.md
- 11-ingestion-error-handling.md

Validation failures include:

- Missing required keys  
- Empty tables  
- Missing racerLaps blob  
- Mismatched field counts  
- Zero-length races  
- Invalid numbers  
- Malformed pace strings  
- Impossible timestamps  

Validation failures must:

- Stop ingestion immediately
- Produce a deterministic error report
- Store the failing HTML in a debug directory

---

## 7. Integration With Ingestion Pipeline

After parsing, the output passes to:

1. Transform layer  
2. Validation layer  
3. Database ingestion layer  
4. State machine updates  

Parsers do not store or log anything directly.

### 7.1 Fixture Integration

When ingestion operates in replay mode:

- Parsers must operate on saved HTML exactly as they would live HTML
- No code path differences

### 7.2 Browser Fallback Integration

If HTML is incomplete or critical JS is missing:

- The ingestion engine may escalate to Playwright fallback
- The parser must accept HTML from either HTTPX or Playwright

---

## 8. Observability and Debugging

Parsers must emit structured logs:

- parser_start
- parser_success
- parser_failure
- parser_field_count
- parser_variant_used
- embedded_js_found
- embedded_js_missing

For failures:

- Save failing HTML under:
  /tmp/mre/parsing-debug/YYYYMMDD-HHMMSS/
- Save extracted JS blobs for review

---

## 9. Backward Compatibility

Parser behaviour must remain stable across MRE v1.x.

Changes to:

- underlying parsing library
- CSS selectors
- embedded JS extraction strategy
- normalisation rules

must be documented and versioned.

Breaking changes require ingestion subsystem version bump.

---

## 10. Security Hardening

Rules reflective of:
24-ingestion-security-hardening.md.

- No JS execution  
- No unvalidated eval  
- No remote script fetching  
- No regex patterns with catastrophic backtracking  
- No file writes outside debug directories  
- No parser-level network requests  

---

## 11. Summary of Commitments

The parser layer must:

- Use selectolax  
- Use strict, validated CSS selectors  
- Use controlled regex for embedded JS  
- Normalise and validate all fields  
- Fail-fast on malformed upstream data  
- Never execute JavaScript  
- Never perform network access  
- Produce deterministic results  
- Integrate cleanly with fixtures and replay  
- Emit rich observability data  

---

End of 26-html-parsing-architecture.md
