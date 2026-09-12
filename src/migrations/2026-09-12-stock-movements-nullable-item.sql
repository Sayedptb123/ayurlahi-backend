-- ADR-005 Step 3 — found while implementing InventoryService's cutover.
--
-- stock_movements.inventory_item_id is NOT NULL with a FK into the legacy
-- inventory_items table. Any item created after Step 3's cutover has no
-- corresponding legacy row, so recording its stock-movement ledger entry
-- is structurally impossible without either violating the authoritative-
-- source invariant (dual-writing a throwaway row into inventory_items
-- just to satisfy this FK) or the insert failing -- silently, since
-- recordMovement() is a best-effort method that swallows all errors.
--
-- Loosening this constraint, not repointing it: inventory_item_id keeps
-- meaning exactly what it always has (a legacy inventory_items row, when
-- one exists) and stays untouched for the 118 existing rows. A new item's
-- movements set inventory_item_id = NULL and rely on the already-added
-- branch_id column (2026-09-12-branch-inventory-schema.sql) instead. The
-- eventual full repoint to inventory_branch_stock_id remains deferred to
-- whichever step retires inventory_items entirely, per Step 2's
-- documented deferral -- this is not that; it only stops the ledger from
-- silently going dark for new items in the meantime.

BEGIN;

ALTER TABLE stock_movements ALTER COLUMN inventory_item_id DROP NOT NULL;

COMMIT;
