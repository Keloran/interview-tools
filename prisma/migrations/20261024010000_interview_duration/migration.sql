-- Idempotent: production may already have this column from a `prisma db push`

-- AlterTable
ALTER TABLE "InterviewStage" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 60;
