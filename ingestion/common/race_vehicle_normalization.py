"""
Denormalize vehicle type + skill tier onto Race rows (ingestion).

Ports schedule heuristics from src/core/events/lcq-bump-up-merge.ts and
infer-bump-ups.ts so DB rows are usable without the Next.js runtime.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple

from ingestion.common.logging import get_logger

logger = get_logger(__name__)

PLACEHOLDER_CLASS_NAMES = frozenset({"track maintenance", "track maintainance", "track watering"})

# LiveRC: banner rows (class field or label), aligned with src/lib/format-class-name.ts
_BREAK_ASTERISKS = re.compile(r"\*{3,}")
_MIN_BREAK = re.compile(r"\b(?:\d+\s*)?min(?:ute)?s?\s*break\b", re.I)
_INTERMISSION = re.compile(r"\bintermission\b", re.I)


def is_placeholder_class(class_name: Optional[str]) -> bool:
    if not class_name or not str(class_name).strip():
        return False
    raw = str(class_name).strip()
    if raw.lower() in PLACEHOLDER_CLASS_NAMES:
        return True
    if _BREAK_ASTERISKS.search(raw):
        return True
    if _INTERMISSION.search(raw):
        return True
    if _MIN_BREAK.search(raw):
        return True
    return False


def label_looks_like_lcq(label: str) -> bool:
    if not label:
        return False
    L = label.lower()
    if re.search(r"\blcq\b", L):
        return True
    return bool(re.search(r"last\s*chance", L, re.I))


def race_is_lcq_row(class_name: str, race_label: str) -> bool:
    cn = (class_name or "").strip().lower()
    if "last chance" in cn:
        return True
    return label_looks_like_lcq(race_label or "")


def label_looks_like_semi(label: str) -> bool:
    if not label:
        return False
    L = label.lower()
    if re.search(r"\bsemi[\s-]*final\b", L):
        return True
    if re.search(r"\bsemi\b", L) and not re.search(r"\ba[\s\d]*[-–]?\s*main\b", L):
        return True
    return False


def label_looks_like_qualifying_or_practice(label: str, session_type: Optional[str]) -> bool:
    if label_looks_like_lcq(label):
        return False
    L = (label or "").lower()
    if re.search(r"(qualif|seed|practice|timed\s*practice)", L):
        return True
    st = (session_type or "").lower()
    if st in ("practice", "seeding") or "qualif" in st:
        return True
    return False


def is_main_session_from_fields(
    session_type: Optional[str],
    race_label: str,
    section_header: Optional[str],
) -> bool:
    st = (session_type or "").lower()
    if st == "main":
        return True
    label = (race_label or "").strip()
    if label:
        lower = label.lower()
        if "main" in lower:
            return True
        if re.search(r"\bfinal\b", lower) and not re.search(r"\bsemi[\s-]*final\b", lower):
            return True
    section = (section_header or "").strip()
    return bool(section) and "main event" in section.lower()


def race_might_be_bump_up_ladder_race(
    race_label: str,
    session_type: Optional[str],
    section_header: Optional[str],
) -> bool:
    label = race_label or ""
    if label_looks_like_lcq(label):
        return True
    if label_looks_like_semi(label):
        return True
    return is_main_session_from_fields(session_type, label, section_header)


def _session_type_str(session_type: Any) -> Optional[str]:
    if session_type is None:
        return None
    if hasattr(session_type, "value"):
        return str(session_type.value)
    return str(session_type)


def infer_skill_tier_from_text(class_name: str, race_label: str) -> Optional[str]:
    """Return Junior / Senior / Sportsman when present in class or label."""
    combined = f"{class_name} {race_label}"
    m = re.search(r"\b(Junior|Senior|Sportsman)\b", combined, re.I)
    if m:
        t = m.group(1)
        return t[:1].upper() + t[1:].lower()
    return None


def infer_skill_tier_from_entry_class_name(class_name: str) -> Optional[str]:
    cn = (class_name or "").strip()
    if not cn:
        return None
    lower = cn.lower()
    for tier in SKILL_TIERS:
        tl = tier.lower()
        if lower == tl or lower.startswith(tl + " ") or lower.startswith(tl + "\t"):
            return tier
    return None


@dataclass(frozen=True)
class RaceNormRow:
    id: str
    class_name: str
    race_label: str
    race_order: Optional[int]
    session_type: Optional[str]
    section_header: Optional[str]
    start_time: Optional[datetime]


def _sort_schedule_races(races: Sequence[RaceNormRow]) -> List[RaceNormRow]:
    filtered = [r for r in races if not is_placeholder_class(r.class_name)]

    def sort_key(r: RaceNormRow) -> Tuple:
        ro = r.race_order
        ro_key = (ro is None, ro if ro is not None else 0)
        ta = r.start_time.timestamp() if r.start_time else 0.0
        return (ro_key[0], ro_key[1], ta, r.race_label)

    return sorted(filtered, key=sort_key)


def get_lcq_merge_target_class_name(
    lcq: RaceNormRow,
    schedule: Sequence[RaceNormRow],
) -> Optional[str]:
    ids = [r.id for r in schedule]
    try:
        idx = ids.index(lcq.id)
    except ValueError:
        return None
    for j in range(idx + 1, len(schedule)):
        r = schedule[j]
        if is_placeholder_class(r.class_name):
            continue
        if not race_might_be_bump_up_ladder_race(
            r.race_label,
            r.session_type,
            r.section_header,
        ):
            continue
        if race_is_lcq_row(r.class_name, r.race_label):
            continue
        cn = (r.class_name or "").strip()
        if cn:
            return cn
    return None


def forward_merge_target_vehicle(
    race: RaceNormRow,
    schedule: Sequence[RaceNormRow],
    resolved_vehicle_by_class: Dict[str, Tuple[Optional[str], Optional[str]]],
) -> Tuple[Optional[str], Optional[str]]:
    """
    Walk forward on schedule to next race with a resolvable vehicle from class_name.
    Returns (vehicle_type, event_race_class_id).
    """
    ids = [r.id for r in schedule]
    try:
        idx = ids.index(race.id)
    except ValueError:
        return None, None
    for j in range(idx + 1, len(schedule)):
        r = schedule[j]
        if is_placeholder_class(r.class_name):
            continue
        cn = (r.class_name or "").strip()
        if not cn:
            continue
        if cn in resolved_vehicle_by_class:
            vt, erc_id = resolved_vehicle_by_class[cn]
            if vt is not None or erc_id is not None:
                return vt, erc_id
    return None, None


def should_try_forward_merge(class_name: str, race_label: str) -> bool:
    """Heuristic: LCQ-like rows and practice rows that are not plain class names."""
    if race_is_lcq_row(class_name, race_label):
        return True
    cn = (class_name or "").lower()
    rl = (race_label or "").lower()
    if "practice" in cn or "practice" in rl:
        return True
    return False


def compute_normalization_for_event(
    races_raw: Sequence[Any],
    erc_by_class_name: Dict[str, Tuple[str, Optional[str]]],
    driver_ids_by_race: Dict[str, List[str]],
    entry_class_names_by_driver: Dict[str, List[str]],
) -> Dict[str, Dict[str, Any]]:
    """
    Returns race_id -> {
      vehicle_type, skill_tier, event_race_class_id,
      vehicle_class_normalization_needs_review
    }
    """
    rows: List[RaceNormRow] = []
    for r in races_raw:
        rows.append(
            RaceNormRow(
                id=str(r.id),
                class_name=r.class_name or "",
                race_label=r.race_label or "",
                race_order=r.race_order,
                session_type=_session_type_str(getattr(r, "session_type", None)),
                section_header=getattr(r, "section_header", None),
                start_time=getattr(r, "start_time", None),
            )
        )

    resolved_vehicle_by_class: Dict[str, Tuple[Optional[str], Optional[str]]] = {}
    for cn, (erc_id, vt) in erc_by_class_name.items():
        resolved_vehicle_by_class[cn] = (vt, erc_id)

    schedule = _sort_schedule_races(rows)
    schedule_ids = {r.id for r in schedule}

    out: Dict[str, Dict[str, Any]] = {}

    # Pass 1: direct ERC lookup + placeholders
    for row in rows:
        rid = row.id
        if is_placeholder_class(row.class_name):
            out[rid] = {
                "vehicle_type": None,
                "skill_tier": None,
                "event_race_class_id": None,
                "vehicle_class_normalization_needs_review": False,
            }
            continue

        cn = (row.class_name or "").strip()
        tier_text = infer_skill_tier_from_text(cn, row.race_label)
        tier_entry = _consensus_skill_tier_from_entries(
            driver_ids_by_race.get(rid, []),
            entry_class_names_by_driver,
        )
        skill_tier = tier_text or tier_entry

        if cn in erc_by_class_name:
            erc_id, vt = erc_by_class_name[cn]
            out[rid] = {
                "vehicle_type": vt,
                "skill_tier": skill_tier,
                "event_race_class_id": erc_id,
                "vehicle_class_normalization_needs_review": vt is None,
            }
        else:
            out[rid] = {
                "vehicle_type": None,
                "skill_tier": skill_tier,
                "event_race_class_id": None,
                "vehicle_class_normalization_needs_review": True,
            }

    # Pass 2: LCQ / forward merge for rows missing vehicle_type
    for row in rows:
        rid = row.id
        if is_placeholder_class(row.class_name):
            continue
        cur = out[rid]
        if cur.get("vehicle_type") is not None:
            continue
        if not should_try_forward_merge(row.class_name, row.race_label):
            continue

        target_cn: Optional[str] = None
        if race_is_lcq_row(row.class_name, row.race_label) and row.id in schedule_ids:
            target_cn = get_lcq_merge_target_class_name(row, schedule)

        vt: Optional[str] = None
        erc_id: Optional[str] = None
        if target_cn and target_cn in erc_by_class_name:
            erc_id, vt = erc_by_class_name[target_cn]
        if vt is None and row.id in schedule_ids:
            vt, erc_id = forward_merge_target_vehicle(
                row, schedule, resolved_vehicle_by_class
            )

        if vt is not None or erc_id is not None:
            out[rid] = {
                "vehicle_type": vt,
                "skill_tier": cur.get("skill_tier"),
                "event_race_class_id": erc_id,
                "vehicle_class_normalization_needs_review": vt is None,
            }
        else:
            out[rid] = {
                "vehicle_type": None,
                "skill_tier": cur.get("skill_tier"),
                "event_race_class_id": None,
                "vehicle_class_normalization_needs_review": True,
            }

    # Pass 3: fill skill tier from label if still missing
    for row in rows:
        rid = row.id
        if is_placeholder_class(row.class_name):
            continue
        cur = out[rid]
        if cur.get("skill_tier"):
            continue
        st = infer_skill_tier_from_text(row.class_name, row.race_label)
        if st:
            cur = dict(cur)
            cur["skill_tier"] = st
            out[rid] = cur

    return out


def _consensus_skill_tier_from_entries(
    driver_ids: Sequence[str],
    entry_class_names_by_driver: Dict[str, List[str]],
) -> Optional[str]:
    tiers: List[str] = []
    for did in driver_ids:
        for cname in entry_class_names_by_driver.get(did, []):
            t = infer_skill_tier_from_entry_class_name(cname)
            if t:
                tiers.append(t)
    if not tiers:
        return None
    uniq = list(dict.fromkeys(tiers))
    if len(uniq) == 1:
        return uniq[0]
    return None
