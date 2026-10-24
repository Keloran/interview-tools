-- Idempotent: production never ran migrations on deploy and may already have this table from a `prisma db push`

-- CreateTable
CREATE TABLE IF NOT EXISTS "AvailabilityLink" (
    "id" TEXT NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "stageId" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "meetingLink" TEXT,
    "slots" TIMESTAMP(3)[],
    "bookedSlot" TIMESTAMP(3),
    "interviewId" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AvailabilityLink_interviewId_key" ON "AvailabilityLink"("interviewId");

-- AddForeignKey (Postgres has no ADD CONSTRAINT IF NOT EXISTS)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AvailabilityLink_applicationId_fkey') THEN
    ALTER TABLE "AvailabilityLink" ADD CONSTRAINT "AvailabilityLink_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AvailabilityLink_stageId_fkey') THEN
    ALTER TABLE "AvailabilityLink" ADD CONSTRAINT "AvailabilityLink_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AvailabilityLink_interviewId_fkey') THEN
    ALTER TABLE "AvailabilityLink" ADD CONSTRAINT "AvailabilityLink_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "InterviewStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
