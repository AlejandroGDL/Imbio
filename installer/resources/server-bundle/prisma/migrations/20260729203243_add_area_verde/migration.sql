-- CreateTable
CREATE TABLE "AreaVerde" (
    "id" SERIAL NOT NULL,
    "areaVerde" VARCHAR(80) NOT NULL,
    "usuario" VARCHAR(160) NOT NULL,
    "tipoEvento" VARCHAR(120) NOT NULL,
    "fecha" DATE NOT NULL,
    "horaInicio" VARCHAR(5) NOT NULL,
    "horaFin" VARCHAR(5) NOT NULL,
    "responsable" VARCHAR(160) NOT NULL,
    "telefono" VARCHAR(20),
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaVerde_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AreaVerde_fecha_idx" ON "AreaVerde"("fecha");

-- CreateIndex
CREATE INDEX "AreaVerde_areaVerde_idx" ON "AreaVerde"("areaVerde");

-- CreateIndex
CREATE INDEX "AreaVerde_activo_idx" ON "AreaVerde"("activo");
