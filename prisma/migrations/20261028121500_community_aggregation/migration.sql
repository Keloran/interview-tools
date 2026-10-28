ALTER TABLE "CommunityControl" ADD COLUMN IF NOT EXISTS "lastPublicationMonth" TEXT;
ALTER TABLE "CommunityConsent" ADD COLUMN IF NOT EXISTS "quarantinedAt" TIMESTAMP(3);
ALTER TABLE "CommunityEmployer"
  ADD COLUMN IF NOT EXISTS "jurisdiction" TEXT,
  ADD COLUMN IF NOT EXISTS "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "cohortReviewedAt" TIMESTAMP(3);
ALTER TABLE "CommunityEmployer" DROP CONSTRAINT IF EXISTS "CommunityEmployer_domain_key";
ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS "communityEmployerId" TEXT REFERENCES "CommunityEmployer"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "communityEmployerConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "communityEmployerChangedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "communityEmployerIdentity" TEXT;
