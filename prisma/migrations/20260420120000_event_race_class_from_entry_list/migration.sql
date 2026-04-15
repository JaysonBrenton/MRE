-- Distinguish registration (entry list) class rows from race/session-only bucket labels (LCQ, semi practice, etc.).
-- Used for event-level UI chips: exclude ERC rows with from_entry_list = false.

ALTER TABLE "event_race_classes" ADD COLUMN "from_entry_list" BOOLEAN NOT NULL DEFAULT true;

-- Race/session-only labels have no corresponding event_entries row for that (event_id, class_name).
UPDATE "event_race_classes" erc
SET "from_entry_list" = false
WHERE NOT EXISTS (
  SELECT 1
  FROM "event_entries" e
  WHERE e.event_id = erc.event_id
    AND e.class_name = erc.class_name
);
