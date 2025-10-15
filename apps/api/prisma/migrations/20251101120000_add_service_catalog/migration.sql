CREATE TABLE "ServiceDefinition" (
    "id" TEXT PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoServico" NOT NULL,
    "precoSugerido" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ServiceDefinition_nome_key" ON "ServiceDefinition"("nome");

CREATE TABLE "ServiceCatalogUsage" (
    "id" TEXT PRIMARY KEY,
    "servicoId" TEXT NOT NULL,
    "serviceDefinitionId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "valorUnitario" DECIMAL(10,2) NOT NULL,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "ServiceCatalogUsage"
  ADD CONSTRAINT "ServiceCatalogUsage_servicoId_fkey"
  FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceCatalogUsage"
  ADD CONSTRAINT "ServiceCatalogUsage_serviceDefinitionId_fkey"
  FOREIGN KEY ("serviceDefinitionId") REFERENCES "ServiceDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ServiceCatalogUsage_servicoId_idx" ON "ServiceCatalogUsage"("servicoId");
CREATE INDEX "ServiceCatalogUsage_serviceDefinitionId_idx" ON "ServiceCatalogUsage"("serviceDefinitionId");

ALTER TABLE "Servico" ADD COLUMN "responsavelId" TEXT;

ALTER TABLE "Servico"
  ADD CONSTRAINT "Servico_responsavelId_fkey"
  FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "InvoiceItem_servicoId_key";
