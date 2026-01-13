"""Track sync reporting helpers."""

from __future__ import annotations

import glob
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List

from ingestion.common.logging import get_logger

logger = get_logger(__name__)


def get_reports_directory() -> Path:
    """Return path to docs/reports directory (support Docker + local)."""
    if os.path.exists("/app/docs/reports"):
        return Path("/app/docs/reports")
    return Path(__file__).resolve().parents[2] / "docs" / "reports"


def generate_track_sync_report(
    start_time: datetime,
    duration_seconds: float,
    total_tracks: int,
    tracks_added: int,
    tracks_updated: int,
    tracks_deactivated: int,
    new_tracks: List[Dict[str, str]],
    updated_tracks: List[Dict[str, str]],
    deactivated_tracks: List[Dict[str, str]],
) -> str:
    """Generate markdown report for track sync run."""
    reports_dir = get_reports_directory()
    reports_dir.mkdir(parents=True, exist_ok=True)

    timestamp_str = start_time.strftime("%Y-%m-%d-%H-%M-%S")
    report_filename = f"track-sync-{timestamp_str}.md"
    report_path = reports_dir / report_filename

    report_lines = [
        "# Track Catalogue Sync Report",
        "",
        f"**Execution Time**: {start_time.strftime('%Y-%m-%d %H:%M:%S')} UTC",
        f"**Duration**: {duration_seconds:.2f}s",
        "",
        "## Summary",
        f"- Total Tracks: {total_tracks}",
        f"- New Tracks: {tracks_added}",
        f"- Updated Tracks: {tracks_updated}",
        f"- Deactivated Tracks: {tracks_deactivated}",
        "",
    ]

    if new_tracks:
        report_lines.append("## New Tracks")
        for idx, track in enumerate(new_tracks, start=1):
            report_lines.append(
                f"{idx}. {track['name']} | {track['slug']} | {track['url']}"
            )
        report_lines.append("")

    if updated_tracks:
        report_lines.append("## Updated Tracks")
        for idx, track in enumerate(updated_tracks, start=1):
            report_lines.append(
                f"{idx}. {track['name']} | {track['slug']} | {track['url']} | Updated: {track['changes']}"
            )
        report_lines.append("")

    if deactivated_tracks:
        report_lines.append("## Deactivated Tracks")
        for idx, track in enumerate(deactivated_tracks, start=1):
            report_lines.append(
                f"{idx}. {track['name']} | {track['slug']} | {track['url']}"
            )
        report_lines.append("")

    with report_path.open("w", encoding="utf-8") as handle:
        handle.write("\n".join(report_lines))

    return str(report_path)


def cleanup_old_reports(retention_days: int | None = None) -> None:
    """Delete reports older than retention period (default 30 days)."""
    retention_days = int(retention_days or os.getenv("TRACK_SYNC_REPORT_RETENTION_DAYS", "30"))
    reports_dir = get_reports_directory()
    if not reports_dir.exists():
        return

    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
    deleted_count = 0

    pattern = str(reports_dir / "track-sync-*.md")
    for report_path in glob.glob(pattern):
        try:
            filename = Path(report_path).name
            timestamp_str = filename.replace("track-sync-", "").replace(".md", "")
            report_date = datetime.strptime(timestamp_str, "%Y-%m-%d-%H-%M-%S")
            if report_date < cutoff_date:
                os.remove(report_path)
                deleted_count += 1
                logger.debug(
                    "old_report_deleted",
                    report_path=report_path,
                    report_date=report_date.isoformat(),
                )
        except (ValueError, OSError) as exc:
            logger.warning(
                "failed_to_delete_report",
                report_path=report_path,
                error=str(exc),
            )

    if deleted_count > 0:
        logger.info(
            "old_reports_cleaned",
            deleted_count=deleted_count,
            retention_days=retention_days,
        )

__all__ = [
    "generate_track_sync_report",
    "cleanup_old_reports",
    "get_reports_directory",
]
