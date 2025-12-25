#!/usr/bin/env python3
"""Test script to run ingestion and verify transponder numbers are captured."""

import asyncio
import sys
from uuid import UUID

# Add ingestion to path
sys.path.insert(0, 'ingestion')

from ingestion.ingestion.pipeline import IngestionPipeline
from ingestion.db.session import db_session
from ingestion.db.repository import Repository
from ingestion.db.models import Driver, RaceDriver


async def main():
    # Event ID from previous script output
    event_id = UUID("67affaa1-f667-4d22-9621-9d1cc189f7a0")
    
    print(f"Starting ingestion for event: {event_id}")
    print("=" * 60)
    
    pipeline = IngestionPipeline()
    
    try:
        result = await pipeline.ingest_event(event_id, depth="laps_full")
        
        print("\nIngestion completed!")
        print(f"Status: {result.get('status')}")
        print(f"Races ingested: {result.get('races_ingested', 0)}")
        print(f"Results ingested: {result.get('results_ingested', 0)}")
        print(f"Laps ingested: {result.get('laps_ingested', 0)}")
        print("=" * 60)
        
        # Now check transponder numbers
        print("\nChecking transponder numbers...")
        print("=" * 60)
        
        with db_session() as session:
            repo = Repository(session)
            
            # Get event to find races
            from ingestion.db.models import Event, Race
            event = repo.get_event_by_id(event_id)
            
            if not event:
                print(f"Event {event_id} not found!")
                return
            
            # Get races for this event
            races = session.query(Race).filter(Race.event_id == str(event_id)).all()
            
            print(f"\nFound {len(races)} race(s) for event: {event.event_name}")
            
            total_drivers_with_transponders = 0
            total_race_drivers_with_transponders = 0
            total_drivers = 0
            total_race_drivers = 0
            
            for race in races:
                print(f"\nRace: {race.class_name} - {race.race_label}")
                
                # Get race drivers
                race_drivers = session.query(RaceDriver).filter(
                    RaceDriver.race_id == str(race.id)
                ).all()
                
                print(f"  Drivers in race: {len(race_drivers)}")
                
                for race_driver in race_drivers:
                    total_race_drivers += 1
                    driver = session.query(Driver).filter(
                        Driver.id == race_driver.driver_id
                    ).first()
                    
                    if driver:
                        total_drivers += 1
                        
                        # Check transponder numbers
                        driver_transponder = driver.transponder_number
                        race_driver_transponder = race_driver.transponder_number
                        
                        transponder_display = race_driver_transponder or driver_transponder or "None"
                        
                        if race_driver_transponder:
                            total_race_drivers_with_transponders += 1
                        if driver_transponder:
                            total_drivers_with_transponders += 1
                        
                        print(f"    - {race_driver.display_name}: {transponder_display}")
                        if race_driver_transponder and driver_transponder and race_driver_transponder != driver_transponder:
                            print(f"      (Driver default: {driver_transponder}, Race override: {race_driver_transponder})")
            
            print("\n" + "=" * 60)
            print("TRANSPONDER NUMBER SUMMARY")
            print("=" * 60)
            print(f"Total Drivers: {total_drivers}")
            print(f"Drivers with transponder (Driver level): {total_drivers_with_transponders}")
            print(f"Total Race Drivers: {total_race_drivers}")
            print(f"Race Drivers with transponder (RaceDriver level): {total_race_drivers_with_transponders}")
            
            if total_race_drivers_with_transponders > 0 or total_drivers_with_transponders > 0:
                print("\n✓ SUCCESS: Transponder numbers are being captured!")
            else:
                print("\n⚠ WARNING: No transponder numbers found. This could mean:")
                print("  - Entry list page is not available for this event")
                print("  - Entry list parsing failed")
                print("  - Drivers couldn't be matched to entry list")
    
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

