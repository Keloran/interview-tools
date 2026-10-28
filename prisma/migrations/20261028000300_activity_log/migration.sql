ALTER TABLE "AvailabilityLink" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
CREATE TABLE IF NOT EXISTS "ActivityEntry" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "date" DATE NOT NULL,
  "activity" TEXT NOT NULL,
  "employer" TEXT NOT NULL DEFAULT '',
  "role" TEXT NOT NULL DEFAULT '',
  "how" TEXT NOT NULL DEFAULT '',
  "outcome" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS "ActivityEntry_userId_date_idx" ON "ActivityEntry"("userId", "date");
