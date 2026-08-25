-- AlterTable
ALTER TABLE "Correspondencia" ADD COLUMN     "asisteAEvento" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fechaFinEvento" DATE,
ADD COLUMN     "fechaInicioEvento" DATE,
ADD COLUMN     "fechaMaximaRespuesta" DATE,
ADD COLUMN     "ocupaRespuesta" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Correspondencia_ocupaRespuesta_fechaMaximaRespuesta_idx" ON "Correspondencia"("ocupaRespuesta", "fechaMaximaRespuesta");

-- CreateIndex
CREATE INDEX "Correspondencia_asisteAEvento_fechaInicioEvento_idx" ON "Correspondencia"("asisteAEvento", "fechaInicioEvento");
