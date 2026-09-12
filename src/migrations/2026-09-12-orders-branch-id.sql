-- ADR-005 (scope/ADR-005-branch-scoped-inventory.md) — first controlled
-- step of the branch-inventory implementation plan (scope/Branch_
-- Inventory_Implementation_Plan.md §6). Purely additive: adds branch_id
-- to orders so new orders start capturing which branch they belong to,
-- from the shipping-branch context CreateOrderScreen already has.
--
-- Deliberately NOT backfilled for existing orders — a delivered
-- historical order's real branch is genuinely unknown, and asserting a
-- default (e.g. primary branch) here would be a stronger, less honest
-- claim than the stock-quantity backfill's "assign to primary" rule,
-- which at least has an explicit, stated convention behind it. Existing
-- orders already have their real historical record in shipping_address.
--
-- Nothing yet reads this column (InventoryService.addStock() is not
-- wired to it in this migration) — see the Implementation Plan's phased
-- rollout order for why that's deliberately deferred until the inventory
-- schema migration itself has run and been verified.

ALTER TABLE orders ADD COLUMN branch_id uuid REFERENCES branches(id);

-- Not NOT NULL: existing rows must stay NULL (see above), and the
-- service layer enforces "required for new orders" at the DTO/create()
-- level rather than the DB level, consistent with how shipping_address's
-- own sub-fields are handled today.
