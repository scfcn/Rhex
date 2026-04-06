-- AlterTable
ALTER TABLE "UserLevelProgress"
ADD COLUMN "currentCheckInStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxCheckInStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastCheckInDate" TEXT;
