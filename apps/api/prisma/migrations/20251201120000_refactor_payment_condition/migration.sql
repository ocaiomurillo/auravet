-- CreateEnum
CREATE TYPE "PaymentConditionType" AS ENUM ('A_VISTA', 'DIAS_30', 'DIAS_60', 'CARTAO_2X', 'CARTAO_3X');

-- AddColumns
ALTER TABLE "Invoice" ADD COLUMN     "paymentConditionId" TEXT,
ADD COLUMN     "paymentConditionType" "PaymentConditionType";

-- Migrate existing enum column values to the new structure
UPDATE "Invoice"
SET "paymentConditionType" = "paymentCondition"::text::"PaymentConditionType",
    "paymentConditionId" = "paymentCondition"::text
WHERE "paymentCondition" IS NOT NULL;

-- Drop old column and enum
ALTER TABLE "Invoice" DROP COLUMN "paymentCondition";

DROP TYPE "PaymentCondition";

-- CreateTable
CREATE TABLE "PaymentCondition" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "prazoDias" INTEGER NOT NULL,
    "parcelas" INTEGER NOT NULL DEFAULT 1,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentCondition_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentCondition_nome_key" UNIQUE ("nome")
);

-- Seed default payment conditions to keep existing invoices consistent
INSERT INTO "PaymentCondition" ("id", "nome", "prazoDias", "parcelas", "observacoes")
VALUES
    ('A_VISTA', 'À vista', 0, 1, 'Pagamento imediato'),
    ('DIAS_30', '30 dias', 30, 1, 'Vencimento em 30 dias'),
    ('DIAS_60', '60 dias', 60, 1, 'Vencimento em 60 dias'),
    ('CARTAO_2X', 'Cartão 2x', 30, 2, 'Parcelado em 2x com intervalos de 30 dias'),
    ('CARTAO_3X', 'Cartão 3x', 30, 3, 'Parcelado em 3x com intervalos de 30 dias')
ON CONFLICT ("id") DO NOTHING;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentConditionId_fkey" FOREIGN KEY ("paymentConditionId") REFERENCES "PaymentCondition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
