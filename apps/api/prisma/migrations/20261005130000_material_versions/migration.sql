-- Material edition workflow (§8.4): pendingVersion stages the edition under review
-- while the live `version` stays untouched. Approve flips live; reject drops
-- the staged row and restores the previous state. Never silently replaced.
ALTER TABLE "Material" ADD COLUMN "pendingVersion" INTEGER;
