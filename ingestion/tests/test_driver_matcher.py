# @fileoverview Tests for driver matcher
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27

import pytest
from uuid import uuid4

from ingestion.ingestion.driver_matcher import DriverMatcher
from ingestion.connectors.liverc.models import ConnectorEntryDriver, ConnectorRaceResult
from ingestion.db.models import EventEntry, Driver, Event, Track
from ingestion.db.repository import Repository
from ingestion.db.session import db_session


class TestDriverMatcher:
    """Tests for DriverMatcher."""
    
    def test_match_by_name(self):
        """Test matching by driver name."""
        entry_drivers = [
            ConnectorEntryDriver(
                driver_name="JOHN DOE",
                car_number="1",
                transponder_number="1234567",
                source_driver_id=None,
                class_name="1/8 Electric Buggy",
            ),
            ConnectorEntryDriver(
                driver_name="JANE SMITH",
                car_number="2",
                transponder_number="7654321",
                source_driver_id=None,
                class_name="1/8 Electric Buggy",
            ),
        ]
        
        race_result = ConnectorRaceResult(
            source_driver_id="999",
            display_name="JOHN DOE",
            position_final=1,
            laps_completed=10,
        )
        
        matched = DriverMatcher.match_driver(entry_drivers, race_result, "1/8 Electric Buggy")
        
        assert matched is not None
        assert matched.driver_name == "JOHN DOE"
        assert matched.transponder_number == "1234567"
    
    def test_match_case_insensitive(self):
        """Test matching is case insensitive."""
        entry_drivers = [
            ConnectorEntryDriver(
                driver_name="john doe",
                car_number="1",
                transponder_number="1234567",
                source_driver_id=None,
                class_name="1/8 Electric Buggy",
            ),
        ]
        
        race_result = ConnectorRaceResult(
            source_driver_id="999",
            display_name="JOHN DOE",
            position_final=1,
            laps_completed=10,
        )
        
        matched = DriverMatcher.match_driver(entry_drivers, race_result, "1/8 Electric Buggy")
        
        assert matched is not None
        assert matched.transponder_number == "1234567"
    
    def test_no_match(self):
        """Test when no match is found."""
        entry_drivers = [
            ConnectorEntryDriver(
                driver_name="JOHN DOE",
                car_number="1",
                transponder_number="1234567",
                source_driver_id=None,
                class_name="1/8 Electric Buggy",
            ),
        ]
        
        race_result = ConnectorRaceResult(
            source_driver_id="999",
            display_name="UNKNOWN DRIVER",
            position_final=1,
            laps_completed=10,
        )
        
        matched = DriverMatcher.match_driver(entry_drivers, race_result, "1/8 Electric Buggy")
        
        assert matched is None
    
    def test_empty_entry_list(self):
        """Test matching with empty entry list."""
        entry_drivers = []
        
        race_result = ConnectorRaceResult(
            source_driver_id="999",
            display_name="JOHN DOE",
            position_final=1,
            laps_completed=10,
        )
        
        matched = DriverMatcher.match_driver(entry_drivers, race_result, "1/8 Electric Buggy")
        
        assert matched is None
    
    def test_match_race_result_to_event_entry_by_id(self):
        """Test matching race result to EventEntry by driver ID."""
        with db_session() as session:
            repo = Repository(session)
            
            # Create track and event
            track = repo.upsert_track(
                source="liverc",
                source_track_slug="test-track",
                track_name="Test Track",
                track_url="https://test.liverc.com",
                events_url="https://test.liverc.com/events",
            )
            
            event = repo.upsert_event(
                source="liverc",
                source_event_id="test-event-1",
                track_id=track.id,
                event_name="Test Event",
                event_date="2025-01-01T00:00:00Z",
                event_entries=10,
                event_drivers=5,
                event_url="https://test.liverc.com/event/1",
            )
            
            # Create driver
            driver = repo.upsert_driver(
                source="liverc",
                source_driver_id="driver-123",
                display_name="JOHN DOE",
                transponder_number="1234567",
            )
            
            # Create EventEntry
            event_entry = repo.upsert_event_entry(
                event_id=event.id,
                driver_id=driver.id,
                class_name="1/8 Electric Buggy",
                transponder_number="1234567",
            )
            
            # Create race result
            race_result = ConnectorRaceResult(
                source_driver_id="driver-123",
                display_name="JOHN DOE",
                position_final=1,
                laps_completed=10,
            )
            
            # Match
            matched = DriverMatcher.match_race_result_to_event_entry(
                event_entries=[event_entry],
                race_result=race_result,
                class_name="1/8 Electric Buggy",
            )
            
            assert matched is not None
            assert matched.id == event_entry.id
            assert matched.transponder_number == "1234567"
    
    def test_match_race_result_to_event_entry_by_name(self):
        """Test matching race result to EventEntry by driver name."""
        with db_session() as session:
            repo = Repository(session)
            
            # Create track and event
            track = repo.upsert_track(
                source="liverc",
                source_track_slug="test-track",
                track_name="Test Track",
                track_url="https://test.liverc.com",
                events_url="https://test.liverc.com/events",
            )
            
            event = repo.upsert_event(
                source="liverc",
                source_event_id="test-event-1",
                track_id=track.id,
                event_name="Test Event",
                event_date="2025-01-01T00:00:00Z",
                event_entries=10,
                event_drivers=5,
                event_url="https://test.liverc.com/event/1",
            )
            
            # Create driver
            driver = repo.upsert_driver(
                source="liverc",
                source_driver_id="driver-123",
                display_name="JOHN DOE",
                transponder_number="1234567",
            )
            
            # Create EventEntry
            event_entry = repo.upsert_event_entry(
                event_id=event.id,
                driver_id=driver.id,
                class_name="1/8 Electric Buggy",
                transponder_number="1234567",
            )
            
            # Create race result with different driver ID but same name
            race_result = ConnectorRaceResult(
                source_driver_id="driver-999",  # Different ID
                display_name="JOHN DOE",  # Same name
                position_final=1,
                laps_completed=10,
            )
            
            # Match
            matched = DriverMatcher.match_race_result_to_event_entry(
                event_entries=[event_entry],
                race_result=race_result,
                class_name="1/8 Electric Buggy",
            )
            
            assert matched is not None
            assert matched.id == event_entry.id
            assert matched.transponder_number == "1234567"
    
    def test_match_race_result_to_event_entry_no_match(self):
        """Test when no EventEntry match is found."""
        with db_session() as session:
            repo = Repository(session)
            
            # Create track and event
            track = repo.upsert_track(
                source="liverc",
                source_track_slug="test-track",
                track_name="Test Track",
                track_url="https://test.liverc.com",
                events_url="https://test.liverc.com/events",
            )
            
            event = repo.upsert_event(
                source="liverc",
                source_event_id="test-event-1",
                track_id=track.id,
                event_name="Test Event",
                event_date="2025-01-01T00:00:00Z",
                event_entries=10,
                event_drivers=5,
                event_url="https://test.liverc.com/event/1",
            )
            
            # Create driver
            driver = repo.upsert_driver(
                source="liverc",
                source_driver_id="driver-123",
                display_name="JOHN DOE",
            )
            
            # Create EventEntry
            event_entry = repo.upsert_event_entry(
                event_id=event.id,
                driver_id=driver.id,
                class_name="1/8 Electric Buggy",
            )
            
            # Create race result with different name
            race_result = ConnectorRaceResult(
                source_driver_id="driver-999",
                display_name="UNKNOWN DRIVER",
                position_final=1,
                laps_completed=10,
            )
            
            # Match
            matched = DriverMatcher.match_race_result_to_event_entry(
                event_entries=[event_entry],
                race_result=race_result,
                class_name="1/8 Electric Buggy",
            )
            
            assert matched is None

