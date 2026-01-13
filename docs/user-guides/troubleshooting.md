---
created: 2026-01-27
creator: Jayson Brenton
lastModified: 2026-01-27
description: Troubleshooting guide for common issues in My Race Engineer
purpose: Provides solutions for common problems users may encounter, including login issues, event import failures, search problems, and performance issues.
relatedFiles:
  - docs/user-stories/user-journeys.md
  - docs/architecture/error-handling.md
---

# Troubleshooting Guide

Find solutions to common issues you may encounter while using My Race Engineer.

## Introduction

This guide helps you resolve common problems and issues when using MRE. If you can't find a solution here, contact support for additional help.

## Prerequisites

- Access to MRE application
- Basic troubleshooting knowledge
- Browser with JavaScript enabled

## Login Issues

### Can't Log In

**Symptoms:**
- Error message: "Invalid email/username or password"
- Login button doesn't work
- Page doesn't respond

**Solutions:**

1. **Verify Credentials:**
   - Check that email/username is correct
   - Verify password is correct (check caps lock)
   - Try typing password in a text editor first to verify

2. **Check Account Status:**
   - Ensure account exists (try registration if new)
   - Account may be locked after too many failed attempts
   - Wait 15-30 minutes if locked, then try again

3. **Browser Issues:**
   - Clear browser cache and cookies
   - Try a different browser
   - Disable browser extensions temporarily
   - Enable JavaScript

4. **Network Issues:**
   - Check internet connection
   - Try refreshing the page
   - Check if MRE service is available

**Still Not Working?**
- Contact support with your email/username
- Provide details about the error message
- Include browser and device information

### Session Expired

**Symptoms:**
- Message: "Your session has expired. Please log in again."
- Redirected to login page
- Work may be lost

**Solutions:**
- Simply log in again
- This is normal after period of inactivity
- Save work frequently to avoid data loss

**Prevention:**
- Stay active while using MRE
- Save important work before leaving
- Use "Remember Me" if available (on trusted devices)

## Event Search Issues

### No Events Found

**Symptoms:**
- Search returns no results
- Message: "No events found for this track and date range"
- Empty results table

**Solutions:**

1. **Check Search Criteria:**
   - Verify track name is correct
   - Ensure date range is valid (not future dates)
   - Try expanding date range (up to 3 months)
   - Check that start date is before end date

2. **Try Different Search:**
   - Select a different track
   - Try a broader date range
   - Check if events exist on LiveRC for that track/date

3. **Verify Track Selection:**
   - Track may not have events in selected range
   - Try searching for a more popular track
   - Check track name spelling

**Still No Results?**
- Event may not be on LiveRC yet
- Track may not have events in that date range
- Try manual search on LiveRC to verify

### Search Not Working

**Symptoms:**
- Search button doesn't respond
- Page freezes during search
- Error message appears

**Solutions:**

1. **Browser Issues:**
   - Refresh the page
   - Clear browser cache
   - Try different browser
   - Check browser console for errors

2. **Network Issues:**
   - Check internet connection
   - Wait a few minutes and try again
   - Check if MRE service is available

3. **Form Validation:**
   - Ensure all required fields are filled
   - Check for validation errors (red text)
   - Fix any errors before searching

## Event Import Issues

### Import Failed

**Symptoms:**
- Event status shows "Failed import"
- Red error indicator
- Event not available for analysis

**Solutions:**

1. **Retry Import:**
   - Click checkbox to select failed event
   - Click "Import selected events" again
   - Wait for import to complete
   - Status should update

2. **Check LiveRC:**
   - Verify event exists on LiveRC
   - Event data may be temporarily unavailable
   - Try again later if LiveRC is down

3. **Network Issues:**
   - Check internet connection
   - Import may timeout on slow connections
   - Try again when connection is stable

**Still Failing?**
- Event data structure may have changed
- May need administrator attention
- Contact support with event details

### Import Taking Too Long

**Symptoms:**
- Status shows "Importing" for extended time
- No progress indicator
- Event not completing

**Solutions:**

1. **Wait Longer:**
   - Large events take time to import
   - Can take several minutes
   - Be patient and wait

2. **Check Status:**
   - Refresh page to see updated status
   - Status may have changed
   - Check if import completed

3. **Retry if Needed:**
   - If stuck for more than 10 minutes, try canceling
   - Select event and retry import
   - May have timed out

### Import Already in Progress

**Symptoms:**
- Error: "Ingestion already in progress for this event"
- Can't start new import
- Event stuck in "Importing" status

**Solutions:**

1. **Wait for Completion:**
   - Import is already running
   - Wait for it to finish
   - Status will update when complete

2. **Check Status:**
   - Refresh page to see current status
   - May have completed
   - Check if status changed

3. **Contact Support:**
   - If stuck for extended time
   - May need administrator intervention
   - Provide event details

## Event Analysis Issues

### Charts Not Displaying

**Symptoms:**
- Charts are blank
- Error messages in charts
- Data not visible

**Solutions:**

1. **Browser Issues:**
   - Enable JavaScript
   - Try different browser
   - Clear browser cache
   - Check browser console for errors

2. **Data Issues:**
   - Ensure event is fully imported
   - Check event status (should be "Stored")
   - Event may have incomplete data

3. **Refresh Page:**
   - Refresh to reload charts
   - May be a temporary display issue
   - Try again after refresh

### Missing Data in Analysis

**Symptoms:**
- Some data missing
- Incomplete charts
- Empty sections

**Solutions:**

1. **Check Event Status:**
   - Event must be "Stored" or "Imported"
   - Re-import if status is "Failed"
   - Wait for import to complete

2. **Data Completeness:**
   - Event may have incomplete data from LiveRC
   - Some events have limited data
   - Check if data exists on LiveRC

3. **Filters:**
   - Check if filters are hiding data
   - Clear filters to see all data
   - Adjust filter settings

## Performance Issues

### Page Loading Slowly

**Symptoms:**
- Pages take long to load
- Spinning indicators
- Timeout errors

**Solutions:**

1. **Network Issues:**
   - Check internet connection speed
   - Try wired connection instead of WiFi
   - Close other bandwidth-heavy applications

2. **Browser Issues:**
   - Close unnecessary browser tabs
   - Clear browser cache
   - Disable browser extensions
   - Try different browser

3. **Large Data Sets:**
   - Events with many drivers/laps load slower
   - Be patient with large events
   - Use filters to reduce data shown

### Application Freezing

**Symptoms:**
- Page becomes unresponsive
- Clicks don't work
- Browser tab shows "Not Responding"

**Solutions:**

1. **Wait:**
   - May be processing large data
   - Wait 30-60 seconds
   - May recover automatically

2. **Refresh:**
   - Refresh the page
   - May need to log in again
   - Unsaved work may be lost

3. **Browser Restart:**
   - Close and reopen browser
   - Clear browser cache
   - Restart computer if needed

## Navigation Issues

### Can't Find Features

**Symptoms:**
- Don't know where features are
- Navigation confusing
- Features seem missing

**Solutions:**

1. **Use Guides:**
   - Check User Guides section
   - Guides explain where features are
   - Follow guide instructions

2. **Use Navigation Menu:**
   - Browse main navigation
   - Check all menu sections
   - Look in submenus

3. **Use Breadcrumbs:**
   - Breadcrumbs show current location
   - Click to navigate back
   - Understand page hierarchy

### Menu Not Visible

**Symptoms:**
- Can't see navigation menu
- Hamburger menu not working
- Sidebar missing

**Solutions:**

1. **Look for Hamburger Icon:**
   - Usually in top-left corner
   - Click to open menu
   - May be collapsed

2. **Browser Issues:**
   - Refresh page
   - Try different browser
   - Check browser zoom level

3. **Mobile View:**
   - Menu may be hidden on mobile
   - Tap hamburger icon to open
   - Swipe or tap outside to close

## Data Issues

### Events Not Matching

**Symptoms:**
- No discovered events
- Events not linking to profile
- Fuzzy matching not working

**Solutions:**

1. **Check Driver Name:**
   - Ensure driver name matches race results
   - Check spelling and format
   - Update if incorrect

2. **Import Events:**
   - Events must be imported first
   - Import events you participated in
   - Matching happens after import

3. **Wait for Processing:**
   - Matching may take time
   - Check again later
   - Refresh page to see updates

### Incorrect Data

**Symptoms:**
- Data seems wrong
- Missing information
- Numbers don't match

**Solutions:**

1. **Verify Source:**
   - Check LiveRC for original data
   - Compare with MRE data
   - May be source data issue

2. **Re-import Event:**
   - Try re-importing the event
   - May fix data issues
   - Wait for import to complete

3. **Contact Support:**
   - Report data discrepancies
   - Provide event details
   - Include what seems incorrect

## Getting Help

### When to Contact Support

Contact support if:

- Issues persist after trying solutions
- Error messages you don't understand
- Data seems incorrect
- Features not working as expected
- Security concerns

### Information to Provide

When contacting support, include:

- **Description**: What problem you're experiencing
- **Steps to Reproduce**: What you did before the issue
- **Error Messages**: Exact error text (if any)
- **Browser/Device**: What browser and device you're using
- **Account Info**: Your email/username (for account issues)
- **Screenshots**: If helpful to show the issue

### Self-Service Resources

Before contacting support:

1. **Check This Guide**: Review troubleshooting steps
2. **Review Other Guides**: May have relevant information
3. **Try Solutions**: Attempt suggested fixes
4. **Search Documentation**: Look for related information

## Related Guides

- **[Getting Started Guide](getting-started.md)**: Basic setup and navigation
- **[Event Search Guide](event-search.md)**: Event search troubleshooting
- **[Event Analysis Guide](event-analysis.md)**: Analysis feature help
- **[Account Management Guide](account-management.md)**: Account-related issues

## Prevention Tips

### Avoid Common Issues

1. **Keep Browser Updated**: Use latest browser version
2. **Clear Cache Regularly**: Prevents stale data issues
3. **Use Stable Connection**: Reliable internet helps
4. **Save Work Frequently**: Prevents data loss
5. **Read Error Messages**: Often contain helpful information

### Best Practices

1. **Follow Guides**: Guides explain proper usage
2. **Verify Information**: Double-check before submitting
3. **Be Patient**: Some operations take time
4. **Report Issues**: Help improve MRE by reporting problems

---

**Still need help?** Contact support with details about your issue, and we'll help you resolve it quickly.

