DROP INDEX IF EXISTS "PostRedPacketClaim_redPacketId_userId_key";

CREATE UNIQUE INDEX "PostRedPacketClaim_redPacketId_userId_triggerCommentId_key"
  ON "PostRedPacketClaim"("redPacketId", "userId", "triggerCommentId");
