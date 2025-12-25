# LiveRC Parser CSS Selector Reference

This document documents all CSS selectors and HTML structure dependencies for LiveRC parsers. This reference is critical for maintaining parsers when LiveRC HTML structure changes.

## Table of Contents

1. [TrackListParser](#tracklistparser)
2. [EventListParser](#eventlistparser)
3. [EventMetadataParser](#eventmetadataparser)
4. [RaceListParser](#racelistparser)
5. [RaceResultsParser](#raceresultsparser)
6. [RaceLapParser](#racelapparser)

---

## TrackListParser

**File**: `ingestion/connectors/liverc/parsers/track_list_parser.py`

**Page**: `https://live.liverc.com` (Global track catalogue)

### CSS Selectors

| Element | Selector | Purpose |
|---------|----------|---------|
| Track rows | `table.track_list tbody tr.clickable-row` | All track entries |
| Track link | `td a[href]` | Track URL (format: `//{slug}.liverc.com/`) |
| Track name | `td a strong` | Track display name |
| Last updated | `td:first-child small small` | Status timestamp (e.g., "1 minute ago") |

### Data Extraction

- **Track slug**: Extracted from URL `//{slug}.liverc.com/` using regex or URL parsing
- **Track URL**: Built as `https://{slug}.liverc.com/`
- **Events URL**: Built as `https://{slug}.liverc.com/events`

### HTML Structure

```html
<table class="table table-striped track_list">
  <tbody>
    <tr class="clickable-row" data-href="//raceplacerc.liverc.com/live/">
      <td class="text-nowrap">
        <i class="fa fa-video-camera fa-fw status_video_1"></i>
        <br /><small><small>1 minute ago</small></small>
      </td>
      <td>
        <span class="hidden">seRC</span>
        <a href="//raceplacerc.liverc.com/">
          <strong>Race Place RC</strong>
        </a>
        <div class="indent"><small>Winter Race Series #1</small></div>
      </td>
    </tr>
  </tbody>
</table>
```

### Edge Cases

- Missing track links: Logged and skipped
- Malformed URLs: Logged and skipped
- Empty track names: Logged and skipped

---

## EventListParser

**File**: `ingestion/connectors/liverc/parsers/event_list_parser.py`

**Page**: `https://{track_slug}.liverc.com/events` (Track events listing)

### CSS Selectors

| Element | Selector | Purpose |
|---------|----------|---------|
| Event rows | `table#events tbody tr` | All event entries (skip header rows) |
| Event link | `td:first-child a[href]` | Event URL (format: `/results/?p=view_event&id={id}`) |
| Event name | Link text content | Event display name |
| Event date | `td:nth-child(2) span.hidden` | ISO date string (format: `2025-11-16 08:30:00`) |
| Entries | `td:nth-child(3)` | Number of entries (integer) |
| Drivers | `td:nth-child(4)` | Number of drivers (integer) |

### Data Extraction

- **Event ID**: Extracted from URL query parameter `?p=view_event&id={id}`
- **Event date**: Parsed from `span.hidden` using `datetime.strptime("%Y-%m-%d %H:%M:%S")`
- **Event URL**: Built as `https://{track_slug}.liverc.com{event_href}`

### HTML Structure

```html
<table id="events" class="table table-striped">
  <tbody>
    <tr>
      <td>
        <a href="/results/?p=view_event&id=486677">
          Cormcc 2025 Rudi Wensing Memorial, Clay Cup
        </a>
      </td>
      <td>
        <span class="hidden">2025-11-16 08:30:00</span>Nov 16, 2025
      </td>
      <td>71</td>
      <td>60</td>
    </tr>
  </tbody>
</table>
```

### Edge Cases

- Header rows: Skipped (contain `<th>` elements)
- Missing event IDs: Logged and skipped
- Invalid dates: Logged and skipped
- Missing entries/drivers: Defaults to 0

---

## EventMetadataParser

**File**: `ingestion/connectors/liverc/parsers/event_metadata_parser.py`

**Page**: `https://{track_slug}.liverc.com/results/?p=view_event&id={id}` (Event detail page)

### CSS Selectors

| Element | Selector | Purpose |
|---------|----------|---------|
| Event name | `h3.page-header` | Event name (text after icon span) |
| Event date | `h5.page-header` | Event date (text after icon, format: "Nov 16, 2025") |
| Event Stats table | `table.table-sm tbody tr` | Statistics rows |
| Entries | Text containing "Entries: {number}" | Number of entries |
| Drivers | Text containing "Drivers: {number}" | Number of drivers |

### Data Extraction

- **Event ID**: Extracted from URL query parameter `?p=view_event&id={id}`
- **Event name**: Text from `h3.page-header` after removing icon span text
- **Event date**: Parsed from `h5.page-header` using `datetime.strptime("%b %d, %Y")` (date only, no time)
- **Entries/Drivers**: Extracted from Event Stats table using regex

### HTML Structure

```html
<h3 class="page-header text-nowrap pull-left">
  <span class="fa fa-list-ol"></span> Cormcc 2025 Rudi Wensing Memorial, Clay Cup
</h3>
<h5 class="page-header text-nowrap pull-left">
  <span class="fa fa-calendar"></span> Nov 16, 2025
</h5>

<table class="table table-sm table-borderless m-0">
  <tbody>
    <tr>
      <th>Registrations</th>
      <td>
        Entries: 71<br />
        Drivers: 60
      </td>
    </tr>
  </tbody>
</table>
```

### Edge Cases

- Missing event ID in URL: Raises `EventPageFormatError`
- Missing event name header: Raises `EventPageFormatError`
- Missing date: Raises `EventPageFormatError`
- Missing stats: Logged as warning, defaults to 0

---

## RaceListParser

**File**: `ingestion/connectors/liverc/parsers/race_list_parser.py`

**Page**: `https://{track_slug}.liverc.com/results/?p=view_event&id={id}` (Event detail page)

### CSS Selectors

| Element | Selector | Purpose |
|---------|----------|---------|
| Race rows | `table.entry_list_data tbody tr` | All race entries (skip header rows) |
| Race link | `td a[href*="view_race_result"]` | Race URL (format: `/results/?p=view_race_result&id={id}`) |
| Race full label | Link text | Complete label (e.g., "Race 14: 1/8 Nitro Buggy (1/8 Nitro Buggy A-Main)") |
| Race time | `td:nth-child(2)` | Race completion time (format: "Nov 16, 2025 at 5:30pm") |

### Data Extraction

- **Race ID**: Extracted from URL query parameter `?p=view_race_result&id={id}`
- **Race number**: Parsed from label using regex `Race (\d+)`
- **Class name**: Text before parentheses in race label
- **Race label**: Text inside parentheses in race label
- **Race time**: Parsed using multiple formats (optional, can be None)
- **Race URL**: Built using `build_race_url(track_slug, race_id)`

### HTML Structure

```html
<table class="table table-hover entry_list_data">
  <tbody>
    <tr>
      <th>Main Events</th>
      <th>Time Completed</th>
    </tr>
    <tr>
      <td>
        <a href="/results/?p=view_race_result&id=6304829" class="block">
          <i class="fa fa-trophy"></i> Race 14: 1/8 Nitro Buggy (1/8 Nitro Buggy A-Main)
        </a>
      </td>
      <td>Nov 16, 2025 at 5:30pm</td>
    </tr>
  </tbody>
</table>
```

### Edge Cases

- Header rows: Skipped (contain `<th>` elements)
- Labels without parentheses: Entire label used as both class_name and race_label
- Labels without "Race X:" prefix: race_order set to None
- Missing race times: start_time set to None
- Grouped races: Handled correctly (Main Events, Qualifier Round 3, etc.)

---

## RaceResultsParser

**File**: `ingestion/connectors/liverc/parsers/race_results_parser.py`

**Page**: `https://{track_slug}.liverc.com/results/?p=view_race_result&id={id}` (Race result page)

### CSS Selectors

| Element | Selector | Purpose |
|---------|----------|---------|
| Result rows | `table.race_result tbody tr` | All driver results |
| Position | `td:first-child` | Final position (integer) |
| Driver name | `td:nth-child(2) span.driver_name` | Driver display name |
| Driver ID (primary) | `td:nth-child(2) a.driver_laps[data-driver-id]` | Driver ID from table attribute |
| Laps/Time | `td:nth-child(4)` | Format: "47/30:31.382" or "0" |
| Fastest lap | `td:nth-child(6)` | Number before `<sup>` (float) |
| Avg lap | `td:nth-child(7) div.hidden` | Average lap time (float) |
| Consistency | `td:nth-child(13)` | Number before "%" (float) |

### Data Extraction

- **Driver ID**: Primary from `data-driver-id` attribute, fallback: match driver name to `racerLaps` keys
- **Laps completed**: Extracted from "47/30:31.382" format (number before "/")
- **Total time raw**: Full string "47/30:31.382" stored as-is
- **Fastest lap**: Extracted using regex before `<sup>` tag
- **Avg lap**: Extracted from `div.hidden` element
- **Consistency**: Extracted using regex before "%" character

### HTML Structure

```html
<table class="table table-striped race_result">
  <tbody>
    <tr>
      <td>1</td>
      <td>
        <span class="car_num">1</span>
        <span class="driver_name">FELIX KOEGLER</span>
        <br />
        <small><small>
          <a href="#" data-driver-id="346997" class="driver_laps">
            <span class="fa fa-eye"></span> View Laps
          </a>
        </small></small>
      </td>
      <td>1</td>
      <td>47/30:31.382</td>
      <td></td>
      <td>37.234<sup>10</sup></td>
      <td><div class="hidden">38.983</div>38.983</td>
      <td>...</td>
      <td>92.82%</td>
    </tr>
    <tr>
      <td>12</td>
      <td>
        <span class="car_num">11</span>
        <span class="driver_name">RILEY LANDER</span>
      </td>
      <td>11</td>
      <td>0</td>
      <td>13 Laps</td>
      <td></td>
      <td><div class="hidden"></div></td>
      <td>...</td>
      <td></td>
    </tr>
  </tbody>
</table>
```

### Edge Cases

- **Non-starting drivers**: 
  - `laps_completed = 0`
  - `total_time_raw = None`
  - All time fields = None
  - No `data-driver-id` attribute
  - Driver ID matched by name to `racerLaps` keys
- **Missing driver IDs**: Logged as warning, result skipped
- **Empty time fields**: Set to None
- **Invalid lap/time format**: Logged and skipped

---

## RaceLapParser

**File**: `ingestion/connectors/liverc/parsers/race_lap_parser.py`

**Page**: `https://{track_slug}.liverc.com/results/?p=view_race_result&id={id}` (Race result page)

### JavaScript Structure

The lap data is embedded in JavaScript, not HTML:

```javascript
var racerLaps = {};
racerLaps[346997] = {
    'driverName': 'FELIX KOEGLER',
    'fastLap': '37.234',
    'avgLap': '38.983',
    'laps': [
        {
            'lapNum': '0',
            'pos': '1',
            'time': '0',
            'pace': '0',
            'segments': []
        },
        {
            'lapNum': '1',
            'pos': '1',
            'time': '38.17',
            'pace': '48/30:32.160',
            'segments': []
        },
        ...
    ]
};
```

### Regex Patterns

| Pattern | Purpose |
|---------|---------|
| `racerLaps\[(\d+)\]\s*=\s*(\{.*?\});` | Extract driver's lap data block |
| Single assignment: `racerLaps\[ID\]\s*=\s*(\{.*?\});` | Extract specific driver's data |

### Data Extraction

- **Driver ID**: Key in `racerLaps` object
- **Lap number**: `lapNum` field (lap 0 is skipped)
- **Position**: `pos` field
- **Lap time**: `time` field (parsed as float)
- **Lap time raw**: `time` field (stored as string)
- **Pace**: `pace` field (stored as string)
- **Elapsed race time**: Calculated as cumulative sum of lap times
- **Segments**: `segments` field (list)

### Field Mapping

| JavaScript Field | ConnectorLap Field |
|------------------|-------------------|
| `lapNum` | `lap_number` |
| `pos` | `position_on_lap` |
| `time` | `lap_time_seconds` (float) |
| `time` | `lap_time_raw` (string) |
| `pace` | `pace_string` |
| (calculated) | `elapsed_race_time` (cumulative) |
| `segments` | `segments` |

### Edge Cases

- **Empty laps arrays**: Return empty list (non-starting drivers)
- **Lap 0**: Skipped (start line)
- **Missing fields**: Defaults applied (0 for numbers, None for strings)
- **Invalid JavaScript**: Raises `RacePageFormatError`
- **Missing driver**: Raises `LapTableMissingError`

---

## Selector Dependencies

### Fragile Selectors (May Break)

1. **RaceResultsParser**: `td:nth-child(13)` for consistency (column position may change)
2. **EventMetadataParser**: Text matching for "Entries:" and "Drivers:" (format may change)
3. **RaceListParser**: Regex parsing of race labels (format may vary)
4. **EntryListParser**: Text parsing of class name from header (format: "{class_name} Entries: {count}")

### Stable Selectors (Less Likely to Break)

1. **TrackListParser**: `table.track_list` (core table class)
2. **EventListParser**: `table#events` (ID selector)
3. **RaceResultsParser**: `span.driver_name` (semantic class name)

---

## Testing

All parsers are tested with HTML fixtures located in:
- `ingestion/tests/fixtures/liverc/`

Test files:
- `test_track_list_parser.py`
- `test_event_list_parser.py`
- `test_event_metadata_parser.py`
- `test_race_list_parser.py`
- `test_race_results_parser.py`
- `test_race_lap_parser.py`
- `test_entry_list_parser.py`

---

---

## EntryListParser

**File**: `ingestion/connectors/liverc/parsers/entry_list_parser.py`

**Page**: `https://{track_slug}.liverc.com/results/?p=view_entry_list&id={event_id}` (Entry list page)

### CSS Selectors

| Element | Selector | Purpose |
|---------|----------|---------|
| Entry tables | `table` | All tables on the page (one per racing class) |
| Class header | `thead tr:first-child th` | Header row containing class name and entry count |
| Entry rows | `tbody tr` | All driver entry rows within a table |
| Car number | `td:first-child` | Car number (first column) |
| Driver name | `td:nth-child(2)` | Driver name (second column, may contain multiple lines) |
| Transponder number | `td:nth-child(3)` | Transponder number (third column, may be empty) |

### Data Extraction

- **Class name**: Extracted from header text before "Entries:" (e.g., "1/8 Electric Buggy Entries: 14" → "1/8 Electric Buggy")
- **Car number**: Text from first column (may be None)
- **Driver name**: Text from second column, cleaned (takes first line if multiple lines)
- **Transponder number**: Text from third column (may be None if empty)

### HTML Structure

```html
<table>
  <thead>
    <tr>
      <th colspan="3">1/8 Electric Buggy Entries: 14</th>
    </tr>
    <tr>
      <th>#</th>
      <th>Driver</th>
      <th>Transponder #</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>BRIGUGLIO, MICHAEL<br>MICHAEL BRIGUGLIO</td>
      <td>3071066</td>
    </tr>
    <tr>
      <td>2</td>
      <td>BROWN, ALEX<br>ALEX BROWN</td>
      <td>3373998</td>
    </tr>
  </tbody>
</table>
```

### Edge Cases

- **Missing entry list pages**: Some events may not have entry lists - parser returns empty entry list (not an error)
- **Missing transponder numbers**: Some drivers may not have transponder numbers (empty cell) - stored as None
- **Multiple racing classes**: Each class has its own table - entries grouped by class_name
- **Driver ID availability**: Driver IDs are not typically available in entry list HTML (set to None)
- **Malformed tables**: Logged as warning, skipped
- **Empty entry lists**: Returns empty ConnectorEntryList (not an error)

---

## Maintenance Notes

When LiveRC HTML structure changes:

1. Update relevant parser implementation
2. Update this selector reference document
3. Update parser docstrings
4. Update test fixtures if structure changes significantly
5. Run all parser tests to verify changes

