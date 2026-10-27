-- Idempotent, like the earlier migrations

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FeedbackType" AS ENUM ('NONE', 'GENERIC', 'SPECIFIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "InterviewStage" ADD COLUMN IF NOT EXISTS "feedbackType" "FeedbackType";
ALTER TABLE "InterviewStage" ADD COLUMN IF NOT EXISTS "feedbackText" TEXT;
