-- Devotional provenance (§14): every entry records where it came from and
-- under what rights, so fallbacks are labeled and never fabricated.
ALTER TABLE "Devotional" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Devotional" ADD COLUMN "fetchedAt" TIMESTAMP(3);
ALTER TABLE "Devotional" ADD COLUMN "rightsNote" TEXT;
