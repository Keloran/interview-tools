-- CreateTable
CREATE TABLE "Application" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "clientCompany" TEXT,
    "jobTitle" TEXT NOT NULL,
    "applicationDate" TIMESTAMP(3) NOT NULL,
    "jobPostingLink" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewStage" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "stageId" INTEGER NOT NULL,
    "stageMethodId" INTEGER NOT NULL,
    "interviewer" TEXT,
    "date" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "outcome" "InterviewOutcome",
    "notes" TEXT,
    "link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "parentId" INTEGER,

    CONSTRAINT "InterviewStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_userId_companyId_jobTitle_applicationDate_clien_key" ON "Application"("userId", "companyId", "jobTitle", "applicationDate", "clientCompany");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewStage" ADD CONSTRAINT "InterviewStage_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewStage" ADD CONSTRAINT "InterviewStage_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewStage" ADD CONSTRAINT "InterviewStage_stageMethodId_fkey" FOREIGN KEY ("stageMethodId") REFERENCES "StageMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewStage" ADD CONSTRAINT "InterviewStage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "InterviewStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Copy legacy data: rows for the same job (user, company, title, client) become one Application,
-- each row becomes a stage (keeping its id), chained in creation order.
-- ponytail: re-applying for the same title at the same company merges into one application; split by hand if needed
INSERT INTO "Application" ("userId", "companyId", "clientCompany", "jobTitle", "applicationDate", "jobPostingLink", "created_at", "updated_at")
SELECT "userId", "companyId", "clientCompany", "jobTitle", MIN("applicationDate"), MAX("metadata"->>'jobListing'), MIN("created_at"), MAX("updated_at")
FROM "Interview"
GROUP BY "userId", "companyId", "clientCompany", "jobTitle";

INSERT INTO "InterviewStage" ("id", "applicationId", "stageId", "stageMethodId", "interviewer", "date", "deadline", "outcome", "notes", "link", "created_at", "updated_at", "parentId")
SELECT i."id", a."id", i."stageId", i."stageMethodId", i."interviewer", i."date", i."deadline", i."outcome", i."notes", i."link", i."created_at", i."updated_at",
       LAG(i."id") OVER (PARTITION BY a."id" ORDER BY i."created_at", i."id")
FROM "Interview" i
JOIN "Application" a ON a."userId" = i."userId" AND a."companyId" = i."companyId" AND a."jobTitle" = i."jobTitle"
  AND a."clientCompany" IS NOT DISTINCT FROM i."clientCompany";

SELECT setval(pg_get_serial_sequence('"InterviewStage"', 'id'), COALESCE(MAX("id"), 0) + 1, false) FROM "InterviewStage";
