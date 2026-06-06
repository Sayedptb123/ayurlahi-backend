-- ============================================================================
-- 2026-06-06-stock-movements
-- Purpose: Phase 24C.1 — append-only ledger of inventory stock changes so
--          consumption / turnover / days-of-cover can be computed (groundwork
--          toward forecasting). Idempotent; safe to re-run.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organisation_id"    UUID NOT NULL REFERENCES "public"."organisations"("id") ON DELETE CASCADE,
  "inventory_item_id"  UUID NOT NULL REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE,
  -- initial | manual_adjustment | purchase_receipt | order_delivery | consumption
  "movement_type"      VARCHAR(30) NOT NULL,
  "quantity"           INTEGER NOT NULL,        -- signed delta (+in / -out)
  "balance_after"      INTEGER,                 -- current_stock after the change
  "unit_cost"          NUMERIC(12,2),           -- enables cost-price trend
  "reference_type"     VARCHAR(30),             -- purchase_order | order | manual
  "reference_id"       UUID,
  "note"               TEXT,
  "created_by"         UUID,
  "created_at"         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"         TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_stock_movements_item"
  ON "public"."stock_movements" ("inventory_item_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_stock_movements_org"
  ON "public"."stock_movements" ("organisation_id");

COMMIT;
