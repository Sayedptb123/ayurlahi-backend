-- ============================================================================
-- 2026-09-07-order-item-reserved-quantity
-- Purpose: Step 2 (reservation change) of the order fulfillment lifecycle
-- rework. Full design: scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md.
--
-- order_items.reserved_quantity: what was actually committed against
-- products.stockQuantity at reservation time, capped to whatever was
-- available (down to 0) rather than the order being rejected outright when
-- stock is short. This is a genuinely new persisted field that the scope
-- doc's §11 explicitly anticipated might be needed once implementation
-- proved it out ("if that need emerges during implementation ... it's a new,
-- small, additive column at that point") -- and it did: order cancellation
-- must restore exactly what was reserved, not the clinic's original
-- requested quantity, and there is no way to recompute "what was reserved"
-- after the fact once other orders have moved stockQuantity around. Without
-- this column, a cancelled short-supplied order would over-credit
-- products.stockQuantity by the shortfall it never actually held.
--
-- Backfill: every existing row predates this reservation model, in which
-- insufficient stock always rejected the whole order rather than reserving a
-- partial amount -- so for every pre-existing row, the full requested
-- `quantity` genuinely was what got reserved. Backfilling to `quantity`
-- (not 0) is the only value consistent with how those rows actually came to
-- exist; 0 would incorrectly make every historical order look like nothing
-- was ever reserved for it.
--
-- Deliberately NOT introduced: this is not `packed_quantity` (added in the
-- prior migration, 2026-09-07-order-fulfillment-lifecycle.sql) and is not
-- conflated with it -- reservation is an inventory commitment made at
-- accept-time; packing is a later, separate, authoritative fact for billing
-- that can itself land lower than what was reserved.
-- ============================================================================

BEGIN;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS reserved_quantity integer;

UPDATE order_items SET reserved_quantity = quantity WHERE reserved_quantity IS NULL;

ALTER TABLE order_items
  ALTER COLUMN reserved_quantity SET NOT NULL;

COMMENT ON COLUMN order_items.reserved_quantity IS 'What was actually committed against products.stockQuantity at reservation time -- capped to available stock (can be less than quantity, down to 0). Used to restore the correct amount to products.stockQuantity on cancellation, instead of quantity. Backfilled to quantity for every pre-existing row (all-or-nothing reservation was the only model before this column existed).';

COMMIT;
