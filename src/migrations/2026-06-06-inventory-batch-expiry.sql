-- ============================================================================
-- 2026-06-06-inventory-batch-expiry
-- Purpose: Phase 24C.2 — add batch_number + expiry_date to inventory_items so
--          dead/expired-stock can be tracked (resolves TRACKER T11). Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE "public"."inventory_items"
  ADD COLUMN IF NOT EXISTS "batch_number" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "expiry_date"  DATE;

CREATE INDEX IF NOT EXISTS "idx_inventory_items_expiry"
  ON "public"."inventory_items" ("expiry_date");

COMMIT;
