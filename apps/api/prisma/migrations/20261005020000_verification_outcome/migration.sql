-- VerificationRecord.status gets its own outcome enum (approved vs verified).
-- Table is empty at this point (no records seeded yet), so the cast is safe.
CREATE TYPE "VerificationOutcome" AS ENUM ('pending', 'approved', 'rejected', 'needsCorrection', 'suspended');
ALTER TABLE "VerificationRecord" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "VerificationRecord" ALTER COLUMN "status" TYPE "VerificationOutcome" USING "status"::text::"VerificationOutcome";
ALTER TABLE "VerificationRecord" ALTER COLUMN "status" SET DEFAULT 'pending';
