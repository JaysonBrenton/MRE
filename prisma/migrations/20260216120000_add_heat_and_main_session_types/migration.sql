-- AlterEnum
-- Add 'heat' and 'main' values to SessionType enum
-- heat = qualifying heats (e.g. Heat 1/3); main = main events (e.g. A1-Main, B-Main)
ALTER TYPE "SessionType" ADD VALUE 'heat';
ALTER TYPE "SessionType" ADD VALUE 'main';
