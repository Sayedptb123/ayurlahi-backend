-- ADR-005 Step 3 — found while implementing PurchaseOrdersService's
-- cutover, same class of issue as the two stock_movements fixes today.
--
-- purchase_order_items.item_id has a FK into the legacy inventory_items
-- table. A new PO created after cutover, whose item picker resolves
-- against the new inventory_item_masters catalog, cannot store a master's
-- id there -- it would violate the FK (the id doesn't exist in
-- inventory_items). item_id is left untouched for the one existing PO
-- item (CNS, PO-414905, item_id already NULL); a new, additive, nullable
-- column is added for the new model instead of repointing/dropping the
-- legacy FK.

BEGIN;

ALTER TABLE purchase_order_items
  ADD COLUMN item_master_id uuid REFERENCES inventory_item_masters(id);

COMMIT;
