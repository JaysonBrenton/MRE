---
created: 2025-01-27
creator: Documentation Update
lastModified: 2025-12-28
description: Navigation patterns and guidelines for MRE version 0.1.1
purpose: Defines navigation patterns including sidebars, multi-level navigation, tabs, and breadcrumbs for version 0.1.1
relatedFiles:
  - docs/architecture/mobile-safe-architecture-guidelines.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# Navigation Patterns Guide

**Document Status:** Version 0.1.1 Feature Specification  
**Authoritative Scope:** Applies to all navigation in version 0.1.1  
**Purpose:** Defines navigation patterns, implementation guidelines, and best practices for breadcrumb navigation (primary), simplified hamburger menus, multi-level navigation, and tabs.

---

## Table of Contents

1. [Overview](#overview)
2. [Breadcrumb Navigation (Primary Pattern)](#breadcrumb-navigation-primary-pattern)
3. [Sidebar Navigation](#sidebar-navigation)
4. [Multi-Level Dropdown Menus (Secondary Pattern)](#multi-level-dropdown-menus-secondary-pattern)
5. [Tab Navigation (Secondary Pattern)](#tab-navigation-secondary-pattern)
6. [Accessibility Requirements](#accessibility-requirements)

---

## Overview

Version 0.1.1 includes navigation features to support complex application structures optimized for desktop viewports. **Breadcrumb navigation is the primary navigation pattern** for version 0.1.1. All navigation patterns must be accessible and consistent.

**Key Principles:**
- Breadcrumb navigation is the primary pattern (preferred method)
- Desktop-optimized design approach
- Keyboard navigation support
- Screen reader compatibility
- Consistent behavior

---

## Breadcrumb Navigation (Primary Pattern)

### Purpose

Breadcrumb navigation is the **primary navigation pattern** for version 0.1.1. It shows the current location in the application hierarchy and provides quick navigation to parent levels. Breadcrumbs should be implemented on all pages with hierarchical navigation.

### Implementation Guidelines

**Structure:**
- Home > Section > Subsection > Current Page
- Separator between levels (typically ">" or "/")
- Each level is clickable (except current page)
- Current page shown as plain text (not clickable)

**Behavior:**
- Show full breadcrumb path
- Hover states on clickable items
- Tooltip for truncated items (if applicable)

**Design Requirements:**
- Clear visual separation between levels
- Accessible separator (visible and screen-reader friendly)
- Consistent styling with rest of navigation
- Preferred navigation method for version 0.1.1

**Accessibility:**
- ARIA breadcrumb structure: `role="navigation"`, `aria-label="Breadcrumb"`
- List structure: `<nav aria-label="Breadcrumb"><ol>...</ol></nav>`
- Current page: `aria-current="page"`
- Screen reader support for navigation path

**Example Structure:**
```tsx
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/section">Section</a></li>
    <li aria-current="page">Current Page</li>
  </ol>
</nav>
```

**Use Cases:**
- Deep navigation hierarchies (e.g., Dashboard > Events > Event Detail > Race Analysis)
- Multi-level page structures
- Showing user location in complex application flows
- Quick navigation to parent pages

---

## Simplified Hamburger Menus

### Purpose

Simplified hamburger menus provide a basic navigation toggle for mobile devices while complementing sidebar navigation on desktop. This is a simplified implementation with basic open/close functionality and minimal features.

### Implementation Guidelines

**Mobile Behavior:**
- Basic open/close toggle functionality
- Hamburger menu icon visible on mobile devices (< 900px width)
- Tapping hamburger icon opens navigation drawer or sidebar
- Simple state management (open/closed)
- Close button or tap-outside-to-close functionality
- Minimal animations (basic transitions, 300ms or less)

**Desktop Behavior:**
- Simplified hamburger menu complements sidebar navigation
- Sidebar navigation preferred on desktop
- Hamburger menu can be used for secondary navigation or mobile view toggle
- Consistent navigation structure between hamburger and sidebar

**Design Requirements:**
- Minimum 44px × 44px touch target for hamburger icon
- Clear visual indicator when menu is open
- Basic icon state (hamburger icon when closed, X icon when open)
- High contrast icon for visibility
- Positioned consistently (typically top-left or top-right)
- Simple state management (no complex animations)

**Accessibility:**
- ARIA labels: `aria-label="Open navigation menu"` / `aria-label="Close navigation menu"`
- ARIA expanded state: `aria-expanded="true"` / `aria-expanded="false"`
- Keyboard support: Enter/Space to toggle, Escape to close
- Basic focus management
- Screen reader announcements when menu opens/closes

**Example Structure:**
```tsx
<button
  aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
  aria-expanded={isOpen}
  onClick={toggleMenu}
  className="hamburger-menu-button"
>
  {isOpen ? <CloseIcon /> : <HamburgerIcon />}
</button>
```

**Note:** This is a simplified implementation. Complex animations, advanced state management, and sophisticated interactions are not required for version 0.1.1.

---

## Sidebar Navigation

### Purpose

Sidebar navigation provides persistent access to main application sections. The sidebar can be collapsed to icon-only mode for a more compact view, or expanded to show full labels and descriptions.

### Implementation Guidelines

**Collapsed Mode (Icon-Only):**
- Sidebar width: 80px
- Only icons visible
- Tooltips appear on hover to show item labels
- All main navigation items remain accessible
- Guides section has special expandable menu behavior

**Expanded Mode:**
- Sidebar width: 256px (w-64)
- Icons, labels, and descriptions visible
- Full navigation context available
- Guides section shows collapsible "User Guides" button

### Guides Menu Behavior

**Collapsed Sidebar:**
- Guides icon appears at bottom of sidebar
- Clicking the icon expands an inline menu showing all guide items
- Icon rotates 90 degrees when menu is expanded
- Each guide item appears as an icon with tooltip
- Menu stays open when navigating to a guide
- Click icon again to collapse menu
- Icon links to `/guides` (guides index page)

**Expanded Sidebar:**
- "User Guides" button with expand/collapse functionality
- Expanded state persisted in localStorage
- All guides listed with full names
- Click button to toggle expanded state

**Design Requirements:**
- Smooth transitions when expanding/collapsing
- Visual feedback for expanded state (icon rotation, background highlight)
- Consistent spacing and styling with rest of sidebar
- Tooltips for all guide items in collapsed mode
- Active state highlighting for current guide

**Accessibility:**
- ARIA expanded state: `aria-expanded="true"` / `aria-expanded="false"`
- Proper ARIA labels for guides menu button
- Tooltip support for icon-only items
- Keyboard navigation support
- Screen reader announcements for menu state changes

---

## Multi-Level Dropdown Menus (Secondary Pattern)

### Purpose

Multi-level dropdown menus support hierarchical navigation structures with nested menu items. **This is a secondary navigation pattern** - use when breadcrumb navigation is insufficient for navigation needs.

### Implementation Guidelines

**Structure:**
- Parent items can have child items
- Maximum nesting depth: 3 levels (to maintain usability)
- Visual indicators for items with children (chevron, arrow)
- Expandable/collapsible submenus

**Mobile Behavior:**
- Tap parent item to expand submenu
- Submenu slides in or expands inline
- Breadcrumb-style navigation for deep levels
- Back button to return to parent level
- Clear visual hierarchy

**Desktop Behavior:**
- Hover or click to expand submenu
- Submenu appears as dropdown panel
- Keyboard navigation with arrow keys
- Escape to close submenu

**Design Requirements:**
- Clear visual hierarchy (indentation, icons)
- Minimum 44px touch target for all menu items
- Visual feedback on interaction (hover, active states)
- Smooth expand/collapse animations
- Maximum submenu width to prevent overflow

**Accessibility:**
- ARIA menu structure: `role="menu"`, `role="menuitem"`
- ARIA expanded state for parent items
- Keyboard navigation: Arrow keys to navigate, Enter to activate
- Screen reader support for menu structure
- Focus management for nested menus

**Example Structure:**
```tsx
<nav role="menu">
  <button role="menuitem" aria-expanded={isExpanded}>
    Parent Item
    <ChevronIcon />
  </button>
  {isExpanded && (
    <ul role="menu">
      <li role="menuitem">Child Item 1</li>
      <li role="menuitem">Child Item 2</li>
    </ul>
  )}
</nav>
```

---

## Tab Navigation (Secondary Pattern)

### Purpose

Tab navigation organizes related content into distinct sections within a single page or view. **This is a secondary navigation pattern** - use for organizing content within a single page context, not for primary application navigation.

### Implementation Guidelines

**Structure:**
- Horizontal tabs for desktop
- Scrollable horizontal tabs for mobile (if many tabs)
- Tab panels with associated content
- Active tab clearly indicated

**Mobile Behavior:**
- Horizontal scrolling for tabs if needed
- Touch-friendly tab switching
- Swipe gestures optional (for mobile apps)
- Tab labels truncate with ellipsis if needed
- Minimum tab width: 80px

**Desktop Behavior:**
- Fixed-width or flexible tabs
- Hover states for better UX
- Keyboard navigation support

**Design Requirements:**
- Minimum 44px height for tabs
- Clear active state (underline, background color, or border)
- Sufficient spacing between tabs
- Accessible color contrast
- Responsive tab sizing

**Accessibility:**
- ARIA tab structure: `role="tablist"`, `role="tab"`, `role="tabpanel"`
- ARIA selected state: `aria-selected="true"`
- Keyboard navigation: Arrow keys to switch tabs, Enter to activate
- Tab order management
- Screen reader announcements for tab changes

**Example Structure:**
```tsx
<div role="tablist">
  <button role="tab" aria-selected={activeTab === 'tab1'}>
    Tab 1
  </button>
  <button role="tab" aria-selected={activeTab === 'tab2'}>
    Tab 2
  </button>
</div>
<div role="tabpanel">
  {/* Tab content */}
</div>
```

---


---

---

## Accessibility Requirements

### Keyboard Navigation

All navigation components must support keyboard navigation:

- **Tab**: Navigate between interactive elements
- **Enter/Space**: Activate menu items or toggle menus
- **Arrow Keys**: Navigate within menus (up/down for vertical, left/right for horizontal)
- **Escape**: Close open menus or dialogs
- **Home/End**: Jump to first/last item in menu

### Screen Reader Support

- Proper ARIA roles and attributes
- Descriptive labels for all interactive elements
- State announcements (menu open/closed, tab selected)
- Navigation structure announcements
- Current location announcements (breadcrumbs)

### Focus Management

- Visible focus indicators on all interactive elements
- Focus trap when menu is open
- Focus return to trigger when menu closes
- Logical tab order throughout navigation

---

## Performance Considerations

- Lazy load navigation menus if they contain many items
- Optimize animations (use CSS transforms, not layout properties)
- Minimize DOM manipulation
- Cache navigation structure when possible
- Debounce scroll/resize handlers

---

## Related Documentation

- [Architecture Guidelines](../architecture/mobile-safe-architecture-guidelines.md) - Architecture rules
- [Version 0.1.1 Feature Scope](../specs/mre-v0.1-feature-scope.md) - Feature specifications

---

## License

Internal use only. This document defines navigation patterns for version 0.1.1 of MRE.

