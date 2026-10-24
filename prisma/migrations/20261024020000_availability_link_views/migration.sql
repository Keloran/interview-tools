-- Idempotent, like the other recent migrations
-- AlterTable
ALTER TABLE "AvailabilityLink" ADD COLUMN IF NOT EXISTS "firstViewedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastViewedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "viewCount" INTEGER NOT NULL DEFAULT 0;

