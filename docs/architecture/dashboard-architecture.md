---
created: 2025-01-27
creator: Documentation Update
lastModified: 2025-01-27
description: Dashboard architecture and widget system for MRE version 0.1.1
purpose: Defines dashboard types, widget system, customization architecture, and implementation guidelines
relatedFiles:
  - docs/design/mre-mobile-ux-guidelines.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# Dashboard Architecture Guide

**Document Status:** Version 0.1.1 Feature Specification  
**Authoritative Scope:** Applies to all dashboard implementations in version 0.1.1  
**Purpose:** Defines dashboard types, widget system architecture, customization system, and implementation guidelines.

**Implementation Status:** Fully in-scope and required for version 0.1.1

---

## Table of Contents

1. [Overview](#overview)
2. [Dashboard Types](#dashboard-types)
3. [Widget System](#widget-system)
4. [Customization System](#customization-system)
5. [Layout System](#layout-system)
6. [Data Fetching Patterns](#data-fetching-patterns)
7. [Performance Optimization](#performance-optimization)
8. [Mobile Dashboard Considerations](#mobile-dashboard-considerations)

---

## Overview

Version 0.1.1 includes a comprehensive dashboard system with customizable widgets. Dashboards provide users with personalized views of data, metrics, and quick actions.

**Key Principles:**
- Full customization (drag-and-drop, resize, rearrange)
- Widget-based architecture
- Mobile-responsive layouts
- Performance-optimized data loading
- Consistent widget patterns

---

## Dashboard Types

All dashboard types listed below are fully in-scope and required for version 0.1.1. Complex dashboards beyond the admin console are architectural requirements.

### User Dashboard (Required)

**Purpose:** Personal dashboard for regular users showing their activity and statistics.

**Widgets:**
- Recent events card
- Personal statistics (events participated, races entered)
- Quick actions (search events, view profile)
- Recent activity feed

**Data Sources:**
- User's event participation
- User's race entries
- User's driver links (if applicable)

### Driver Dashboard (Required)

**Purpose:** Performance-focused dashboard for drivers showing lap times, race results, and performance metrics.

**Widgets:**
- Performance summary cards (best lap, average lap, consistency)
- Recent race results
- Lap time trends chart
- Upcoming events
- Quick actions (analyze event, view driver details)

**Data Sources:**
- Driver's race results
- Driver's lap times
- Driver's event entries
- Performance calculations

### Team Dashboard (Required)

**Purpose:** Team management dashboard showing team statistics and member performance.

**Widgets:**
- Team statistics cards (total members, events, wins)
- Team member performance comparison
- Team event calendar
- Recent team activity
- Quick actions (manage team, add members)

**Data Sources:**
- Team members' data
- Team events
- Aggregated team statistics

### Track Dashboard (Required)

**Purpose:** Track-specific dashboard showing track statistics and event history.

**Widgets:**
- Track information card
- Event history chart
- Track records (fastest lap, most events)
- Upcoming events at track
- Quick actions (follow track, search events)

**Data Sources:**
- Track data
- Track events
- Track statistics

---

## Widget System

### Widget Types

#### Stat Cards

**Purpose:** Display key metrics and statistics.

**Features:**
- Large number display
- Label/description
- Trend indicator (up/down arrow, percentage)
- Optional icon
- Click action (navigate to detail page)

**Example:**
```tsx
<StatCard
  label="Total Events"
  value={eventCount}
  trend={{ direction: 'up', value: 12 }}
  icon={<EventIcon />}
  onClick={navigateToEvents}
/>
```

#### Charts and Graphs

**Purpose:** Visualize data trends and comparisons.

**Chart Types:**
- Line charts (lap times over time, trends)
- Bar charts (comparisons, distributions)
- Pie charts (proportions, categories)

**Features:**
- Interactive tooltips
- Zoom and pan (for detailed views)
- Legend and labels
- Responsive sizing
- Export functionality (optional)

**Example:**
```tsx
<LineChart
  data={lapTimeData}
  xAxis="lapNumber"
  yAxis="lapTimeSeconds"
  title="Lap Times Over Race"
/>
```

#### Recent Activity Feeds

**Purpose:** Show recent events, updates, or actions.

**Features:**
- Chronological list of activities
- Activity type icons
- Timestamps
- Links to related content
- Pagination or infinite scroll

**Example:**
```tsx
<ActivityFeed
  activities={recentActivities}
  onActivityClick={handleActivityClick}
  loadMore={loadMoreActivities}
/>
```

#### Quick Action Buttons

**Purpose:** Provide quick access to common actions.

**Features:**
- Icon + label buttons
- Grouped by category
- Prominent placement
- Touch-friendly targets

**Example:**
```tsx
<QuickActions>
  <ActionButton icon={<SearchIcon />} label="Search Events" />
  <ActionButton icon={<AddIcon />} label="Import Event" />
</QuickActions>
```

---

## Customization System

### Full Customization Support (Required Features)

Customizable widgets with full customization support are required features for version 0.1.1. All dashboard types must support customization.

**Features (All Required):**
- Drag-and-drop widget rearrangement
- Resize widgets (width and height)
- Show/hide widgets
- Save custom layouts per dashboard type per user
- Reset to default layout

### Implementation Architecture

**Layout Storage:**
- Store widget positions and sizes
- Store widget visibility state
- Store layout per dashboard type per user
- Default layouts for new users

**State Management:**
- Widget configuration state
- Layout state (positions, sizes)
- Visibility state
- Drag-and-drop state

**Persistence:**
- Save layout to database (user preferences)
- Load layout on dashboard load
- Sync layout changes in real-time (optional)
- Default layout fallback

**Example Structure:**
```typescript
interface DashboardLayout {
  dashboardType: 'user' | 'driver' | 'team' | 'track';
  widgets: WidgetConfig[];
  gridLayout: GridLayout;
}

interface WidgetConfig {
  id: string;
  type: 'stat' | 'chart' | 'activity' | 'action';
  position: { x: number; y: number };
  size: { width: number; height: number };
  visible: boolean;
  config: WidgetSpecificConfig;
}
```

### Drag-and-Drop Implementation

**Requirements:**
- Smooth drag animations
- Visual feedback during drag
- Drop zones with visual indicators
- Snap to grid (optional)
- Collision detection

**Libraries:**
- Consider `react-grid-layout` or similar
- Or custom implementation with drag API
- Touch support for mobile

### Resize Implementation

**Requirements:**
- Resize handles on widgets
- Minimum and maximum sizes
- Aspect ratio constraints (for charts)
- Visual feedback during resize
- Snap to grid (optional)

---

## Layout System

### Grid Layout

**Approach:**
- CSS Grid or Flexbox-based layout
- Responsive grid columns
- Widgets span multiple columns/rows
- Auto-adjustment for mobile

**Grid Configuration:**
- Desktop: 12-column grid
- Tablet: 8-column grid
- Mobile: 4-column grid (single column preferred)

### Responsive Behavior

**Desktop (> 900px):**
- Multi-column widget layout
- Larger widget sizes
- More widgets visible
- Side-by-side widgets

**Tablet (600-899px):**
- Reduced column count
- Medium widget sizes
- Some widgets stack vertically

**Mobile (< 600px):**
- Single-column layout preferred
- Full-width widgets
- Stacked vertical layout
- Simplified widget views

---

## Data Fetching Patterns

### Widget Data Loading

**Pattern:**
- Each widget fetches its own data
- Use `src/core/<domain>/repo.ts` for data access
- Parallel data fetching for multiple widgets
- Loading states per widget
- Error handling per widget

**Example:**
```tsx
// In widget component
const { data, loading, error } = useWidgetData(widgetId);

if (loading) return <WidgetSkeleton />;
if (error) return <WidgetError error={error} />;
return <WidgetContent data={data} />;
```

### Caching Strategy

**Requirements:**
- Cache widget data to reduce API calls
- Cache invalidation on data updates
- Stale-while-revalidate pattern
- Cache per widget type

### Data Aggregation

**Pattern:**
- Aggregate data in core layer
- Widgets receive pre-aggregated data
- Avoid multiple queries for same data
- Share data between related widgets

---

## Performance Optimization

### Widget Loading

**Strategies:**
- Lazy load widgets below fold
- Prioritize above-fold widgets
- Progressive loading
- Skeleton screens during load

### Rendering Optimization

**Strategies:**
- Memoize widget components
- Virtual scrolling for activity feeds
- Chart rendering optimization
- Debounce resize/drag operations

### Data Optimization

**Strategies:**
- Paginate activity feeds
- Limit chart data points
- Aggregate statistics efficiently
- Cache expensive calculations

---

## Mobile Dashboard Considerations

### Layout Adaptation

**Mobile Behavior:**
- Single-column layout
- Full-width widgets
- Stacked vertical arrangement
- Simplified widget views

### Touch Interactions

**Requirements:**
- Touch-friendly drag-and-drop (if supported on mobile)
- Large touch targets for customization controls
- Swipe gestures for navigation (optional)
- Simplified customization UI on mobile

### Performance

**Mobile Optimization:**
- Reduce widget count on mobile
- Simplified charts (fewer data points)
- Lazy load below-fold widgets
- Optimize images and icons

### Customization on Mobile

**Approach:**
- Simplified customization (show/hide widgets)
- Drag-and-drop optional on mobile
- Settings page for layout customization
- Desktop-focused customization, mobile view-only

---

## Widget API Structure

### Widget Interface

```typescript
interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  config: WidgetConfig;
  dataSource: DataSource;
  refreshInterval?: number;
}

interface WidgetConfig {
  size: { width: number; height: number };
  position: { x: number; y: number };
  visible: boolean;
  // Widget-specific config
  [key: string]: any;
}
```

### Widget Registration

**Pattern:**
- Register widgets in widget registry
- Widget factory pattern
- Type-safe widget creation
- Widget metadata (name, description, icon)

---

## Related Documentation

- [Mobile UX Guidelines](../design/mre-mobile-ux-guidelines.md) - Mobile-specific requirements
- [Mobile-Safe Architecture Guidelines](mobile-safe-architecture-guidelines.md) - Architecture rules
- [Version 0.1.1 Feature Scope](../specs/mre-v0.1-feature-scope.md) - Feature specifications
- [Dark Theme Guidelines](../design/mre-dark-theme-guidelines.md) - Visual styling

---

## License

Internal use only. This document defines dashboard architecture for version 0.1.1 of MRE.

