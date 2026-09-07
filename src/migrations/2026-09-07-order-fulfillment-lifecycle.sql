-- ============================================================================
-- 2026-09-07-order-fulfillment-lifecycle
-- Purpose: Step 1 (migration + entities) of the order fulfillment lifecycle
-- rework -- partial fulfillment, packing-stage billing with per-item
-- discount, mid-packing amendments, and post-delivery replacements. Full
-- design: scope/Order_Fulfillment_Lifecycle_Scope_2026-09-07.md (all
-- decisions locked as of that document's §10/§11/§18).
--
-- order_items.packed_quantity: the actual packed/supplied quantity --
-- authoritative for billing and clinic inventory credit. order_items.quantity
-- stays the immutable requested quantity (never overwritten). Locked in the
-- scope doc's §11 specifically because shipped_quantity/delivered_quantity
-- (both already present, added long before this) were confirmed dormant
-- (zero read/write sites anywhere in the monorepo) and are deliberately left
-- alone rather than repurposed -- they'll carry their own real, distinct
-- meanings (actual shipped / actual delivered) once that application code is
-- written, not this one.
--
-- discount_amount (order_items, orders, invoices): per-item discount entered
-- by the manufacturer's packing team, and the matching order-level/invoice-
-- level total summed across items for the bill breakdown. A flat amount, not
-- a percentage, for consistency with every other money column on these three
-- entities (unit_price, subtotal, gst_amount, total_amount, commission_amount
-- are all amounts) and so the order/invoice-level total is a direct sum with
-- no percentage-to-amount conversion step.
--
-- order_replacements: structured record for a post-delivery replacement
-- (missing/wrong/damaged item), always charge=0, referenced against the
-- original order -- never a new order or invoice. Deliberately NOT a
-- duplicate of the existing `disputes` table (case-tracking: free-text
-- description/resolution, evidence/comments jsonb, no quantity or product
-- reference at all) -- dispute_id is a nullable link back to a dispute row
-- when the clinic raised one, keeping the human-facing case and the
-- mechanical fulfillment record as two different shapes of data. No
-- @ManyToOne relation is declared in the entity for dispute_id specifically
-- to avoid a circular module import (disputes/entities already imports
-- Order from orders/entities) -- same plain-FK-by-convention style already
-- used throughout this codebase for organisation_id/cancelled_by/etc.
--
-- No PACKED status/enum value is added by this migration -- orders.status
-- and order_items.status are plain varchar(20) at the DB level (confirmed in
-- baseline-2026-05-31-supabase.sql), not a native Postgres enum, so adding
-- 'packed' needs no ALTER TYPE and no schema change at all. That's an
-- application-code-only change (TS enum + ORDER_TRANSITIONS), scoped
-- separately as Step 3.
-- ============================================================================

BEGIN;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS packed_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN order_items.packed_quantity IS 'Actual packed/supplied quantity for this line, recorded by the manufacturer during packing. Authoritative for billing and clinic inventory credit -- quantity (the requested amount) is never overwritten. 0 on every pre-existing row (predates partial fulfillment).';
COMMENT ON COLUMN order_items.discount_amount IS 'Per-item discount amount entered by the manufacturer''s packing team. Flat amount, not a percentage. Summed into orders.discount_amount / invoices.discount_amount for the bill breakdown total-discount line.';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN orders.discount_amount IS 'Sum of order_items.discount_amount across this order''s items -- the total-discount line shown on the bill breakdown.';

-- Note: unlike orders/order_items, the pre-existing `invoices` table uses
-- camelCase column names at the DB level (e.g. "totalAmount", "gstAmount") --
-- confirmed in baseline-2026-05-31-supabase.sql. Matching that existing
-- convention here (quoted, camelCase) rather than introducing a mixed-case
-- table, even though it diverges from the project's standard snake_case rule
-- for genuinely new tables (see order_replacements below, which is new and
-- correctly snake_case).
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS "discountAmount" numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN invoices."discountAmount" IS 'Snapshotted total discount at invoice-creation time, mirroring orders.discount_amount the same way every other invoice total is a snapshot rather than a live re-read of the order.';

CREATE TABLE IF NOT EXISTS order_replacements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisations(id),
  order_id         uuid NOT NULL REFERENCES orders(id),
  order_item_id    uuid NOT NULL REFERENCES order_items(id),
  dispute_id       uuid NULL REFERENCES disputes(id),
  quantity         integer NOT NULL,
  reason           varchar(20) NOT NULL,
  charge           numeric(12,2) NOT NULL DEFAULT 0,
  status           varchar(20) NOT NULL DEFAULT 'pending',
  created_by       uuid NULL REFERENCES users(id),
  resolved_at      timestamptz NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_order_replacements_organisation ON order_replacements (organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_order_replacements_order ON order_replacements (order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_order_replacements_dispute ON order_replacements (dispute_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE order_replacements IS 'Structured post-delivery replacement record (missing/wrong/damaged item) -- always charge=0, shipped against the original order, never a new order/invoice. Distinct from disputes (free-text case tracking): dispute_id optionally links back to the human-facing case. organisation_id is the clinic''s org, same as order_id''s.';
COMMENT ON COLUMN order_replacements.reason IS 'missing | wrong | damaged';
COMMENT ON COLUMN order_replacements.status IS 'pending | shipped | resolved';
COMMENT ON COLUMN order_replacements.charge IS 'Always 0 today -- a manufacturer-side fulfillment correction, not a sale. Stored as a real column rather than assumed, for auditability.';

COMMIT;
