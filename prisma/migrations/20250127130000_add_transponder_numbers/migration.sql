-- AddTransponderNumbers
-- Add transponder_number fields to drivers and race_drivers tables

-- Add transponder_number column to drivers table
ALTER TABLE "drivers" ADD COLUMN "transponder_number" TEXT;

-- Add transponder_number column to race_drivers table
ALTER TABLE "race_drivers" ADD COLUMN "transponder_number" TEXT;

