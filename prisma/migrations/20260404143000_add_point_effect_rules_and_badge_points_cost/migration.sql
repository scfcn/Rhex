-- CreateEnum
CREATE TYPE "PointEffectTargetType" AS ENUM ('POINTS', 'PROBABILITY');

-- CreateEnum
CREATE TYPE "PointEffectRuleKind" AS ENUM ('FIXED', 'PERCENTAGE', 'RANDOM_FIXED', 'RANDOM_PERCENTAGE', 'RANDOM_SIGNED_MULTIPLIER');

-- CreateEnum
CREATE TYPE "PointEffectDirection" AS ENUM ('BUFF', 'NERF', 'RANDOM_SIGNED');

-- AlterTable
ALTER TABLE "Badge" ADD COLUMN "pointsCost" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PointEffectRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetType" "PointEffectTargetType" NOT NULL,
    "scopeKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ruleKind" "PointEffectRuleKind" NOT NULL,
    "direction" "PointEffectDirection" NOT NULL DEFAULT 'BUFF',
    "value" DOUBLE PRECISION NOT NULL,
    "extraValue" DOUBLE PRECISION,
    "startMinuteOfDay" INTEGER,
    "endMinuteOfDay" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointEffectRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointEffectRule_status_targetType_sortOrder_idx" ON "PointEffectRule"("status", "targetType", "sortOrder");
