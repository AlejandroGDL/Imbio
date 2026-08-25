-- CreateTable
CREATE TABLE "Vacacion" (
    "id" SERIAL NOT NULL,
    "personalId" INTEGER NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "diasSolicitados" INTEGER NOT NULL,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vacacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vacacion_personalId_idx" ON "Vacacion"("personalId");

-- CreateIndex
CREATE INDEX "Vacacion_fechaInicio_idx" ON "Vacacion"("fechaInicio");

-- CreateIndex
CREATE INDEX "Vacacion_fechaFin_idx" ON "Vacacion"("fechaFin");

-- CreateIndex
CREATE INDEX "Vacacion_activo_idx" ON "Vacacion"("activo");

-- AddForeignKey
ALTER TABLE "Vacacion" ADD CONSTRAINT "Vacacion_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "Personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
