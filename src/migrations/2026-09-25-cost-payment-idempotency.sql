-- Cash MVP batch 2 (recurring-bill payments, asset maintenance): a
-- double-submitted payment or maintenance log must not create a second row,
-- and so a second voucher. One key per form submit, unique per bill / asset.
-- Additive: nullable columns + partial unique indexes.
--
-- Rollback: DROP INDEX IF EXISTS uq_bill_payments_idem, uq_asset_maintenance_idem;
--           ALTER TABLE bill_payments DROP COLUMN IF EXISTS idempotency_key;
--           ALTER TABLE asset_maintenance DROP COLUMN IF EXISTS idempotency_key;

BEGIN;

ALTER TABLE bill_payments ADD COLUMN idempotency_key UUID NULL;
CREATE UNIQUE INDEX uq_bill_payments_idem
  ON bill_payments (recurring_bill_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE asset_maintenance ADD COLUMN idempotency_key UUID NULL;
CREATE UNIQUE INDEX uq_asset_maintenance_idem
  ON asset_maintenance (asset_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

COMMIT;
