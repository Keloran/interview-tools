-- Edit its migration.sql to:
ALTER TABLE "Interview" ALTER COLUMN "status" SET DEFAULT 'APPLIED';

-- Optional backfill
-- UPDATE "Interview" SET "status" = 'APPLIED' WHERE "status" IS NULL;