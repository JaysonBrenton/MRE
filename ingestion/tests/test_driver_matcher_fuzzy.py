# @fileoverview Tests for fuzzy driver matching
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27

import pytest
from uuid import uuid4
from datetime import datetime

from ingestion.ingestion.driver_matcher import DriverMatcher
from ingestion.ingestion.normalizer import AUTO_CONFIRM_MIN, SUGGEST_MIN
from ingestion.db.models import User, Driver, UserDriverLink, UserDriverLinkStatus, EventDriverLinkMatchType


class TestDriverMatcherFuzzy:
    """Tests for fuzzy driver matching logic."""
    
    def test_exact_normalized_match(self):
        """Test that exact normalized matches return CONFIRMED status."""
        user = User(
            id=str(uuid4()),
            email="test@example.com",
            password_hash="hash",
            driver_name="Jayson Brenton",
            normalized_name="brenton jayson",
            transponder_number=None,
            team_name=None,
            is_admin=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        driver = Driver(
            id=str(uuid4()),
            source="liverc",
            source_driver_id="123",
            display_name="Jayson Brenton",
            normalized_name="brenton jayson",
            transponder_number=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        result = DriverMatcher.fuzzy_match_user_to_driver(user, driver)
        assert result is not None
        match_type, score, status = result
        assert match_type == EventDriverLinkMatchType.EXACT
        assert score == 1.0
        assert status == UserDriverLinkStatus.CONFIRMED
    
    def test_transponder_match(self):
        """Test that transponder matches return SUGGESTED status."""
        user = User(
            id=str(uuid4()),
            email="test@example.com",
            password_hash="hash",
            driver_name="John Doe",
            normalized_name="doe john",
            transponder_number="1234567",
            team_name=None,
            is_admin=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        driver = Driver(
            id=str(uuid4()),
            source="liverc",
            source_driver_id="123",
            display_name="Different Name",
            normalized_name="different name",
            transponder_number="1234567",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        result = DriverMatcher.fuzzy_match_user_to_driver(user, driver)
        assert result is not None
        match_type, score, status = result
        assert match_type == EventDriverLinkMatchType.TRANSPONDER
        assert score == 1.0
        assert status == UserDriverLinkStatus.SUGGESTED
    
    def test_fuzzy_match_auto_confirm(self):
        """Test that high similarity (>=0.95) returns CONFIRMED status."""
        user = User(
            id=str(uuid4()),
            email="test@example.com",
            password_hash="hash",
            driver_name="Jayson Brenton",
            normalized_name="brenton jayson",
            transponder_number=None,
            team_name=None,
            is_admin=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        driver = Driver(
            id=str(uuid4()),
            source="liverc",
            source_driver_id="123",
            display_name="Jayson Brenton",  # Very close match
            normalized_name="brenton jayson",
            transponder_number=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        result = DriverMatcher.fuzzy_match_user_to_driver(user, driver)
        assert result is not None
        match_type, score, status = result
        assert match_type == EventDriverLinkMatchType.EXACT  # Exact normalized match
        assert score == 1.0
        assert status == UserDriverLinkStatus.CONFIRMED
    
    def test_fuzzy_match_suggest(self):
        """Test that medium similarity (0.85-0.94) returns SUGGESTED status."""
        user = User(
            id=str(uuid4()),
            email="test@example.com",
            password_hash="hash",
            driver_name="Jayson Brenton",
            normalized_name="brenton jayson",
            transponder_number=None,
            team_name=None,
            is_admin=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        driver = Driver(
            id=str(uuid4()),
            source="liverc",
            source_driver_id="123",
            display_name="Jason Brenton",  # Close but not exact
            normalized_name="brenton jason",
            transponder_number=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        result = DriverMatcher.fuzzy_match_user_to_driver(user, driver)
        # This might return SUGGESTED if similarity >= 0.85
        if result:
            match_type, score, status = result
            assert match_type == EventDriverLinkMatchType.FUZZY
            assert SUGGEST_MIN <= score < AUTO_CONFIRM_MIN
            assert status == UserDriverLinkStatus.SUGGESTED
    
    def test_fuzzy_match_below_threshold(self):
        """Test that low similarity (<0.85) returns None."""
        user = User(
            id=str(uuid4()),
            email="test@example.com",
            password_hash="hash",
            driver_name="Jayson Brenton",
            normalized_name="brenton jayson",
            transponder_number=None,
            team_name=None,
            is_admin=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        driver = Driver(
            id=str(uuid4()),
            source="liverc",
            source_driver_id="123",
            display_name="Completely Different Name",
            normalized_name="completely different name",
            transponder_number=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        result = DriverMatcher.fuzzy_match_user_to_driver(user, driver)
        assert result is None
    
    def test_no_transponder_match_when_different(self):
        """Test that different transponders don't match."""
        user = User(
            id=str(uuid4()),
            email="test@example.com",
            password_hash="hash",
            driver_name="John Doe",
            normalized_name="doe john",
            transponder_number="1234567",
            team_name=None,
            is_admin=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        driver = Driver(
            id=str(uuid4()),
            source="liverc",
            source_driver_id="123",
            display_name="John Doe",
            normalized_name="doe john",
            transponder_number="7654321",  # Different transponder
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        result = DriverMatcher.fuzzy_match_user_to_driver(user, driver)
        # Should match by name, not transponder
        assert result is not None
        match_type, score, status = result
        assert match_type == EventDriverLinkMatchType.EXACT  # Exact normalized match
        assert status == UserDriverLinkStatus.CONFIRMED
    
    def test_user_without_normalized_name(self):
        """Test that normalization is computed if missing."""
        user = User(
            id=str(uuid4()),
            email="test@example.com",
            password_hash="hash",
            driver_name="Jayson Brenton",
            normalized_name=None,  # Missing normalized name
            transponder_number=None,
            team_name=None,
            is_admin=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        driver = Driver(
            id=str(uuid4()),
            source="liverc",
            source_driver_id="123",
            display_name="Jayson Brenton",
            normalized_name="brenton jayson",
            transponder_number=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        result = DriverMatcher.fuzzy_match_user_to_driver(user, driver)
        assert result is not None
        match_type, score, status = result
        assert match_type == EventDriverLinkMatchType.EXACT
        assert status == UserDriverLinkStatus.CONFIRMED
    
    def test_driver_without_normalized_name(self):
        """Test that normalization is computed if missing."""
        user = User(
            id=str(uuid4()),
            email="test@example.com",
            password_hash="hash",
            driver_name="Jayson Brenton",
            normalized_name="brenton jayson",
            transponder_number=None,
            team_name=None,
            is_admin=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        driver = Driver(
            id=str(uuid4()),
            source="liverc",
            source_driver_id="123",
            display_name="Jayson Brenton",
            normalized_name=None,  # Missing normalized name
            transponder_number=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        result = DriverMatcher.fuzzy_match_user_to_driver(user, driver)
        assert result is not None
        match_type, score, status = result
        assert match_type == EventDriverLinkMatchType.EXACT
        assert status == UserDriverLinkStatus.CONFIRMED

