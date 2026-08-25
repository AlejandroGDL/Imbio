-- CreateEnum
CREATE TYPE "TipoCorrespondencia" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "TipoDocumentoCorrespondencia" AS ENUM ('MEMORANDUM', 'OFICIO');

-- CreateEnum
CREATE TYPE "StatusCorrespondencia" AS ENUM ('PENDIENTE', 'ATENDIDO', 'ARCHIVADO');

-- CreateTable
CREATE TABLE "Correspondencia" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoCorrespondencia" NOT NULL,
    "tipoDocumento" "TipoDocumentoCorrespondencia" NOT NULL,
    "numero" VARCHAR(80) NOT NULL,
    "fecha" DATE NOT NULL,
    "remitente" VARCHAR(200) NOT NULL,
    "destinatario" VARCHAR(200) NOT NULL,
    "asunto" VARCHAR(300) NOT NULL,
    "observaciones" TEXT,
    "status" "StatusCorrespondencia" NOT NULL DEFAULT 'PENDIENTE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Correspondencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Correspondencia_fecha_idx" ON "Correspondencia"("fecha");

-- CreateIndex
CREATE INDEX "Correspondencia_tipo_idx" ON "Correspondencia"("tipo");

-- CreateIndex
CREATE INDEX "Correspondencia_status_idx" ON "Correspondencia"("status");

-- CreateIndex
CREATE INDEX "Correspondencia_activo_idx" ON "Correspondencia"("activo");
