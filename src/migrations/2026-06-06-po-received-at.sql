-- ============================================================================
-- 2026-06-06-po-received-at
-- Purpose: Phase 24B.3 — capture when a purchase order was received, so
--          supplier lead-time can be measured. Idempotent.
-- ============================================================================
BEGIN;
ALTER TABLE "public"."purchase_orders"
  ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMP;
-- Backfill: existing 'received' POs get updated_at as a best-effort receipt time.
UPDATE "public"."purchase_orders"
   SET "received_at" = "updated_at"
 WHERE "status" = 'received' AND "received_at" IS NULL;
COMMIT;
