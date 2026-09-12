-- ADR-005 Step 3 — found while implementing InventoryService's cutover
-- (companion to 2026-09-12-stock-movements-nullable-item.sql).
--
-- Once inventory_item_id can be NULL for a movement against an item
-- created after cutover, stock_movements has no column left that
-- identifies WHICH item the movement is about -- branch_id names the
-- branch, but a branch has many items. Adding a direct reference to the
-- new model's stock row, additive and nullable: legacy movements
-- (inventory_item_id set) leave this NULL and keep working exactly as
-- before; movements recorded through the new InventoryService code path
-- populate this instead of inventory_item_id.

BEGIN;

ALTER TABLE stock_movements
  ADD COLUMN inventory_branch_stock_id uuid REFERENCES inventory_branch_stock(id);

COMMIT;
