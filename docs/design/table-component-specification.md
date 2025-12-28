---
created: 2025-01-27
creator: Documentation Update
lastModified: 2025-01-27
description: Table component specification for MRE version 0.1.1
purpose: Defines table component usage, features, mobile behavior, and implementation guidelines
relatedFiles:
  - docs/design/mre-mobile-ux-guidelines.md
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# Table Component Specification

**Document Status:** Version 0.1.1 Feature Specification  
**Authoritative Scope:** Applies to all table components in version 0.1.1  
**Purpose:** Defines table component usage, required features, mobile behavior, and implementation guidelines.

**Implementation Status:** Fully in-scope and required for version 0.1.1

---

## Table of Contents

1. [Overview](#overview)
2. [Usage Locations](#usage-locations)
3. [Required Features](#required-features)
4. [Mobile Behavior](#mobile-behavior)
5. [Responsive Column Strategies](#responsive-column-strategies)
6. [Accessibility Requirements](#accessibility-requirements)
7. [Performance Considerations](#performance-considerations)
8. [Integration with Data Sources](#integration-with-data-sources)

---

## Overview

Version 0.1.1 includes table components for displaying structured data across the application. Tables support sorting, filtering, pagination, and mobile-friendly interactions.

**Key Principles:**
- Horizontal scroll on mobile (preferred approach)
- Touch-friendly interactions
- Accessible table structure
- Performant rendering for large datasets
- Consistent styling across all tables

---

## Usage Locations

Tables are fully in-scope and required for version 0.1.1. Tables are used in all of the following locations:

1. **Admin Console (Required)**
   - Users list (with edit/delete actions)
   - Events list (with re-ingest/delete actions)
   - Tracks list (with follow/unfollow actions)

2. **Event Lists Page (Required)**
   - Browse imported events
   - Filter by track, date range
   - Sort by date, name, entries

3. **Driver Lists/Management (Required)**
   - List all drivers
   - Filter by name, transponder
   - View driver details
   - Driver information and transponder overrides

4. **Race Results Display (Required)**
   - Race results table
   - Sort by position, lap times
   - Filter by driver, class

**Note:** Tables are fully in-scope for version 0.1.1 and must be implemented in all specified locations. Tables are not limited to event analysis visualization - they are required components across the application.

---

## Required Features

### Column Sorting

**Requirements:**
- Click column header to sort
- Visual indicator for sort direction (arrow up/down)
- Sort state persists during session
- Multi-column sorting (optional, advanced feature)

**Implementation:**
- Sortable columns marked with sort icon
- Click toggles between ascending/descending
- Default sort column specified
- Sort indicators update on state change

**Example:**
```tsx
<Table>
  <TableHeader>
    <SortableColumn 
      field="name" 
      currentSort={sortState}
      onSort={handleSort}
    >
      Driver Name
    </SortableColumn>
  </TableHeader>
</Table>
```

### Row Filtering and Search

**Requirements:**
- Global search across all columns
- Column-specific filters (dropdowns, inputs)
- Filter state persists during session
- Clear filters button
- Filter count indicator

**Implementation:**
- Search input above table
- Filter controls per column (where applicable)
- Real-time filtering as user types
- Debounced search for performance
- Filter chips showing active filters

**Example:**
```tsx
<TableFilters>
  <SearchInput 
    placeholder="Search drivers..."
    value={searchTerm}
    onChange={handleSearch}
  />
  <ColumnFilter 
    column="status"
    options={statusOptions}
    value={statusFilter}
    onChange={handleStatusFilter}
  />
</TableFilters>
```

### Pagination

**Requirements:**
- Configurable page size (10, 25, 50, 100 items)
- Page navigation (first, previous, next, last)
- Current page indicator
- Total items count
- Items per page selector

**Implementation:**
- Pagination controls below table
- Page number buttons
- Disabled state for first/last pages
- URL parameters for page state (optional)
- Server-side or client-side pagination

**Example:**
```tsx
<Pagination
  currentPage={page}
  totalPages={totalPages}
  pageSize={pageSize}
  totalItems={totalItems}
  onPageChange={handlePageChange}
  onPageSizeChange={handlePageSizeChange}
/>
```

---

## Mobile Behavior

### Horizontal Scroll

**Primary Approach:**
- Tables use horizontal scroll on mobile devices
- Preferred for data tables with many columns
- Touch-friendly scrolling with momentum
- Visual indicators for scrollable content

**Implementation:**
- Table wrapper with `overflow-x: auto`
- Minimum table width to prevent column collapse
- Scroll indicators (shadows, gradients) at edges
- Smooth scrolling behavior

**Example:**
```tsx
<div className="table-wrapper">
  <Table style={{ minWidth: '800px' }}>
    {/* Table content */}
  </Table>
</div>
```

### Touch-Friendly Interactions

**Column Sorting:**
- Tap column header to sort
- Visual feedback on tap
- Large touch target (minimum 44px height)

**Row Selection:**
- Tap row to select (if selection enabled)
- Checkbox column for multi-select
- Adequate spacing between rows

**Filter Controls:**
- Large touch targets for filter buttons
- Dropdown filters with mobile-friendly UI
- Search input with adequate size

**Pagination:**
- Large pagination buttons (minimum 44px)
- Swipe gestures optional (for mobile apps)
- Clear page indicators

### Column Visibility

**Responsive Strategies:**
- Hide less important columns on small screens
- Show key data columns prioritized
- Column visibility toggle (optional)
- Responsive column strategies per table type

**Priority Columns:**
- Always visible: Primary identifier, key data
- Hide on mobile: Secondary data, metadata
- Show on tap: Expandable rows for details

---

## Responsive Column Strategies

### Strategy 1: Hide Columns

**Approach:**
- Hide less important columns on mobile
- Show only essential columns
- Column visibility toggle to show/hide columns

**Use Case:**
- Tables with many columns
- When horizontal scroll is not desired
- When key data can be prioritized

### Strategy 2: Horizontal Scroll

**Approach:**
- Allow horizontal scrolling
- Maintain all columns visible
- Visual scroll indicators

**Use Case:**
- Data tables requiring all columns
- When column order matters
- When users need to compare columns

### Strategy 3: Responsive Column Reordering

**Approach:**
- Reorder columns for mobile view
- Most important columns first
- Less important columns scrollable

**Use Case:**
- Tables with clear column priority
- When some columns are rarely needed
- Balanced approach between scroll and hide

---

## Accessibility Requirements

### Table Structure

**Semantic HTML:**
- Use `<table>`, `<thead>`, `<tbody>`, `<tfoot>` elements
- Proper `<th>` and `<td>` elements
- Scope attributes for headers: `scope="col"` or `scope="row"`
- Caption or aria-label for table description

**Example:**
```tsx
<table aria-label="Driver list">
  <caption>List of all drivers</caption>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Transponder</th>
    </tr>
  </thead>
  <tbody>
    {/* Rows */}
  </tbody>
</table>
```

### Keyboard Navigation

**Requirements:**
- Tab to navigate between interactive elements
- Arrow keys to navigate table cells
- Enter/Space to activate sort/filter
- Escape to close filters/dropdowns

### Screen Reader Support

**Requirements:**
- Proper table structure announced
- Column headers associated with cells
- Sort state announced
- Filter state announced
- Pagination state announced

**ARIA Attributes:**
- `aria-sort` for sortable columns
- `aria-label` for table description
- `aria-live` for dynamic updates
- `role="columnheader"` for sortable headers

---

## Performance Considerations

### Virtual Scrolling

**For Large Datasets:**
- Render only visible rows
- Virtual scrolling for 100+ rows
- Smooth scrolling performance
- Maintain scroll position

**Implementation:**
- Use libraries like `react-window` or `react-virtualized`
- Calculate visible range
- Render only visible items
- Preserve scroll position on updates

### Lazy Loading

**For Paginated Tables:**
- Load data as pages are requested
- Prefetch next page (optional)
- Loading states during fetch
- Error handling for failed loads

### Optimization

**Best Practices:**
- Memoize table components
- Debounce search/filter inputs
- Optimize re-renders
- Use CSS for styling (not inline styles)
- Minimize DOM manipulation

---

## Integration with Data Sources

### API Integration

**Pattern:**
- Fetch data via `/api/v1/` endpoints
- Use `src/core/<domain>/repo.ts` for data access
- Transform data in core layer, not in table component
- Handle loading and error states

**Example:**
```tsx
// In core layer
export async function getUsers(filters, sort, pagination) {
  // Fetch and transform data
  return users;
}

// In table component
const users = await getUsers(filters, sort, pagination);
```

### Data Transformation

**Requirements:**
- Transform data in core layer, not table component
- Table component receives formatted data
- Consistent data format across tables
- Type-safe data structures

---

## Styling Guidelines

### Design Tokens

**Use Semantic Tokens:**
- `--token-surface` for table background
- `--token-surface-alt` for header background
- `--token-border` for borders
- `--token-text-primary` for text
- `--token-text-secondary` for secondary text
- `--token-accent` for sort indicators and links

### Table Styles

**Requirements:**
- Consistent spacing (use spacing scale)
- Clear borders or row separators
- Hover states for rows (desktop)
- Active states for selected rows
- Focus states for keyboard navigation

---

## Related Documentation

- [Mobile UX Guidelines](mre-mobile-ux-guidelines.md) - Mobile-specific requirements
- [Mobile-Safe Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md) - Architecture rules
- [Version 0.1.1 Feature Scope](../specs/mre-v0.1-feature-scope.md) - Feature specifications
- [Dark Theme Guidelines](mre-dark-theme-guidelines.md) - Visual styling

---

## License

Internal use only. This document defines table component specifications for version 0.1.1 of MRE.

