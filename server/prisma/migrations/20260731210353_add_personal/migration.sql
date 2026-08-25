-- CreateEnum
CREATE TYPE "TipoPersonal" AS ENUM ('CONFIANZA', 'SINDICALIZADO');

-- CreateTable
CREATE TABLE "Personal" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "apellidos" VARCHAR(160) NOT NULL,
    "curp" VARCHAR(18),
    "fechaNacimiento" DATE,
    "telefono" VARCHAR(20),
    "domicilio" TEXT,
    "sabeManejar" BOOLEAN NOT NULL DEFAULT false,
    "tieneLicencia" BOOLEAN NOT NULL DEFAULT false,
    "fechaExpedicionLicencia" DATE,
    "fechaExpiracionLicencia" DATE,
    "puesto" VARCHAR(120) NOT NULL,
    "fechaIngreso" DATE NOT NULL,
    "tipo" "TipoPersonal" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Personal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Personal_curp_key" ON "Personal"("curp");

-- CreateIndex
CREATE INDEX "Personal_apellidos_nombre_idx" ON "Personal"("apellidos", "nombre");

-- CreateIndex
CREATE INDEX "Personal_tipo_idx" ON "Personal"("tipo");

-- CreateIndex
CREATE INDEX "Personal_activo_idx" ON "Personal"("activo");
