-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'CHANGE_ORDER';

-- AlterEnum
ALTER TYPE "EstimateEventType" ADD VALUE 'CHANGE_ORDER_CREATED';

-- AlterTable
ALTER TABLE "Estimate" ADD COLUMN     "parentEstimateId" TEXT;

-- CreateIndex
CREATE INDEX "Estimate_parentEstimateId_idx" ON "Estimate"("parentEstimateId");

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_parentEstimateId_fkey" FOREIGN KEY ("parentEstimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
