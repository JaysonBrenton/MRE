# Constants for lap annotation derivation.
# All time thresholds are in seconds unless noted.

# Invalid lap (suspected cut): lap time < class_threshold (class average * this factor)
CLASS_THRESHOLD_FACTOR = 0.2  # 20% of class average = 80% faster = invalid
MIN_CLASS_THRESHOLD_SECONDS = 5.0

# Driver-relative invalid: lap < driver_median * this factor (optional)
DRIVER_FAST_FACTOR = 0.85

# Crash band: baseline + [CRASH_MIN_ADDED, CRASH_MAX_ADDED] seconds
CRASH_MIN_ADDED_SECONDS = 10.0
CRASH_MAX_ADDED_SECONDS = 35.0

# Mechanical: lap time > baseline + MECHANICAL_ADDED_SECONDS, or DNF
MECHANICAL_ADDED_SECONDS = 60.0

# Fuel stop (nitro): lap time in [median + FUEL_MIN_ADDED, median + FUEL_MAX_ADDED]
# and elapsed_race_time in pit window
FUEL_MIN_ADDED_SECONDS = 5.0
FUEL_MAX_ADDED_SECONDS = 15.0
PIT_WINDOW_START_SECONDS = 7 * 60   # 7 minutes
PIT_WINDOW_END_SECONDS = 10 * 60    # 10 minutes

# Flame out (nitro): very long lap then return to normal
FLAME_OUT_LONG_FACTOR = 2.5   # lap > median * this
FLAME_OUT_MIN_LONG_SECONDS = 60.0
RETURN_TO_NORMAL_FACTOR = 1.2  # next lap within median * this

# Confidence values (0.0 to 1.0)
CONFIDENCE_HIGH = 0.9
CONFIDENCE_MEDIUM = 0.6
CONFIDENCE_LOW = 0.3

# Annotation reason/type values
INVALID_REASON_SUSPECTED_CUT = "suspected_cut"
INCIDENT_CRASH = "suspected_crash"
INCIDENT_MECHANICAL = "suspected_mechanical"
INCIDENT_FUEL_STOP = "suspected_fuel_stop"
INCIDENT_FLAME_OUT = "suspected_flame_out"
