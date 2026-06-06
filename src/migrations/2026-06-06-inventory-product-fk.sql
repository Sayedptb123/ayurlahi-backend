-- ============================================================================
-- 2026-06-06-inventory-product-fk
-- Purpose: Phase 24A.0 — tighten inventory_items.product_id (the hook for the
--          low-stock → marketplace "Order Now" bridge) from an unconstrained
--          character varying to a real uuid FK -> products(id). Resolves
--          TRACKER T12. Idempotent; safe to re-run.
-- ============================================================================

BEGIN;

-- 1. Normalise empties to NULL so the type cast can't fail on ''.
UPDATE "public"."inventory_items" SET "product_id" = NULL
 WHERE "product_id" IS NOT NULL AND btrim("product_id") = '';

-- 2. Convert column type varchar -> uuid (all live values are NULL today).
ALTER TABLE "public"."inventory_items"
  ALTER COLUMN "product_id" TYPE uuid USING NULLIF(btrim("product_id"), '')::uuid;

-- 3. Add the FK. ON DELETE SET NULL: if a marketplace product is removed the
--    clinic's stock item simply unlinks (it still tracks stock on its own).
ALTER TABLE "public"."inventory_items"
  DROP CONSTRAINT IF EXISTS "inventory_items_product_fk";
ALTER TABLE "public"."inventory_items"
  ADD CONSTRAINT "inventory_items_product_fk"
  FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;

-- 4. Index for the bridge lookup (low-stock items by linked product).
CREATE INDEX IF NOT EXISTS "idx_inventory_items_product_id"
  ON "public"."inventory_items" ("product_id");

COMMIT;
