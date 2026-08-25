-- Enums
CREATE TYPE "Unidad" AS ENUM ('PIEZA', 'LITRO', 'GALON', 'KILO', 'CAJA', 'ROLLO', 'PAQUETE');
CREATE TYPE "TipoMovimientoConsumible" AS ENUM ('ENTRADA', 'SALIDA');

-- Requisiciones
CREATE TABLE "Requisicion" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(40) NOT NULL,
    "concepto" VARCHAR(200) NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "unidad" "Unidad" NOT NULL,
    "partida" VARCHAR(100) NOT NULL,
    "fechaSolicitud" DATE NOT NULL,
    "observaciones" TEXT,
    "surtido" BOOLEAN NOT NULL DEFAULT false,
    "fechaEntrega" DATE,
    "esConsumible" BOOLEAN NOT NULL DEFAULT false,
    "consumibleMovimientoId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requisicion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Requisicion_numero_key" ON "Requisicion"("numero");
CREATE UNIQUE INDEX "Requisicion_consumibleMovimientoId_key" ON "Requisicion"("consumibleMovimientoId");
CREATE INDEX "Requisicion_fechaSolicitud_idx" ON "Requisicion"("fechaSolicitud");
CREATE INDEX "Requisicion_surtido_idx" ON "Requisicion"("surtido");
CREATE INDEX "Requisicion_esConsumible_idx" ON "Requisicion"("esConsumible");
CREATE INDEX "Requisicion_activo_idx" ON "Requisicion"("activo");

-- Consumibles
CREATE TABLE "Consumible" (
    "id" SERIAL NOT NULL,
    "concepto" VARCHAR(200) NOT NULL,
    "unidad" "Unidad" NOT NULL,
    "cantidadActual" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "imagen" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consumible_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Consumible_concepto_idx" ON "Consumible"("concepto");
CREATE INDEX "Consumible_activo_idx" ON "Consumible"("activo");
CREATE UNIQUE INDEX "Consumible_concepto_unidad_key" ON "Consumible"("concepto", "unidad");

-- ConsumibleMovimiento
CREATE TABLE "ConsumibleMovimiento" (
    "id" SERIAL NOT NULL,
    "consumibleId" INTEGER NOT NULL,
    "tipo" "TipoMovimientoConsumible" NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requisicionId" INTEGER,
    "personalId" INTEGER,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumibleMovimiento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConsumibleMovimiento_consumibleId_idx" ON "ConsumibleMovimiento"("consumibleId");
CREATE INDEX "ConsumibleMovimiento_fecha_idx" ON "ConsumibleMovimiento"("fecha");
CREATE INDEX "ConsumibleMovimiento_tipo_idx" ON "ConsumibleMovimiento"("tipo");
CREATE INDEX "ConsumibleMovimiento_personalId_idx" ON "ConsumibleMovimiento"("personalId");
CREATE INDEX "ConsumibleMovimiento_activo_idx" ON "ConsumibleMovimiento"("activo");

-- Foreign keys
ALTER TABLE "ConsumibleMovimiento" ADD CONSTRAINT "ConsumibleMovimiento_consumibleId_fkey" FOREIGN KEY ("consumibleId") REFERENCES "Consumible"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConsumibleMovimiento" ADD CONSTRAINT "ConsumibleMovimiento_requisicionId_fkey" FOREIGN KEY ("requisicionId") REFERENCES "Requisicion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsumibleMovimiento" ADD CONSTRAINT "ConsumibleMovimiento_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "Personal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Vincular Requisicion con su movimiento
ALTER TABLE "Requisicion" ADD CONSTRAINT "Requisicion_consumibleMovimientoId_fkey" FOREIGN KEY ("consumibleMovimientoId") REFERENCES "ConsumibleMovimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
