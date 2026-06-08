# @fileoverview Admin settings API (internal S2S; requires X-Ingestion-Admin-Token)

from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from ingestion.common.settings import clear_settings_cache, get_effective
from ingestion.common.settings_registry import (
    INGESTION_SETTING_CATEGORY_LABELS,
    INGESTION_SETTING_CATEGORY_ORDER,
    IngestionSettingDefinition,
    list_admin_visible_settings,
)

ADMIN_TOKEN_HEADER = "X-Ingestion-Admin-Token"

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_ingestion_admin_token(
    x_ingestion_admin_token: Optional[str] = Header(default=None, alias=ADMIN_TOKEN_HEADER),
) -> None:
    expected = os.getenv("INGESTION_ADMIN_TOKEN", "")
    if not expected:
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "INGESTION_ADMIN_TOKEN is not configured",
                },
            },
        )
    if not x_ingestion_admin_token or not secrets.compare_digest(
        x_ingestion_admin_token, expected
    ):
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Invalid or missing admin token",
                },
            },
        )


def _serialize_setting(definition: IngestionSettingDefinition) -> dict[str, Any]:
    effective = get_effective(definition.key, mask_secrets=True)
    payload: dict[str, Any] = {
        "key": definition.key,
        "label": definition.label,
        "description": definition.description,
        "category": definition.category,
        "type": definition.type,
        "applyMode": definition.apply_mode,
        "scope": definition.scope,
        "writable": definition.writable,
        "effectiveValue": effective.effective_value,
        "source": effective.source,
        "envValue": effective.env_value,
        "dbValue": effective.db_value,
        "defaultValue": effective.default_value,
        "pendingRestart": False,
    }
    if definition.min is not None:
        payload["min"] = definition.min
    if definition.max is not None:
        payload["max"] = definition.max
    if definition.enum_values:
        payload["enumValues"] = list(definition.enum_values)
    if definition.confirm_when:
        payload["confirmWhen"] = definition.confirm_when
    if definition.docker_service:
        payload["dockerService"] = definition.docker_service
    return payload


@router.get("/settings")
def get_admin_settings(_auth: None = Depends(_require_ingestion_admin_token)) -> dict[str, Any]:
    """List ingestion-scoped settings with effective values (read-only Phase 1)."""
    visible = [definition for definition in list_admin_visible_settings() if definition.scope != "app"]
    settings = [_serialize_setting(definition) for definition in visible]
    categories = [
        {"id": category, "label": INGESTION_SETTING_CATEGORY_LABELS[category]}
        for category in INGESTION_SETTING_CATEGORY_ORDER
        if any(item["category"] == category for item in settings)
    ]
    return {
        "success": True,
        "data": {
            "settings": settings,
            "categories": categories,
        },
    }


@router.post("/settings/reload")
def reload_admin_settings(_auth: None = Depends(_require_ingestion_admin_token)) -> dict[str, Any]:
    """Clear in-process settings cache after Next.js writes DB overrides."""
    clear_settings_cache()
    from ingestion.common.site_policy import SitePolicy

    SitePolicy.reset_shared()
    return {
        "success": True,
        "data": {"reloadedAt": datetime.now(timezone.utc).isoformat()},
    }
