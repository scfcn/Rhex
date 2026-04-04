CREATE TABLE "GiftDefinition" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostGiftEvent" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "senderId" INTEGER NOT NULL,
  "receiverId" INTEGER NOT NULL,
  "giftId" TEXT NOT NULL,
  "giftNameSnapshot" TEXT NOT NULL,
  "giftIconSnapshot" TEXT NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "totalPoints" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostGiftEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostGiftStats" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "receiverId" INTEGER NOT NULL,
  "giftId" TEXT NOT NULL,
  "giftNameSnapshot" TEXT NOT NULL,
  "giftIconSnapshot" TEXT NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "totalCount" INTEGER NOT NULL DEFAULT 0,
  "totalPoints" INTEGER NOT NULL DEFAULT 0,
  "lastSentAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostGiftStats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostGiftStats_postId_giftId_key" ON "PostGiftStats"("postId", "giftId");
CREATE INDEX "GiftDefinition_isEnabled_sortOrder_createdAt_idx" ON "GiftDefinition"("isEnabled", "sortOrder", "createdAt");
CREATE INDEX "PostGiftEvent_postId_createdAt_idx" ON "PostGiftEvent"("postId", "createdAt");
CREATE INDEX "PostGiftEvent_senderId_createdAt_idx" ON "PostGiftEvent"("senderId", "createdAt");
CREATE INDEX "PostGiftEvent_receiverId_createdAt_idx" ON "PostGiftEvent"("receiverId", "createdAt");
CREATE INDEX "PostGiftEvent_giftId_createdAt_idx" ON "PostGiftEvent"("giftId", "createdAt");
CREATE INDEX "PostGiftEvent_postId_senderId_createdAt_idx" ON "PostGiftEvent"("postId", "senderId", "createdAt");
CREATE INDEX "PostGiftStats_postId_totalCount_idx" ON "PostGiftStats"("postId", "totalCount");
CREATE INDEX "PostGiftStats_postId_totalPoints_idx" ON "PostGiftStats"("postId", "totalPoints");
CREATE INDEX "PostGiftStats_receiverId_lastSentAt_idx" ON "PostGiftStats"("receiverId", "lastSentAt");

ALTER TABLE "PostGiftEvent"
  ADD CONSTRAINT "PostGiftEvent_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostGiftEvent"
  ADD CONSTRAINT "PostGiftEvent_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostGiftEvent"
  ADD CONSTRAINT "PostGiftEvent_receiverId_fkey"
  FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostGiftStats"
  ADD CONSTRAINT "PostGiftStats_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostGiftStats"
  ADD CONSTRAINT "PostGiftStats_receiverId_fkey"
  FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
