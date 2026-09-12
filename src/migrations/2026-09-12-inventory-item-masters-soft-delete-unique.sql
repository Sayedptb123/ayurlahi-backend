-- ADR-005 Step 3 — found via the acceptance-test verification script
-- (scripts/verify-step3-cutover.ts): inventory_item_masters uses soft
-- delete (deleted_at), but its UNIQUE(organisation_id, name) /
-- UNIQUE(organisation_id, sku) constraints from the original Step 2 DDL
-- are plain, unscoped unique constraints -- they apply to soft-deleted
-- rows too. A clinic that creates an item, deletes it, then later wants
-- to re-add an item with the same name (a discontinued product brought
-- back, or simply retrying after a mistaken delete) would be permanently
-- blocked, forever, since the deleted row still occupies the unique slot.
--
-- Replacing with partial unique indexes scoped to deleted_at IS NULL --
-- strictly widens what's allowed (soft-deleted rows no longer block reuse
-- of their name/sku), never narrows it. Doesn't touch any existing data;
-- all 115 current rows have deleted_at IS NULL already (verified, Step 2
-- reconciliation), so this is a no-op for them.

BEGIN;

ALTER TABLE inventory_item_masters DROP CONSTRAINT inventory_item_masters_organisation_id_name_key;
ALTER TABLE inventory_item_masters DROP CONSTRAINT inventory_item_masters_organisation_id_sku_key;

CREATE UNIQUE INDEX inventory_item_masters_org_name_uq
  ON inventory_item_masters (organisation_id, name)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX inventory_item_masters_org_sku_uq
  ON inventory_item_masters (organisation_id, sku)
  WHERE deleted_at IS NULL;

COMMIT;
