-- AlterTable
-- Add section_header to store LiveRC round headings (e.g. "Qualifier Round 1", "Main Events", "Seeding Round 2")
ALTER TABLE "races" ADD COLUMN IF NOT EXISTS "section_header" TEXT;
