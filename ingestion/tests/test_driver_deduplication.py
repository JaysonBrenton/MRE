# @fileoverview Tests for driver deduplication
#
# @created 2026-02-20
# @description Unit tests for find_duplicate_groups, _pick_canonical, build_merge_plans.

import pytest

from ingestion.ingestion.driver_deduplication import build_merge_plans
from ingestion.db.session import db_session


class TestDriverDeduplication:
    """Tests for driver deduplication logic."""

    def test_pick_canonical_prefers_most_results(self):
        """Canonical is the driver with most race results."""
        with db_session() as session:
            # Use real drivers - find any duplicate group and verify canonical has most results
            from ingestion.ingestion.driver_deduplication import (
                find_duplicate_groups,
                _race_result_count,
            )
            groups = find_duplicate_groups(session, source="liverc")
            if not groups:
                pytest.skip("No duplicate groups in test database")
            group = groups[0]
            plan = build_merge_plans(session, [group])[0]
            canonical_count = _race_result_count(session, plan.canonical_id)
            for mid in plan.merged_ids:
                merged_count = _race_result_count(session, mid)
                assert canonical_count >= merged_count, (
                    f"Canonical should have >= results; canonical={canonical_count}, merged={merged_count}"
                )

    def test_find_duplicate_groups_requires_transponder(self):
        """Groups only include drivers with non-null transponder."""
        with db_session() as session:
            from ingestion.ingestion.driver_deduplication import find_duplicate_groups
            groups = find_duplicate_groups(session, source="liverc")
            for g in groups:
                assert g.transponder, "Each group must have transponder"
                assert len(g.driver_ids) >= 2, "Each group must have 2+ drivers"

    def test_build_merge_plans_excludes_single_driver_groups(self):
        """Merge plans only include groups with 2+ drivers (one canonical + merged)."""
        with db_session() as session:
            from ingestion.ingestion.driver_deduplication import (
                find_duplicate_groups,
                build_merge_plans,
            )
            groups = find_duplicate_groups(session, source="liverc")
            plans = build_merge_plans(session, groups)
            for plan in plans:
                assert plan.canonical_id in plan.group.driver_ids
                assert len(plan.merged_ids) >= 1
                assert plan.canonical_id not in plan.merged_ids
