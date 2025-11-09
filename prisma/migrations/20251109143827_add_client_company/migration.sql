/*
  Warnings:

  - A unique constraint covering the columns `[userId,companyId,jobTitle,applicationDate,clientCompany]` on the table `Interview` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Interview_userId_companyId_jobTitle_applicationDate_key";

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "clientCompany" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Interview_userId_companyId_jobTitle_applicationDate_clientC_key" ON "Interview"("userId", "companyId", "jobTitle", "applicationDate", "clientCompany");
