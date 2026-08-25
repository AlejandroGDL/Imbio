-- Drop old event range columns
ALTER TABLE "Correspondencia" DROP COLUMN "fechaInicioEvento";
ALTER TABLE "Correspondencia" DROP COLUMN "fechaFinEvento";

-- Add new event dates array
ALTER TABLE "Correspondencia" ADD COLUMN "fechasEvento" TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[];

-- Replace old index with new one
DROP INDEX IF EXISTS "Correspondencia_asisteAEvento_fechaInicioEvento_idx";
CREATE INDEX "Correspondencia_asisteAEvento_idx" ON "Correspondencia"("asisteAEvento");
