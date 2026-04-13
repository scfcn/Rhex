CREATE TYPE "AiReplyTaskStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

CREATE TYPE "AiReplyTaskSourceType" AS ENUM ('POST', 'COMMENT');

CREATE TABLE "AiReplyTask" (
  "id" TEXT NOT NULL,
  "sourceType" "AiReplyTaskSourceType" NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "status" "AiReplyTaskStatus" NOT NULL DEFAULT 'PENDING',
  "postId" TEXT NOT NULL,
  "sourceCommentId" TEXT,
  "generatedCommentId" TEXT,
  "triggerUserId" INTEGER NOT NULL,
  "agentUserId" INTEGER NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "scheduledAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMPTZ(3),
  "finishedAt" TIMESTAMPTZ(3),
  "errorMessage" TEXT,
  "resultExcerpt" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiReplyTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiReplyTask_sourceKey_key" ON "AiReplyTask"("sourceKey");

CREATE UNIQUE INDEX "AiReplyTask_generatedCommentId_key" ON "AiReplyTask"("generatedCommentId");

CREATE INDEX "AiReplyTask_status_scheduledAt_createdAt_idx" ON "AiReplyTask"("status", "scheduledAt", "createdAt");

CREATE INDEX "AiReplyTask_postId_createdAt_idx" ON "AiReplyTask"("postId", "createdAt");

CREATE INDEX "AiReplyTask_sourceCommentId_idx" ON "AiReplyTask"("sourceCommentId");

CREATE INDEX "AiReplyTask_agentUserId_createdAt_idx" ON "AiReplyTask"("agentUserId", "createdAt");

CREATE INDEX "AiReplyTask_triggerUserId_createdAt_idx" ON "AiReplyTask"("triggerUserId", "createdAt");

ALTER TABLE "AiReplyTask"
ADD CONSTRAINT "AiReplyTask_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "Post"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "AiReplyTask"
ADD CONSTRAINT "AiReplyTask_sourceCommentId_fkey"
FOREIGN KEY ("sourceCommentId") REFERENCES "Comment"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "AiReplyTask"
ADD CONSTRAINT "AiReplyTask_generatedCommentId_fkey"
FOREIGN KEY ("generatedCommentId") REFERENCES "Comment"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "AiReplyTask"
ADD CONSTRAINT "AiReplyTask_triggerUserId_fkey"
FOREIGN KEY ("triggerUserId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "AiReplyTask"
ADD CONSTRAINT "AiReplyTask_agentUserId_fkey"
FOREIGN KEY ("agentUserId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
