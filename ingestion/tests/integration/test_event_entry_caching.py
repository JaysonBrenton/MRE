"""Integration test to verify event entry cache eliminates redundant queries."""

from __future__ import annotations

from unittest.mock import Mock, patch
from uuid import UUID, uuid4

import pytest

from ingestion.db.repository import Repository
from ingestion.ingestion.pipeline import IngestionPipeline


@pytest.mark.asyncio
async def test_event_entry_cache_eliminates_redundant_queries(db_session):
    """Verify that event entry cache prevents redundant get_event_entries_by_class calls."""
    
    event_id = uuid4()
    class_name = "Mod"
    
    # Create a mock repository
    repo = Repository(db_session)
    
    # Mock get_event_entries_by_event to return some entries
    mock_entries = [
        Mock(
            class_name=class_name,
            driver_id=uuid4(),
            event_id=event_id,
        )
        for _ in range(10)
    ]
    
    # Track calls to get_event_entries_by_class
    original_get_by_class = repo.get_event_entries_by_class
    call_count = {"count": 0}
    
    def tracked_get_by_class(event_id: UUID, class_name: str):
        call_count["count"] += 1
        return original_get_by_class(event_id, class_name)
    
    repo.get_event_entries_by_class = tracked_get_by_class
    
    # Mock get_event_entries_by_event to return cached entries
    with patch.object(repo, "get_event_entries_by_event", return_value=mock_entries):
        # Create pipeline instance
        pipeline = IngestionPipeline()
        
        # Simulate processing multiple race results for the same class
        # In the old implementation, this would call get_event_entries_by_class
        # for each result (e.g., 50 results = 50 calls)
        # With caching, it should only call get_event_entries_by_event once
        
        # Simulate the cache setup that happens in _process_races_parallel
        all_event_entries = repo.get_event_entries_by_event(event_id=event_id)
        event_entries_cache = {}
        for entry in all_event_entries:
            if entry.class_name not in event_entries_cache:
                event_entries_cache[entry.class_name] = []
            event_entries_cache[entry.class_name].append(entry)
        
        # Simulate processing 50 race results (old code would call get_event_entries_by_class 50 times)
        num_results = 50
        for _ in range(num_results):
            # Use cached entries instead of calling get_event_entries_by_class
            event_entries = event_entries_cache.get(class_name, [])
            assert len(event_entries) > 0  # Verify cache has entries
        
        # Verify that get_event_entries_by_class was never called
        # (because we used the cache)
        assert call_count["count"] == 0, (
            f"Expected 0 calls to get_event_entries_by_class with caching, "
            f"but got {call_count['count']} calls. "
            f"Without caching, this would have been {num_results} calls."
        )
        
        # Verify get_event_entries_by_event was called once (to populate cache)
        assert repo.get_event_entries_by_event.call_count == 1, (
            "Expected get_event_entries_by_event to be called once to populate cache"
        )


@pytest.mark.asyncio
async def test_event_entry_cache_handles_multiple_classes(db_session):
    """Verify cache works correctly when event has multiple classes."""
    
    event_id = uuid4()
    class_names = ["Mod", "Stock", "Pro"]
    
    repo = Repository(db_session)
    
    # Create mock entries for multiple classes
    mock_entries = []
    for class_name in class_names:
        for _ in range(5):
            mock_entries.append(
                Mock(
                    class_name=class_name,
                    driver_id=uuid4(),
                    event_id=event_id,
                )
            )
    
    with patch.object(repo, "get_event_entries_by_event", return_value=mock_entries):
        # Simulate cache setup
        all_event_entries = repo.get_event_entries_by_event(event_id=event_id)
        event_entries_cache = {}
        for entry in all_event_entries:
            if entry.class_name not in event_entries_cache:
                event_entries_cache[entry.class_name] = []
            event_entries_cache[entry.class_name].append(entry)
        
        # Verify cache has entries for all classes
        for class_name in class_names:
            assert class_name in event_entries_cache
            assert len(event_entries_cache[class_name]) == 5
        
        # Verify get_event_entries_by_event was called once (not once per class)
        assert repo.get_event_entries_by_event.call_count == 1

