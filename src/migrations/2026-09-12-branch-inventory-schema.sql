-- ADR-005 / Branch_Inventory_Implementation_Plan.md — Step 2.
-- Schema + data migration ONLY. Creates the new item-master/branch-stock
-- tables and backfills them from the existing (pooled) inventory_items,
-- using the agreed rule: 100% of existing stock -> each org's primary
-- branch, every other branch starts at 0.
--
-- Deliberately DOES NOT touch inventory_items, stock_movements.inventory_item_id,
-- or purchase_order_items -- those stay exactly as they are, still being
-- read/written by the live InventoryService/PurchaseOrdersService. Renaming
-- inventory_items -> inventory_items_legacy or repointing
-- stock_movements.inventory_item_id (as the original plan's §2 steps 5/8
-- describe) would break those services immediately, since they are not
-- being updated in this step. That repoint/rename is deferred to the step
-- that actually cuts the service layer over to the new tables, so schema
-- and code are never out of sync. Until then, both the old table and the
-- new tables exist side by side; nothing in the app reads the new ones yet
-- -- zero user-facing change, exactly as intended for this step.
--
-- Pre-migration assertions (verified manually before running this file):
--   * every org with inventory_items has exactly one is_primary branch
--   * no org has more than one is_primary branch
--   * no duplicate (organisation_id, name) or (organisation_id, sku) among
--     non-deleted inventory_items (would violate the new UNIQUE constraints)
--   * inventory_items: 115 rows, 0 soft-deleted
--   * stock_movements: 118 rows, all inventory_item_id values resolve
--   * purchase_order_items: 1 row, item_id NULL (no FK to repoint)
--   * purchase_orders: 1 row (CNS)

BEGIN;

-- 1. New tables -------------------------------------------------------

CREATE TABLE inventory_item_masters (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name             varchar NOT NULL,
  sku              varchar,
  description      text,
  category         varchar,
  unit             varchar NOT NULL,
  unit_price       decimal(10,2),
  cost_price       decimal(10,2),
  hsn_code         varchar(20),
  gst_rate         decimal(5,2),
  product_id       uuid REFERENCES products(id) ON DELETE SET NULL,
  is_active        boolean DEFAULT true,
  -- Traceability only (not in the original plan DDL) -- which
  -- inventory_items row this master was backfilled from. Makes the
  -- "exactly one item master per existing item" reconciliation check exact
  -- rather than inferred from name/sku matching. NULL for any item master
  -- created after cutover (no legacy row to point at).
  legacy_item_id   uuid,
  created_at       timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at       timestamp DEFAULT CURRENT_TIMESTAMP,
  deleted_at       timestamp,
  UNIQUE (organisation_id, name),
  UNIQUE (organisation_id, sku)
);

CREATE TABLE inventory_branch_stock (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  branch_id        uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  item_master_id   uuid NOT NULL REFERENCES inventory_item_masters(id) ON DELETE CASCADE,
  current_stock    integer DEFAULT 0 CHECK (current_stock >= 0),
  min_stock_level  integer DEFAULT 10,
  batch_number     varchar(100),
  expiry_date      date,
  created_at       timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at       timestamp DEFAULT CURRENT_TIMESTAMP,
  deleted_at       timestamp,
  UNIQUE (branch_id, item_master_id)
);

-- 2. Additive branch_id columns on existing tables (nullable, no rename,
--    no FK repoint -- orders.branch_id already exists from Step 1) --------

ALTER TABLE stock_movements ADD COLUMN branch_id uuid REFERENCES branches(id);
ALTER TABLE purchase_orders ADD COLUMN branch_id uuid REFERENCES branches(id);

-- 3. Backfill inventory_item_masters -- 1:1 from inventory_items, verbatim,
--    including any soft-deleted rows (none exist today, but the rule holds
--    generally: nothing about this backfill un-deletes anything). ---------

INSERT INTO inventory_item_masters (
  organisation_id, name, sku, description, category, unit, unit_price,
  cost_price, hsn_code, gst_rate, product_id, is_active, legacy_item_id,
  created_at, updated_at, deleted_at
)
SELECT
  organisation_id, name, sku, description, category, unit, unit_price,
  cost_price, hsn_code, gst_rate, product_id, is_active, id,
  created_at, updated_at, deleted_at
FROM inventory_items;

-- 4. Backfill inventory_branch_stock -- one row per item master just
--    created, allocated 100% to that org's primary branch. -------------

INSERT INTO inventory_branch_stock (
  organisation_id, branch_id, item_master_id, current_stock, min_stock_level,
  batch_number, expiry_date, created_at, updated_at, deleted_at
)
SELECT
  im.organisation_id, b.id, im.id, ii.current_stock, ii.min_stock_level,
  ii.batch_number, ii.expiry_date, im.created_at, im.updated_at, im.deleted_at
FROM inventory_item_masters im
JOIN inventory_items ii ON ii.id = im.legacy_item_id
JOIN branches b ON b.organisation_id = im.organisation_id
  AND b.is_primary = true AND b.deleted_at IS NULL;

-- 5. Backfill stock_movements.branch_id -- additive only; inventory_item_id
--    itself is untouched, still points at inventory_items. --------------

UPDATE stock_movements sm
SET branch_id = ibs.branch_id
FROM inventory_item_masters im
JOIN inventory_branch_stock ibs ON ibs.item_master_id = im.id
WHERE im.legacy_item_id = sm.inventory_item_id;

-- 6. Backfill purchase_orders.branch_id -- primary-branch rule, same as
--    stock (only 1 existing PO, CNS). purchase_order_items.item_id is left
--    untouched (still points at inventory_items; the single existing row
--    has item_id NULL anyway). -------------------------------------------

UPDATE purchase_orders po
SET branch_id = b.id
FROM branches b
WHERE b.organisation_id = po.organisation_id
  AND b.is_primary = true AND b.deleted_at IS NULL;

-- orders.branch_id: untouched here, added in the prior migration
-- (2026-09-12-orders-branch-id.sql) and deliberately left NULL for all
-- pre-existing rows -- no equivalent honest "assign to primary" default
-- exists for a historical order the way it does for a stock quantity.

-- inventory_items: NOT renamed to inventory_items_legacy in this step --
-- see header comment. Still the live table for InventoryService.

COMMIT;
