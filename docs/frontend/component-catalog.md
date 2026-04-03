---
created: 2026-03-22
description: UI component inventory aligned with src/components
purpose:
  One row per component module (build-first). Regenerate with
  scripts/generate-component-catalog-markdown.mjs after adding/removing files.
relatedFiles:
  - docs/architecture/atomic-design-system.md
  - docs/reference/generated/component-files.manifest.json
---

# MRE component catalog

**Generated:** 2026-03-22T10:14:33.213Z  
**Count:** 155 files  
**Exclusions:** Excludes: _.test.ts, _.test.tsx, **tests**/**,
organisms/**/overview-testing/\*\*

This catalog lists every production component file under
[`src/components/`](../../src/components/). Tier and feature area come from path
conventions in
[`docs/architecture/atomic-design-system.md`](../architecture/atomic-design-system.md).
**Purpose** is a short human-readable label derived from the filename; read the
source file for behavior and props.

## admin

| File                                                              | Tier             | Purpose                         |
| ----------------------------------------------------------------- | ---------------- | ------------------------------- |
| `src/components/organisms/admin/AdminDashboardStats.tsx`          | organism (admin) | Admin Dashboard Stats           |
| `src/components/organisms/admin/AuditLogTable.tsx`                | organism (admin) | Audit Log Table                 |
| `src/components/organisms/admin/DeleteConfirmationDialog.tsx`     | organism (admin) | Delete Confirmation Dialog      |
| `src/components/organisms/admin/EditUserModal.tsx`                | organism (admin) | Edit User Modal                 |
| `src/components/organisms/admin/EventsTable.tsx`                  | organism (admin) | Events Table                    |
| `src/components/organisms/admin/HealthStatus.tsx`                 | organism (admin) | Health Status                   |
| `src/components/organisms/admin/IngestionControls.tsx`            | organism (admin) | Ingestion Controls              |
| `src/components/organisms/admin/LogViewer.tsx`                    | organism (admin) | Log Viewer                      |
| `src/components/organisms/admin/TracksTable.tsx`                  | organism (admin) | Tracks Table                    |
| `src/components/organisms/admin/UsersTable.tsx`                   | organism (admin) | Users Table                     |
| `src/components/organisms/admin/VenueCorrectionRequestsTable.tsx` | organism (admin) | Venue Correction Requests Table |

## atoms

| File                                      | Tier | Purpose         |
| ----------------------------------------- | ---- | --------------- |
| `src/components/atoms/Breadcrumbs.tsx`    | atom | Breadcrumbs     |
| `src/components/atoms/Button.tsx`         | atom | Button          |
| `src/components/atoms/ChartIcon.tsx`      | atom | Chart Icon      |
| `src/components/atoms/ListRow.tsx`        | atom | List Row        |
| `src/components/atoms/LoadingState.tsx`   | atom | Loading State   |
| `src/components/atoms/StandardButton.tsx` | atom | Standard Button |
| `src/components/atoms/StandardInput.tsx`  | atom | Standard Input  |
| `src/components/atoms/StatusBadge.tsx`    | atom | Status Badge    |
| `src/components/atoms/Switch.tsx`         | atom | Switch          |

## dashboard

| File                                                                   | Tier                 | Purpose                         |
| ---------------------------------------------------------------------- | -------------------- | ------------------------------- |
| `src/components/organisms/dashboard/DashboardClient.tsx`               | organism (dashboard) | Dashboard Client                |
| `src/components/organisms/dashboard/DashboardEventSearchProvider.tsx`  | organism (dashboard) | Dashboard Event Search Provider |
| `src/components/organisms/dashboard/DashboardEventSelector.tsx`        | organism (dashboard) | Dashboard Event Selector        |
| `src/components/organisms/dashboard/DriverCardsAndWeatherGrid.tsx`     | organism (dashboard) | Driver Cards And Weather Grid   |
| `src/components/organisms/dashboard/EventActionsContext.tsx`           | organism (dashboard) | Event Actions Context           |
| `src/components/organisms/dashboard/EventActionsProvider.tsx`          | organism (dashboard) | Event Actions Provider          |
| `src/components/organisms/dashboard/EventAnalysisHeaderWrapper.tsx`    | organism (dashboard) | Event Analysis Header Wrapper   |
| `src/components/organisms/dashboard/EventAnalysisSection.tsx`          | organism (dashboard) | Event Analysis Section          |
| `src/components/organisms/dashboard/ImprovementDriverCard.tsx`         | organism (dashboard) | Improvement Driver Card         |
| `src/components/organisms/dashboard/shell/AdaptiveNavigationRail.tsx`  | organism (dashboard) | Adaptive Navigation Rail        |
| `src/components/organisms/dashboard/shell/CommandPalette.tsx`          | organism (dashboard) | Command Palette                 |
| `src/components/organisms/dashboard/shell/ContextRibbon.tsx`           | organism (dashboard) | Context Ribbon                  |
| `src/components/organisms/dashboard/shell/DashboardActionsPopover.tsx` | organism (dashboard) | Dashboard Actions Popover       |
| `src/components/organisms/dashboard/shell/EventSearchModal.tsx`        | organism (dashboard) | Event Search Modal              |
| `src/components/organisms/dashboard/shell/TopStatusBar.tsx`            | organism (dashboard) | Top Status Bar                  |
| `src/components/organisms/dashboard/shell/UserProfileModal.tsx`        | organism (dashboard) | User Profile Modal              |

## event-analysis

| File                                                                          | Tier                      | Purpose                          |
| ----------------------------------------------------------------------------- | ------------------------- | -------------------------------- |
| `src/components/organisms/event-analysis/AvgVsFastestChart.tsx`               | organism (event-analysis) | Avg Vs Fastest Chart             |
| `src/components/organisms/event-analysis/BestLapBarChart.tsx`                 | organism (event-analysis) | Best Lap Bar Chart               |
| `src/components/organisms/event-analysis/ChartColorPicker.tsx`                | organism (event-analysis) | Chart Color Picker               |
| `src/components/organisms/event-analysis/ChartContainer.tsx`                  | organism (event-analysis) | Chart Container                  |
| `src/components/organisms/event-analysis/ChartControls.tsx`                   | organism (event-analysis) | Chart Controls                   |
| `src/components/organisms/event-analysis/ChartDataNotice.tsx`                 | organism (event-analysis) | Chart Data Notice                |
| `src/components/organisms/event-analysis/ChartDriverPicker.tsx`               | organism (event-analysis) | Chart Driver Picker              |
| `src/components/organisms/event-analysis/ChartPagination.tsx`                 | organism (event-analysis) | Chart Pagination                 |
| `src/components/organisms/event-analysis/ChartSection.tsx`                    | organism (event-analysis) | Chart Section                    |
| `src/components/organisms/event-analysis/ChartTypeSelector.tsx`               | organism (event-analysis) | Chart Type Selector              |
| `src/components/organisms/event-analysis/ClassMostImprovedCard.tsx`           | organism (event-analysis) | Class Most Improved Card         |
| `src/components/organisms/event-analysis/ClassTopAverageLapsCard.tsx`         | organism (event-analysis) | Class Top Average Laps Card      |
| `src/components/organisms/event-analysis/ClassTopFastestLapsCard.tsx`         | organism (event-analysis) | Class Top Fastest Laps Card      |
| `src/components/organisms/event-analysis/CollapsibleDriverPanel.tsx`          | organism (event-analysis) | Collapsible Driver Panel         |
| `src/components/organisms/event-analysis/CombinedDriversTable.tsx`            | organism (event-analysis) | Combined Drivers Table           |
| `src/components/organisms/event-analysis/ComparisonsTab.tsx`                  | organism (event-analysis) | Comparisons Tab                  |
| `src/components/organisms/event-analysis/ComparisonTest.tsx`                  | organism (event-analysis) | Comparison Test                  |
| `src/components/organisms/event-analysis/CorrectVenueModal.tsx`               | organism (event-analysis) | Correct Venue Modal              |
| `src/components/organisms/event-analysis/CountryLeaderboardCard.tsx`          | organism (event-analysis) | Country Leaderboard Card         |
| `src/components/organisms/event-analysis/DriverCard.tsx`                      | organism (event-analysis) | Driver Card                      |
| `src/components/organisms/event-analysis/DriverList.tsx`                      | organism (event-analysis) | Driver List                      |
| `src/components/organisms/event-analysis/DriverSelectionHeader.tsx`           | organism (event-analysis) | Driver Selection Header          |
| `src/components/organisms/event-analysis/DriversTab.tsx`                      | organism (event-analysis) | Drivers Tab                      |
| `src/components/organisms/event-analysis/EntryList.tsx`                       | organism (event-analysis) | Entry List                       |
| `src/components/organisms/event-analysis/EntryListTab.tsx`                    | organism (event-analysis) | Entry List Tab                   |
| `src/components/organisms/event-analysis/EventAnalysisActionsMenu.tsx`        | organism (event-analysis) | Event Analysis Actions Menu      |
| `src/components/organisms/event-analysis/EventAnalysisHeader.tsx`             | organism (event-analysis) | Event Analysis Header            |
| `src/components/organisms/event-analysis/EventAnalysisSidebar.tsx`            | organism (event-analysis) | Event Analysis Sidebar           |
| `src/components/organisms/event-analysis/EventAnalysisToolbar.tsx`            | organism (event-analysis) | Event Analysis Toolbar           |
| `src/components/organisms/event-analysis/EventFastestAverageLapsTable.tsx`    | organism (event-analysis) | Event Fastest Average Laps Table |
| `src/components/organisms/event-analysis/EventFastestLapsTable.tsx`           | organism (event-analysis) | Event Fastest Laps Table         |
| `src/components/organisms/event-analysis/EventMostImprovedTable.tsx`          | organism (event-analysis) | Event Most Improved Table        |
| `src/components/organisms/event-analysis/EventStats.tsx`                      | organism (event-analysis) | Event Stats                      |
| `src/components/organisms/event-analysis/EventWinnersTable.tsx`               | organism (event-analysis) | Event Winners Table              |
| `src/components/organisms/event-analysis/HeatsCard.tsx`                       | organism (event-analysis) | Heats Card                       |
| `src/components/organisms/event-analysis/LapByLapTrendChart.tsx`              | organism (event-analysis) | Lap By Lap Trend Chart           |
| `src/components/organisms/event-analysis/LapTimeLineChart.tsx`                | organism (event-analysis) | Lap Time Line Chart              |
| `src/components/organisms/event-analysis/LapTimeTrendCard.tsx`                | organism (event-analysis) | Lap Time Trend Card              |
| `src/components/organisms/event-analysis/LinkYourDriverPrompt.tsx`            | organism (event-analysis) | Link Your Driver Prompt          |
| `src/components/organisms/event-analysis/ListPagination.tsx`                  | organism (event-analysis) | List Pagination                  |
| `src/components/organisms/event-analysis/LiveRCEntryListTable.tsx`            | organism (event-analysis) | Live RC Entry List Table         |
| `src/components/organisms/event-analysis/MainPodiumCard.tsx`                  | organism (event-analysis) | Main Podium Card                 |
| `src/components/organisms/event-analysis/MainsCard.tsx`                       | organism (event-analysis) | Mains Card                       |
| `src/components/organisms/event-analysis/MultiMainOverallCard.tsx`            | organism (event-analysis) | Multi Main Overall Card          |
| `src/components/organisms/event-analysis/MyEventsContent.tsx`                 | organism (event-analysis) | My Events Content                |
| `src/components/organisms/event-analysis/MyLapsContent.tsx`                   | organism (event-analysis) | My Laps Content                  |
| `src/components/organisms/event-analysis/OverviewTab.tsx`                     | organism (event-analysis) | Overview Tab                     |
| `src/components/organisms/event-analysis/PracticeClassLeaderboard.tsx`        | organism (event-analysis) | Practice Class Leaderboard       |
| `src/components/organisms/event-analysis/PracticeDriverSelector.tsx`          | organism (event-analysis) | Practice Driver Selector         |
| `src/components/organisms/event-analysis/PracticeMyDayTab.tsx`                | organism (event-analysis) | Practice My Day Tab              |
| `src/components/organisms/event-analysis/PracticeMySessionsTab.tsx`           | organism (event-analysis) | Practice My Sessions Tab         |
| `src/components/organisms/event-analysis/RaceSelector.tsx`                    | organism (event-analysis) | Race Selector                    |
| `src/components/organisms/event-analysis/sessions/DriverNameFilter.tsx`       | organism (event-analysis) | Driver Name Filter               |
| `src/components/organisms/event-analysis/sessions/DriverPerformanceChart.tsx` | organism (event-analysis) | Driver Performance Chart         |
| `src/components/organisms/event-analysis/sessions/HeatProgressionChart.tsx`   | organism (event-analysis) | Heat Progression Chart           |
| `src/components/organisms/event-analysis/sessions/LapDataTable.tsx`           | organism (event-analysis) | Lap Data Table                   |
| `src/components/organisms/event-analysis/sessions/OverviewChart.tsx`          | organism (event-analysis) | Overview Chart                   |
| `src/components/organisms/event-analysis/sessions/SessionChartTabs.tsx`       | organism (event-analysis) | Session Chart Tabs               |
| `src/components/organisms/event-analysis/sessions/SessionControls.tsx`        | organism (event-analysis) | Session Controls                 |
| `src/components/organisms/event-analysis/sessions/SessionLapDataModal.tsx`    | organism (event-analysis) | Session Lap Data Modal           |
| `src/components/organisms/event-analysis/sessions/SessionsTable.tsx`          | organism (event-analysis) | Sessions Table                   |
| `src/components/organisms/event-analysis/sessions/SessionsTableResults.tsx`   | organism (event-analysis) | Sessions Table Results           |
| `src/components/organisms/event-analysis/sessions/SessionsTableRow.tsx`       | organism (event-analysis) | Sessions Table Row               |
| `src/components/organisms/event-analysis/sessions/ViewModeToggle.tsx`         | organism (event-analysis) | View Mode Toggle                 |
| `src/components/organisms/event-analysis/SessionsTab.tsx`                     | organism (event-analysis) | Sessions Tab                     |
| `src/components/organisms/event-analysis/SidebarAction.tsx`                   | organism (event-analysis) | Sidebar Action                   |
| `src/components/organisms/event-analysis/TabNavigation.tsx`                   | organism (event-analysis) | Tab Navigation                   |
| `src/components/organisms/event-analysis/TemperatureSparkline.tsx`            | organism (event-analysis) | Temperature Sparkline            |
| `src/components/organisms/event-analysis/TrackLeaderboardTab.tsx`             | organism (event-analysis) | Track Leaderboard Tab            |
| `src/components/organisms/event-analysis/UnifiedPerformanceChart.tsx`         | organism (event-analysis) | Unified Performance Chart        |
| `src/components/organisms/event-analysis/WeatherCard.tsx`                     | organism (event-analysis) | Weather Card                     |

## event-search

| File                                                                | Tier                    | Purpose                    |
| ------------------------------------------------------------------- | ----------------------- | -------------------------- |
| `src/components/organisms/event-search/CheckLiveRCButton.tsx`       | organism (event-search) | Check Live RC Button       |
| `src/components/organisms/event-search/DateRangeModal.tsx`          | organism (event-search) | Date Range Modal           |
| `src/components/organisms/event-search/DateRangePicker.tsx`         | organism (event-search) | Date Range Picker          |
| `src/components/organisms/event-search/DateRangePresetPicker.tsx`   | organism (event-search) | Date Range Preset Picker   |
| `src/components/organisms/event-search/EventRow.tsx`                | organism (event-search) | Event Row                  |
| `src/components/organisms/event-search/EventSearchContainer.tsx`    | organism (event-search) | Event Search Container     |
| `src/components/organisms/event-search/EventSearchForm.tsx`         | organism (event-search) | Event Search Form          |
| `src/components/organisms/event-search/EventSearchTableHeader.tsx`  | organism (event-search) | Event Search Table Header  |
| `src/components/organisms/event-search/EventTable.tsx`              | organism (event-search) | Event Table                |
| `src/components/organisms/event-search/ImportPrompt.tsx`            | organism (event-search) | Import Prompt              |
| `src/components/organisms/event-search/TrackAndFavouritesModal.tsx` | organism (event-search) | Track And Favourites Modal |
| `src/components/organisms/event-search/TrackRow.tsx`                | organism (event-search) | Track Row                  |
| `src/components/organisms/event-search/TrackSelectionModal.tsx`     | organism (event-search) | Track Selection Modal      |

## events

| File                                                   | Tier              | Purpose            |
| ------------------------------------------------------ | ----------------- | ------------------ |
| `src/components/organisms/events/EventsPageClient.tsx` | organism (events) | Events Page Client |

## molecules

| File                                            | Tier     | Purpose            |
| ----------------------------------------------- | -------- | ------------------ |
| `src/components/molecules/ContentWrapper.tsx`   | molecule | Content Wrapper    |
| `src/components/molecules/ErrorDisplay.tsx`     | molecule | Error Display      |
| `src/components/molecules/EventStatusBadge.tsx` | molecule | Event Status Badge |
| `src/components/molecules/LabeledSwitch.tsx`    | molecule | Labeled Switch     |
| `src/components/molecules/Modal.tsx`            | molecule | Modal              |
| `src/components/molecules/PageContainer.tsx`    | molecule | Page Container     |
| `src/components/molecules/StandardTable.tsx`    | molecule | Standard Table     |
| `src/components/molecules/Stepper.tsx`          | molecule | Stepper            |
| `src/components/molecules/Tooltip.tsx`          | molecule | Tooltip            |

## practice-days

| File                                                                    | Tier                     | Purpose                       |
| ----------------------------------------------------------------------- | ------------------------ | ----------------------------- |
| `src/components/organisms/practice-days/MonthYearPicker.tsx`            | organism (practice-days) | Month Year Picker             |
| `src/components/organisms/practice-days/PracticeDayRow.tsx`             | organism (practice-days) | Practice Day Row              |
| `src/components/organisms/practice-days/PracticeDaySearchContainer.tsx` | organism (practice-days) | Practice Day Search Container |

## root

| File                                       | Tier | Purpose                 |
| ------------------------------------------ | ---- | ----------------------- |
| `src/components/AdminNav.tsx`              | root | Admin Nav               |
| `src/components/AuthenticatedNav.tsx`      | root | Authenticated Nav       |
| `src/components/AuthenticatedNavLinks.tsx` | root | Authenticated Nav Links |
| `src/components/ConditionalNav.tsx`        | root | Conditional Nav         |
| `src/components/ErrorBoundary.tsx`         | root | Error Boundary          |
| `src/components/Footer.tsx`                | root | Footer                  |
| `src/components/GlobalErrorHandler.tsx`    | root | Global Error Handler    |
| `src/components/Hero.tsx`                  | root | Hero                    |
| `src/components/LogoutButton.tsx`          | root | Logout Button           |
| `src/components/NavBar.tsx`                | root | Nav Bar                 |
| `src/components/Providers.tsx`             | root | Providers               |

## search

| File                                                     | Tier              | Purpose              |
| -------------------------------------------------------- | ----------------- | -------------------- |
| `src/components/organisms/search/SearchForm.tsx`         | organism (search) | Search Form          |
| `src/components/organisms/search/SearchResultsTable.tsx` | organism (search) | Search Results Table |

## store

| File                                     | Tier  | Purpose        |
| ---------------------------------------- | ----- | -------------- |
| `src/components/store/ReduxProvider.tsx` | store | Redux Provider |

## templates

| File                                           | Tier     | Purpose          |
| ---------------------------------------------- | -------- | ---------------- |
| `src/components/templates/DashboardLayout.tsx` | template | Dashboard Layout |

## track-maps

| File                                                           | Tier                  | Purpose                |
| -------------------------------------------------------------- | --------------------- | ---------------------- |
| `src/components/organisms/track-maps/ShapePropertiesPanel.tsx` | organism (track-maps) | Shape Properties Panel |
| `src/components/organisms/track-maps/ShapeToolbar.tsx`         | organism (track-maps) | Shape Toolbar          |
| `src/components/organisms/track-maps/ShareMapDialog.tsx`       | organism (track-maps) | Share Map Dialog       |
| `src/components/organisms/track-maps/TrackMapCanvas.tsx`       | organism (track-maps) | Track Map Canvas       |
| `src/components/organisms/track-maps/TrackMapEditor.tsx`       | organism (track-maps) | Track Map Editor       |

## users

| File                                                 | Tier             | Purpose           |
| ---------------------------------------------------- | ---------------- | ----------------- |
| `src/components/organisms/users/DriverLinkCard.tsx`  | organism (users) | Driver Link Card  |
| `src/components/organisms/users/DriverLinksView.tsx` | organism (users) | Driver Links View |
