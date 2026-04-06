-- CreateEnum
CREATE TYPE "ConversationKind" AS ENUM ('DIRECT', 'GROUP');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "kind" "ConversationKind" NOT NULL DEFAULT 'DIRECT';

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN "archivedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "DirectConversation" (
    "conversationId" TEXT NOT NULL,
    "userLowId" INTEGER NOT NULL,
    "userHighId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DirectConversation_pkey" PRIMARY KEY ("conversationId"),
    CONSTRAINT "DirectConversation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Remove malformed direct conversations that cannot be recovered safely.
WITH "MalformedConversation" AS (
  SELECT c."id"
  FROM "Conversation" c
  LEFT JOIN "ConversationParticipant" cp ON cp."conversationId" = c."id"
  GROUP BY c."id"
  HAVING COUNT(cp."id") <> 2 OR COUNT(DISTINCT cp."userId") <> 2
)
DELETE FROM "Conversation"
WHERE "id" IN (SELECT "id" FROM "MalformedConversation");

CREATE TEMP TABLE "_DirectConversationRanking" AS
SELECT
  source."conversationId",
  source."userLowId",
  source."userHighId",
  FIRST_VALUE(source."conversationId") OVER (
    PARTITION BY source."userLowId", source."userHighId"
    ORDER BY source."createdAt" ASC, source."conversationId" ASC
  ) AS "canonicalConversationId",
  ROW_NUMBER() OVER (
    PARTITION BY source."userLowId", source."userHighId"
    ORDER BY source."createdAt" ASC, source."conversationId" ASC
  ) AS "conversationRank"
FROM (
  SELECT
    c."id" AS "conversationId",
    c."createdAt",
    MIN(cp."userId") AS "userLowId",
    MAX(cp."userId") AS "userHighId"
  FROM "Conversation" c
  INNER JOIN "ConversationParticipant" cp ON cp."conversationId" = c."id"
  GROUP BY c."id", c."createdAt"
) AS source;

-- Move messages from duplicate conversations onto the canonical direct conversation.
UPDATE "DirectMessage" dm
SET "conversationId" = ranking."canonicalConversationId"
FROM "_DirectConversationRanking" ranking
WHERE ranking."conversationRank" > 1
  AND dm."conversationId" = ranking."conversationId";

CREATE TEMP TABLE "_DirectConversationUnreadRollup" AS
SELECT
  ranking."canonicalConversationId" AS "conversationId",
  cp."userId",
  SUM(cp."unreadCount")::INTEGER AS "unreadCount"
FROM "_DirectConversationRanking" ranking
INNER JOIN "ConversationParticipant" cp ON cp."conversationId" = ranking."conversationId"
GROUP BY ranking."canonicalConversationId", cp."userId";

CREATE TEMP TABLE "_DirectConversationLastReadRollup" AS
SELECT DISTINCT ON (ranking."canonicalConversationId", cp."userId")
  ranking."canonicalConversationId" AS "conversationId",
  cp."userId",
  cp."lastReadMessageId"
FROM "_DirectConversationRanking" ranking
INNER JOIN "ConversationParticipant" cp ON cp."conversationId" = ranking."conversationId"
INNER JOIN "DirectMessage" dm ON dm."id" = cp."lastReadMessageId"
WHERE cp."lastReadMessageId" IS NOT NULL
ORDER BY ranking."canonicalConversationId", cp."userId", dm."createdAt" DESC, dm."id" DESC;

UPDATE "ConversationParticipant" cp
SET "unreadCount" = rollup."unreadCount"
FROM "_DirectConversationUnreadRollup" rollup
WHERE cp."conversationId" = rollup."conversationId"
  AND cp."userId" = rollup."userId";

UPDATE "ConversationParticipant" cp
SET "lastReadMessageId" = rollup."lastReadMessageId"
FROM "_DirectConversationLastReadRollup" rollup
WHERE cp."conversationId" = rollup."conversationId"
  AND cp."userId" = rollup."userId";

UPDATE "Conversation" c
SET "lastMessageAt" = rollup."lastMessageAt"
FROM (
  SELECT dm."conversationId", MAX(dm."createdAt") AS "lastMessageAt"
  FROM "DirectMessage" dm
  GROUP BY dm."conversationId"
) AS rollup
WHERE c."id" = rollup."conversationId";

-- Drop duplicate conversations after their messages and participant state are folded into the canonical conversation.
DELETE FROM "Conversation" c
USING "_DirectConversationRanking" ranking
WHERE ranking."conversationRank" > 1
  AND c."id" = ranking."conversationId";

-- Materialize the direct-conversation uniqueness key for all surviving direct threads.
INSERT INTO "DirectConversation" ("conversationId", "userLowId", "userHighId", "createdAt", "updatedAt")
SELECT
  ranking."canonicalConversationId",
  ranking."userLowId",
  ranking."userHighId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "_DirectConversationRanking" ranking
WHERE ranking."conversationRank" = 1;

DROP TABLE "_DirectConversationUnreadRollup";
DROP TABLE "_DirectConversationLastReadRollup";
DROP TABLE "_DirectConversationRanking";

-- DropIndex
DROP INDEX "ConversationParticipant_userId_updatedAt_idx";

-- CreateIndex
CREATE INDEX "Conversation_kind_lastMessageAt_idx" ON "Conversation"("kind", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_archivedAt_updatedAt_idx" ON "ConversationParticipant"("userId", "archivedAt", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectConversation_userLowId_userHighId_key" ON "DirectConversation"("userLowId", "userHighId");

-- CreateIndex
CREATE INDEX "DirectConversation_userLowId_idx" ON "DirectConversation"("userLowId");

-- CreateIndex
CREATE INDEX "DirectConversation_userHighId_idx" ON "DirectConversation"("userHighId");
