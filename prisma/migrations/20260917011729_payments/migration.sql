-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CHECK', 'CARD', 'BANK_TRANSFER', 'ZELLE', 'VENMO', 'OTHER');

-- AlterEnum
ALTER TYPE "EstimateEventType" ADD VALUE 'PAYMENT_RECORDED';

-- AlterTable
ALTER TABLE "Estimate" ADD COLUMN     "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estimateId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "PaymentMethod",
    "note" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_estimateId_paidAt_idx" ON "Payment"("estimateId", "paidAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing invoices carried the deposit as "already received" and PAID ones as fully paid.
-- Turn those assumptions into real payment rows so balance = total − Σ payments everywhere.
INSERT INTO "Payment" ("id", "estimateId", "amount", "paidAt", "note")
SELECT 'pay_' || md5(random()::text || id), id, "depositAmount", COALESCE("acceptedAt", "createdAt"), 'Deposit'
FROM "Estimate" WHERE "kind" = 'INVOICE' AND "depositAmount" > 0;

INSERT INTO "Payment" ("id", "estimateId", "amount", "paidAt", "note")
SELECT 'pay_' || md5(random()::text || id || 'bal'), id, "total" - "depositAmount", COALESCE("paidAt", "updatedAt"), 'Balance'
FROM "Estimate" WHERE "kind" = 'INVOICE' AND "status" = 'PAID' AND "total" - "depositAmount" > 0;

UPDATE "Estimate" e SET "amountPaid" = COALESCE((SELECT SUM(p.amount) FROM "Payment" p WHERE p."estimateId" = e.id), 0)
WHERE e."kind" = 'INVOICE';
