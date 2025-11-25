-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('EM_ANDAMENTO', 'CANCELADO', 'CONCLUIDO');

-- AlterTable
ALTER TABLE "Servico" ADD COLUMN     "status" "ServiceStatus" NOT NULL DEFAULT 'EM_ANDAMENTO';

UPDATE "Servico" AS s
SET "status" = 'CONCLUIDO'
WHERE EXISTS (
  SELECT 1 FROM "Appointment" a WHERE a."id" = s."appointmentId" AND a."status" = 'CONCLUIDO'
) OR EXISTS (
  SELECT 1 FROM "InvoiceItem" ii WHERE ii."servicoId" = s."id"
);

-- Ensure blocked invoice status
INSERT INTO "InvoiceStatus" ("id", "slug", "name", "createdAt", "updatedAt")
VALUES ('status-bloqueada', 'BLOQUEADA', 'Bloqueada', NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;
