CREATE TABLE IF NOT EXISTS "ImportFile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "originalName" TEXT NOT NULL,
  "storedName" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Calculation" ADD COLUMN "importFileId" TEXT;
ALTER TABLE "Calculation" ADD COLUMN "sourceRowNumber" INTEGER;

CREATE INDEX IF NOT EXISTS "Calculation_importFileId_idx" ON "Calculation"("importFileId");
CREATE INDEX IF NOT EXISTS "ImportFile_createdAt_id_idx" ON "ImportFile"("createdAt", "id");
