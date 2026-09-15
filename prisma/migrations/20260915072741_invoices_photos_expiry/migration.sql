-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('ESTIMATE', 'INVOICE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstimateEventType" ADD VALUE 'EXPIRED';
ALTER TYPE "EstimateEventType" ADD VALUE 'CONVERTED_TO_INVOICE';
ALTER TYPE "EstimateEventType" ADD VALUE 'PAID';

-- AlterEnum
ALTER TYPE "EstimateStatus" ADD VALUE 'PAID';

-- AlterTable
ALTER TABLE "Estimate" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "kind" "DocumentKind" NOT NULL DEFAULT 'ESTIMATE',
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "sourceEstimateId" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "defaultDueDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "invoicePrefix" TEXT NOT NULL DEFAULT 'INV-',
ADD COLUMN     "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 1001;

-- CreateTable
CREATE TABLE "EstimatePhoto" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estimateId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "showOnDocument" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EstimatePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EstimatePhoto_estimateId_position_idx" ON "EstimatePhoto"("estimateId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_sourceEstimateId_key" ON "Estimate"("sourceEstimateId");

-- CreateIndex
CREATE INDEX "Estimate_organizationId_kind_status_idx" ON "Estimate"("organizationId", "kind", "status");

-- CreateIndex
CREATE INDEX "Estimate_status_expiresAt_idx" ON "Estimate"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_sourceEstimateId_fkey" FOREIGN KEY ("sourceEstimateId") REFERENCES "Estimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimatePhoto" ADD CONSTRAINT "EstimatePhoto_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

