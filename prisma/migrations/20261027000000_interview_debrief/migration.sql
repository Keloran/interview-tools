-- Idempotent, like the earlier migrations

-- AlterTable
ALTER TABLE "InterviewStage" ADD COLUMN IF NOT EXISTS "debriefedAt" TIMESTAMP(3);
ALTER TABLE "InterviewStage" ADD COLUMN IF NOT EXISTS "rating" INTEGER;
ALTER TABLE "InterviewStage" ADD COLUMN IF NOT EXISTS "debriefNotes" TEXT;
ALTER TABLE "InterviewStage" ADD COLUMN IF NOT EXISTS "peopleMet" TEXT;
ALTER TABLE "InterviewStage" ADD COLUMN IF NOT EXISTS "questionsAsked" TEXT;
ALTER TABLE "InterviewStage" ADD COLUMN IF NOT EXISTS "prepNotes" TEXT;
ALTER TABLE "InterviewStage" ADD COLUMN IF NOT EXISTS "nextStep" TEXT;
ALTER TABLE "InterviewStage" ADD COLUMN IF NOT EXISTS "replyBy" TIMESTAMP(3);
