-- CreateTable
CREATE TABLE "AvailabilityLink" (
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
CREATE UNIQUE INDEX "AvailabilityLink_interviewId_key" ON "AvailabilityLink"("interviewId");

-- AddForeignKey
ALTER TABLE "AvailabilityLink" ADD CONSTRAINT "AvailabilityLink_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityLink" ADD CONSTRAINT "AvailabilityLink_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityLink" ADD CONSTRAINT "AvailabilityLink_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "InterviewStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

