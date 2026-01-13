---
created: 2026-01-27
creator: Jayson Brenton
lastModified: 2026-01-27
description: Guide to navigating My Race Engineer application
purpose: Provides comprehensive instructions for using breadcrumb navigation, menus, tabs, keyboard shortcuts, and finding features throughout the application.
relatedFiles:
  - docs/design/navigation-patterns.md
  - docs/specs/mre-v0.1-feature-scope.md
---

# Navigation Guide

Learn how to navigate My Race Engineer effectively using breadcrumbs, menus, tabs, keyboard shortcuts, and other navigation patterns.

## Introduction

MRE uses several navigation patterns to help you move through the application efficiently. Understanding these patterns will help you find features quickly and navigate with confidence.

## Prerequisites

- You must be logged into MRE
- Basic familiarity with web applications

## Breadcrumb Navigation

Breadcrumb navigation is the **primary navigation pattern** in MRE. It shows your current location and provides a path back to previous sections.

### Understanding Breadcrumbs

Breadcrumbs appear at the top of most pages and show your navigation path:

**Example:**
```
Home > Guides > Getting Started
```

**Components:**
- **Home**: Starting point (usually Dashboard)
- **Intermediate Sections**: Clickable links to previous sections
- **Current Page**: Final item (not clickable, shows where you are)

### Using Breadcrumbs

**Navigate Back:**
1. Click any breadcrumb item to go back to that section
2. Each click moves you one level up the hierarchy
3. Useful for quick navigation without using the back button

**Example Navigation:**
- You're on: `Home > Event Search > Event Analysis`
- Click "Event Search" to return to search results
- Click "Home" to return to dashboard

### Breadcrumb Benefits

- **Clear Location**: Always know where you are
- **Quick Navigation**: Jump back multiple levels with one click
- **Context**: Understand the page hierarchy
- **Consistency**: Same pattern throughout the application

## Main Navigation Menu

The main navigation provides access to all major sections of MRE.

### Accessing the Menu

**Desktop:**
- Sidebar navigation (usually visible)
- Hamburger menu (if sidebar is collapsed)

**Mobile:**
- Hamburger menu icon (☰) in top corner
- Tap to open/close menu

### Menu Sections

**Dashboard:**
- Your personal dashboard
- Statistics and quick actions
- Usually the default landing page

**Event Search:**
- Search for race events
- Import events from LiveRC
- Core feature for discovering events

**My Events:**
- View all your events
- Filter and sort your events
- Access event analysis

**Guides:**
- User guides and documentation
- Help and tutorials
- This guide and others

### Menu Behavior

**Desktop:**
- Sidebar may be collapsible
- Hover to expand submenus
- Click to navigate

### Guides Menu in Collapsed Sidebar

When the sidebar is collapsed (icon-only mode), the guides section has special behavior:

**Collapsed Sidebar Guides Menu:**
- A guides icon appears at the bottom of the collapsed sidebar
- Clicking the guides icon expands a menu showing all available guides
- The icon rotates when the menu is expanded to indicate its state
- Each guide appears as an icon with a tooltip showing its name
- Clicking a guide link navigates to that guide while keeping the menu open
- Click the guides icon again to collapse the menu
- The guides icon links to `/guides` (the guides index page) for right-click or middle-click navigation

**Expanded Sidebar Guides Section:**
- When the sidebar is expanded, the guides section shows a "User Guides" button
- Click the button to expand/collapse the list of guides
- The expanded state is remembered in your browser's local storage
- All guides are listed with their full names

**Mobile:**
- Full-screen overlay when open
- Tap outside to close
- Swipe to close (if supported)

## Tab Navigation

Some pages use tabs to organize related content within a single page.

### Understanding Tabs

Tabs appear horizontally (desktop) or as a scrollable list (mobile):

**Example (Event Analysis):**
- Overview
- Drivers
- Sessions / Heats
- Comparisons

### Using Tabs

**Switching Tabs:**
1. Click or tap a tab to switch to that section
2. Active tab is highlighted
3. Content updates to show selected tab's information

**Keyboard Navigation:**
- Arrow keys to move between tabs
- Enter or Space to select
- Tab key to move focus to tab content

### Tab Features

- **Active Indicator**: Current tab is visually distinct
- **Content Switching**: Only active tab's content is visible
- **State Persistence**: Selected tab may be remembered
- **Accessibility**: Keyboard and screen reader support

## Dropdown Menus

Some navigation items have dropdown menus for sub-options.

### Multi-Level Dropdowns

**Structure:**
- Main menu item
- Submenu items (appear on hover or click)
- Nested submenus (if applicable)

**Usage:**
1. Hover or click main menu item
2. Submenu appears
3. Click submenu item to navigate
4. Menu closes after selection

### Dropdown Behavior

**Desktop:**
- Hover to open
- Click to navigate
- Click outside to close

**Mobile:**
- Tap to open
- Tap item to navigate
- Tap outside to close

## Keyboard Shortcuts

MRE supports keyboard shortcuts for common actions.

### Navigation Shortcuts

**General Navigation:**
- **Alt + H**: Go to Home/Dashboard
- **Alt + S**: Go to Event Search
- **Alt + E**: Go to My Events
- **Alt + G**: Go to Guides

**Page Navigation:**
- **Esc**: Close modals or menus
- **Tab**: Move focus to next element
- **Shift + Tab**: Move focus to previous element
- **Enter**: Activate focused element

**Tab Navigation:**
- **Arrow Left/Right**: Switch between tabs
- **Home**: Go to first tab
- **End**: Go to last tab

### Form Shortcuts

- **Enter**: Submit form (when in form)
- **Esc**: Cancel or close form
- **Tab**: Move to next field
- **Shift + Tab**: Move to previous field

### Browser Shortcuts

Standard browser shortcuts also work:

- **Back**: Browser back button or Alt + Left Arrow
- **Forward**: Browser forward button or Alt + Right Arrow
- **Refresh**: F5 or Ctrl/Cmd + R
- **Find**: Ctrl/Cmd + F

## Finding Features

### Using Search

**Global Search (if available):**
1. Look for search icon or box
2. Type feature name or keyword
3. Results show matching pages or features
4. Click to navigate

### Using Navigation Menu

1. Browse main navigation menu
2. Look for descriptive menu items
3. Check submenus for related features
4. Use breadcrumbs to understand location

### Using Guides

1. Navigate to Guides section
2. Browse available guides
3. Guides explain where features are located
4. Follow guide instructions to find features

## Mobile vs Desktop Differences

### Desktop Navigation

**Features:**
- Sidebar navigation (usually always visible)
- Hover interactions
- Multi-column layouts
- More screen space for navigation

**Patterns:**
- Breadcrumbs at top
- Sidebar on left
- Tabs horizontal
- Dropdowns on hover

### Mobile Navigation

**Features:**
- Hamburger menu (hidden by default)
- Touch interactions
- Single column layouts
- Full-screen overlays

**Patterns:**
- Breadcrumbs at top (may be abbreviated)
- Hamburger menu icon
- Tabs scrollable horizontal
- Dropdowns on tap

### Responsive Behavior

- Navigation adapts to screen size
- Touch targets are larger on mobile (44px minimum)
- Menus may collapse on smaller screens
- Layout adjusts automatically

## Navigation Tips

### Efficient Navigation

1. **Use Breadcrumbs**: Quick way to go back multiple levels
2. **Learn Shortcuts**: Keyboard shortcuts save time
3. **Bookmark Pages**: Use browser bookmarks for frequently visited pages
4. **Use Search**: If available, search is faster than browsing

### Understanding Location

1. **Check Breadcrumbs**: Always know where you are
2. **Look at URL**: URL shows current page path
3. **Notice Highlights**: Active menu items are highlighted
4. **Read Page Headers**: Headers confirm current section

### Getting Unstuck

1. **Click Home**: Always returns to dashboard
2. **Use Breadcrumbs**: Navigate back step by step
3. **Check Menu**: Browse menu to find other sections
4. **Use Back Button**: Browser back button works too

## Common Navigation Issues

### Menu Not Visible

**Possible Causes:**
- Sidebar collapsed
- Mobile menu not opened
- Browser zoom issue

**Solutions:**
- Look for hamburger menu icon
- Click to expand sidebar
- Check browser zoom level
- Refresh page

### Guides Menu Not Expanding

**Possible Causes:**
- Sidebar is expanded (guides menu only works in collapsed mode)
- JavaScript disabled
- Browser compatibility issue

**Solutions:**
- Collapse the sidebar to see the guides menu icon
- In expanded sidebar, use the "User Guides" button instead
- Enable JavaScript
- Try a different browser
- Refresh the page

### Breadcrumbs Missing

**Possible Causes:**
- On home page (no breadcrumbs needed)
- Page doesn't use breadcrumbs
- Layout issue

**Solutions:**
- Check if you're on dashboard/home
- Some pages may not have breadcrumbs
- Try refreshing page

### Tabs Not Working

**Possible Causes:**
- JavaScript disabled
- Browser compatibility
- Page loading issue

**Solutions:**
- Enable JavaScript
- Try different browser
- Refresh page
- Check browser console for errors

## Related Guides

- **[Getting Started Guide](getting-started.md)**: Learn the basics
- **[Dashboard Guide](dashboard.md)**: Navigate your dashboard
- **[Event Search Guide](event-search.md)**: Navigate event search

## Next Steps

After mastering navigation:

1. Explore all main sections using the menu
2. Practice using breadcrumbs to navigate back
3. Try keyboard shortcuts for faster navigation
4. Customize your navigation preferences if available

---

**Ready to explore?** Use the navigation menu and breadcrumbs to discover all the features MRE has to offer!

