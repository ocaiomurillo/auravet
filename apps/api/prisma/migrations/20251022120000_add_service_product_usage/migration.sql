CREATE TABLE "ServiceProductUsage" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valorUnitario" DECIMAL(10,2) NOT NULL,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProductUsage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ServiceProductUsage" ADD CONSTRAINT "ServiceProductUsage_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceProductUsage" ADD CONSTRAINT "ServiceProductUsage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ServiceProductUsage_servicoId_productId_key" ON "ServiceProductUsage"("servicoId", "productId");
