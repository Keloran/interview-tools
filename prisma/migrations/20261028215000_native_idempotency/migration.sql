CREATE TABLE "InterviewCreateReceipt" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "mutationId" TEXT NOT NULL,
  "interviewId" INTEGER,
  CONSTRAINT "InterviewCreateReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InterviewCreateReceipt_interviewId_key" ON "InterviewCreateReceipt"("interviewId");
CREATE UNIQUE INDEX "InterviewCreateReceipt_userId_mutationId_key" ON "InterviewCreateReceipt"("userId", "mutationId");
ALTER TABLE "InterviewCreateReceipt" ADD CONSTRAINT "InterviewCreateReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewCreateReceipt" ADD CONSTRAINT "InterviewCreateReceipt_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "InterviewStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
