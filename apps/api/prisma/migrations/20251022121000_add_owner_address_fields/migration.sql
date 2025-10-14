ALTER TABLE "Owner" ADD COLUMN     "cpf"         TEXT;
ALTER TABLE "Owner" ADD COLUMN     "logradouro"  TEXT;
ALTER TABLE "Owner" ADD COLUMN     "numero"      TEXT;
ALTER TABLE "Owner" ADD COLUMN     "complemento" TEXT;
ALTER TABLE "Owner" ADD COLUMN     "bairro"      TEXT;
ALTER TABLE "Owner" ADD COLUMN     "cidade"      TEXT;
ALTER TABLE "Owner" ADD COLUMN     "estado"      TEXT;
ALTER TABLE "Owner" ADD COLUMN     "cep"         TEXT;

CREATE UNIQUE INDEX "Owner_cpf_key" ON "Owner"("cpf");
