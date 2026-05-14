from ingestion.ingestion.pit_stop_detection import detect_pit_stops_for_race, DETECTION_VERSION


def _race_data(vehicle_type: str | None) -> dict:
    return {
        "race": {
            "id": "race-1",
            "event_id": "event-1",
            "class_name": "Worlds Nitro Buggy",
            "race_label": "A Main",
            "duration_seconds": 1800,
        },
        "vehicle_type": vehicle_type,
        "results": [
            {
                "id": "rr-1",
                "laps_completed": 10,
                "fast_lap_time": 33.9,
                "avg_lap_time": 35.1,
                "laps": [
                    {"lap_number": 1, "lap_time_seconds": 34.0, "elapsed_race_time": 34.0},
                    {"lap_number": 2, "lap_time_seconds": 34.2, "elapsed_race_time": 68.2},
                    {"lap_number": 3, "lap_time_seconds": 34.1, "elapsed_race_time": 102.3},
                    {"lap_number": 4, "lap_time_seconds": 34.0, "elapsed_race_time": 136.3},
                    {"lap_number": 5, "lap_time_seconds": 34.3, "elapsed_race_time": 170.6},
                    {"lap_number": 6, "lap_time_seconds": 42.0, "elapsed_race_time": 560.0},
                    {"lap_number": 7, "lap_time_seconds": 34.4, "elapsed_race_time": 594.4},
                    {"lap_number": 8, "lap_time_seconds": 34.2, "elapsed_race_time": 628.6},
                ],
            }
        ],
    }


def test_detect_pit_stops_for_nitro_race():
    output = detect_pit_stops_for_race(_race_data("1/8 nitro buggy"))

    assert len(output["pit_stop_events"]) == 1
    assert len(output["driver_pit_strategies"]) == 1
    assert len(output["lap_annotations"]) == 1

    event = output["pit_stop_events"][0]
    assert event["race_result_id"] == "rr-1"
    assert event["lap_number"] == 6
    assert event["detection_version"] == DETECTION_VERSION
    assert event["pit_time_earliest_seconds"] == 518.0
    assert event["pit_time_latest_seconds"] == 560.0
    assert event["pit_time_estimate_seconds"] == 539.0

    strategy = output["driver_pit_strategies"][0]
    assert strategy["race_result_id"] == "rr-1"
    assert strategy["pit_count_detected"] == 1


def test_detect_pit_stops_skips_electric():
    output = detect_pit_stops_for_race(_race_data("1/10 ep buggy"))
    assert output == {
        "lap_annotations": [],
        "pit_stop_events": [],
        "driver_pit_strategies": [],
    }
