CREATE TABLE "CommentEffectFeedback" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "scene" TEXT NOT NULL,
  "rewardClaimId" TEXT,
  "feedbackJson" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommentEffectFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommentEffectFeedback_commentId_key" ON "CommentEffectFeedback"("commentId");
CREATE INDEX "CommentEffectFeedback_postId_commentId_idx" ON "CommentEffectFeedback"("postId", "commentId");
CREATE INDEX "CommentEffectFeedback_postId_createdAt_idx" ON "CommentEffectFeedback"("postId", "createdAt");
CREATE INDEX "CommentEffectFeedback_userId_createdAt_idx" ON "CommentEffectFeedback"("userId", "createdAt");
CREATE INDEX "CommentEffectFeedback_rewardClaimId_idx" ON "CommentEffectFeedback"("rewardClaimId");

ALTER TABLE "CommentEffectFeedback"
ADD CONSTRAINT "CommentEffectFeedback_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommentEffectFeedback"
ADD CONSTRAINT "CommentEffectFeedback_commentId_fkey"
FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommentEffectFeedback"
ADD CONSTRAINT "CommentEffectFeedback_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommentEffectFeedback"
ADD CONSTRAINT "CommentEffectFeedback_rewardClaimId_fkey"
FOREIGN KEY ("rewardClaimId") REFERENCES "PostRedPacketClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
