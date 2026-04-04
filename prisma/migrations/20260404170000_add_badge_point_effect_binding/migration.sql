-- AlterTable
ALTER TABLE "PointEffectRule" ADD COLUMN "badgeId" TEXT;

-- CreateIndex
CREATE INDEX "PointEffectRule_badgeId_status_targetType_sortOrder_idx" ON "PointEffectRule"("badgeId", "status", "targetType", "sortOrder");

-- AddForeignKey
ALTER TABLE "PointEffectRule"
ADD CONSTRAINT "PointEffectRule_badgeId_fkey"
FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
