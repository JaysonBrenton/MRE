---
created: 2026-01-27
creator: Jayson Brenton
lastModified: 2026-01-27
description: Guide to driver-specific features in My Race Engineer
purpose: Provides comprehensive instructions for viewing discovered events, understanding fuzzy matching, confirming participation, and managing driver information.
relatedFiles:
  - docs/user-stories/user-journeys.md
  - docs/user-stories/liverc-integration.md
---

# Driver Features Guide

Learn how MRE automatically discovers events where you participated, understand match types, confirm your participation, and manage your driver information.

## Introduction

MRE uses intelligent matching to automatically discover events where you participated. This guide explains how the discovery process works, how to view discovered events, and how to confirm or reject participation suggestions.

## Prerequisites

- You must be logged into MRE
- Your driver name must be set in your profile
- Events must be imported into MRE (either by you or other users)

## How Event Discovery Works

### Automatic Discovery

When events are imported into MRE, the system automatically:

1. **Extracts Driver Names**: Gets all driver names from the event data
2. **Normalizes Names**: Converts names to a standard format for comparison
3. **Matches Against Users**: Compares event driver names with all user driver names
4. **Creates Links**: Creates connections between you and events where you likely participated

### Matching Methods

MRE uses three methods to match you with events, in priority order:

#### 1. Transponder Match (Highest Priority)

- **How It Works**: Matches your transponder number (if available) with transponder numbers in event data
- **Accuracy**: Very high - transponder numbers are unique
- **Status**: Automatically confirmed if match found

#### 2. Exact Name Match (Second Priority)

- **How It Works**: Matches your driver name exactly (after normalization) with driver names in events
- **Accuracy**: High - exact matches are reliable
- **Status**: Automatically confirmed if match found

#### 3. Fuzzy Name Match (Third Priority)

- **How It Works**: Uses similarity algorithms to find driver names that are similar to yours
- **Accuracy**: Medium - may include false positives
- **Status**: Marked as "Suggested" - requires your confirmation

### Name Normalization

MRE normalizes driver names to improve matching:

- Converts to lowercase
- Removes extra spaces
- Handles common variations
- Accounts for nicknames and abbreviations

**Example:**
- "John Smith" matches "john smith", "John  Smith", "J. Smith"

## Viewing Discovered Events

### Accessing Discovered Events

**From Dashboard:**
1. Navigate to your Dashboard
2. Look for "Discovered Events" widget or section
3. View events where you've been matched

**From My Events:**
1. Navigate to "My Events" page
2. Filter or look for "Discovered Events" section
3. View all events where you've been matched

**From Event List:**
1. Events where you've been matched show special indicators
2. Look for "Confirmed" or "Suggested" status tags
3. Click to view event details

### Understanding Event Status

Discovered events have different status indicators:

#### Confirmed

- **Visual**: Green tag/badge with checkmark
- **Meaning**: You've confirmed participation OR system matched via transponder/exact name
- **Action**: Event is linked to your profile, view analysis available

#### Suggested

- **Visual**: Blue tag/badge with question mark
- **Meaning**: System suggests you participated (fuzzy match)
- **Action**: Review and confirm or reject the suggestion

#### Rejected (Future Feature)

- **Visual**: Gray tag/badge
- **Meaning**: You've rejected the suggestion
- **Action**: Event won't appear in your discovered events

### Match Type Indicators

Events show how they were matched:

- **Transponder**: Matched via transponder number
- **Exact**: Matched via exact name match
- **Fuzzy**: Matched via fuzzy name similarity

## Confirming Participation

### Reviewing Suggested Events

1. Navigate to discovered events
2. Find events with "Suggested" status
3. Review event details:
   - Event name and date
   - Track location
   - Driver name in event (compare with yours)
   - Match confidence (if shown)

### Confirming a Suggestion

1. Click on a suggested event
2. Review the event details
3. If you participated:
   - Click **"Confirm Participation"** button
   - Status changes to "Confirmed"
   - Event is now linked to your profile

### Rejecting a Suggestion

1. Click on a suggested event
2. Review the event details
3. If you did NOT participate:
   - Click **"Reject"** or **"Not Me"** button
   - Status changes to "Rejected"
   - Event is removed from your discovered events

### Bulk Confirmation (Future Feature)

- Select multiple suggested events
- Confirm or reject all at once
- Saves time when reviewing many suggestions

## Understanding Match Types

### Transponder Match

**What It Means:**
- Your transponder number matches a transponder in the event
- Very reliable - transponders are unique identifiers

**When It Happens:**
- You've registered your transponder number in your profile
- Event data includes transponder numbers
- Numbers match exactly

**Action Required:**
- None - automatically confirmed
- Event is immediately linked to your profile

### Exact Name Match

**What It Means:**
- Your driver name (after normalization) exactly matches a driver name in the event
- High reliability - exact matches are accurate

**When It Happens:**
- Your driver name matches exactly (case-insensitive, spacing normalized)
- Event has been imported with driver names
- No variations or typos in either name

**Action Required:**
- None - automatically confirmed
- Event is immediately linked to your profile

### Fuzzy Name Match

**What It Means:**
- Your driver name is similar (but not identical) to a driver name in the event
- Medium reliability - may include false positives

**When It Happens:**
- Names are similar but not exact (e.g., "John Smith" vs "Jon Smith")
- Handles common variations, nicknames, abbreviations
- Similarity score exceeds threshold

**Action Required:**
- Review the suggestion
- Confirm if you participated
- Reject if it's not you

**Common Scenarios:**
- Nickname variations: "John" vs "Johnny"
- Abbreviations: "J. Smith" vs "John Smith"
- Typos: "John Smth" vs "John Smith"
- Middle names: "John Smith" vs "John A. Smith"

## Managing Your Driver Information

### Viewing Your Driver Profile

1. Navigate to your profile or account settings
2. View your driver information:
   - Driver name (as it appears in race results)
   - Normalized name (used for matching)
   - Team name (if set)
   - Transponder number (if registered)

### Updating Your Driver Name

**Important Considerations:**
- Changing your driver name may affect event matching
- Previously matched events remain linked
- New events will use your updated name for matching
- Ensure name matches how it appears in race results

**To Update:**
1. Navigate to account settings or profile
2. Edit your driver name
3. Save changes
4. System re-normalizes your name automatically

### Registering Your Transponder

**Benefits:**
- More accurate event matching
- Automatic confirmation of matches
- Reduces false positives

**To Register:**
1. Navigate to account settings or profile
2. Find transponder number field
3. Enter your transponder number
4. Save changes
5. Future events with matching transponders are automatically confirmed

## Tips and Best Practices

### Improving Match Accuracy

1. **Use Your Exact Racing Name**: Enter your name exactly as it appears in race results
2. **Register Your Transponder**: Provides the most accurate matching
3. **Review Suggestions Promptly**: Confirm or reject fuzzy matches to improve system learning
4. **Keep Name Consistent**: Don't change your driver name frequently

### Managing Discovered Events

1. **Review Regularly**: Check for new discovered events periodically
2. **Confirm Accurate Matches**: Help the system learn what's correct
3. **Reject Incorrect Matches**: Prevents false associations
4. **Use Filters**: Filter by match type or status to focus on what needs attention

### Understanding False Positives

**Why They Happen:**
- Similar names (e.g., "John Smith" vs "Jon Smith")
- Common names that match multiple people
- Typos in event data

**What To Do:**
- Review each suggestion carefully
- Reject if it's not you
- System learns from your feedback

## Common Issues

### No Events Discovered

**Possible Causes:**
- No events imported yet
- Driver name doesn't match any event drivers
- Name normalization issue

**Solutions:**
- Import some events
- Verify your driver name is correct
- Check that name matches how it appears in race results
- Try searching for events manually

### Too Many False Positives

**Possible Causes:**
- Driver name is too common
- Fuzzy matching threshold too low
- Name variations causing matches

**Solutions:**
- Register your transponder for more accurate matching
- Use a more unique driver name if possible
- Reject incorrect suggestions to help system learn
- Contact support if issue persists

### Events Not Matching

**Possible Causes:**
- Driver name doesn't match exactly
- Name spelled differently in events
- Event data incomplete

**Solutions:**
- Verify your driver name matches race results
- Check event data for your name spelling
- Manually search for events if needed
- Contact support if matching should work but doesn't

## Related Guides

- **[Event Search Guide](event-search.md)**: Learn how to manually search for events
- **[Event Analysis Guide](event-analysis.md)**: Analyze events you've participated in
- **[Account Management Guide](account-management.md)**: Manage your account and profile

## Next Steps

After understanding driver features:

1. Review your discovered events
2. Confirm or reject suggestions
3. Register your transponder if available
4. Ensure your driver name is accurate
5. Start analyzing your race performance

---

**Ready to see your events?** Check your Dashboard or My Events page to view discovered events and start analyzing your performance!

