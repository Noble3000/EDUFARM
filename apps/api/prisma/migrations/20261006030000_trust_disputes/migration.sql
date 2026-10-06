-- Trust + disputes: edit history, moderation state, dispute lifecycle fields.
-- updatedAt backfills to now() for existing rows (Prisma maintains it after).

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "appealReason" TEXT,
ADD COLUMN     "appealStatus" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "assignedTo" TEXT,
ADD COLUMN     "evidence" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "slaDueAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ReviewReply" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "DisputeAction" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisputeAction_disputeId_idx" ON "DisputeAction"("disputeId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Dispute_assignedTo_idx" ON "Dispute"("assignedTo");

-- CreateIndex
CREATE INDEX "Review_materialId_status_idx" ON "Review"("materialId", "status");

-- AddForeignKey
ALTER TABLE "DisputeAction" ADD CONSTRAINT "DisputeAction_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
