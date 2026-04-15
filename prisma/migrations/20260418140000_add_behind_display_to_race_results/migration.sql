-- LiveRC "Behind" is sometimes non-numeric (e.g. "1 Lap"); store verbatim for display.
ALTER TABLE "race_results" ADD COLUMN "behind_display" TEXT;
