ALTER TABLE "FollowUp" ADD COLUMN "clientMutationId" TEXT;
CREATE UNIQUE INDEX "FollowUp_applicationId_clientMutationId_key" ON "FollowUp"("applicationId", "clientMutationId");
