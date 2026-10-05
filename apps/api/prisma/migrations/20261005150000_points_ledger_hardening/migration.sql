-- Points ledger hardening (§12, financial-adjacent): every award carries
-- source reference + rule version; idempotency keys unique per student so
-- concurrent/duplicate awards collapse to one row at the database level.
-- Step 1: disambiguate pre-existing duplicate keys (dev E2E data).
UPDATE "PointLedger" p SET "capKey" = p."capKey" || ':kept:' || p."id"
WHERE p."id" IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY "studentId", "capKey" ORDER BY "createdAt", id) AS rn
    FROM "PointLedger" WHERE "capKey" IS NOT NULL
  ) d WHERE d.rn > 1
);
-- Step 2: provenance columns.
ALTER TABLE "PointLedger" ADD COLUMN "sourceRef" TEXT;
ALTER TABLE "PointLedger" ADD COLUMN "ruleVersion" TEXT NOT NULL DEFAULT 'v1';
-- Step 3: idempotency guard (NULL keys — manual adjustments — stay unrestricted).
ALTER TABLE "PointLedger" ADD CONSTRAINT "PointLedger_studentId_capKey_key" UNIQUE ("studentId", "capKey");
