-- ADR-005 / Branch_Inventory_Implementation_Plan.md — Step 2 follow-up.
--
-- Question raised: for a genuinely single-location organisation that has
-- never added a branch (branches count = 0 -- NOT the same as "has exactly
-- one primary branch", which SAIFIS/CNS/PMS all already had before Step 2
-- ran), where does its inventory live in the new item-master/branch-stock
-- model? Confirmed live examples today: Anjala Ayur Home, Pms, sasa cli --
-- three approved CLINIC orgs with zero branches rows and zero inventory.
--
-- Answer: match the convention ADR-004 already established on every other
-- branch-scoped table in this codebase (patients, patient_bills,
-- admissions, room_bookings, orders) -- branch_id nullable, NULL means
-- "organisation-wide," not a new bespoke representation. This migration
-- was originally created with branch_id NOT NULL; loosening it now.
--
-- Does not touch any existing row: SAIFIS/CNS/PMS all have a real,
-- non-null branch_id from the Step 2 backfill and are unaffected.
-- Purely additive/dormant until a branch-less org's inventory is actually
-- migrated or created under the new model (Step 3+).

BEGIN;

ALTER TABLE inventory_branch_stock ALTER COLUMN branch_id DROP NOT NULL;

-- Postgres's existing UNIQUE(branch_id, item_master_id) does not dedupe
-- across multiple NULLs -- without this, a branch-less org could end up
-- with two "organisation-level" stock rows for the same item master.
CREATE UNIQUE INDEX inventory_branch_stock_org_level_uq
  ON inventory_branch_stock (item_master_id)
  WHERE branch_id IS NULL;

COMMIT;
