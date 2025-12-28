# @fileoverview Tests for auto-confirmation logic
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27

import pytest
from uuid import uuid4
from datetime import datetime

from ingestion.ingestion.auto_confirm import AutoConfirm, MIN_EVENTS_FOR_AUTO_CONFIRM
from ingestion.db.models import (
    User, Driver, UserDriverLink, EventDriverLink, Event, Track,
    UserDriverLinkStatus, EventDriverLinkMatchType
)
from ingestion.db.repository import Repository
from ingestion.db.session import db_session
from ingestion.ingestion.normalizer import SUGGEST_MIN


class TestAutoConfirm:
    """Tests for auto-confirmation logic."""
    
    def test_auto_confirm_transponder_across_multiple_events(self):
        """Test that transponder matches across 2+ events auto-confirm."""
        with db_session() as session:
            repo = Repository(session)
            
            # Create user
            user = User(
                id=str(uuid4()),
                email="test@example.com",
                password_hash="hash",
                driver_name="Jayson Brenton",
                normalized_name="brenton jayson",
                transponder_number="1234567",
                team_name=None,
                is_admin=False,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(user)
            session.flush()
            
            # Create track
            track = repo.upsert_track(
                source="liverc",
                source_track_slug="test-track",
                track_name="Test Track",
                track_url="https://test.liverc.com",
                events_url="https://test.liverc.com/events",
            )
            
            # Create driver
            driver = repo.upsert_driver(
                source="liverc",
                source_driver_id="driver-123",
                display_name="Jayson Brenton",
                transponder_number="1234567",
            )
            
            # Create two events
            event1 = repo.upsert_event(
                source="liverc",
                source_event_id="event-1",
                track_id=track.id,
                event_name="Event 1",
                event_date="2025-01-01T00:00:00Z",
                event_entries=10,
                event_drivers=5,
                event_url="https://test.liverc.com/event/1",
            )
            
            event2 = repo.upsert_event(
                source="liverc",
                source_event_id="event-2",
                track_id=track.id,
                event_name="Event 2",
                event_date="2025-01-02T00:00:00Z",
                event_entries=10,
                event_drivers=5,
                event_url="https://test.liverc.com/event/2",
            )
            
            # Create UserDriverLink (suggested)
            user_driver_link = repo.upsert_user_driver_link(
                user_id=user.id,
                driver_id=driver.id,
                status=UserDriverLinkStatus.SUGGESTED,
                similarity_score=1.0,
                matched_at=datetime.utcnow(),
            )
            
            # Create EventDriverLinks for both events (transponder matches)
            repo.upsert_event_driver_link(
                user_id=user.id,
                event_id=event1.id,
                driver_id=driver.id,
                match_type=EventDriverLinkMatchType.TRANSPONDER,
                similarity_score=1.0,
                transponder_number="1234567",
                matched_at=datetime.utcnow(),
                user_driver_link_id=user_driver_link.id,
            )
            
            repo.upsert_event_driver_link(
                user_id=user.id,
                event_id=event2.id,
                driver_id=driver.id,
                match_type=EventDriverLinkMatchType.TRANSPONDER,
                similarity_score=1.0,
                transponder_number="1234567",
                matched_at=datetime.utcnow(),
                user_driver_link_id=user_driver_link.id,
            )
            
            session.commit()
            
            # Run auto-confirmation
            stats = AutoConfirm.run_auto_confirmation(repo)
            
            # Verify link was confirmed
            session.refresh(user_driver_link)
            assert user_driver_link.status == UserDriverLinkStatus.CONFIRMED
            assert user_driver_link.confirmed_at is not None
            assert stats["links_confirmed"] == 1
    
    def test_auto_confirm_requires_minimum_events(self):
        """Test that auto-confirmation requires MIN_EVENTS_FOR_AUTO_CONFIRM events."""
        with db_session() as session:
            repo = Repository(session)
            
            # Create user
            user = User(
                id=str(uuid4()),
                email="test@example.com",
                password_hash="hash",
                driver_name="Jayson Brenton",
                normalized_name="brenton jayson",
                transponder_number="1234567",
                team_name=None,
                is_admin=False,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(user)
            session.flush()
            
            # Create track
            track = repo.upsert_track(
                source="liverc",
                source_track_slug="test-track",
                track_name="Test Track",
                track_url="https://test.liverc.com",
                events_url="https://test.liverc.com/events",
            )
            
            # Create driver
            driver = repo.upsert_driver(
                source="liverc",
                source_driver_id="driver-123",
                display_name="Jayson Brenton",
                transponder_number="1234567",
            )
            
            # Create one event (not enough)
            event1 = repo.upsert_event(
                source="liverc",
                source_event_id="event-1",
                track_id=track.id,
                event_name="Event 1",
                event_date="2025-01-01T00:00:00Z",
                event_entries=10,
                event_drivers=5,
                event_url="https://test.liverc.com/event/1",
            )
            
            # Create UserDriverLink (suggested)
            user_driver_link = repo.upsert_user_driver_link(
                user_id=user.id,
                driver_id=driver.id,
                status=UserDriverLinkStatus.SUGGESTED,
                similarity_score=1.0,
                matched_at=datetime.utcnow(),
            )
            
            # Create only one EventDriverLink (not enough)
            repo.upsert_event_driver_link(
                user_id=user.id,
                event_id=event1.id,
                driver_id=driver.id,
                match_type=EventDriverLinkMatchType.TRANSPONDER,
                similarity_score=1.0,
                transponder_number="1234567",
                matched_at=datetime.utcnow(),
                user_driver_link_id=user_driver_link.id,
            )
            
            session.commit()
            
            # Run auto-confirmation
            stats = AutoConfirm.run_auto_confirmation(repo)
            
            # Verify link was NOT confirmed (only 1 event)
            session.refresh(user_driver_link)
            assert user_driver_link.status == UserDriverLinkStatus.SUGGESTED
            assert user_driver_link.confirmed_at is None
            assert stats["links_confirmed"] == 0
    
    def test_auto_confirm_requires_name_compatibility(self):
        """Test that auto-confirmation requires name compatibility."""
        with db_session() as session:
            repo = Repository(session)
            
            # Create user with one name
            user = User(
                id=str(uuid4()),
                email="test@example.com",
                password_hash="hash",
                driver_name="Jayson Brenton",
                normalized_name="brenton jayson",
                transponder_number="1234567",
                team_name=None,
                is_admin=False,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(user)
            session.flush()
            
            # Create track
            track = repo.upsert_track(
                source="liverc",
                source_track_slug="test-track",
                track_name="Test Track",
                track_url="https://test.liverc.com",
                events_url="https://test.liverc.com/events",
            )
            
            # Create driver with different name (low compatibility)
            driver = repo.upsert_driver(
                source="liverc",
                source_driver_id="driver-123",
                display_name="Completely Different Name",
                transponder_number="1234567",  # Same transponder
            )
            
            # Create two events
            event1 = repo.upsert_event(
                source="liverc",
                source_event_id="event-1",
                track_id=track.id,
                event_name="Event 1",
                event_date="2025-01-01T00:00:00Z",
                event_entries=10,
                event_drivers=5,
                event_url="https://test.liverc.com/event/1",
            )
            
            event2 = repo.upsert_event(
                source="liverc",
                source_event_id="event-2",
                track_id=track.id,
                event_name="Event 2",
                event_date="2025-01-02T00:00:00Z",
                event_entries=10,
                event_drivers=5,
                event_url="https://test.liverc.com/event/2",
            )
            
            # Create UserDriverLink (suggested)
            user_driver_link = repo.upsert_user_driver_link(
                user_id=user.id,
                driver_id=driver.id,
                status=UserDriverLinkStatus.SUGGESTED,
                similarity_score=1.0,
                matched_at=datetime.utcnow(),
            )
            
            # Create EventDriverLinks for both events (transponder matches)
            repo.upsert_event_driver_link(
                user_id=user.id,
                event_id=event1.id,
                driver_id=driver.id,
                match_type=EventDriverLinkMatchType.TRANSPONDER,
                similarity_score=1.0,
                transponder_number="1234567",
                matched_at=datetime.utcnow(),
                user_driver_link_id=user_driver_link.id,
            )
            
            repo.upsert_event_driver_link(
                user_id=user.id,
                event_id=event2.id,
                driver_id=driver.id,
                match_type=EventDriverLinkMatchType.TRANSPONDER,
                similarity_score=1.0,
                transponder_number="1234567",
                matched_at=datetime.utcnow(),
                user_driver_link_id=user_driver_link.id,
            )
            
            session.commit()
            
            # Run auto-confirmation
            stats = AutoConfirm.run_auto_confirmation(repo)
            
            # Verify link was marked as CONFLICT (transponder match but low name compatibility)
            session.refresh(user_driver_link)
            assert user_driver_link.status == UserDriverLinkStatus.CONFLICT
            assert user_driver_link.conflict_reason is not None
            assert "low name compatibility" in user_driver_link.conflict_reason.lower()
            assert stats["links_conflicted"] == 1
    
    def test_auto_confirm_skips_already_confirmed(self):
        """Test that already confirmed links are skipped."""
        with db_session() as session:
            repo = Repository(session)
            
            # Create user
            user = User(
                id=str(uuid4()),
                email="test@example.com",
                password_hash="hash",
                driver_name="Jayson Brenton",
                normalized_name="brenton jayson",
                transponder_number="1234567",
                team_name=None,
                is_admin=False,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(user)
            session.flush()
            
            # Create track
            track = repo.upsert_track(
                source="liverc",
                source_track_slug="test-track",
                track_name="Test Track",
                track_url="https://test.liverc.com",
                events_url="https://test.liverc.com/events",
            )
            
            # Create driver
            driver = repo.upsert_driver(
                source="liverc",
                source_driver_id="driver-123",
                display_name="Jayson Brenton",
                transponder_number="1234567",
            )
            
            # Create two events
            event1 = repo.upsert_event(
                source="liverc",
                source_event_id="event-1",
                track_id=track.id,
                event_name="Event 1",
                event_date="2025-01-01T00:00:00Z",
                event_entries=10,
                event_drivers=5,
                event_url="https://test.liverc.com/event/1",
            )
            
            event2 = repo.upsert_event(
                source="liverc",
                source_event_id="event-2",
                track_id=track.id,
                event_name="Event 2",
                event_date="2025-01-02T00:00:00Z",
                event_entries=10,
                event_drivers=5,
                event_url="https://test.liverc.com/event/2",
            )
            
            # Create UserDriverLink (already confirmed)
            user_driver_link = repo.upsert_user_driver_link(
                user_id=user.id,
                driver_id=driver.id,
                status=UserDriverLinkStatus.CONFIRMED,
                similarity_score=1.0,
                matched_at=datetime.utcnow(),
                confirmed_at=datetime.utcnow(),
            )
            
            # Create EventDriverLinks for both events
            repo.upsert_event_driver_link(
                user_id=user.id,
                event_id=event1.id,
                driver_id=driver.id,
                match_type=EventDriverLinkMatchType.TRANSPONDER,
                similarity_score=1.0,
                transponder_number="1234567",
                matched_at=datetime.utcnow(),
                user_driver_link_id=user_driver_link.id,
            )
            
            repo.upsert_event_driver_link(
                user_id=user.id,
                event_id=event2.id,
                driver_id=driver.id,
                match_type=EventDriverLinkMatchType.TRANSPONDER,
                similarity_score=1.0,
                transponder_number="1234567",
                matched_at=datetime.utcnow(),
                user_driver_link_id=user_driver_link.id,
            )
            
            session.commit()
            
            original_confirmed_at = user_driver_link.confirmed_at
            
            # Run auto-confirmation
            stats = AutoConfirm.run_auto_confirmation(repo)
            
            # Verify link status unchanged
            session.refresh(user_driver_link)
            assert user_driver_link.status == UserDriverLinkStatus.CONFIRMED
            assert user_driver_link.confirmed_at == original_confirmed_at
            assert stats["links_confirmed"] == 0

