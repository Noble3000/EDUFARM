-- Library entitlement: grant states, edition snapshot, course link.
-- (Also carries the pending Material.version DEFAULT 0 alignment from schema.)

-- AlterEnum
ALTER TYPE "PurchaseStatus" ADD VALUE 'revoked';
ALTER TYPE "PurchaseStatus" ADD VALUE 'suspended';

-- AlterTable
ALTER TABLE "Material" ALTER COLUMN "version" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "accessType" TEXT NOT NULL DEFAULT 'purchase',
ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "versionGranted" INTEGER;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
