-- CreateTable
CREATE TABLE "Injustificante" (
    "id" SERIAL NOT NULL,
    "personalId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "razon" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Injustificante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Injustificante_personalId_idx" ON "Injustificante"("personalId");

-- CreateIndex
CREATE INDEX "Injustificante_fecha_idx" ON "Injustificante"("fecha");

-- CreateIndex
CREATE INDEX "Injustificante_activo_idx" ON "Injustificante"("activo");

-- AddForeignKey
ALTER TABLE "Injustificante" ADD CONSTRAINT "Injustificante_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "Personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
