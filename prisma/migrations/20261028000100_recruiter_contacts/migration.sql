ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "viaRecruiter" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "recruiterName" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "recruiterEmail" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "recruiterLinkedIn" TEXT;

-- Existing client-company applications already represent an agency route.
UPDATE "Application" SET "viaRecruiter" = true
WHERE "clientCompany" IS NOT NULL AND btrim("clientCompany") <> '';
