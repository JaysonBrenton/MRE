"""Runtime settings resolver — DB → environment → registry default."""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Literal, Optional, Union

from ingestion.common.settings_registry import (
    INGESTION_SETTINGS_REGISTRY,
    IngestionSettingDefinition,
    get_setting_definition,
)
from ingestion.db.models import IngestionSetting
from ingestion.db.session import SessionLocal

SettingSource = Literal["database", "environment", "default"]

EffectiveValue = Union[str, int, float, bool]

_db_overrides_cache: dict[str, str] | None = None
_db_cache_loaded_at: float = 0.0


@dataclass(frozen=True)
class EffectiveSetting:
    key: str
    effective_value: EffectiveValue
    source: SettingSource
    default_value: EffectiveValue
    env_value: Optional[EffectiveValue] = None
    db_value: Optional[EffectiveValue] = None


def _cache_ttl_seconds() -> int:
    raw = os.environ.get("INGESTION_SETTINGS_CACHE_TTL_SECONDS", "30")
    try:
        return max(0, int(raw))
    except ValueError:
        return 30


def _parse_bool(raw: str) -> bool:
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _parse_typed_raw(raw: str, definition: IngestionSettingDefinition) -> EffectiveValue:
    setting_type = definition.type
    if setting_type == "boolean":
        return _parse_bool(raw)
    if setting_type == "integer":
        return int(raw)
    if setting_type == "number":
        return float(raw)
    if setting_type == "json":
        parsed = json.loads(raw)
        if not isinstance(parsed, (dict, list)):
            raise ValueError(f"{definition.key} must be JSON object or array")
        return raw
    return raw


def _coerce_default(definition: IngestionSettingDefinition) -> EffectiveValue:
    return definition.default


def serialize_setting_value(value: EffectiveValue, definition: IngestionSettingDefinition) -> str:
    if definition.type == "boolean":
        return "true" if bool(value) else "false"
    if definition.type in ("integer", "number"):
        return str(value)
    return str(value)


def _mask_effective_value(key: str, value: EffectiveValue, *, secret: bool) -> EffectiveValue:
    if not secret:
        return value
    if key == "DATABASE_URL" and isinstance(value, str) and value:
        return "postgresql://***"
    return "***"


def _load_db_overrides(*, force: bool = False) -> dict[str, str]:
    global _db_overrides_cache, _db_cache_loaded_at
    now = time.monotonic()
    ttl = _cache_ttl_seconds()
    if (
        not force
        and _db_overrides_cache is not None
        and (ttl == 0 or (now - _db_cache_loaded_at) < ttl)
    ):
        return _db_overrides_cache

    session = SessionLocal()
    try:
        rows = session.query(IngestionSetting.key, IngestionSetting.value).all()
        _db_overrides_cache = {row.key: row.value for row in rows}
        _db_cache_loaded_at = now
        return _db_overrides_cache
    finally:
        session.close()


def clear_settings_cache() -> None:
    """Clear in-process DB override cache (called after admin PATCH/reload)."""
    global _db_overrides_cache, _db_cache_loaded_at
    _db_overrides_cache = None
    _db_cache_loaded_at = 0.0


def _resolve_definition(
    definition: IngestionSettingDefinition,
    *,
    mask_secrets: bool,
    db_overrides: dict[str, str],
) -> EffectiveSetting:
    default_value = _coerce_default(definition)
    raw_env = os.environ.get(definition.key)
    env_value: Optional[EffectiveValue] = None
    db_value: Optional[EffectiveValue] = None
    effective_value = default_value
    source: SettingSource = "default"

    if raw_env is not None:
        env_value = _parse_typed_raw(raw_env, definition)

    raw_db = db_overrides.get(definition.key)
    if raw_db is not None:
        db_value = _parse_typed_raw(raw_db, definition)
        effective_value = db_value
        source = "database"
    elif env_value is not None:
        effective_value = env_value
        source = "environment"

    if mask_secrets and definition.secret:
        effective_value = _mask_effective_value(definition.key, effective_value, secret=True)
        if env_value is not None:
            env_value = _mask_effective_value(definition.key, env_value, secret=True)
        if db_value is not None:
            db_value = _mask_effective_value(definition.key, db_value, secret=True)

    return EffectiveSetting(
        key=definition.key,
        effective_value=effective_value,
        source=source,
        default_value=default_value,
        env_value=env_value,
        db_value=db_value,
    )


def get_effective(key: str, *, mask_secrets: bool = True) -> EffectiveSetting:
    definition = get_setting_definition(key)
    if definition is None:
        raise KeyError(f"Unknown ingestion setting key: {key}")
    db_overrides = _load_db_overrides()
    return _resolve_definition(definition, mask_secrets=mask_secrets, db_overrides=db_overrides)


def list_all(*, mask_secrets: bool = True) -> list[EffectiveSetting]:
    db_overrides = _load_db_overrides()
    return [
        _resolve_definition(definition, mask_secrets=mask_secrets, db_overrides=db_overrides)
        for definition in INGESTION_SETTINGS_REGISTRY
    ]


def list_ingestion_scoped(*, mask_secrets: bool = True) -> list[EffectiveSetting]:
    db_overrides = _load_db_overrides()
    return [
        _resolve_definition(definition, mask_secrets=mask_secrets, db_overrides=db_overrides)
        for definition in INGESTION_SETTINGS_REGISTRY
        if definition.scope != "app"
    ]


def get_int(key: str) -> int:
    return int(get_effective(key, mask_secrets=False).effective_value)


def get_bool(key: str) -> bool:
    return bool(get_effective(key, mask_secrets=False).effective_value)


def get_str(key: str) -> str:
    return str(get_effective(key, mask_secrets=False).effective_value)


def get_float(key: str) -> float:
    return float(get_effective(key, mask_secrets=False).effective_value)
