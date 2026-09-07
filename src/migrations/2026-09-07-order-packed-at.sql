-- ============================================================================
-- 2026-09-07-order-packed-at
-- Purpose: Step 4 (billing relocation + discount math) of the order
-- fulfillment lifecycle rework. Full design:
-- scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md §7.
--
-- orders.packed_at: set on first entry to PACKED, guarding invoice creation
-- the same way !deliveredAt used to (one invoice per order, never
-- re-created on a repeated status update) -- mirrors the existing
-- confirmed_at/shipped_at/delivered_at/cancelled_at pattern exactly.
-- ============================================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS packed_at timestamp NULL;

COMMENT ON COLUMN orders.packed_at IS 'Set on first entry to PACKED. Guards invoice creation against being re-run on a repeated status update, same pattern as confirmed_at/shipped_at/delivered_at/cancelled_at.';

COMMIT;
