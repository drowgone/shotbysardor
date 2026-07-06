-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "ocrFindings" JSONB,
ADD COLUMN     "ocrLevel" TEXT,
ADD COLUMN     "ocrProcessedAt" TIMESTAMP(3),
ADD COLUMN     "ocrScore" INTEGER,
ADD COLUMN     "ocrText" TEXT;
