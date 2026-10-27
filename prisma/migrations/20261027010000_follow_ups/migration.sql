-- Idempotent, like the earlier migrations

-- CreateTable
CREATE TABLE IF NOT EXISTS "FollowUp" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FollowUp_applicationId_idx" ON "FollowUp"("applicationId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
