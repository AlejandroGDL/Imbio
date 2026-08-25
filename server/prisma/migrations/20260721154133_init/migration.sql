-- CreateEnum
CREATE TYPE "CategoriaTramite" AS ENUM ('PERMISO', 'SERVICIO', 'SANCION');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('REGISTRADA', 'PENDIENTE_PAGO', 'PAGADA', 'EN_REVISION', 'AUTORIZADA', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoPago" AS ENUM ('MEMORANDUM', 'EFECTIVO', 'TRANSFERENCIA', 'OTRO');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'OPERADOR', 'TECNICO');

-- CreateTable
CREATE TABLE "Ciudadano" (
    "id" SERIAL NOT NULL,
    "curp" VARCHAR(18),
    "nombre" TEXT NOT NULL,
    "apellidoPaterno" TEXT NOT NULL,
    "apellidoMaterno" TEXT,
    "telefono" VARCHAR(20),
    "email" VARCHAR(120),
    "direccion" TEXT,
    "fechaNacimiento" DATE,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ciudadano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tramite" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" "CategoriaTramite" NOT NULL,
    "campos" JSONB NOT NULL,
    "precioBase" DECIMAL(10,2),
    "reglaPrecio" JSONB,
    "requierePago" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tramite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Solicitud" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "ciudadanoId" INTEGER NOT NULL,
    "tramiteId" INTEGER NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'REGISTRADA',
    "datos" JSONB NOT NULL,
    "precioFinal" DECIMAL(10,2),
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaAtencion" TIMESTAMP(3),
    "observaciones" TEXT,
    "registradoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "folioPago" VARCHAR(80) NOT NULL,
    "tipo" "TipoPago" NOT NULL DEFAULT 'MEMORANDUM',
    "monto" DECIMAL(10,2) NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL,
    "lugarPago" TEXT,
    "observaciones" TEXT,
    "registradoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Autorizacion" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "numeroAutorizacion" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "emitidoPorId" INTEGER,
    "considerandos" TEXT,
    "observaciones" TEXT,
    "documentoPdf" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Autorizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tecnico" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "departamento" TEXT,
    "cedula" VARCHAR(30),
    "email" VARCHAR(120),
    "telefono" VARCHAR(20),
    "firma" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tecnico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" VARCHAR(120),
    "rol" "RolUsuario" NOT NULL DEFAULT 'OPERADOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcceso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nombreInstitucion" TEXT NOT NULL DEFAULT 'IMBIO',
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "sitioWeb" TEXT,
    "piePaginaAutorizacion" TEXT,
    "serieFolioSolicitud" TEXT NOT NULL DEFAULT 'SOL',
    "serieFolioAutorizacion" TEXT NOT NULL DEFAULT 'AUT',
    "siguienteFolioSolicitud" INTEGER NOT NULL DEFAULT 1,
    "siguienteFolioAutorizacion" INTEGER NOT NULL DEFAULT 1,
    "esServidor" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ciudadano_curp_key" ON "Ciudadano"("curp");

-- CreateIndex
CREATE INDEX "Ciudadano_curp_idx" ON "Ciudadano"("curp");

-- CreateIndex
CREATE INDEX "Ciudadano_apellidoPaterno_apellidoMaterno_nombre_idx" ON "Ciudadano"("apellidoPaterno", "apellidoMaterno", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Tramite_codigo_key" ON "Tramite"("codigo");

-- CreateIndex
CREATE INDEX "Tramite_categoria_activo_idx" ON "Tramite"("categoria", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Solicitud_folio_key" ON "Solicitud"("folio");

-- CreateIndex
CREATE INDEX "Solicitud_ciudadanoId_idx" ON "Solicitud"("ciudadanoId");

-- CreateIndex
CREATE INDEX "Solicitud_tramiteId_idx" ON "Solicitud"("tramiteId");

-- CreateIndex
CREATE INDEX "Solicitud_estado_idx" ON "Solicitud"("estado");

-- CreateIndex
CREATE INDEX "Solicitud_fechaSolicitud_idx" ON "Solicitud"("fechaSolicitud");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_solicitudId_key" ON "Pago"("solicitudId");

-- CreateIndex
CREATE INDEX "Pago_folioPago_idx" ON "Pago"("folioPago");

-- CreateIndex
CREATE INDEX "Pago_fechaPago_idx" ON "Pago"("fechaPago");

-- CreateIndex
CREATE UNIQUE INDEX "Autorizacion_solicitudId_key" ON "Autorizacion"("solicitudId");

-- CreateIndex
CREATE UNIQUE INDEX "Autorizacion_numeroAutorizacion_key" ON "Autorizacion"("numeroAutorizacion");

-- CreateIndex
CREATE INDEX "Autorizacion_numeroAutorizacion_idx" ON "Autorizacion"("numeroAutorizacion");

-- CreateIndex
CREATE INDEX "Autorizacion_fechaEmision_idx" ON "Autorizacion"("fechaEmision");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_ciudadanoId_fkey" FOREIGN KEY ("ciudadanoId") REFERENCES "Ciudadano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_tramiteId_fkey" FOREIGN KEY ("tramiteId") REFERENCES "Tramite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Autorizacion" ADD CONSTRAINT "Autorizacion_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Autorizacion" ADD CONSTRAINT "Autorizacion_emitidoPorId_fkey" FOREIGN KEY ("emitidoPorId") REFERENCES "Tecnico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
