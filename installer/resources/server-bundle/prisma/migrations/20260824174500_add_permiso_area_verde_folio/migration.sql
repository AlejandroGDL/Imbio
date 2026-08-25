-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "serieFolioAreaVerde" TEXT NOT NULL DEFAULT 'CC-AV',
ADD COLUMN     "siguienteFolioAreaVerde" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "AreaVerde" ADD COLUMN     "folioPermiso" TEXT,
ADD CONSTRAINT "AreaVerde_folioPermiso_key" UNIQUE ("folioPermiso");
