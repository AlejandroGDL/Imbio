-- Enum
CREATE TYPE "EstadoResguardo" AS ENUM ('EN_BODEGA', 'ASIGNADO', 'REPARACION', 'BAJA');

-- Tabla Resguardo
CREATE TABLE "Resguardo" (
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(80) NOT NULL,
    "marca" VARCHAR(80) NOT NULL,
    "modelo" VARCHAR(120),
    "numeroSerie" VARCHAR(120) NOT NULL,
    "imagen" TEXT,
    "descripcion" TEXT,
    "estado" "EstadoResguardo" NOT NULL DEFAULT 'EN_BODEGA',
    "personalActualId" INTEGER,
    "fechaAsignacionActual" DATE,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Resguardo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Resguardo_numeroSerie_key" ON "Resguardo"("numeroSerie");
CREATE INDEX "Resguardo_estado_idx" ON "Resguardo"("estado");
CREATE INDEX "Resguardo_tipo_idx" ON "Resguardo"("tipo");
CREATE INDEX "Resguardo_personalActualId_idx" ON "Resguardo"("personalActualId");
CREATE INDEX "Resguardo_activo_idx" ON "Resguardo"("activo");

-- Tabla ResguardoHistorial
CREATE TABLE "ResguardoHistorial" (
    "id" SERIAL NOT NULL,
    "resguardoId" INTEGER NOT NULL,
    "personalId" INTEGER NOT NULL,
    "fechaAsignacion" DATE NOT NULL,
    "fechaDevolucion" DATE,
    "motivo" VARCHAR(200),
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResguardoHistorial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ResguardoHistorial_resguardoId_idx" ON "ResguardoHistorial"("resguardoId");
CREATE INDEX "ResguardoHistorial_personalId_idx" ON "ResguardoHistorial"("personalId");
CREATE INDEX "ResguardoHistorial_fechaAsignacion_idx" ON "ResguardoHistorial"("fechaAsignacion");
CREATE INDEX "ResguardoHistorial_activo_idx" ON "ResguardoHistorial"("activo");

-- Foreign keys
ALTER TABLE "Resguardo" ADD CONSTRAINT "Resguardo_personalActualId_fkey" FOREIGN KEY ("personalActualId") REFERENCES "Personal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResguardoHistorial" ADD CONSTRAINT "ResguardoHistorial_resguardoId_fkey" FOREIGN KEY ("resguardoId") REFERENCES "Resguardo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResguardoHistorial" ADD CONSTRAINT "ResguardoHistorial_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "Personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
