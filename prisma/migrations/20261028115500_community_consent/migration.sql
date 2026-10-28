CREATE TABLE IF NOT EXISTS "CommunityControl" (
  "id" TEXT PRIMARY KEY DEFAULT 'global', "noticeVersion" TEXT, "noticePublishedAt" TIMESTAMP(3),
  "collectionEnabled" BOOLEAN NOT NULL DEFAULT false, "publicationEnabled" BOOLEAN NOT NULL DEFAULT false,
  "revocationEpoch" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "CommunityControl" ("id") VALUES ('global') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS "CommunityConsent" (
  "userId" INTEGER PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "noticeVersion" TEXT NOT NULL, "grantedAt" TIMESTAMP(3), "withdrawnAt" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 1, "purgePending" BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS "CommunityEmployer" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "domain" TEXT UNIQUE,
  "reviewedAt" TIMESTAMP(3), "suppressedAt" TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS "CommunityContribution" (
  "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "employerId" TEXT NOT NULL REFERENCES "CommunityEmployer"("id") ON DELETE CASCADE,
  "noticeVersion" TEXT NOT NULL, "consentRevision" INTEGER NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL, "responded" BOOLEAN, "ghosted" BOOLEAN,
  "feedbackGiven" BOOLEAN, "replyDays" INTEGER, PRIMARY KEY ("userId", "employerId")
);
CREATE TABLE IF NOT EXISTS "CommunitySnapshot" (
  "employerId" TEXT PRIMARY KEY REFERENCES "CommunityEmployer"("id") ON DELETE CASCADE,
  "revocationEpoch" INTEGER NOT NULL, "noticeVersion" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL, "data" JSONB NOT NULL
);
