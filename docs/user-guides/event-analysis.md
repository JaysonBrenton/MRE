---
created: 2026-01-27
creator: Jayson Brenton
lastModified: 2026-01-27
description: Guide to analyzing race event data in My Race Engineer
purpose: Provides comprehensive instructions for using the Event Analysis feature to view charts, compare drivers, explore sessions, and export data.
relatedFiles:
  - docs/frontend/liverc/user-workflow.md
  - docs/design/telemetry-visualization-specification.md
  - docs/user-stories/liverc-integration.md
---

# Event Analysis Guide

Learn how to analyze race event data, view interactive charts, compare drivers, and export data for further analysis in My Race Engineer.

## Introduction

The Event Analysis page provides detailed insights into race events. You can view lap times, compare drivers, explore different sessions and heats, and export data for further analysis.

## Prerequisites

- You must be logged into MRE
- You need to have imported an event (events must have "Stored" or "Imported" status)
- The event must have complete data (races, drivers, results, and lap data)

## Accessing Event Analysis

### From Event Search

1. Search for and import an event (see [Event Search Guide](event-search.md))
2. Once the event status shows "Stored" or "Imported"
3. Click the **"Analyse event"** button in the event row
4. You'll be taken to the Event Analysis page

### From Event List

1. Navigate to your events list
2. Find an imported event
3. Click **"Analyse event"** to view analysis

## Page Structure

The Event Analysis page is organized into tabs:

1. **Overview** - Quick summary and highlights
2. **Drivers** - All drivers who participated
3. **Sessions / Heats** - All races and sessions
4. **Comparisons** - Side-by-side driver comparisons

## Overview Tab

The Overview tab provides a quick "at a glance" summary of the event.

### Main Highlights Chart

The primary chart shows key performance metrics:

**Best Lap Per Driver:**
- Bar chart or list showing fastest lap time for each driver
- Quickly identify the fastest drivers
- Click drivers to highlight them in the chart

**Average Lap vs Fastest Lap:**
- Comparison showing consistency
- Drivers with smaller gaps are more consistent
- Helps identify drivers who are fast but inconsistent

### Chart Interactivity

**Driver Selection:**
- Use checkboxes or toggle buttons to select/unselect drivers
- Selected drivers are highlighted in the chart
- Unselected drivers are grayed out or hidden
- This helps focus on specific drivers

**Metric Switching:**
- Use the dropdown or toggle to switch metrics
- Options include:
  - **Lap Time**: Show actual lap times
  - **Gap to Leader**: Show time gap behind the fastest driver
- Chart updates dynamically when you change metrics

### Event Summary Statistics

The Overview tab also displays:

- **Total Races/Sessions**: Number of races in the event
- **Total Drivers**: Number of unique drivers
- **Total Laps Recorded**: Total number of laps across all races
- **Date Range**: When the races occurred
- **Quick Links**: Direct links to key races or sessions

## Drivers Tab

The Drivers tab shows all drivers who participated in the event.

### Driver List

**Desktop View:**
- Table format with sortable columns
- Columns include:
  - Driver name
  - Number of races participated
  - Best lap time
  - Average lap time
  - Consistency score (if available)

**Mobile View:**
- List or card format
- Touch-friendly interface
- Scrollable list

### Driver Selection

**Selecting Drivers:**
- Use checkboxes to select multiple drivers
- Selected drivers can be compared in the Comparisons tab
- Selection persists when switching tabs

**Viewing Driver Details:**
- Click on a driver name or "View Details" button
- See:
  - Driver's race results summary
  - Lap time distribution
  - Position changes over races
  - Individual race performances

### Driver Information

For each driver, you can see:

- **Best Lap**: Fastest single lap time
- **Average Lap**: Average lap time across all races
- **Consistency**: How consistent the driver's lap times are
- **Total Laps**: Number of laps completed
- **Races Participated**: Which races the driver entered

## Sessions / Heats Tab

The Sessions/Heats tab displays all races and sessions for the event.

### Session List

Sessions are organized by:

- **Class**: Racing class (e.g., "1/8 Nitro Buggy", "1/8 Electric Buggy")
- **Session Type**: Main, qualifying, heat, etc.
- **Date/Time**: When the session occurred

### Session Information

Each session shows:

- **Session Name**: e.g., "A-Main", "B-Main", "Qualifying Round 1"
- **Class Name**: Racing class
- **Date/Time**: When the session occurred
- **Number of Drivers**: How many drivers participated
- **Duration**: Length of the session

### Filtering Sessions

**Filter by Class:**
- Use the "All Classes" dropdown
- Select a specific class to filter
- View only sessions for that class

**Filter by Session Type:**
- Options include:
  - "All Sessions"
  - "Mains Only"
  - "Qualifying Only"
  - "Heats Only"

### Viewing Session Details

Click on a session to see:

- **Race Results Table**: Complete results for that session
- **Columns Include**:
  - Position
  - Driver name
  - Laps completed
  - Total time
  - Fast lap
  - Average lap time

## Comparisons Tab

The Comparisons tab allows you to compare selected drivers side-by-side.

### Selecting Drivers for Comparison

**From Drivers Tab:**
- Select drivers using checkboxes
- Switch to Comparisons tab
- Selected drivers appear automatically

**From Comparisons Tab:**
- Use inline driver selection
- Multi-select checkboxes or toggle buttons
- Quick select options:
  - "Select All"
  - "Select Top 3"
  - "Select Top 5"
  - "Clear Selection"

### Comparison Charts

**Lap Time Comparison:**
- Overlay multiple drivers' lap times on the same graph
- X-axis: Lap number
- Y-axis: Lap time (seconds)
- Multiple lines (one per driver) with different colors
- Legend shows driver names and colors
- Helps identify where drivers gain or lose time

**Position Over Time:**
- Shows position changes for selected drivers
- X-axis: Race time (elapsed)
- Y-axis: Position (1, 2, 3, etc.)
- Lines show position changes throughout the race
- Useful for understanding race strategy

**Gap Analysis:**
- Shows time gap to leader for selected drivers
- X-axis: Lap number or race time
- Y-axis: Gap (seconds)
- Helps understand how far behind the leader each driver is

### Chart Controls

**Driver Selection:**
- Add or remove drivers from comparison
- Selection updates chart in real-time

**Metric Selection:**
- Choose what to compare:
  - Lap time
  - Position
  - Gap to leader

**Zoom and Pan:**
- Zoom into specific race segments (if supported)
- Pan to different parts of the race
- Reset zoom to return to full race view

### Comparison Table

Optional side-by-side table comparing key metrics:

- **Columns**: Driver Name, Best Lap, Average Lap, Consistency, Total Laps
- **Sortable**: Click column headers to sort
- **Scrollable**: On mobile, table scrolls horizontally

## Interactivity and Filters

### Driver Selection

**Multi-Select Drivers:**
- Select multiple drivers for visualization
- Selected drivers highlighted
- Selection persists across chart views

**Quick Select Options:**
- "Select All": Select all drivers
- "Select Top 3": Select fastest 3 drivers
- "Select Top 5": Select fastest 5 drivers
- "Clear Selection": Deselect all

### Filtering Options

**Filter by Class:**
- Dropdown to filter by racing class
- "All Classes" or specific class
- Updates all charts and tables

**Filter by Session:**
- Filter by heat/main/qualifying
- Options: "All Sessions", "Mains Only", "Qualifying Only", "Heats Only"

**Filter by Date Range:**
- If event spans multiple days
- Use date range picker
- Same interface as Event Search

### Chart Interactions

**Hover/Tooltip:**
- Hover over data points (desktop) or tap (mobile)
- Tooltip shows:
  - Lap number
  - Lap time
  - Driver name
  - Position

**Click Data Point:**
- Click a data point to see detailed lap information
- May show additional context

**Zoom/Pan:**
- Zoom into specific time ranges (if supported)
- Pan to different parts of the race
- "Reset View" button to return to full view

## Exporting Data

### Export Functionality

MRE supports exporting data to CSV format.

**Export Locations:**
- **Page-level**: "Export All Data" button in page header
- **Per-tab**: Tab-specific export buttons (e.g., "Export Overview Data")
- **Per-chart**: Export button within chart controls

### Exportable Data Types

**Lap Times Table:**
- All lap times for selected drivers/sessions
- Columns: Driver Name, Lap Number, Lap Time, Position, Elapsed Time

**Driver Comparison Dataset:**
- Side-by-side driver metrics
- Columns: Driver Name, Best Lap, Average Lap, Consistency, Total Laps

**Race Results:**
- Complete race results for selected sessions
- Columns: Position, Driver, Laps, Total Time, Fast Lap, Average Lap

**Session Summary:**
- Summary statistics for all sessions
- Columns: Session Name, Class, Date, Drivers, Duration

### Export Behavior

1. Click export button
2. CSV file downloads automatically
3. File naming: `{event-name}_{data-type}_{timestamp}.csv`
4. Export includes only visible/filtered data (respects current filters and selections)

### Export Tips

- Apply filters before exporting to get specific data
- Select specific drivers before exporting to focus on relevant data
- Export from different tabs to get different data perspectives

## Tips for Effective Analysis

### Comparing Your Performance

**Compare Against Fastest Driver:**
1. Select "My Driver" and "Fastest Driver" from driver list
2. View lap time comparison chart
3. See gap analysis to understand where you're losing time

**Identify Time Loss Areas:**
1. View lap time graph with spikes highlighted
2. Identify slowest laps (visual indicators)
3. See consistency score and drop-off points

### Understanding Charts

**Lap Time Charts:**
- Lower is better (faster times)
- Consistent lines indicate consistent performance
- Spikes show slow laps or mistakes

**Position Charts:**
- Track position changes over time
- Identify where positions were gained or lost
- Understand race strategy

**Gap Analysis:**
- Shows how far behind leader
- Negative gaps mean you're ahead
- Helps set realistic goals

## Common Issues

### Charts Not Displaying

**Possible Causes:**
- Event data incomplete
- Browser compatibility issues
- JavaScript disabled

**Solutions:**
- Ensure event is fully imported
- Try refreshing the page
- Check browser console for errors

### Missing Data

**Possible Causes:**
- Event partially imported
- LiveRC data incomplete
- Data processing error

**Solutions:**
- Check event status (should be "Stored")
- Try re-importing the event
- Contact support if data seems incorrect

### Export Not Working

**Possible Causes:**
- Browser blocking downloads
- No data selected
- Export format issue

**Solutions:**
- Check browser download settings
- Ensure data is selected/filtered
- Try a different browser

## Related Guides

- **[Event Search Guide](event-search.md)**: Learn how to find and import events
- **[Navigation Guide](navigation.md)**: Master navigation patterns
- **[Troubleshooting Guide](troubleshooting.md)**: Common issues and solutions

## Next Steps

After analyzing events, you can:

1. Compare performance across multiple events
2. Track improvements over time
3. Use exported data for further analysis
4. Share insights with your team

---

**Ready to dive deeper?** Explore the [Dashboard Guide](dashboard.md) to track your progress over time.

