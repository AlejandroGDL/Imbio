-- CreateEnum
CREATE TYPE "TipoIncidencia" AS ENUM ('FALTA', 'JUSTIFICANTE', 'RETARDO', 'PERMISO_SIN_GOCE_SUELDO', 'PERMISO_CON_GOCE_SUELDO');

-- CreateTable
CREATE TABLE "Incidencia" (
    "id" SERIAL NOT NULL,
    "personalId" INTEGER NOT NULL,
    "tipo" "TipoIncidencia" NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incidencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Incidencia_personalId_idx" ON "Incidencia"("personalId");

-- CreateIndex
CREATE INDEX "Incidencia_fecha_idx" ON "Incidencia"("fecha");

-- CreateIndex
CREATE INDEX "Incidencia_tipo_idx" ON "Incidencia"("tipo");

-- CreateIndex
CREATE INDEX "Incidencia_activo_idx" ON "Incidencia"("activo");

-- AddForeignKey
ALTER TABLE "Incidencia" ADD CONSTRAINT "Incidencia_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "Personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
