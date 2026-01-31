# Event Fixture: 486677

## Event Details

- **Event Name**: Cormcc 2025 Rudi Wensing Memorial, Clay Cup
- **Event Date**: Nov 16, 2025
- **Track**: Canberra Off Road Model Car Club (canberraoffroad)
- **Entries**: 71
- **Drivers**: 60

## Races Included

1. **Race 6304829**: 1/8 Nitro Buggy A-Main (Race 14)
2. **Race 6304822**: 1/8 Electric Buggy A3-Main (Race 13)
3. **Race 6304830**: 1/8 Nitro Buggy B-Main (Race 10)

## Known Quirks

### Non-Starting Drivers

- **RILEY LANDER** (driver ID: 731648) appears in race 6304829 results table at
  position 12 with:
  - `laps_completed = 0`
  - No `data-driver-id` attribute in table (no "View Laps" link)
  - Empty `racerLaps[731648]` object with empty strings for all stats
  - All time fields should be `None`

### Race Label Structure

- Race labels follow pattern: "Race {number}: {class_name} ({race_label})"
- Example: "Race 14: 1/8 Nitro Buggy (1/8 Nitro Buggy A-Main)"
- Some races may not have parentheses (e.g., qualifier heats)

### Driver ID Matching

- Most drivers have `data-driver-id` attribute in results table
- Non-starting drivers may need to be matched by name to `racerLaps` keys
- Driver names in table are uppercase (e.g., "FELIX KOEGLER")
- Driver names in `racerLaps` match table names

### Lap Data Structure

- `racerLaps` JavaScript object contains lap data for all drivers
- Empty `laps` arrays indicate non-starting drivers
- Lap times are stored as strings (e.g., "37.234")
- `pace` field contains formatted strings (e.g., "48/30:32.160")

## Race Structure Notes

- Event contains multiple race groups:
  - Main Events (races 1-14)
  - Qualifier Round 3 (races 1-6)
  - Qualifier Round 2 (races 1-6)
  - Qualifier Round 1 (races 1-6)
- Race numbers are sequential within each group
- Race times are formatted as "Nov 16, 2025 at 5:30pm"
