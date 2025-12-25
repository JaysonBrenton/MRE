# @fileoverview Tests for EventEntry repository methods
# 
# @created 2025-12-24
# @creator Jayson Brenton
# @lastModified 2025-12-24

import pytest
from uuid import uuid4

from ingestion.db.models import Event, EventEntry, Driver, Track
from ingestion.db.repository import Repository
from ingestion.db.session import db_session


class TestEventEntryRepository:
    """Tests for EventEntry repository methods."""
    
    def test_upsert_event_entry_create(self):
        """Test creating a new EventEntry."""
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
                source_driver_id="driver-1",
                display_name="Test Driver",
                transponder_number="1234567",
            )
            
            # Create EventEntry
            event_entry = repo.upsert_event_entry(
                event_id=event.id,
                driver_id=driver.id,
                class_name="1/8 Electric Buggy",
                transponder_number="1234567",
                car_number="1",
            )
            
            assert event_entry is not None
            assert event_entry.event_id == event.id
            assert event_entry.driver_id == driver.id
            assert event_entry.class_name == "1/8 Electric Buggy"
            assert event_entry.transponder_number == "1234567"
            assert event_entry.car_number == "1"
    
    def test_upsert_event_entry_update(self):
        """Test updating an existing EventEntry."""
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
                source_driver_id="driver-1",
                display_name="Test Driver",
            )
            
            # Create EventEntry
            event_entry1 = repo.upsert_event_entry(
                event_id=event.id,
                driver_id=driver.id,
                class_name="1/8 Electric Buggy",
                transponder_number="1234567",
            )
            
            # Update EventEntry
            event_entry2 = repo.upsert_event_entry(
                event_id=event.id,
                driver_id=driver.id,
                class_name="1/8 Electric Buggy",
                transponder_number="7654321",
                car_number="2",
            )
            
            assert event_entry1.id == event_entry2.id
            assert event_entry2.transponder_number == "7654321"
            assert event_entry2.car_number == "2"
    
    def test_get_event_entries_by_class(self):
        """Test getting EventEntry records by class."""
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
            
            # Create drivers
            driver1 = repo.upsert_driver(
                source="liverc",
                source_driver_id="driver-1",
                display_name="Driver 1",
            )
            driver2 = repo.upsert_driver(
                source="liverc",
                source_driver_id="driver-2",
                display_name="Driver 2",
            )
            
            # Create EventEntry records
            repo.upsert_event_entry(
                event_id=event.id,
                driver_id=driver1.id,
                class_name="1/8 Electric Buggy",
            )
            repo.upsert_event_entry(
                event_id=event.id,
                driver_id=driver2.id,
                class_name="1/8 Electric Buggy",
            )
            repo.upsert_event_entry(
                event_id=event.id,
                driver_id=driver1.id,
                class_name="1/10 Electric Buggy",
            )
            
            # Get entries for class
            entries = repo.get_event_entries_by_class(
                event_id=event.id,
                class_name="1/8 Electric Buggy",
            )
            
            assert len(entries) == 2
            assert all(e.class_name == "1/8 Electric Buggy" for e in entries)
            assert all(e.driver is not None for e in entries)  # Check driver relationship is loaded
    
    def test_get_event_entries_by_driver(self):
        """Test getting EventEntry records by driver."""
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
                source_driver_id="driver-1",
                display_name="Test Driver",
            )
            
            # Create EventEntry records for multiple classes
            repo.upsert_event_entry(
                event_id=event.id,
                driver_id=driver.id,
                class_name="1/8 Electric Buggy",
            )
            repo.upsert_event_entry(
                event_id=event.id,
                driver_id=driver.id,
                class_name="1/10 Electric Buggy",
            )
            
            # Get entries for driver
            entries = repo.get_event_entries_by_driver(
                event_id=event.id,
                driver_id=driver.id,
            )
            
            assert len(entries) == 2
            assert all(e.driver_id == driver.id for e in entries)
            assert {e.class_name for e in entries} == {"1/8 Electric Buggy", "1/10 Electric Buggy"}

