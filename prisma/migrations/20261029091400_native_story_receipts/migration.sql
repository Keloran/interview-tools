CREATE TABLE "StoryCreateReceipt" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "mutationId" TEXT NOT NULL,
  "storyId" INTEGER,
  CONSTRAINT "StoryCreateReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoryCreateReceipt_storyId_key" ON "StoryCreateReceipt"("storyId");
CREATE UNIQUE INDEX "StoryCreateReceipt_userId_mutationId_key" ON "StoryCreateReceipt"("userId", "mutationId");
ALTER TABLE "StoryCreateReceipt" ADD CONSTRAINT "StoryCreateReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryCreateReceipt" ADD CONSTRAINT "StoryCreateReceipt_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE SET NULL ON UPDATE CASCADE;
