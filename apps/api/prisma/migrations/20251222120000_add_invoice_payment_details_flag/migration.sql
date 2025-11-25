-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "paymentDetailsDefined" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing invoices that already have payment information
UPDATE "Invoice"
SET "paymentDetailsDefined" = true
WHERE "paymentConditionId" IS NOT NULL
  OR "paymentMethod" IS NOT NULL
  OR "paymentConditionType" IS NOT NULL;
