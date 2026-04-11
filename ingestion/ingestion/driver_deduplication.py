# @fileoverview Driver deduplication - merge duplicate Driver records
#
# @created 2026-02-20
# @description Identifies and merges duplicate Driver records using transponder + normalized name.
#              See docs/architecture/driver-deduplication-design.md
#
# @purpose Consolidate fragmented driver identities for correct track leaderboard display.

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from ingestion.common.logging import get_logger
from ingestion.common import metrics
from ingestion.db.models import (
    Driver,
    EventEntry,
    EventDriverLink,
    MultiMainResultEntry,
    RaceDriver,
    RaceResult,
    UserDriverLink,
)
from ingestion.ingestion.normalizer import Normalizer

logger = get_logger(__name__)


@dataclass
class DuplicateGroup:
    """A group of Driver records that are duplicates (same person)."""
    normalized_name: str
    transponder: str
    source: str
    driver_ids: List[str] = field(default_factory=list)
    display_names: List[str] = field(default_factory=list)
    canonical_id: Optional[str] = None


@dataclass
class MergePlan:
    """Plan for merging a duplicate group."""
    group: DuplicateGroup
    canonical_id: str
    merged_ids: List[str]
    updates: Dict[str, int] = field(default_factory=dict)
    deletes: Dict[str, int] = field(default_factory=dict)


def _effective_transponder(session: Session, driver: Driver) -> Optional[str]:
    """Get transponder from Driver or first EventEntry for that driver."""
    t = driver.transponder_number
    if t and str(t).strip():
        return str(t).strip()
    entry = (
        session.query(EventEntry.transponder_number)
        .filter(EventEntry.driver_id == driver.id)
        .filter(EventEntry.transponder_number.isnot(None))
        .filter(EventEntry.transponder_number != "")
        .limit(1)
        .first()
    )
    if entry and entry[0]:
        return str(entry[0]).strip()
    return None


def _race_result_count(session: Session, driver_id: str) -> int:
    """Count RaceResults for a driver (via RaceDriver)."""
    return (
        session.query(func.count(RaceResult.id))
        .join(RaceDriver, RaceResult.race_driver_id == RaceDriver.id)
        .filter(RaceDriver.driver_id == driver_id)
        .scalar()
        or 0
    )


def find_duplicate_groups(
    session: Session,
    source: str = "liverc",
) -> List[DuplicateGroup]:
    """
    Find groups of Driver records that match on (source, normalized_name, transponder).
    Only includes groups where transponder is non-null (avoids false positives).
    """
    drivers = (
        session.query(Driver)
        .filter(Driver.source == source)
        .all()
    )
    # Build (normalized_name, transponder) -> list of drivers
    by_key: Dict[Tuple[str, str], List[Driver]] = defaultdict(list)
    for d in drivers:
        norm = d.normalized_name or Normalizer.normalize_driver_name(d.display_name)
        trans = _effective_transponder(session, d)
        if not trans:
            continue
        key = (norm, trans)
        by_key[key].append(d)

    groups: List[DuplicateGroup] = []
    for (norm, trans), driver_list in by_key.items():
        if len(driver_list) < 2:
            continue
        group = DuplicateGroup(
            normalized_name=norm,
            transponder=trans,
            source=source,
            driver_ids=[d.id for d in driver_list],
            display_names=[d.display_name for d in driver_list],
        )
        groups.append(group)
    return groups


def _pick_canonical(session: Session, driver_ids: List[str]) -> str:
    """Pick canonical driver: most race results, then earliest created_at."""
    best_id = None
    best_count = -1
    best_created = None
    for did in driver_ids:
        count = _race_result_count(session, did)
        driver = session.get(Driver, did)
        if driver is None:
            continue
        created = driver.created_at
        if count > best_count or (count == best_count and (best_created is None or created < best_created)):
            best_id = did
            best_count = count
            best_created = created
    return best_id or driver_ids[0]


def build_merge_plans(
    session: Session,
    groups: List[DuplicateGroup],
) -> List[MergePlan]:
    """Build merge plans for each duplicate group."""
    plans: List[MergePlan] = []
    for g in groups:
        canonical_id = _pick_canonical(session, g.driver_ids)
        merged_ids = [did for did in g.driver_ids if did != canonical_id]
        if not merged_ids:
            continue
        plan = MergePlan(group=g, canonical_id=canonical_id, merged_ids=merged_ids)
        plans.append(plan)
    return plans


def execute_merge(session: Session, plan: MergePlan) -> Dict[str, int]:
    """
    Execute merge: update all FKs from merged drivers to canonical, then delete merged drivers.
    Returns counts of updates/deletes per table.
    """
    canonical_id = plan.canonical_id
    merged_ids = plan.merged_ids
    stats: Dict[str, int] = {}

    for mid in merged_ids:
        # 1. RaceDriver: just update driver_id
        rd_updated = (
            session.query(RaceDriver)
            .filter(RaceDriver.driver_id == mid)
            .update({"driver_id": canonical_id}, synchronize_session="fetch")
        )
        stats["race_drivers"] = stats.get("race_drivers", 0) + rd_updated

        # 2. EventEntry: update driver_id; handle (event_id, driver_id, class_name) unique
        #   - find entries that would conflict (canonical already has same event+class)
        canonical_entries = {
            (e.event_id, e.class_name)
            for e in session.query(EventEntry.event_id, EventEntry.class_name)
            .filter(EventEntry.driver_id == canonical_id)
            .all()
        }
        merged_entries = (
            session.query(EventEntry)
            .filter(EventEntry.driver_id == mid)
            .all()
        )
        for ee in merged_entries:
            key = (ee.event_id, ee.class_name)
            if key in canonical_entries:
                session.delete(ee)
                stats["event_entries_deleted"] = stats.get("event_entries_deleted", 0) + 1
            else:
                ee.driver_id = canonical_id
                canonical_entries.add(key)
                stats["event_entries"] = stats.get("event_entries", 0) + 1

        # 3. MultiMainResultEntry: update driver_id; handle (multi_main_result_id, driver_id) unique
        canonical_mmre = {
            e.multi_main_result_id
            for e in session.query(MultiMainResultEntry.multi_main_result_id)
            .filter(MultiMainResultEntry.driver_id == canonical_id)
            .all()
        }
        for mmre in session.query(MultiMainResultEntry).filter(MultiMainResultEntry.driver_id == mid).all():
            if mmre.multi_main_result_id in canonical_mmre:
                session.delete(mmre)
                stats["multi_main_result_entries_deleted"] = stats.get("multi_main_result_entries_deleted", 0) + 1
            else:
                mmre.driver_id = canonical_id
                canonical_mmre.add(mmre.multi_main_result_id)
                stats["multi_main_result_entries"] = stats.get("multi_main_result_entries", 0) + 1

        # 4. TransponderOverride (raw SQL - table exists in DB but not in Python models)
        # Unique (event_id, driver_id, effective_from_race_id). Delete merged rows that would conflict.
        from sqlalchemy import text
        try:
            session.execute(
                text("""
                    DELETE FROM transponder_overrides m
                    WHERE m.driver_id = :merged
                    AND EXISTS (
                        SELECT 1 FROM transponder_overrides c
                        WHERE c.driver_id = :canonical
                        AND c.event_id = m.event_id
                        AND (c.effective_from_race_id = m.effective_from_race_id
                             OR (c.effective_from_race_id IS NULL AND m.effective_from_race_id IS NULL))
                    )
                """),
                {"canonical": canonical_id, "merged": mid},
            )
            toup = session.execute(
                text("UPDATE transponder_overrides SET driver_id = :c WHERE driver_id = :m"),
                {"c": canonical_id, "m": mid},
            )
            stats["transponder_overrides"] = stats.get("transponder_overrides", 0) + toup.rowcount
        except Exception as e:
            logger.warning("transponder_override_update_skipped", error=str(e), merged_id=mid)

        # 5. EventDriverLink: update driver_id; handle (user_id, event_id, driver_id) unique
        canonical_edl: Set[Tuple[str, str, str]] = {
            (e.user_id, e.event_id, e.driver_id)
            for e in session.query(EventDriverLink.user_id, EventDriverLink.event_id, EventDriverLink.driver_id)
            .filter(EventDriverLink.driver_id == canonical_id)
            .all()
        }
        for edl in session.query(EventDriverLink).filter(EventDriverLink.driver_id == mid).all():
            key = (edl.user_id, edl.event_id, canonical_id)
            if key in canonical_edl:
                session.delete(edl)
                stats["event_driver_links_deleted"] = stats.get("event_driver_links_deleted", 0) + 1
            else:
                edl.driver_id = canonical_id
                canonical_edl.add(key)
                stats["event_driver_links"] = stats.get("event_driver_links", 0) + 1

        # 6. UserDriverLink: canonical can have only one (driver_id unique). Delete merged's link.
        udl = session.query(UserDriverLink).filter(UserDriverLink.driver_id == mid).first()
        if udl:
            session.delete(udl)
            stats["user_driver_links_deleted"] = stats.get("user_driver_links_deleted", 0) + 1

        # 7. Delete merged Driver
        driver = session.get(Driver, mid)
        if driver:
            session.delete(driver)
            stats["drivers_deleted"] = stats.get("drivers_deleted", 0) + 1

    session.flush()
    return stats


def run_deduplication(
    session: Session,
    source: str = "liverc",
    dry_run: bool = True,
) -> Dict[str, Any]:
    """
    Find duplicate groups, optionally merge, and return stats.
    """
    groups = find_duplicate_groups(session, source=source)
    plans = build_merge_plans(session, groups)
    total_merged = sum(len(p.merged_ids) for p in plans)

    result: Dict[str, Any] = {
        "duplicate_groups": len(groups),
        "merge_plans": len(plans),
        "drivers_to_merge": total_merged,
        "dry_run": dry_run,
    }

    if dry_run:
        result["plans"] = [
            {
                "normalized_name": p.group.normalized_name,
                "transponder": p.group.transponder,
                "canonical_id": p.canonical_id,
                "merged_ids": p.merged_ids,
                "display_names": p.group.display_names,
            }
            for p in plans
        ]
        return result

    executed = 0
    for plan in plans:
        try:
            stats = execute_merge(session, plan)
            executed += 1
            logger.info(
                "driver_merge_executed",
                canonical_id=plan.canonical_id,
                merged_ids=plan.merged_ids,
                stats=stats,
            )
            metrics.record_db_update("drivers", len(plan.merged_ids))
        except Exception as e:
            logger.error(
                "driver_merge_failed",
                canonical_id=plan.canonical_id,
                merged_ids=plan.merged_ids,
                error=str(e),
            )
            raise

    result["merges_executed"] = executed
    return result
