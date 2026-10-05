-- Settlement periods (§13.3): runs group matured entries into batches; pay
-- settles exactly one batch. Ledger rows are never edited in place.
CREATE TABLE "SettlementBatch" (
    "id" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reference" TEXT,
    "totalGrossKobo" INTEGER NOT NULL DEFAULT 0,
    "totalLecturerKobo" INTEGER NOT NULL DEFAULT 0,
    "totalPlatformKobo" INTEGER NOT NULL DEFAULT 0,
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SettlementBatch_idempotencyKey_key" ON "SettlementBatch"("idempotencyKey");
ALTER TABLE "ESpeesLedger" ADD COLUMN "settlementBatchId" TEXT;
ALTER TABLE "ESpeesLedger" ADD CONSTRAINT "ESpeesLedger_settlementBatchId_fkey" FOREIGN KEY ("settlementBatchId") REFERENCES "SettlementBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
