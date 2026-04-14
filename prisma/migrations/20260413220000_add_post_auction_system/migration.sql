ALTER TYPE "PostType" ADD VALUE 'AUCTION';

CREATE TYPE "PostAuctionMode" AS ENUM ('SEALED_BID', 'OPEN_ASCENDING');

CREATE TYPE "PostAuctionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SETTLING', 'SETTLED', 'CANCELLED', 'FAILED');

CREATE TYPE "PostAuctionPricingRule" AS ENUM ('FIRST_PRICE', 'SECOND_PRICE');

CREATE TYPE "PostAuctionEntryStatus" AS ENUM ('ACTIVE', 'OUTBID', 'LOST', 'WON', 'CANCELLED', 'REFUNDED');

ALTER TABLE "Board" ALTER COLUMN "allowedPostTypes" SET DEFAULT 'NORMAL,BOUNTY,POLL,LOTTERY,AUCTION';

CREATE TABLE "PostAuction" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "sellerId" INTEGER NOT NULL,
  "mode" "PostAuctionMode" NOT NULL,
  "status" "PostAuctionStatus" NOT NULL DEFAULT 'DRAFT',
  "pricingRule" "PostAuctionPricingRule" NOT NULL DEFAULT 'FIRST_PRICE',
  "startPrice" INTEGER NOT NULL,
  "incrementStep" INTEGER NOT NULL DEFAULT 1,
  "startsAt" TIMESTAMPTZ(3),
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "activatedAt" TIMESTAMPTZ(3),
  "participantCount" INTEGER NOT NULL DEFAULT 0,
  "bidCount" INTEGER NOT NULL DEFAULT 0,
  "leaderUserId" INTEGER,
  "leaderBidAmount" INTEGER,
  "winningBidAmount" INTEGER,
  "finalPrice" INTEGER,
  "winnerUserId" INTEGER,
  "winnerOnlyContent" TEXT,
  "winnerOnlyContentPreview" TEXT,
  "settledAt" TIMESTAMPTZ(3),
  "cancelledAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PostAuction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostAuctionEntry" (
  "id" TEXT NOT NULL,
  "auctionId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "currentBidAmount" INTEGER NOT NULL,
  "frozenAmount" INTEGER NOT NULL,
  "status" "PostAuctionEntryStatus" NOT NULL DEFAULT 'ACTIVE',
  "firstBidAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastBidAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "refundedAt" TIMESTAMPTZ(3),

  CONSTRAINT "PostAuctionEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostAuctionBidRecord" (
  "id" TEXT NOT NULL,
  "auctionId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PostAuctionBidRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostAuction_postId_key" ON "PostAuction"("postId");
CREATE UNIQUE INDEX "PostAuctionEntry_auctionId_userId_key" ON "PostAuctionEntry"("auctionId", "userId");
CREATE INDEX "PostAuction_sellerId_createdAt_idx" ON "PostAuction"("sellerId", "createdAt");
CREATE INDEX "PostAuction_status_endsAt_idx" ON "PostAuction"("status", "endsAt");
CREATE INDEX "PostAuction_winnerUserId_settledAt_idx" ON "PostAuction"("winnerUserId", "settledAt");
CREATE INDEX "PostAuctionEntry_auctionId_currentBidAmount_idx" ON "PostAuctionEntry"("auctionId", "currentBidAmount");
CREATE INDEX "PostAuctionEntry_userId_lastBidAt_idx" ON "PostAuctionEntry"("userId", "lastBidAt");
CREATE INDEX "PostAuctionBidRecord_auctionId_createdAt_idx" ON "PostAuctionBidRecord"("auctionId", "createdAt");
CREATE INDEX "PostAuctionBidRecord_auctionId_amount_createdAt_idx" ON "PostAuctionBidRecord"("auctionId", "amount", "createdAt");
CREATE INDEX "PostAuctionBidRecord_userId_createdAt_idx" ON "PostAuctionBidRecord"("userId", "createdAt");

ALTER TABLE "PostAuction"
  ADD CONSTRAINT "PostAuction_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostAuction"
  ADD CONSTRAINT "PostAuction_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostAuction"
  ADD CONSTRAINT "PostAuction_winnerUserId_fkey"
  FOREIGN KEY ("winnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PostAuctionEntry"
  ADD CONSTRAINT "PostAuctionEntry_auctionId_fkey"
  FOREIGN KEY ("auctionId") REFERENCES "PostAuction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostAuctionEntry"
  ADD CONSTRAINT "PostAuctionEntry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostAuctionBidRecord"
  ADD CONSTRAINT "PostAuctionBidRecord_auctionId_fkey"
  FOREIGN KEY ("auctionId") REFERENCES "PostAuction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostAuctionBidRecord"
  ADD CONSTRAINT "PostAuctionBidRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
