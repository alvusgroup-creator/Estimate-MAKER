-- AlterEnum
ALTER TYPE "EstimateEventType" ADD VALUE 'EMAILED';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "notifyEmail" TEXT,
ADD COLUMN     "notifyOnAccepted" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnDeclined" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOnViewed" BOOLEAN NOT NULL DEFAULT true;
