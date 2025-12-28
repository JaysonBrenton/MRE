#!/usr/bin/env python3
"""
Direct event ingestion script that bypasses CLI dependencies.
"""
import sys
import os
import asyncio
from pathlib import Path

# Add ingestion directory to path
ingestion_dir = Path(__file__).parent.parent / "ingestion"
sys.path.insert(0, str(ingestion_dir))
# Also add parent directory to path for proper imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from ingestion.ingestion.pipeline import IngestionPipeline
from ingestion.db.session import db_session
from ingestion.db.models import Track, Event
from ingestion.db.repository import Repository
from uuid import UUID

async def main():
    # Event: Cormcc Club Day 20 July 2025
    track_slug = "canberraoffroad"
    source_event_id = "475681"
    
    print(f"Finding track: {track_slug}...")
    
    with db_session() as session:
        repo = Repository(session)
        track = session.query(Track).filter(Track.source_track_slug == track_slug).first()
        
        if not track:
            print(f"❌ Track not found: {track_slug}")
            return 1
        
        print(f"✅ Found track: {track.track_name} (ID: {track.id})")
        
        # Check if event exists
        event = session.query(Event).filter(
            Event.source == "liverc",
            Event.source_event_id == source_event_id
        ).first()
        
        if event:
            print(f"✅ Found existing event: {event.event_name} (ID: {event.id})")
            event_id = UUID(event.id)
        else:
            print(f"Event not found, will create via ingest_event_by_source_id...")
            event_id = None
    
    # Ingest the event
    pipeline = IngestionPipeline()
    
    if event_id:
        print(f"\n🔄 Ingesting event {event_id}...")
        try:
            result = await pipeline.ingest_event(event_id, depth="laps_full")
            print(f"\n✅ Ingestion completed:")
            print(f"   Races ingested: {result.get('races_ingested', 0)}")
            print(f"   Results ingested: {result.get('results_ingested', 0)}")
            print(f"   Laps ingested: {result.get('laps_ingested', 0)}")
            return 0
        except Exception as e:
            print(f"\n❌ Ingestion failed: {e}")
            import traceback
            traceback.print_exc()
            return 1
    else:
        print(f"\n🔄 Ingesting event by source_id {source_event_id}...")
        try:
            track_uuid = UUID(track.id)
            result = await pipeline.ingest_event_by_source_id(
                source_event_id=source_event_id,
                track_id=track_uuid,
                depth="laps_full"
            )
            print(f"\n✅ Ingestion completed:")
            print(f"   Event ID: {result.get('event_id')}")
            print(f"   Races ingested: {result.get('races_ingested', 0)}")
            print(f"   Results ingested: {result.get('results_ingested', 0)}")
            print(f"   Laps ingested: {result.get('laps_ingested', 0)}")
            return 0
        except Exception as e:
            print(f"\n❌ Ingestion failed: {e}")
            import traceback
            traceback.print_exc()
            return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

