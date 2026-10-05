-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE 'suspended';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VerificationStatus" ADD VALUE 'needsCorrection';
ALTER TYPE "VerificationStatus" ADD VALUE 'suspended';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false;
