CREATE TYPE "PostAttachmentSourceType" AS ENUM ('UPLOAD', 'EXTERNAL_LINK');

CREATE TABLE "PostAttachment" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "uploadId" TEXT,
  "sourceType" "PostAttachmentSourceType" NOT NULL,
  "name" TEXT NOT NULL,
  "fileExt" TEXT,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "externalUrl" TEXT,
  "externalCode" TEXT,
  "minDownloadLevel" INTEGER NOT NULL DEFAULT 0,
  "minDownloadVipLevel" INTEGER NOT NULL DEFAULT 0,
  "pointsCost" INTEGER NOT NULL DEFAULT 0,
  "requireReplyUnlock" BOOLEAN NOT NULL DEFAULT false,
  "downloadCount" INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "PostAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostAttachmentPurchase" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "attachmentId" TEXT NOT NULL,
  "buyerId" INTEGER NOT NULL,
  "sellerId" INTEGER NOT NULL,
  "pointsCost" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PostAttachmentPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostAttachmentPurchase_attachmentId_buyerId_key" ON "PostAttachmentPurchase"("attachmentId", "buyerId");
CREATE INDEX "PostAttachment_postId_sortOrder_idx" ON "PostAttachment"("postId", "sortOrder");
CREATE INDEX "PostAttachment_postId_downloadCount_idx" ON "PostAttachment"("postId", "downloadCount");
CREATE INDEX "PostAttachment_uploadId_idx" ON "PostAttachment"("uploadId");
CREATE INDEX "PostAttachmentPurchase_postId_buyerId_idx" ON "PostAttachmentPurchase"("postId", "buyerId");
CREATE INDEX "PostAttachmentPurchase_sellerId_createdAt_idx" ON "PostAttachmentPurchase"("sellerId", "createdAt");

ALTER TABLE "PostAttachment"
  ADD CONSTRAINT "PostAttachment_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostAttachment"
  ADD CONSTRAINT "PostAttachment_uploadId_fkey"
  FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PostAttachmentPurchase"
  ADD CONSTRAINT "PostAttachmentPurchase_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostAttachmentPurchase"
  ADD CONSTRAINT "PostAttachmentPurchase_attachmentId_fkey"
  FOREIGN KEY ("attachmentId") REFERENCES "PostAttachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostAttachmentPurchase"
  ADD CONSTRAINT "PostAttachmentPurchase_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostAttachmentPurchase"
  ADD CONSTRAINT "PostAttachmentPurchase_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
