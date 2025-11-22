-- Add appointment link to services
ALTER TABLE "Servico" ADD COLUMN "appointmentId" TEXT;

-- Backfill appointment links based on existing relationships
UPDATE "Servico" s
SET "appointmentId" = a."id"
FROM "Appointment" a
WHERE a."serviceId" = s."id" AND s."appointmentId" IS NULL;

-- Enforce uniqueness and referential integrity
CREATE UNIQUE INDEX "Servico_appointmentId_key" ON "Servico"("appointmentId");

ALTER TABLE "Servico"
ADD CONSTRAINT "Servico_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
