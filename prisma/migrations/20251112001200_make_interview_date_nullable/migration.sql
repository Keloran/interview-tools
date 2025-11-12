-- AlterTable
-- Make Interview.date nullable to support Technical Test entries using deadline instead of date
ALTER TABLE "Interview"
    ALTER COLUMN "date" DROP NOT NULL;
