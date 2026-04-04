-- Make the existing announcement table serve as a reusable site document store.
ALTER TABLE "Announcement"
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'ANNOUNCEMENT',
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT NOT NULL DEFAULT 'DOCUMENT',
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "linkUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "titleColor" TEXT,
  ADD COLUMN IF NOT EXISTS "titleBold" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Announcement_type_status_idx"
  ON "Announcement" ("type", "status");

CREATE INDEX IF NOT EXISTS "Announcement_type_publishedAt_idx"
  ON "Announcement" ("type", "publishedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Announcement_type_slug_key"
  ON "Announcement" ("type", "slug")
  WHERE "slug" IS NOT NULL;
