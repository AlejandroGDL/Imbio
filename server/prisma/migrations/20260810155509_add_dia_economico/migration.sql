-- CreateTable
CREATE TABLE "DiaEconomico" (
    "id" SERIAL NOT NULL,
    "personalId" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "diasSolicitados" INTEGER NOT NULL,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaEconomico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiaEconomico_personalId_idx" ON "DiaEconomico"("personalId");

-- CreateIndex
CREATE INDEX "DiaEconomico_anio_idx" ON "DiaEconomico"("anio");

-- CreateIndex
CREATE INDEX "DiaEconomico_activo_idx" ON "DiaEconomico"("activo");

-- AddForeignKey
ALTER TABLE "DiaEconomico" ADD CONSTRAINT "DiaEconomico_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "Personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
