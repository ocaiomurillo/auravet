-- CreateTable
CREATE TABLE "ServiceNote" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceNote_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ServiceNote"
ADD CONSTRAINT "ServiceNote_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceNote"
ADD CONSTRAINT "ServiceNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
