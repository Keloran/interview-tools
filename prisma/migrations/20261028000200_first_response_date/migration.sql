-- Historical timestamps cannot establish when a company first replied.
-- Leave existing applications unknown until the owner supplies the date.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "firstResponseAt" DATE;
